-- Role-based notifications: schema, RLS, helper RPCs.

do $$ begin
  create type public.notification_type as enum (
    'INVITE',
    'APPROVAL_REQUEST',
    'APPROVAL_RESULT',
    'SAMPLE_EVENT',
    'PROJECT_EVENT',
    'SYSTEM_ALERT',
    'ACCOUNT',
    'INFO'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.pending_request_type add value 'coResearcherInvite';
exception
  when duplicate_object then null;
  when invalid_parameter_value then null;
end $$;

create table if not exists public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'INFO',
  title text not null,
  description text default '',
  link_to text not null default '/dashboard',
  target_entity text,
  target_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, is_read);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_no_direct_insert" on public.notifications;
create policy "notifications_no_direct_insert"
  on public.notifications for insert
  to authenticated
  with check (false);

create or replace function public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_description text default '',
  p_link_to text default '/dashboard',
  p_target_entity text default null,
  p_target_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.notifications (
    user_id, type, title, description, link_to, target_entity, target_id
  ) values (
    p_user_id, p_type, p_title, coalesce(p_description, ''), coalesce(p_link_to, '/dashboard'), p_target_entity, p_target_id
  )
  returning notification_id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.create_notifications_for_role(
  p_role public.user_role,
  p_type public.notification_type,
  p_title text,
  p_description text default '',
  p_link_to text default '/dashboard',
  p_target_entity text default null,
  p_target_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.notifications (
    user_id, type, title, description, link_to, target_entity, target_id
  )
  select
    p.id,
    p_type,
    p_title,
    coalesce(p_description, ''),
    coalesce(p_link_to, '/dashboard'),
    p_target_entity,
    p_target_id
  from public.profiles p
  where p.role = p_role and p.status = 'Active';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.create_notification(uuid, public.notification_type, text, text, text, text, text) from public;
revoke all on function public.create_notifications_for_role(public.user_role, public.notification_type, text, text, text, text, text) from public;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, text, text, text) to authenticated;
grant execute on function public.create_notifications_for_role(public.user_role, public.notification_type, text, text, text, text, text) to authenticated;

grant select, update, delete on public.notifications to authenticated;
