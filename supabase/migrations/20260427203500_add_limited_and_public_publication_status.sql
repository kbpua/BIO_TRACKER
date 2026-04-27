-- Add new publication states:
-- - Draft
-- - Published (limited): visible to researchers/admins only
-- - Published (public): visible to researchers/admins/students
-- Keep backward compatibility by migrating legacy "Published" values to "Published (public)".

do $$ begin
  alter type public.publication_status add value if not exists 'Published (limited)';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.publication_status add value if not exists 'Published (public)';
exception when duplicate_object then null;
end $$;

update public.projects
set publication_status = 'Published (public)'::public.publication_status
where publication_status::text = 'Published';
