# DrawCoin

DrawCoin is a Farcaster-ready creator app for turning hand-drawn or AI-generated artwork into tradeable coins on Base using Zora infrastructure.

The product joins a drawing canvas, AI image/content assistance, coin creation, Farcaster sharing, and Supabase-backed persistence into one mobile-first flow.

## Core Experience

| Flow | What happens |
| --- | --- |
| Art Creation | Users draw artwork, refine visuals, or generate art with AI assistance. |
| Coin Creation & Trading | Artwork becomes a coin through Zora SDK and Base wallet flows. |
| Multi-Platform Support | Built for web, Farcaster Mini Apps, BaseApp-style usage, and shareable mobile surfaces. |
| User Experience | Pixel/retro visual language, fast mobile screens, wallet prompts, and creator-first actions. |

## Feature Map

- Drawing and art generation interface for creator-owned assets.
- Zora coin creation flow for art-backed token launches.
- Farcaster Mini App SDK and frame-related integrations.
- Supabase data layer plus Upstash Redis support for app state and generated content.
- IPFS/storage-oriented asset path for generated and uploaded media.
- Trading and token detail pages for created coins.

| Layer | Tools |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS, Radix UI, VT323, Press Start 2P, Recharts |
| Blockchain & Web3 | Zora SDK, Zora Protocol SDK, Wagmi, Viem, Ethers, Base |
| AI & Image Processing | Google Gemini, drawing canvas flow, generated metadata/content |
| Database & Backend | Supabase, Upstash Redis, API routes, Axios |
| Integrations | Farcaster auth, Farcaster Mini App SDK, frame packages, cloudflared for local testing |

## Project Structure

- `src/` - application routes, components, token/art flows, API logic, and integrations.
- `public/` - assets, icons, and metadata used by the mini app.
- `supabase/` - database-related project files.
- `next.config.js` and `vercel.json` - deployment/runtime configuration.

## Getting Started

```bash
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build for production. |
| `npm start` | Run the production server after build. |
| `npm run lint` | Run lint checks. |

## Status

- Repository: https://github.com/yusufky63/drawcoin
- Live app: https://drawcoin-mini.vercel.app
- Portfolio entry: https://codexsha.com
