-- Proud Email OS: initial schema
-- Tables, enums, RLS policies, and a JWT role-claim hook.
-- Apply via Supabase SQL editor or `supabase db push` once the project is linked.

----------------------------------------------------------------------
-- Extensions
----------------------------------------------------------------------
create extension if not exists "pgcrypto";

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'strategist', 'designer', 'viewer', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type brand_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scrape_status as enum ('pending', 'running', 'done', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('pending_review', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type knowledge_source as enum (
    'scraped_website', 'uploaded_file', 'inbound_email',
    'manual_note', 'brand_guide', 'strategy_doc',
    'meeting_notes', 'campaign_debrief'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status as enum (
    'draft', 'generating', 'pending_review',
    'calendar_approved', 'copy_generating', 'copy_done',
    'briefs_done', 'complete', 'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_format as enum ('text', 'designed', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stage_status as enum ('pending', 'generating', 'done', 'needs_review', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type klaviyo_data_type as enum ('flows', 'campaigns', 'metrics');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recommendation_type as enum ('flow_gap', 'ab_test', 'improvement', 'next_step');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recommendation_priority as enum ('high', 'medium', 'low');
exception when duplicate_object then null; end $$;

----------------------------------------------------------------------
-- Users (mirrors auth.users, adds role + display name)
----------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- Brands
----------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website_url text,
  industry text,
  contact_name text,
  contact_email text,
  klaviyo_api_key text,
  klaviyo_account_name text,
  inbox_alias text unique,
  primary_color text,
  secondary_color text,
  font_heading text,
  font_body text,
  logo_url text,
  tone_of_voice text,
  target_audience text,
  prefer_brand_over_strategy boolean not null default false,
  auto_ingest_forwarded_emails boolean not null default true,
  scrape_status scrape_status not null default 'pending',
  digital_lead_id uuid references public.users(id) on delete set null,
  designer_id uuid references public.users(id) on delete set null,
  status brand_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

create index if not exists brand_members_user_idx on public.brand_members(user_id);

----------------------------------------------------------------------
-- Proud Strategy (org-wide living document)
----------------------------------------------------------------------
create table if not exists public.proud_strategy_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text not null,
  body text,
  position integer not null default 0,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proud_strategy_revisions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.proud_strategy_sections(id) on delete cascade,
  body text,
  edited_by_user_id uuid references public.users(id) on delete set null,
  edited_at timestamptz not null default now()
);

----------------------------------------------------------------------
-- Knowledge bank
----------------------------------------------------------------------
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  source_type knowledge_source not null,
  title text not null,
  content text,
  file_url text,
  source_url text,
  email_from text,
  email_subject text,
  email_received_at timestamptz,
  review_status review_status not null default 'approved',
  added_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_items_brand_idx on public.knowledge_items(brand_id);
create index if not exists knowledge_items_review_idx on public.knowledge_items(review_status);

----------------------------------------------------------------------
-- Campaigns
----------------------------------------------------------------------
create table if not exists public.campaign_plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  month integer not null,
  year integer not null,
  team_brief text,
  strategic_rationale text,
  target_designed_count integer,
  target_text_count integer,
  target_sms_count integer,
  status plan_status not null default 'draft',
  approved_by_user_id uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, month, year)
);

create table if not exists public.campaign_series (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_plans(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  theme text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_emails (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_plans(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  series_id uuid references public.campaign_series(id) on delete set null,
  sequence_number integer not null,
  scheduled_date date,
  theme text,
  email_type text,
  format email_format not null default 'designed',
  target_segment text,
  strategic_rationale text,
  subject_line text,
  preview_text text,
  body_headline text,
  body_copy text,
  cta_text text,
  cta_url text,
  sender_identity text,
  sms_body text,
  layout_template text,
  design_brief text,
  imagery_notes text,
  colour_notes text,
  asana_task_id text,
  asana_task_url text,
  asana_exported_at timestamptz,
  copy_status stage_status not null default 'pending',
  brief_status stage_status not null default 'pending',
  regeneration_feedback jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaign_emails_plan_idx on public.campaign_emails(plan_id);
create index if not exists campaign_emails_brand_idx on public.campaign_emails(brand_id);

----------------------------------------------------------------------
-- Klaviyo + EOM
----------------------------------------------------------------------
create table if not exists public.klaviyo_cache (
  brand_id uuid not null references public.brands(id) on delete cascade,
  data_type klaviyo_data_type not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (brand_id, data_type)
);

create table if not exists public.klaviyo_recommendations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  type recommendation_type not null,
  priority recommendation_priority not null default 'medium',
  title text not null,
  description text,
  actionable_steps text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.eom_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  month integer not null,
  year integer not null,
  metrics_snapshot jsonb,
  report_content text,
  key_wins text,
  key_issues text,
  next_month_recommendations text,
  status stage_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, month, year)
);

----------------------------------------------------------------------
-- Client approval (Phase 2B)
----------------------------------------------------------------------
create table if not exists public.approval_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  plan_id uuid references public.campaign_plans(id) on delete cascade,
  campaign_email_id uuid references public.campaign_emails(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_link_id uuid not null references public.approval_links(id) on delete cascade,
  campaign_email_id uuid references public.campaign_emails(id) on delete cascade,
  action text not null,           -- approve | request_changes | comment
  comment text,
  acted_at timestamptz not null default now(),
  client_ip text,
  client_user_agent text
);

----------------------------------------------------------------------
-- Audit log
----------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_brand_idx on public.audit_log(brand_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);

----------------------------------------------------------------------
-- updated_at trigger
----------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'users','brands','knowledge_items','proud_strategy_sections',
      'campaign_plans','campaign_emails','eom_reports'
    ])
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

----------------------------------------------------------------------
-- Helper: current user role (read from public.users)
----------------------------------------------------------------------
create or replace function public.current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.has_brand_access(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or exists (select 1 from public.brand_members bm where bm.brand_id = b and bm.user_id = auth.uid())
$$;

----------------------------------------------------------------------
-- Auto-create public.users row on auth.users signup
----------------------------------------------------------------------
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'pending')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

----------------------------------------------------------------------
-- Row-Level Security
----------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.proud_strategy_sections enable row level security;
alter table public.proud_strategy_revisions enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.campaign_plans enable row level security;
alter table public.campaign_series enable row level security;
alter table public.campaign_emails enable row level security;
alter table public.klaviyo_cache enable row level security;
alter table public.klaviyo_recommendations enable row level security;
alter table public.eom_reports enable row level security;
alter table public.approval_links enable row level security;
alter table public.approval_actions enable row level security;
alter table public.audit_log enable row level security;

-- USERS: self-read; admins read all; admins update role
drop policy if exists "users self read" on public.users;
create policy "users self read" on public.users
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "users admin write" on public.users;
create policy "users admin write" on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- BRANDS: members and admins read; admins/strategists write
drop policy if exists "brands read" on public.brands;
create policy "brands read" on public.brands
  for select using (public.has_brand_access(id));

drop policy if exists "brands write" on public.brands;
create policy "brands write" on public.brands
  for all using (public.is_admin() or public.current_user_role() = 'strategist')
  with check (public.is_admin() or public.current_user_role() = 'strategist');

-- BRAND_MEMBERS: admin-managed; members can see their own
drop policy if exists "brand_members read" on public.brand_members;
create policy "brand_members read" on public.brand_members
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "brand_members admin write" on public.brand_members;
create policy "brand_members admin write" on public.brand_members
  for all using (public.is_admin()) with check (public.is_admin());

-- PROUD STRATEGY: any authenticated read; strategist/admin write
drop policy if exists "strategy read" on public.proud_strategy_sections;
create policy "strategy read" on public.proud_strategy_sections
  for select using (auth.role() = 'authenticated');

drop policy if exists "strategy write" on public.proud_strategy_sections;
create policy "strategy write" on public.proud_strategy_sections
  for all using (public.is_admin() or public.current_user_role() = 'strategist')
  with check (public.is_admin() or public.current_user_role() = 'strategist');

drop policy if exists "strategy revisions read" on public.proud_strategy_revisions;
create policy "strategy revisions read" on public.proud_strategy_revisions
  for select using (auth.role() = 'authenticated');

-- Generic per-brand RLS template
do $$
declare tbl text;
begin
  for tbl in select unnest(array[
    'knowledge_items','campaign_plans','campaign_series','campaign_emails',
    'klaviyo_cache','klaviyo_recommendations','eom_reports',
    'approval_links','audit_log'
  ])
  loop
    execute format('drop policy if exists "%1$s brand read" on public.%1$I', tbl);
    execute format(
      'create policy "%1$s brand read" on public.%1$I for select using (public.has_brand_access(brand_id))',
      tbl
    );
    execute format('drop policy if exists "%1$s brand write" on public.%1$I', tbl);
    execute format(
      'create policy "%1$s brand write" on public.%1$I for all using (public.has_brand_access(brand_id)) with check (public.has_brand_access(brand_id))',
      tbl
    );
  end loop;
end $$;

-- Approval actions: read+insert allowed only via service role (server endpoint)
-- (no public policy = service role only)

----------------------------------------------------------------------
-- Seed: empty Proud Strategy starter sections (idempotent)
----------------------------------------------------------------------
insert into public.proud_strategy_sections (section_key, title, position) values
  ('philosophy', 'Philosophy', 0),
  ('cadence', 'Cadence principles', 1),
  ('voice', 'Voice', 2),
  ('segmentation', 'Segmentation', 3),
  ('learnings', 'Running learnings', 4)
on conflict (section_key) do nothing;
