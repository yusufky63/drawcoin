# DrawCoin: Base App and Missions setup

DrawCoin now follows Base's standard web app model. Base Account is the primary
wallet, browser wallets are fallbacks, and Farcaster remains an optional social
sharing/profile layer only.

## What is implemented

- `baseAccount()` with wagmi/viem on Base and Base Sepolia, plus an
  injected-wallet fallback. DrawCoin creation and trading remain mainnet-only;
  Sepolia is enabled on Missions for badge staging.
- ERC-8021 Builder Code attribution at the wagmi client configuration level.
- SIWE with an HttpOnly session, ERC-6492 smart-account signature support, and
  atomically consumed SHA-256 nonce hashes in Supabase. Nonce issuance is
  bounded by anonymized per-client and global limits.
- Basename reverse resolution for the connected Base address.
- Three server-evaluated missions: First Stroke, Collector, and Curator.
- A non-transferable ERC-1155 badge contract with wallet-bound, expiring EIP-712
  claim vouchers and replay protection.
- An opt-in, fail-closed ERC-7677 Paymaster proxy for canonical Base Account
  v1.1 wallets. It accepts only the exact badge claim authorized for that
  wallet and uses a central, atomic sponsorship-grant ledger.
- Base Dashboard notification status and badge-unlocked notifications.

## 1. Register the standard web app in Base Dashboard

Register the exact production URL (`https://drawcoin.app`) in Base Dashboard
and complete the app metadata there. Set the generated Builder Code as
`NEXT_PUBLIC_BUILDER_CODE`. DrawCoin does not publish a Farcaster Mini App
runtime for the Base integration; Farcaster remains an optional standard-web
sharing and profile link only.

The Builder Code is attached to Base transactions through the wagmi `dataSuffix`
configuration. The Zora create/trade wrappers intentionally do not append it a
second time. Keep `NEXT_PUBLIC_DRAWCOIN_PLATFORM_REFERRER` set to DrawCoin's
registered Zora referrer; the verification API requires the matching onchain
event as an additional provenance check.

## 2. Apply the Supabase migration

Apply all migrations, including
`supabase/migrations/20260811173317_create_draw_missions.sql`,
`supabase/migrations/20260811173342_reconcile_onchain_badge_claims.sql`, and
`supabase/migrations/20260811173355_secure_paymaster_grants.sql`, plus
`supabase/migrations/20260811202443_redefine_first_stroke_verified_creation.sql`, before
enabling SIWE, missions, or gas sponsorship:

```sh
npx supabase db push
```

The migrations create the mission, badge, and private SIWE nonce tables. They
also remove browser write access from DrawCoins, transactions, and watchlists.
Existing activity remains readable but is not trusted in bulk. An exact activity
may count only after the server verifies it and records `verified_at`.

Trust rules:

- First Stroke requires a successful `CoinCreatedV4` event from Zora's official
  Base factory, matching the coin, creator, metadata URI, name, and symbol. It
  verifies a DrawCoin creation, not whether a bitmap was authored by a human.
- Collector requires a successful `CoinBuy` event emitted by a verified
  DrawCoin contract, with the signed wallet as recipient.
- Curator requires a valid SIWE session; watchlist writes are made server-side
  and only for verified DrawCoins. Watchlist membership and saved price
  snapshots are private; only aggregate counts remain public.

## 3. Configure SIWE and RPC access

