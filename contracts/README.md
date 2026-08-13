# DrawCoin mission badge contract

`DrawCoinMissionBadges.sol` is a non-transferable ERC-1155 contract. A user can
claim a mission badge only with a short-lived EIP-712 voucher signed by the
DrawCoin server. The voucher binds the wallet, badge token ID, onchain nonce,
deadline, chain, and deployed contract.

## Compile

From this directory:

```sh
forge build
```

## Deploy

Deploy with these constructor arguments:

1. `initialOwner`: a multisig or other operational owner.
2. `initialClaimSigner`: the address derived from the server-side
   `BADGE_CLAIM_SIGNER_PRIVATE_KEY`.
3. `initialBaseURI`: the HTTPS or IPFS directory containing `1.json` through
   `6.json`. It must end with `/`; the contract appends `<tokenId>.json`.

The matching metadata files are included in `metadata/`. Their current `image`
fields point to the matching SVG files served from `public/badges/`. Upload the
complete six-file metadata directory to durable storage and use that directory
URI, including its trailing `/`, as `initialBaseURI`. If metadata is moved to a
new content-addressed directory after deployment, update the contract with
`setBaseURI` before enabling claims for the affected badges.

## Application badge IDs

| Token ID | Mission slug | Badge metadata |
| --- | --- | --- |
| `1` | `first-stroke` | `metadata/1.json` |
| `2` | `collector` | `metadata/2.json` |
| `3` | `curator` | `metadata/3.json` |
| `4` | `creator-journey` | `metadata/4.json` |
| `5` | `ecosystem-builder` | `metadata/5.json` |
| `6` | `base-regular` | `metadata/6.json` |

The contract itself accepts any non-zero token ID; this table is the mapping
used by the DrawCoin mission catalog. The server must issue claim vouchers only
for active catalog entries. Adding another mission therefore requires its
catalog row, badge artwork, numbered metadata file, and server configuration to
be deployed together.

Test on Base Sepolia (chain ID `84532`) before deploying to Base mainnet
(chain ID `8453`). After deployment, verify the exact source and configure the
CDP Paymaster allowlist with only the deployed contract and
`claim(uint256,uint256,uint256,bytes)`.

Never put the claim signer private key or CDP Paymaster URL in a
`NEXT_PUBLIC_*` variable. Keep the owner and claim signer as separate accounts.

## Application configuration

Configure the Next.js server after deployment:

```env
# Public contract identity (84532 for Sepolia, 8453 for mainnet)
BADGE_CONTRACT_CHAIN_ID=84532
BADGE_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS=0x...

# Server-only claim signer and RPC
BADGE_CLAIM_SIGNER_PRIVATE_KEY=0x...
BADGE_RPC_URL=https://...

# Server-only ERC-7677 proxy configuration
BASE_PAYMASTER_SERVICE_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/...
PAYMASTER_PROXY_SECRET=use-at-least-32-random-characters

# Base Dashboard wallet-address notifications
BASE_DASHBOARD_API_KEY=...
BASE_APP_URL=https://your-registered-app.example
```

The address derived from `BADGE_CLAIM_SIGNER_PRIVATE_KEY` must equal the
contract's `claimSigner()`. In CDP, set per-operation, per-address, and global
spend limits in addition to allowlisting only the badge contract and its
`claim` function. Register `BASE_APP_URL` exactly as written in the Base
Dashboard project.

Before enabling production claims, verify that `uri(1)` through `uri(6)` each
resolve to valid JSON and that every metadata `image` URL resolves to its
matching badge artwork.
