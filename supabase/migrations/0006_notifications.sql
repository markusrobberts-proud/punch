-- 0006_notifications.sql
-- In-app notifications. One row per recipient so we can mark-as-read
-- per-user without a junction table. kind is a stable categorical
-- string we read in the UI to pick the icon + treatment.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Recipient. Clerk user id (text).
  user_id text not null references public.users(id) on delete cascade,

  -- Categorical: what happened.
  -- Examples: "client_approve", "client_request_changes", "client_comment",
  -- "plan_approved", "briefs_ready", "knowledge_pending", "inbound_email",
  -- "user_pending", "role_changed", "scrape_complete".
  kind text not null,

  -- Display text (computed by the emitter so the UI stays dumb).
  title text not null,
  body text,
  -- Where clicking the notification should take the user.
  link text,

  -- Source context.
  brand_id uuid references public.brands(id) on delete cascade,
  entity_type text,
  entity_id text,
  actor_user_id text references public.users(id) on delete set null,

  -- State.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Fast unread-count lookup per recipient.
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id) where read_at is null;

-- Inbox list ordering.
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
