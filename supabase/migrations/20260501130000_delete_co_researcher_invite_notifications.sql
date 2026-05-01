-- Allow cleanup of an invitee's pending INVITE notifications when their
-- co-researcher invitation is cancelled by the lead researcher, or
-- accepted/declined by the invitee themselves. Without this, the invitee's
-- bell fills up with stale invite notifications after every cancel/re-invite
-- cycle.
--
-- The function only ever deletes rows where:
--   type           = 'INVITE'
--   target_entity  = 'project'
--   target_id      = the given project id
--   user_id        = the given recipient
-- so it cannot be abused to clear out arbitrary notifications of other types.
--
-- Authorization mirrors the existing trust model for co_researcher_invites
-- (any active user). Anonymous callers are rejected.

create or replace function public.delete_co_researcher_invite_notifications(
  p_user_id uuid,
  p_project_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_active_user() then
    raise exception 'Not authorized';
  end if;

  delete from public.notifications
  where user_id = p_user_id
    and type = 'INVITE'
    and target_entity = 'project'
    and target_id = p_project_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.delete_co_researcher_invite_notifications(uuid, text) from public;
grant execute on function public.delete_co_researcher_invite_notifications(uuid, text) to authenticated;
