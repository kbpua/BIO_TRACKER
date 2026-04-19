-- Fix: stale profiles rows (no matching auth.users) after admin deletes a user
-- could still match by email and block or confuse Google re-signup.
-- handle_new_user: never auto-insert profiles for OAuth (non-email); Google
-- roles are chosen in the app — avoids default Student rows from the trigger.

-- ---------------------------------------------------------------------------
-- 1) handle_new_user — skip auto profile for OAuth; email-only uses metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_role public.user_role;
  desired_status public.account_status;
  desired_name text;
  primary_provider text := lower(trim(coalesce(new.raw_app_meta_data->>'provider', '')));
  v_has_google boolean;
  iss_lower text := lower(trim(coalesce(
    new.raw_user_meta_data->>'iss',
    new.raw_app_meta_data->>'iss',
    ''
  )));
begin
  v_has_google := exists (
    select 1
    from jsonb_array_elements_text(coalesce(new.raw_app_meta_data->'providers', '[]'::jsonb)) as t(v)
    where lower(trim(t.v)) = 'google'
  );

  if not v_has_google and iss_lower <> '' then
    v_has_google := position('accounts.google.com' in iss_lower) > 0
      or position('googleusercontent.com' in iss_lower) > 0;
  end if;

  -- Google markers with empty provider string, or any non-email SSO (never default Student here).
  if v_has_google or (primary_provider <> '' and primary_provider <> 'email') then
    return new;
  end if;

  desired_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  desired_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'Student'::public.user_role);
  desired_status := coalesce((new.raw_user_meta_data->>'status')::public.account_status, 'Pending'::public.account_status);

  insert into public.profiles (id, legacy_id, email, full_name, role, status, created_by)
  values (
    new.id,
    public.generate_profile_legacy_id(desired_role, desired_name),
    new.email,
    desired_name,
    desired_role,
    desired_status,
    coalesce(new.raw_user_meta_data->>'created_by', 'Self')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) resolve_oauth_profile — remove orphan profiles for this email, then resolve
-- ---------------------------------------------------------------------------
-- Must be VOLATILE (not STABLE) because the function does a DELETE
-- (orphan cleanup). STABLE/IMMUTABLE functions cannot perform DML.
create or replace function public.resolve_oauth_profile()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  em text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  prof jsonb;
  other_id uuid;
begin
  if uid is null then
    return jsonb_build_object('kind', 'no_session');
  end if;

  -- Remove stale profile rows left when auth.users was deleted (no CASCADE / manual DB ops).
  if em <> '' then
    delete from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = em
      and not exists (select 1 from auth.users au where au.id = p.id);
  end if;

  prof := (
    select to_jsonb(p)
    from public.profiles p
    where p.id = uid
    limit 1
  );

  if prof is not null then
    return jsonb_build_object('kind', 'profile', 'profile', prof);
  end if;

  -- Only treat as "email taken" if another *live* auth user already owns this email.
  if em <> '' then
    other_id := (
      select p.id
      from public.profiles p
      inner join auth.users au on au.id = p.id
      where lower(trim(coalesce(p.email, ''))) = em
        and p.id is distinct from uid
      limit 1
    );
    if other_id is not null then
      return jsonb_build_object('kind', 'email_exists_other_account');
    end if;
  end if;

  return jsonb_build_object('kind', 'no_profile');
end;
$$;

alter function public.resolve_oauth_profile() owner to postgres;
