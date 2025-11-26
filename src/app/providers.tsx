"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, useAccount, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { http } from "wagmi";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { sdk } from "@farcaster/miniapp-sdk";
import { FarcasterProvider } from '../lib/farcaster';
import { checkAndSwitchNetwork } from '../services/networkUtils';
import { SWRConfig } from 'swr';

// Create Wagmi configuration for both Farcaster mini-apps and BaseApp
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http('https://base-mainnet.g.alchemy.com/v2/W0EIbyevIb8MhQyUPQecm'),
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

// Component to handle automatic network switching
function NetworkSwitcher() {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    // Only attempt to switch if wallet is connected and not on Base mainnet
    if (isConnected && chainId && chainId !== base.id) {
      console.log(`Current chain: ${chainId}, switching to Base (${base.id})`);
      checkAndSwitchNetwork({ chainId, switchChain });
    }
  }, [isConnected, chainId, switchChain]);

  return null; // This component doesn't render anything
}

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

  // SWR cache provider with localStorage persistence for market data
  const swrProvider = () => {
    const map = new Map();
    
    // Try to restore from localStorage on init
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('swr-cache-market');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Only restore if cache is less than 5 minutes old
          if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
            Object.entries(parsed.data || {}).forEach(([key, value]) => {
              map.set(key, value);
            });
            console.log('✅ Restored SWR cache from localStorage');
          }
        }
      } catch (e) {
        console.warn('Failed to restore SWR cache:', e);
      }
    }
    
    return map;
  };

  return (
    <SWRConfig 
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 1 minute
        focusThrottleInterval: 60000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        provider: swrProvider,
        // This is the key: keep data indefinitely until explicitly revalidated
        revalidateIfStale: false,
        revalidateOnMount: true,
        keepPreviousData: true,
        // Persist cache to localStorage after successful fetch
        onSuccess: (data: any, key: string) => {
          if (typeof window !== 'undefined' && key.includes('/api/market')) {
            try {
              const currentCache = JSON.parse(localStorage.getItem('swr-cache-market') || '{}');
              currentCache.data = currentCache.data || {};
              currentCache.data[key] = data;
              currentCache.timestamp = Date.now();
              localStorage.setItem('swr-cache-market', JSON.stringify(currentCache));
            } catch (e) {
              console.warn('Failed to persist SWR cache:', e);
            }
          }
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <FarcasterProvider>
            {mounted ? (
              <>
                <NetworkSwitcher />
                {children}
              </>
            ) : null}
          </FarcasterProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </SWRConfig>
  );
}
