-- Allow active Researchers and Admins to read other active Researcher/Admin profiles
-- (id, names, email) so the app can resolve co-researcher invite targets from a researcher session.
-- Students are excluded by the caller-role guard. Complements profiles_select_own_or_admin (OR).

create policy "profiles_select_active_peer_directory"
  on public.profiles for select
  to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.status = 'Active'
        and me.role in ('Researcher', 'Admin')
    )
    and status = 'Active'
    and role in ('Researcher', 'Admin')
  );
