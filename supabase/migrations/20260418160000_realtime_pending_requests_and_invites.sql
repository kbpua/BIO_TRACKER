-- Broadcast pending_requests / co_researcher_invites changes so other clients receive
-- postgres_changes and run refreshInvitesAndRequests (see DataContext).

do $$
begin
  alter publication supabase_realtime add table public.pending_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.co_researcher_invites;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.pending_requests replica identity full;
alter table public.co_researcher_invites replica identity full;
