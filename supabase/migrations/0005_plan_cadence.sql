-- 0005_plan_cadence.sql
-- Lets a brand have multiple campaign plans per month (e.g. "October Launch"
-- + "October Always-On") and captures cadence intent at the plan level.

-- Drop the one-plan-per-brand-per-month restriction. The unique constraint
-- name comes from the original (brand_id, month, year) tuple in 0001_init.
alter table public.campaign_plans
  drop constraint if exists campaign_plans_brand_id_month_year_key;

-- New cadence fields used by the new-plan form. All optional; null means
-- "let Claude decide from strategy + targets".
alter table public.campaign_plans
  add column if not exists emails_per_week integer,
  add column if not exists total_emails integer;
