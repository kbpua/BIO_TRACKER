-- Google OAuth: defer profile row until in-app role selection; RPC for email/id
-- resolution under RLS; allow authenticated self-insert; admin notification copy.

-- ---------------------------------------------------------------------------
-- 1) Skip auto profile for OAuth (non-email): Google role chosen in the app
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

  -- Never auto-insert for SSO; only email/password (provider "email") uses this trigger.
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
-- 2) Resolve profile for the current JWT (bypasses RLS for email collision check)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_oauth_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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

  -- Avoid SELECT ... INTO <var>: Supabase SQL editor can treat the target as a relation name.
  prof := (
    select to_jsonb(p)
    from public.profiles p
    where p.id = uid
    limit 1
  );

  if prof is not null then
    return jsonb_build_object('kind', 'profile', 'profile', prof);
  end if;

  if em <> '' then
    other_id := (
      select p.id
      from public.profiles p
      where lower(trim(coalesce(p.email, ''))) = em
      limit 1
    );
    if other_id is not null and other_id is distinct from uid then
      return jsonb_build_object('kind', 'email_exists_other_account');
    end if;
  end if;

  return jsonb_build_object('kind', 'no_profile');
end;
$$;

alter function public.resolve_oauth_profile() owner to postgres;
grant execute on function public.resolve_oauth_profile() to authenticated;

grant execute on function public.generate_profile_legacy_id(public.user_role, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS: allow users to insert their own profile row (Google completion)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Admin notifications: clearer copy on profile INSERT
--    (Google-style wording when pending_days_remaining is set — Google + aligned flows)
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins_profile_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_days_txt text := '';
  ins_title text;
  ins_description text;
begin
  if tg_op = 'INSERT' then
    if new.role = 'Researcher'::public.user_role
       and new.status = 'Pending'::public.account_status then
      ins_title := 'New Researcher Registration';
      ins_description := new.full_name || ' registered as a Researcher. Awaiting admin approval.';
    elsif new.role = 'Student'::public.user_role
          and new.status = 'Active'::public.account_status then
      ins_title := 'New Student Registration';
      ins_description := new.full_name || ' registered as a Student. Account auto-activated.';
    else
      ins_title := 'New Account Registration';
      ins_description := new.full_name || ' registered as ' || new.role::text || '. Status: ' || new.status::text || '.';
    end if;

    insert into public.notifications (user_id, type, title, description, link_to, target_entity, target_id)
    select
      p.id,
      'ACCOUNT'::public.notification_type,
      ins_title,
      ins_description,
      '/users',
      'user',
      new.id::text
    from public.profiles p
    where p.role = 'Admin'::public.user_role
      and p.status = 'Active'::public.account_status;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role = 'Researcher'::public.user_role
       and new.status = 'Pending'::public.account_status
       and not (old.role = 'Researcher'::public.user_role and old.status = 'Pending'::public.account_status) then
      if new.pending_days_remaining is not null then
        pending_days_txt := ' ' || new.pending_days_remaining::text || ' days remaining.';
      end if;

      insert into public.notifications (user_id, type, title, description, link_to, target_entity, target_id)
      select
        p.id,
        'APPROVAL_REQUEST'::public.notification_type,
        'Pending Researcher Approval',
        new.full_name || ' is awaiting approval.' || pending_days_txt,
        '/users',
        'user',
        new.id::text
      from public.profiles p
      where p.role = 'Admin'::public.user_role
        and p.status = 'Active'::public.account_status;
    end if;
    return new;
  end if;

  return new;
end;
$$;

alter function public.notify_admins_profile_events() owner to postgres;
