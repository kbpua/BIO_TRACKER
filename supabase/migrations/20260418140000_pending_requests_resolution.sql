-- Keep co-researcher admin requests after decision so the requester can see Approved / Rejected on project details.

alter table public.pending_requests add column if not exists resolved_at timestamptz;
alter table public.pending_requests add column if not exists resolution text;

comment on column public.pending_requests.resolved_at is 'When an admin approved or rejected this request (co-researcher flow).';
comment on column public.pending_requests.resolution is 'approved | rejected for resolved co-researcher requests; null while pending.';
