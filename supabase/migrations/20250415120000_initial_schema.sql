-- BioSample Tracker — initial schema for Supabase (PostgreSQL)
-- Run via Supabase SQL Editor, or: supabase db push (if using Supabase CLI)
-- After migration: Authentication → Providers (enable Email); add Netlify URL to Auth URL config.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (optional; keeps data aligned with the React app)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('Admin', 'Researcher', 'Student');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('Active', 'Pending', 'Deactivated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sample_status as enum ('Active', 'Used', 'Expired', 'Contaminated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('Active', 'Completed', 'On Hold');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publication_status as enum ('Draft', 'Published');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pending_request_type as enum ('add', 'edit', 'delete', 'export');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invite_status as enum ('Pending', 'Accepted', 'Declined');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users — app user identity + role)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  legacy_id text unique,
  email text,
  full_name text not null,
  role public.user_role not null default 'Student',
  status public.account_status not null default 'Pending',
  date_created date not null default (timezone('utc', now()))::date,
  created_by text,
  pending_days_remaining integer,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- Organisms, projects, samples (string IDs match existing mock conventions)
-- ---------------------------------------------------------------------------
create table if not exists public.organisms (
  id text primary key,
  scientific_name text not null,
  common_name text,
  taxonomy_id text,
  kingdom text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text,
  start_date date,
  end_date date,
  lead_researcher text not null,
  co_researchers text[] not null default '{}',
  status public.project_status not null default 'Active',
  publication_status public.publication_status not null default 'Draft',
  approved_exporters text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.samples (
  id text primary key,
  sample_id text not null,
  sample_name text,
  disease text,
  organism_id text references public.organisms (id),
  project_id text not null references public.projects (id) on delete restrict,
  sample_type text not null,
  tissue_source text,
  study_purpose text,
  collection_date date,
  collected_by text,
  storage_location text,
  status public.sample_status not null default 'Active',
  notes text default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists samples_project_id_idx on public.samples (project_id);
create index if not exists samples_organism_id_idx on public.samples (organism_id);
create index if not exists samples_status_idx on public.samples (status);

-- ---------------------------------------------------------------------------
-- Activity feed (store timestamps; UI can format "time ago" client-side)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Pending requests (edit/delete/export/add — flexible JSON payloads)
-- ---------------------------------------------------------------------------
create table if not exists public.pending_requests (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  type public.pending_request_type not null,
  requested_by text not null,
  sample_record_id text references public.samples (id) on delete set null,
  sample_id text,
  submitted_at timestamptz not null default timezone('utc', now()),
  reason text,
  changes jsonb,
  proposed_updates jsonb,
  proposed_sample jsonb
);

create index if not exists pending_requests_project_idx on public.pending_requests (project_id);

-- ---------------------------------------------------------------------------
-- Co-researcher invites
-- ---------------------------------------------------------------------------
create table if not exists public.co_researcher_invites (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  invited_by text not null,
  invited_to text not null,
  status public.invite_status not null default 'Pending',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists co_invites_project_idx on public.co_researcher_invites (project_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (role/status adjustable by admin later)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status, created_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'Student'::public.user_role,
    'Pending'::public.account_status,
    coalesce(new.raw_user_meta_data->>'created_by', 'Self')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when auth email changes
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email, updated_at = timezone('utc', now())
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_updated();
