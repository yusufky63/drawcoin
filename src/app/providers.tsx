"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { http } from "wagmi";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { sdk } from "@farcaster/miniapp-sdk";
import { FarcasterProvider } from '../lib/farcaster';

// Create Wagmi configuration for both Farcaster mini-apps and BaseApp
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    // Farcaster connector for Farcaster mini-apps (auto-connects)
    miniAppConnector(),
    // Injected connector for browser wallets (MetaMask, etc.)
    injected(),
    // WalletConnect for mobile wallets
  
    // Coinbase Wallet
    coinbaseWallet({
      appName: 'DrawCoin',
    }),
  ]
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // React Query client
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 10 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  
  // Track whether we've mounted in the browser
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const signalMiniAppReady = async () => {
      try {
        await sdk.actions.ready();
      } catch (error) {
        // Swallow errors when not running inside the Base or Farcaster mini-app runtime
        if (process.env.NODE_ENV !== 'production') {
          console.debug('MiniApp SDK ready signal skipped', error);
        }
      }
    };

    // Notify BaseApp/Farcaster runtime that the UI is ready to display
    signalMiniAppReady();
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FarcasterProvider>
          {mounted ? children : null}
        </FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
