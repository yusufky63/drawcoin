begin;

-- Remote migration version: 20260814134854.

-- Curator depended on historical watchlist rows that cannot be proven from
-- Base. Keep the definition for audit/history, but remove it from the active
-- catalog and never recycle token id 3.
update public.mission_definitions
set is_active = false, updated_at = now()
where slug = 'curator';

alter table public.mission_definitions
  drop constraint if exists mission_definitions_metric_check;

alter table public.mission_definitions
  add constraint mission_definitions_metric_check
  check (
    metric in (
      'verified_creation',
      'verified_buy',
      'watchlist_token',
      'ecosystem_role',
      'verified_activity_day',
      'verified_trade',
      'distinct_collected_coin',
      'round_trip_token',
      'verified_trade_day',
      'completed_standard_mission'
    )
  );

insert into public.mission_definitions (
  slug,
  title,
  description,
  metric,
  threshold,
  sort_order,
  badge_token_id,
  badge_name,
  badge_description,
  badge_image_url
)
values
  (
    'active-trader',
    'Active Trader',
    'Complete five verified DrawCoin buys or sells on Base.',
    'verified_trade',
    5,
    70,
    7,
    'Active Trader',
    'Awarded for five verified DrawCoin trades on Base.',
    'https://drawcoin.app/badges/active-trader.svg'
  ),
  (
    'diverse-collector',
    'Diverse Collector',
    'Collect five different verified DrawCoins from other creators.',
    'distinct_collected_coin',
    5,
    80,
    8,
    'Diverse Collector',
    'Awarded for collecting five different DrawCoins from other creators.',
    'https://drawcoin.app/badges/diverse-collector.svg'
  ),
  (
    'round-trip',
    'Round Trip',
    'Buy and later sell the same verified DrawCoin.',
    'round_trip_token',
    1,
    90,
    9,
    'Round Trip',
    'Awarded for completing a verified buy and later sell on one DrawCoin.',
    'https://drawcoin.app/badges/round-trip.svg'
  ),
  (
    'trader-veteran',
    'Trader Veteran',
    'Complete twenty-five verified DrawCoin trades on Base.',
    'verified_trade',
    25,
    100,
    10,
    'Trader Veteran',
    'Awarded for twenty-five verified DrawCoin trades on Base.',
    'https://drawcoin.app/badges/trader-veteran.svg'
  ),
  (
    'market-regular',
    'Market Regular',
    'Complete verified trades on seven different UTC days.',
    'verified_trade_day',
    7,
    110,
    11,
    'Market Regular',
    'Awarded for verified DrawCoin trading on seven different days.',
    'https://drawcoin.app/badges/market-regular.svg'
  ),
  (
    'badge-hunter',
    'Badge Hunter',
    'Complete five standard DrawCoin missions.',
    'completed_standard_mission',
    5,
    120,
    12,
    'Badge Hunter',
    'Awarded for completing five standard DrawCoin missions.',
    'https://drawcoin.app/badges/badge-hunter.svg'
  ),
  (
    'badge-master',
    'Badge Master',
    'Complete all ten standard DrawCoin missions.',
    'completed_standard_mission',
    10,
    130,
    13,
    'Badge Master',
    'Awarded for completing all ten standard DrawCoin missions.',
    'https://drawcoin.app/badges/badge-master.svg'
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  threshold = excluded.threshold,
  sort_order = excluded.sort_order,
  badge_token_id = excluded.badge_token_id,
  badge_name = excluded.badge_name,
  badge_description = excluded.badge_description,
  badge_image_url = excluded.badge_image_url,
  is_active = true,
  updated_at = now();

create index if not exists transactions_verified_mission_metrics_idx
  on public.transactions (
    lower(user_address),
    timestamp,
    lower(token_address)
  )
  where verified_at is not null;

commit;
