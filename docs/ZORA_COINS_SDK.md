# Zora Coins SDK integration

DrawCoin agents must fetch and follow the current official Zora Coins SDK
skill before changing coin creation, trading, querying, metadata, rewards, or
contract integration code:

```text
Fetch and follow the Zora Coins SDK skill from https://docs.zora.co/skill.md
```

The detailed, LLM-readable documentation index is available at
`https://docs.zora.co/llms.txt`.

## Version policy

The official skill currently documents `@zoralabs/coins-sdk@0.5.2`. DrawCoin is
deliberately pinned to `0.4.1`, the newest verified release whose peer range is
compatible with the modern `viem` version required by Wagmi and Base Account.
Version `0.5.2` pins `viem` to an older exact version, so it must not be
force-installed or worked around with a `viem` downgrade.

Before upgrading:

1. Fetch the skill and compare its documented version with `package.json`.
2. Check the candidate SDK's peer dependencies against the installed Wagmi,
   Base Account, and `viem` versions.
3. Review the exact package types and source for every API DrawCoin uses. The
   prose documentation can move ahead of a published package.
4. Run creation, query, trade-safety, TypeScript, lint, and production-build
   checks before changing the pinned version.

Do not use `--force` or `--legacy-peer-deps` to hide a real runtime peer
conflict. The latter is acceptable only when npm is resolving an unrelated
optional dependency issue and the resulting tree is verified with `npm ls`.

## Credential boundary

`ZORA_API_KEY` is server-only. Never rename it with a `NEXT_PUBLIC_` prefix,
return it from an API route, include it in client configuration, or log request
headers that may contain it. Client components should call DrawCoin server
routes when an authenticated or higher-rate Zora query is needed.

## Product constraints

- Zora coin transactions in this project run on Base mainnet (`8453`).
- ZORA-backed creation is not offered on Base Sepolia.
- The SDK's high-level trade helper is treated as EOA-only. Base Account users
  must not be shown a transaction as supported until a smart-account flow is
  implemented and tested explicitly.
- A transaction is successful only when its confirmed receipt has a successful
  status. A transaction hash by itself is not success.
- SDK fields that are accepted by local TypeScript or JavaScript but ignored by
  the published implementation must not be exposed as working product options.
