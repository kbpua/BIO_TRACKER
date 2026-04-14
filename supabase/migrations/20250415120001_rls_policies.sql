-- Row Level Security — starter policies for BioSample Tracker
-- Tighten these per your course requirements (e.g. students: only published projects).
-- Never expose the service_role key in the browser.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'Admin' from public.profiles p where p.id = auth.uid() and p.status = 'Active'),
    false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'Active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organisms enable row level security;
alter table public.projects enable row level security;
alter table public.samples enable row level security;
alter table public.activity_log enable row level security;
alter table public.pending_requests enable row level security;
alter table public.co_researcher_invites enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- MVP: any active logged-in user can read/write domain tables
-- Replace with stricter rules (e.g. lead/co-researcher on project) before production.
-- ---------------------------------------------------------------------------
drop policy if exists "organisms_all_active" on public.organisms;
create policy "organisms_all_active"
  on public.organisms for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "projects_all_active" on public.projects;
create policy "projects_all_active"
  on public.projects for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "samples_all_active" on public.samples;
create policy "samples_all_active"
  on public.samples for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "activity_all_active" on public.activity_log;
create policy "activity_all_active"
  on public.activity_log for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "pending_requests_all_active" on public.pending_requests;
create policy "pending_requests_all_active"
  on public.pending_requests for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "invites_all_active" on public.co_researcher_invites;
create policy "invites_all_active"
  on public.co_researcher_invites for all
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- Grants (Supabase: authenticated role must be able to reach tables)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.organisms to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.samples to authenticated;
grant select, insert, update, delete on public.activity_log to authenticated;
grant select, insert, update, delete on public.pending_requests to authenticated;
grant select, insert, update, delete on public.co_researcher_invites to authenticated;
