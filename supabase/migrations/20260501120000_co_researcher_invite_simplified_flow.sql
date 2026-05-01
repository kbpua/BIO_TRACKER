-- Streamlined co-researcher invite flow
-- The Lead Researcher invites a Co-Researcher directly. The admin approval
-- gate has been removed; invitations go straight to the target researcher,
-- who can Accept or Decline. The Lead Researcher can also Cancel a pending
-- invitation, which removes it from the target researcher's view.
--
-- We add a 'Cancelled' status value to invite_status so the four states
-- (Pending, Accepted, Declined, Cancelled) are all representable, even
-- though the application currently DELETEs rows on accept/decline/cancel.

alter type public.invite_status add value if not exists 'Cancelled';
