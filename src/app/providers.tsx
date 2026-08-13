"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type State,
  WagmiProvider,
  useAccount,
  useSwitchChain,
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { usePathname } from "next/navigation";
import { getConfig } from "@/lib/wagmiConfig";
import { checkAndSwitchNetwork } from '../services/networkUtils';
import { SWRConfig } from 'swr';
import ArtToaster from '@/components/ui/ArtToaster';

// Component to handle automatic network switching
function NetworkSwitcher() {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const pathname = usePathname();

  useEffect(() => {
    // Base Sepolia is permitted only on Missions so the documented badge
    // staging flow can run without fighting the global mainnet guard.
    const isMissionTestnet =
      pathname === "/missions" && chainId === baseSepolia.id;

    if (isConnected && chainId && chainId !== base.id && !isMissionTestnet) {
      console.log(`Current chain: ${chainId}, switching to Base (${base.id})`);
      checkAndSwitchNetwork({ chainId, switchChain });
    }
  }, [isConnected, chainId, pathname, switchChain]);

  return null; // This component doesn't render anything
}

export default function Providers({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  const [wagmiConfig] = useState(() => getConfig());
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
  
  return (
    <SWRConfig 
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 1 minute
        focusThrottleInterval: 60000,
        errorRetryCount: 1,
        errorRetryInterval: 2000,
        revalidateIfStale: false,
        revalidateOnMount: true,
        keepPreviousData: true,
      }}
    >
      <WagmiProvider config={wagmiConfig} initialState={initialState}>
        <QueryClientProvider client={queryClient}>
          <NetworkSwitcher />
          {children}
          <ArtToaster />
        </QueryClientProvider>
      </WagmiProvider>
    </SWRConfig>
  );
}
