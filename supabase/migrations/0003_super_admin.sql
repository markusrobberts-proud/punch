-- Add super_admin role. Highest privilege tier.
-- super_admin behaves exactly like admin for RLS, but the app layer
-- lets them toggle a "view as" preview of other roles for QA purposes.
--
-- IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction that
-- also uses the new value. If Supabase SQL editor rejects this whole
-- block at once, run the ALTER TYPE statement first on its own, then
-- run the rest.

alter type user_role add value if not exists 'super_admin' before 'admin';

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_user_role() in ('admin', 'super_admin');
$$;
