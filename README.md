# DrawCoin 🎨

**Create and trade hand-drawn art tokens on Base blockchain**

DrawCoin is a decentralized platform that enables users to create and trade art tokens (coins) using hand-drawn artwork or AI-generated art. Built on the Base Network and integrated with the Zora SDK, DrawCoin makes digital art-backed coin creation and trading accessible to everyone.

## 🌟 Features

### 🎨 Art Creation

- **Hand-drawn Canvas**: Interactive drawing canvas with professional tools
- **AI Art Generation**: Generate artwork using advanced AI models (Gemini, Together.ai)
- **Custom Drawing Tools**: Brushes, colors, shapes, and layers
- **High-Quality Output**: 1024x1024 resolution artwork

### 🪙 Coin Creation & Trading

- **ERC-20 Coin Minting**: Create your own tradeable coins backed by artwork
- **Zora Protocol Integration**: Leverages Zora's robust coin creation infrastructure
- **Base Network**: Fast and low-cost transactions on Base L2
- **Multiple Trading Pairs**: ETH, ZORA, and coin-to-coin trading

### 🌐 Multi-Platform Support

- **Farcaster Mini-App**: Native integration with Farcaster ecosystem
- **BaseApp Compatible**: Works seamlessly in BaseApp environment
- **Web Browser**: Full desktop and mobile browser support
- **Wallet Integration**: MetaMask, Coinbase Wallet, and more

### 📱 User Experience

- **Responsive Design**: Optimized for all screen sizes
- **Real-time Market Data**: Live coin prices and trading volumes
- **Portfolio Management**: Track your coin holdings and performance
- **Search & Discovery**: Find coins by name, symbol, or creator

## 🛠 Technology Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Query** - Data fetching and caching
- **Wagmi** - Ethereum React hooks

### Blockchain & Web3

- **Base Network** - Ethereum L2 for fast, cheap transactions
- **Zora SDK** - Coin creation and trading infrastructure
- **Viem** - TypeScript Ethereum library
- **IPFS** - Decentralized storage for artwork and metadata

### AI & Image Processing

- **Google Gemini** - AI image generation
- **Together.ai** - Alternative AI provider
- **Canvas API** - Drawing functionality
- **Pinata** - IPFS pinning service

### Database & Backend

- **Supabase** - PostgreSQL database and real-time subscriptions
- **Next.js API Routes** - Server-side functionality
- **Vercel** - Deployment and hosting

### Integrations

- **Farcaster SDK** - Social protocol integration
- **Coinbase Wallet** - Wallet connectivity
- **Ethers.js** - Ethereum interactions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Git for version control
- A wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yusufky63/drawcoin.git
cd drawcoin
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Environment Setup**
   Create a `.env.local` file with the following variables:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# IPFS Storage
PINATA_JWT=your_pinata_jwt_token

# AI Services
TOGETHER_API_KEY=your_together_api_key
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

ZORA_API_KEY=your_zora_api_key

# App Configuration
NEXT_PUBLIC_URL=https://your-domain.vercel.app
```

4. **Database Setup**

```bash
# Run Supabase migrations
npx supabase db reset
```

5. **Start Development Server**

```bash
npm run dev
# or
yarn dev
```

Visit `http://localhost:3000` to see the application.

## 📖 How DrawCoin Works

DrawCoin makes it easy for anyone to create, trade, and manage art-backed tokens. Whether you're on your phone or computer, the entire platform is designed to be simple and accessible. Here's everything you can do:

### 🎨 Creating Your Art Coin

**Two Ways to Create Art:**

1. **Draw it Yourself (Custom Canvas)**

   - Open the drawing canvas on any device - mobile or desktop
   - Use professional drawing tools: different brush sizes, colors, shapes
   - On mobile: Touch and draw with your finger or stylus
   - On desktop: Use your mouse or drawing tablet for precise control
   - Preview your artwork in real-time as you create
   - Capture your masterpiece when you're happy with it

2. **Let AI Create for You (AI Generation)**
   - Simply describe what you want in plain English
   - Example: "A cute cat in space" or "Abstract colorful waves"
   - AI generates hand-drawn style artwork in seconds
   - You get 5 free AI generations per day
   - Perfect for when you have an idea but not the drawing skills

