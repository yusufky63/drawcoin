-- A claim may be discovered from the contract after the browser disappears
-- before reporting its transaction hash. The contract's `claimed` mapping is
-- canonical, so a reconciled row only requires a claim timestamp.
alter table public.user_badges
  add column if not exists notification_attempted_at timestamptz;

alter table public.user_badges
  drop constraint if exists user_badges_claimed_state_check;

alter table public.user_badges
  add constraint user_badges_claimed_state_check
  check (
    (claim_status = 'claimed' and claimed_at is not null)
    or claim_status <> 'claimed'
  );

comment on column public.user_badges.notification_attempted_at is
  'Atomic at-most-once reservation made before sending a Base badge notification.';
