-- Link co-researcher invites to the invitee's profile so the UI can match pending
-- invites reliably (display strings can differ slightly from session full_name).

alter table public.co_researcher_invites
  add column if not exists invited_to_user_id uuid references public.profiles (id) on delete set null;

create index if not exists co_invites_invited_to_user_id_idx
  on public.co_researcher_invites (invited_to_user_id)
  where invited_to_user_id is not null;

comment on column public.co_researcher_invites.invited_to_user_id is
  'profiles.id of the invited user; used for matching invites in the app.';
