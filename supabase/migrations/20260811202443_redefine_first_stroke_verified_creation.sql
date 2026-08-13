begin;

-- First Stroke verifies that DrawCoin can prove the Base creation event. It
-- does not make an unverifiable claim about how the artwork was authored.
alter table public.mission_definitions
  drop constraint if exists mission_definitions_metric_check;

update public.mission_definitions
set
  metric = 'verified_creation',
  updated_at = now()
where metric = 'hand_drawn_coin';

update public.mission_definitions
set
  description = 'Create your first verified DrawCoin on Base.',
  badge_description = 'Awarded for creating a verified DrawCoin on Base.',
  updated_at = now()
where slug = 'first-stroke';

alter table public.mission_definitions
  add constraint mission_definitions_metric_check
  check (metric in ('verified_creation', 'verified_buy', 'watchlist_token'));

-- This migration intentionally leaves RLS, policies, grants, existing mission
-- progress, and legacy activity verification state unchanged.
commit;
