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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# IPFS Storage
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token

# AI Services
NEXT_PUBLIC_TOGETHER_API_KEY=your_together_api_key
NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Blockchain
NEXT_PUBLIC_ZORA_API_KEY=your_zora_api_key

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

## 📖 How It Works

### Creating Art Coins

1. **Choose Creation Method**
   - **Custom Draw**: Use the interactive canvas to create hand-drawn artwork
   - **AI Generate**: Describe your vision and let AI create the artwork

2. **Add Coin Details**
   - Coin name and symbol
   - Artwork description
   - Optional advanced settings (market cap, currency)

3. **Mint on Blockchain**
   - Artwork is uploaded to IPFS for permanent storage
   - Coin is minted on Base using Zora protocol
   - Creator receives the coin and can start trading

### Trading Coins

1. **Browse Market**
   - Explore all available coins
   - Filter by price, volume, or creation date
   - View detailed coin information

2. **Execute Trades**
   - Buy coins with ETH or ZORA
   - Sell coins back to the market
   - Set slippage tolerance for price protection

3. **Portfolio Management**
   - Track your coin holdings
   - Monitor performance and profits
   - View transaction history

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
