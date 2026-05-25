-- 0010_approval_actions_user.sql
-- Lets authenticated clients (signed in to PUNCH with role='client')
-- record approve / request-changes / comment actions without going
-- through a tokenised approval link. Token-based actions still work
-- exactly as before.
--
-- Schema change:
--   - approval_actions.user_id: optional FK to public.users(id)
--   - approval_actions.approval_link_id: now nullable
--   - constraint: row must have either a link OR a user

alter table public.approval_actions
  add column if not exists user_id text references public.users(id) on delete set null;

alter table public.approval_actions
  alter column approval_link_id drop not null;

do $$ begin
  alter table public.approval_actions
    add constraint approval_actions_link_or_user
    check (approval_link_id is not null or user_id is not null);
exception when duplicate_object then null; end $$;

create index if not exists approval_actions_user_idx
  on public.approval_actions(user_id) where user_id is not null;
