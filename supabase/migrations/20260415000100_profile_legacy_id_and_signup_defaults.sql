-- Ensure profile rows get legacy IDs and role/status defaults from signup metadata.
-- This migration keeps frontend IDs aligned with format: [ROLE]-[INITIALS]-[###].

create or replace function public.generate_profile_legacy_id(
  p_role public.user_role,
  p_full_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  role_code text;
  initials text := '';
  token text;
  next_inc integer;
begin
  role_code := case p_role
    when 'Admin' then 'ADM'
    when 'Researcher' then 'RES'
    when 'Student' then 'STU'
    else 'USR'
  end;

  for token in
    select regexp_split_to_table(coalesce(trim(p_full_name), ''), '\s+')
  loop
    if length(token) > 0 then
      initials := initials || upper(left(regexp_replace(token, '[^A-Za-z0-9].*$', ''), 1));
    end if;
  end loop;

  if initials = '' then
    initials := 'XX';
  end if;

  select coalesce(max((regexp_match(legacy_id, '-(\d+)$'))[1]::integer), 0) + 1
  into next_inc
  from public.profiles
  where legacy_id is not null;

  return role_code || '-' || initials || '-' || lpad(next_inc::text, 3, '0');
end;
$$;

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
begin
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

-- Backfill existing profiles that still show UUID-only IDs on the frontend.
do $$
declare
  row_record record;
begin
  for row_record in
    select id, role, full_name
    from public.profiles
    where legacy_id is null
    order by date_created asc, id asc
  loop
    update public.profiles
    set legacy_id = public.generate_profile_legacy_id(row_record.role, row_record.full_name)
    where id = row_record.id;
  end loop;
end $$;
