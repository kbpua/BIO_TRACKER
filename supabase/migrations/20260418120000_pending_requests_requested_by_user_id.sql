-- Stable link from pending_requests to the requesting profile so approval/rejection
-- notifications can use auth user id (avoids name-only lookup failures).

alter table public.pending_requests
  add column if not exists requested_by_user_id uuid references public.profiles (id) on delete set null;

create index if not exists pending_requests_requested_by_user_id_idx
  on public.pending_requests (requested_by_user_id)
  where requested_by_user_id is not null;

comment on column public.pending_requests.requested_by_user_id is
  'profiles.id of the user who submitted the request; used for reliable notifications.';
