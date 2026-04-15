-- Allow Admin users to delete an Auth account (auth.users) safely from the app.
-- This function is SECURITY DEFINER and checks admin status internally.

create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requester_id uuid := auth.uid();
begin
  if requester_id is null then
    return false;
  end if;

  -- Only active admins can delete users.
  if not public.is_admin() then
    return false;
  end if;

  -- Prevent deleting yourself from the admin UI.
  if requester_id = target_user_id then
    return false;
  end if;

  delete from auth.users
  where id = target_user_id;

  return found;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
