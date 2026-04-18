-- Fix: notifications RLS previously blocked ALL inserts (including RPCs), so admin
-- alerts never appeared. Allow self-inserts for authenticated users; ensure RPC
-- functions run as postgres (superuser) so cross-user inserts bypass RLS.
-- Also add a SECURITY DEFINER trigger so admin alerts fire from DB on signup/profile changes.

-- ---------------------------------------------------------------------------
-- RLS: replace blanket deny with "own row only" for authenticated inserts
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_no_direct_insert" on public.notifications;
drop policy if exists "notifications_insert_own_only" on public.notifications;

create policy "notifications_insert_own_only"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs: owned by postgres so SECURITY DEFINER inserts bypass RLS for admins
-- ---------------------------------------------------------------------------
alter function public.create_notification(uuid, public.notification_type, text, text, text, text, text) owner to postgres;
alter function public.create_notifications_for_role(public.user_role, public.notification_type, text, text, text, text, text) owner to postgres;

-- ---------------------------------------------------------------------------
-- Trigger: notify Active admins when a profile is created or becomes Pending Researcher
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins_profile_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_days_txt text := '';
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, description, link_to, target_entity, target_id)
    select
      p.id,
      'ACCOUNT'::public.notification_type,
      'New Account Registration',
      new.full_name || ' registered as ' || new.role::text || '. Status: ' || new.status::text || '.',
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

drop trigger if exists trg_profiles_notify_admins on public.profiles;
create trigger trg_profiles_notify_admins
  after insert or update of role, status on public.profiles
  for each row
  execute function public.notify_admins_profile_events();
