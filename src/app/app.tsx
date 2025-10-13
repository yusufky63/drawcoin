"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import MarketPage from "../components/market/MarketPage";
import CreatePage from "../components/create/CreatePage";
import CoinDetailPage from "../components/coin/CoinDetailPage";
import DetailsModal from "../components/market/DetailsModal";
import { Coin } from "../lib/supabase";
import { initializeFarcaster, dismissSplashScreen } from "./mini-app";

// Loading component removed

// NoSSR wrapper component
function NoSSR({ children }: { children: React.ReactNode }) {
  return (
    <div suppressHydrationWarning>
      {typeof window === 'undefined' ? null : children}
    </div>
  )
}
NoSSR.displayName = 'NoSSR';

// Create dynamic import for portfolio component
const PortfolioPage = dynamic(
  () => import("../components/portfolio/PortfolioPage").catch(err => {
    console.error("[APP] Error importing PortfolioPage:", err);
    const FallbackComponent = () => (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-art-gray-900 mb-2">Portfolio</h2>
          <p className="text-art-gray-600">Connect your wallet to view your token holdings.</p>
        </div>
      </div>
    );
    return { default: FallbackComponent };
  }),
  { ssr: false }
);

// App component props
interface AppProps {
  isMiniApp?: boolean;
  userName?: string;
  userFid?: number;
}

// Top level app component
export default function App({ isMiniApp = false, userName = 'User', userFid }: AppProps) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState("explore");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Coin | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeToken, setTradeToken] = useState<Coin | null>(null);

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
    console.log('[APP] App component mounted, client-side rendering enabled');
    
    if (isMiniApp) {
      console.log(`[APP] Running in Farcaster Mini App context for user: ${userName} (FID: ${userFid})`);
    }
    
    // No loading delay needed
    
    if (typeof window !== 'undefined') {
      // Tab değişimlerini dinle
      const handleTabChangeEvent = (event: CustomEvent) => {
        if (event.detail && event.detail.tab) {
          setActiveTab(event.detail.tab);
        }
      };
      
      window.addEventListener('changeTab', handleTabChangeEvent as EventListener);
      
      return () => {
        window.removeEventListener('changeTab', handleTabChangeEvent as EventListener);
      };
    }
  }, [isMiniApp, userName, userFid]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // SSR durumunda hiçbir şey render etme
  if (!isClient) {
    return null;
  }

  // No loading screen needed

  const handleTrade = (token: Coin) => {
    console.log('Trade token:', token);
    setTradeToken(token);
    setTradeModalOpen(true);
  };

  const handleView = (token: Coin) => {
    console.log('View token:', token);
    // Navigate to coin detail page
    router.push(`/coin/${token.contract_address}`);
  };

  const handleCreateSuccess = (tokenAddress: string) => {
    console.log('Token created:', tokenAddress);
    setActiveTab("explore");
    // TODO: Show success message and redirect to market
  };

  const renderContent = () => {
    // If a token is selected, show coin detail page
    if (selectedToken) {
      return <CoinDetailPage token={selectedToken} onBack={() => setSelectedToken(null)} />;
    }

    switch (activeTab) {
      case "explore":
        return <MarketPage onTrade={handleTrade} onView={handleView} />;
      case "create":
        return <CreatePage onSuccess={handleCreateSuccess} />;
      case "portfolio":
        return <PortfolioPage onView={handleView} />;
      default:
        return <MarketPage onTrade={handleTrade} onView={handleView} />;
    }
  };

  return (
    <NoSSR>
      <div className="min-h-screen bg-art-gray-50">
        <main className="pb-20 md:pb-0">
          {renderContent()}
        </main>
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#1e293b',
              fontFamily: 'Inter, system-ui, sans-serif',
              border: '1px solid #e5e5e5',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              fontSize: '0.875rem',
              padding: '0.75rem',
              borderRadius: '8px'
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
            duration: 3000,
            id: 'art-toast',
          }}
          gutter={4}
          containerStyle={{
            top: 20,
          }}
          containerClassName="art-toasts"
        />

        {/* Details Modal */}
        {tradeModalOpen && tradeToken && (
          <DetailsModal
            token={tradeToken}
            isOpen={tradeModalOpen}
            onClose={() => {
              setTradeModalOpen(false);
              setTradeToken(null);
            }}
          />
        )}
      </div>
    </NoSSR>
  );
}
