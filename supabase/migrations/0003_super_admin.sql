-- Add super_admin role. Highest privilege tier.
--
-- IMPORTANT: Postgres won't let you reference a new enum value in the
-- same transaction that adds it. Run this file in TWO separate steps
-- in the Supabase SQL editor.
--
-- STEP 1: run just this one line on its own:

alter type user_role add value if not exists 'super_admin' before 'admin';

-- STEP 2: run everything below this comment as a second query.
-- (Splitting at the blank line is enough; Supabase commits between.)

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_user_role() in ('admin', 'super_admin');
$$;