**Adding Your Token Details:**

- Give your token a creative name and symbol (like "SpaceCat" - $SCAT)
- Write a description of what makes your artwork special
- Optional: Customize starting market cap and other advanced settings

**Making it Official:**

- Your artwork is saved permanently on IPFS (decentralized storage that never goes away)
- Your token is created on the Base blockchain using Zora's trusted protocol
- You receive 10 million initial tokens - these are yours!
- Everything happens in seconds, and you're ready to trade

### 💱 Trading & Discovering Coins

**Finding Tokens to Trade:**

- **Home Page**: See trending tokens with live price ticker at the top
- **Search**: Find tokens by name, symbol, or creator
- **Filters**: Sort by price, market cap, 24h volume, or newest
- **Watchlist**: Save your favorite tokens for quick access (works on all devices)
- **Live Updates**: Prices and market data refresh in real-time

**Buying Tokens:**

- Multiple payment options: ETH, USDC, or other coins
- Use quick percentage buttons (25%, 50%, 75%, 100% of your balance)
- Slippage protection: Set how much price change you'll accept
- See the USD value before you confirm
- Instant wallet confirmation - no complicated steps

**Selling Tokens:**

- Sell any amount you own with one click
- Same easy interface as buying
- Convert back to ETH or USDC
- See your profit/loss in real-time

**Smart Trading Features:**

- **Price Charts**: View interactive price history (powered by GeckoTerminal)
- **Recent Trades**: See what others are buying and selling
- **Live Market Data**: Market cap, 24h volume, holder count
- **Slippage Control**: Protect yourself from price changes during busy times

### 📊 Your Portfolio Dashboard

**Track Everything in One Place:**

- **Total Balance**: See your entire portfolio value in USD
- **Holdings Tab**: All tokens you own with current prices and 24h changes
- **Your Tokens Tab**: Tokens you created with performance stats
- **Transaction History**: Complete record of all your trades
- **Mobile Optimized**: Swipe through tabs easily on your phone

**Portfolio Features:**

- **Sort & Filter**: Organize by name, market cap, volume, or balance
- **Quick Actions**: Buy more or sell directly from your portfolio
- **Performance Tracking**: See gains/losses on each token
- **Share Portfolio**: Share your success on social media with one click
- **Zora Profile Integration**: Your Web3 identity displayed beautifully

### 🌐 Multi-Platform Experience

**Works Everywhere:**

- **Mobile Browsers**: Full experience on iPhone, Android, any mobile browser
- **Desktop Browsers**: Large screen optimized for serious trading
- **Farcaster Mini-App**: Native integration within Farcaster social network
- **BaseApp**: Seamless experience in Base ecosystem apps
- **Progressive Design**: Interface adapts perfectly to your screen size

**Mobile-Specific Features:**

- Compact navigation with bottom menu bar
- Touch-optimized drawing canvas
- Swipe gestures for tab navigation
- One-handed operation friendly
- Fast loading even on slower connections

**Desktop-Specific Features:**

- Larger drawing canvas (1024x1024 resolution)
- Multiple windows support
- Keyboard shortcuts
- Advanced chart analysis
- Side-by-side token comparison

### 💎 Platform-Wide Features

**For Your Security & Convenience:**

- **Wallet Connection**: MetaMask, Coinbase Wallet, WalletConnect supported
- **Network Switching**: Automatically switches to Base network for you
- **Transaction History**: Every buy, sell, and creation is recorded
- **Real-Time Notifications**: Toast messages keep you informed of every action
- **Error Recovery**: Smart retry system if something goes wrong

**Social & Community:**

- **Share Tokens**: Share your favorite tokens on Twitter and Farcaster
- **Creator Profiles**: See all tokens created by an artist
- **Recent Transactions**: Community-wide trade feed
- **Global Stats**: Platform statistics and top performers
- **Comments (Coming Soon)**: Discuss tokens with other traders

**Advanced Features (Simple to Use):**

- **Multiple Trading Pairs**: Trade between any supported tokens
- **Onchain Data Display**: See blockchain details without being technical
- **Price Feeds**: Accurate prices from multiple sources (Binance, CoinGecko, etc.)
- **IPFS Integration**: Your art is stored forever, decentralized
- **Analytics**: Track platform growth and your personal stats

