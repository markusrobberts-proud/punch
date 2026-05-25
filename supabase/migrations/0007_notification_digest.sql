-- 0007_notification_digest.sql
-- Per-user preference for the email digest cadence.
--   'daily'  : one email per day with unread notifications (default)
--   'weekly' : one email per week (Monday morning Sydney time)
--   'off'    : no digest emails
--
-- We also track when we last sent a digest so the cron job doesn't
-- double-send.

alter table public.users
  add column if not exists notification_digest text not null default 'daily',
  add column if not exists last_digest_sent_at timestamptz;

-- Constrain the values so a typo in a future migration doesn't drift.
do $$ begin
  alter table public.users
    add constraint users_notification_digest_check
    check (notification_digest in ('daily', 'weekly', 'off'));
exception when duplicate_object then null; end $$;