Copy `.env.example` to a local environment file and replace every placeholder.
Generate `AUTH_SESSION_SECRET` with at least 32 random characters. Keep
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SESSION_SECRET`, and `BASE_RPC_URL`
server-only. A dedicated authenticated Base RPC is recommended for reliable
receipt verification. Set a private Ethereum mainnet `ETHEREUM_RPC_URL` for
ENSIP-19 Basename resolution; the resolver uses `toCoinType(base.id)` as Base's
official guide requires.

By default, production SIWE sessions accept only Base mainnet (`8453`), while
local development also accepts Base Sepolia (`84532`) for badge staging.
Configure the server-only `BASE_SEPOLIA_RPC_URL` for smart-account signature
verification. Because Vercel Preview builds also use `NODE_ENV=production`, set
`NEXT_PUBLIC_ENABLE_BASE_SEPOLIA=true` explicitly in local/Preview staging
environments. Keep it `false` or unset in the main Production environment. The
flag is public configuration; server verification still enforces the selected
chain policy.

Nonce issuance allows at most 10 requests per anonymized client in 10 minutes,
3 simultaneously active nonces per client, and 10,000 active nonces globally.
Only an HMAC client hash is stored; raw IP addresses are never persisted. On
Vercel, the protected forwarding header is used automatically. On another host,
leave `AUTH_TRUSTED_CLIENT_IP_HEADER` empty for a shared restrictive bucket, or
set it only when a trusted reverse proxy overwrites that header and direct
access to the application origin is blocked.

## 4. Deploy the badge contract safely

The contract lives at `contracts/DrawCoinMissionBadges.sol`. Test it on Base
Sepolia first. Constructor arguments are:

1. an operational owner, preferably a multisig;
2. the address derived from `BADGE_CLAIM_SIGNER_PRIVATE_KEY`;
3. the HTTPS or IPFS directory ending in `/` that serves `1.json`, `2.json`,
   and `3.json`.

Badge metadata and artwork are in `contracts/metadata/` and `public/badges/`.
After Sepolia verification, deploy the same source to Base mainnet, verify it on
BaseScan, and switch `BADGE_CONTRACT_CHAIN_ID` from `84532` to `8453`.

Never reuse the owner key as the claim signer. Rotate the onchain signer before
replacing the server key.

## 5. Configure gas sponsorship

Gas sponsorship is disabled by default. First create a CDP Paymaster for the
same chain as the badge contract. Its upstream policy is a mandatory second
enforcement layer and must allow only:

- the deployed `DrawCoinMissionBadges` address;
- `claim(uint256,uint256,uint256,bytes)`;
- zero ETH value;
- conservative per-wallet, per-operation, and global spend limits.

Set the provider endpoint as server-only `BASE_PAYMASTER_SERVICE_URL` and create
an independent 32+ character `PAYMASTER_PROXY_SECRET`. Apply the secure
paymaster-grant migration, verify the upstream policy, and only then set
`PAYMASTER_PROXY_ENABLED=true`. Do not use the flag as a substitute for the CDP
policy: Base Accounts are upgradeable, so provider-side contract/function and
spend limits remain required.

The public browser receives only a short-lived proxy URL. The proxy accepts the
official Coinbase Smart Wallet/Base Account v1.1 model used by
`@base-org/account` 2.2.0:

- EntryPoint v0.6 at `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`;
- factory `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842`;
- the factory's pinned v1.1 implementation and canonical ERC-1967 proxy
  runtime;
- for an undeployed account, exact `createAccount(bytes[],uint256)` init code
  whose factory-derived address equals the UserOperation sender.

Generic ERC-7579, EIP-7702, unknown factories, changed implementations, and
unverifiable accounts are not sponsored. They continue through the normal
user-paid claim path. The proxy also checks wallet, chain, badge contract,
calldata hash, token ID, nonce, expiry, a single inner call, and zero ETH value.
Supabase atomically limits an active grant to eight stub estimations and one
final `pm_getPaymasterData` reservation across all server instances. A missing
migration, database error, exhausted grant, or failed account attestation
disables sponsorship instead of falling back to an unbounded in-memory limit.

If Paymaster configuration is absent or disabled, Base Account falls back to a
normal user-paid badge transaction. If the badge contract itself is absent,
completed missions still work offchain and the claim endpoint returns a safe
unavailable response.

## 6. Enable Base App notifications

Set `BASE_DASHBOARD_API_KEY` and `BASE_APP_URL` to the exact URL registered in
Base Dashboard. Notifications are available only to wallets that pinned the app
in Base App and opted in. The Missions screen shows the current status and sends
a badge-unlocked notification after the claim receipt is verified.

## Production checklist

- Apply the migration and verify RLS grants in the target Supabase project.
- Use production-only secrets with separate staging and mainnet values.
- Confirm Builder Code transactions appear in Base Dashboard attribution.
- Complete an end-to-end Sepolia badge claim before switching to mainnet.
- Confirm the Paymaster policy rejects all targets/functions except badge claim.
- Confirm `PAYMASTER_PROXY_ENABLED` remains false until the grant migration and
  upstream per-wallet/global spend caps are live.
- Pin DrawCoin in Base App, opt in, and test one notification.
- Keep Farcaster integrations labeled as optional social sharing/profile links.

Official references:

- [Migrate to a standard Base web app](https://docs.base.org/apps/guides/migrate-to-standard-web-app)
- [Base Account with wagmi](https://docs.base.org/base-account/framework-integrations/wagmi/setup)
- [Authenticate users with SIWE](https://docs.base.org/base-account/guides/authenticate-users)
- [Sponsor gas with a Paymaster](https://docs.base.org/base-account/improve-ux/sponsor-gas/paymasters)
- [Coinbase Smart Wallet v1.1 source](https://github.com/coinbase/smart-wallet)
- [Base App notifications](https://docs.base.org/apps/technical-guides/base-notifications)
- [Builder Codes for app developers](https://docs.base.org/apps/builder-codes/app-developers)