### 🎯 Everything Designed Around You

**Complete Beginner?**

- No coding knowledge needed - ever
- Clear instructions at every step
- Help tooltips throughout the platform
- Start with AI art if drawing isn't your thing

**Experienced Trader?**

- Advanced slippage controls
- Quick percentage trading buttons
- Live price charts and analytics
- Multi-token portfolio management

**Artist?**

- Professional drawing tools
- High-resolution artwork (1024x1024)
- Your art stored permanently
- Keep creating - no limits

**Mobile User?**

- Everything works perfectly on your phone
- Create, trade, and manage on the go
- Touch-optimized for one-handed use
- No desktop required

### ✨ Why DrawCoin is Special

- **No Barriers**: Anyone can create tokens, no technical skills required
- **Your Art, Forever**: IPFS ensures your artwork never disappears
- **Fast & Cheap**: Base network means quick transactions and low fees
- **Mobile First**: Full power in your pocket
- **Community Driven**: Built for artists, traders, and collectors
- **Transparent**: Everything on blockchain, fully verifiable
- **Growing**: New features added regularly based on user feedback

### Technical Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend APIs   │    │   Blockchain    │
│                 │    │                  │    │                 │
│ • Next.js App   │◄──►│ • Coin Creation  │◄──►│ • Base Network  │
│ • Drawing Canvas│    │ • AI Generation  │    │ • Zora Protocol │
│ • Wallet UI     │    │ • IPFS Upload    │    │ • Smart Contracts│
│ • Market View   │    │ • Market Data    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐            │
         └──────────────►│   External APIs  │◄───────────┘
                        │                  │
                        │ • Supabase DB    │
                        │ • IPFS/Pinata    │
                        │ • AI Services    │
                        │ • Price Feeds    │
                        └──────────────────┘
```

## 🎯 Use Cases

### For Artists

- **Monetize Digital Art**: Turn drawings into tradeable coins
- **Build Community**: Engage with collectors and fans
- **Retain Ownership**: Keep creator rights and royalties
- **Global Reach**: Access worldwide traders instantly

### For Traders

- **Discover Unique Art**: Find one-of-a-kind digital artwork-backed coins
- **Support Artists**: Directly support creators you love
- **Investment Potential**: Trade coins as they appreciate
- **Portfolio Diversification**: Add art-backed coins to your holdings

### For Developers

- **Open Source**: Learn from production-ready Web3 code
- **Extensible Platform**: Build additional features and integrations
- **Modern Stack**: Next.js, TypeScript, and Web3 best practices
- **Scalable Architecture**: Handle thousands of users and transactions

## 🔧 Configuration

### Network Settings

- **Default Network**: Base Mainnet (Chain ID: 8453)
- **Supported Wallets**: MetaMask, Coinbase Wallet, WalletConnect
- **Gas Optimization**: Automatic gas price optimization

### IPFS Configuration

- **Primary Gateway**: Custom Pinata gateway for fast access
- **Fallback Gateways**: Multiple IPFS gateways for reliability
- **Metadata Format**: Standard coin metadata with image references

### AI Art Settings

- **Primary Provider**: Google Gemini for high-quality generation
- **Fallback Provider**: Together.ai for reliability
- **Style Prompts**: Hand-drawn, sketch, artistic style enhancement
- **Output Format**: 1024x1024 PNG images

## 🔒 Security

### Smart Contract Security

- **Zora SDK**: Battle-tested smart contracts for coin creation
- **Base Network**: Ethereum L2 with full security guarantees
- **No Custom Contracts**: Reduces attack surface

### Data Protection

- **IPFS Storage**: Decentralized, immutable artwork storage
- **Metadata Validation**: Input sanitization and validation
- **Rate Limiting**: API protection against abuse

### Wallet Security

- **No Private Keys**: Never stores or accesses private keys
- **User Consent**: All transactions require explicit user approval
- **Network Validation**: Automatic network switching for safety

## 🙏 Acknowledgments

- **Zora SDK** - For providing robust token infrastructure
- **Base Network** - For fast and affordable transactions
- **Farcaster** - For social protocol integration
- **Supabase** - For database and real-time functionality
- **Vercel** - For deployment and hosting

---

**Made with ❤️ for the Web3 art community**
