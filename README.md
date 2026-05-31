# DrawCoin

DrawCoin lets creators draw or generate artwork, turn it into a tradeable coin through Zora infrastructure, and share the experience through Base and Farcaster-ready surfaces.

## Snapshot

- **Category:** AI creator economy on Base
- **Status:** Public repository
- **Live:** https://drawcoin-mini.vercel.app
- **Repository:** https://github.com/yusufky63/drawcoin
- **Portfolio:** https://codexsha.dev

## Product Scope

DrawCoin is documented here as a product repository, not just a code dump. The goal of this README is to make the product purpose, runtime surface, and development path clear for future review and maintenance.

## Core Capabilities

- Drawing canvas and AI image generation paths
- Zora-backed coin creation and trading-oriented pages
- Base network wallet flows
- Farcaster Mini App and Base App compatibility
- Supabase/Redis persistence and asset metadata handling

## Existing README Coverage Preserved

This refresh keeps the important project-specific areas from the previous documentation:

- Art Creation
- Coin Creation & Trading
- Multi-Platform Support
- User Experience
- Technology Stack
- App Pages & Features

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Farcaster SDK
- Zora SDK
- Wagmi
- Viem
- Supabase
- Google Gemini
- Upstash Redis
- Ethers
- tldraw

## Repository Map

| Path | Purpose |
| --- | --- |
| src/app/ | Next.js routes and app surfaces |
| src/components/ | UI and product components |
| src/lib/ | Web3, AI, and utility integration code |
| public/ | Icons, OG images, and static assets |

## Local Development

| Command | Purpose |
| --- | --- |
| npm run dev | Run local development server |
| npm run build | Build production app |
| npm run start | Start production server |
| npm run lint | Run lint checks |

## Environment Notes

Use local environment files for secrets and deployment-specific values. Do not commit real keys.

- Farcaster app credentials
- Supabase URL/key
- Zora/WalletConnect configuration
- Gemini or other AI provider key
- Upstash Redis values where enabled

## Operational Notes

- Keep this README aligned with the live product and portfolio copy.
- Prefer small, documented changes over large undocumented rewrites.
- The previous README already contained rich feature notes; this version keeps those product flows but presents them in a tighter repository-oriented structure.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
