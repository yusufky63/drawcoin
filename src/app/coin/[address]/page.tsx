'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CoinDetailPage from '../../../components/coin/CoinDetailPage';
import { Coin } from '../../../lib/supabase';
import { getOnchainTokenDetails } from '../../../services/sdk/getOnchainData';
import { getCoinDetails } from '../../../services/sdk/getCoins';

export default function CoinRoutePage() {
  const params = useParams();
  const router = useRouter();
  const contractAddress = params.address as string;
  
  const [token, setToken] = useState<Coin | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      if (!contractAddress) return;
      
      setLoading(true);
      try {
        console.log('Loading token data for:', contractAddress);
        
        // Create initial token object
        const initialToken: Coin = {
          id: '0',
          name: 'Loading...',
          symbol: 'LOADING',
          contract_address: contractAddress,
          image_url: '',
          description: '',
          category: '',
          creator_address: '',
          tx_hash: '',
          chain_id: 8453,
          currency: 'ETH',
          holders: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setToken(initialToken);
        setInitialLoad(false); // Show loading screen immediately
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
        // Fetch data from both APIs in parallel with timeout
        const [zoraData, onchainData] = await Promise.allSettled([
          Promise.race([getCoinDetails(contractAddress), timeoutPromise]),
          Promise.race([getOnchainTokenDetails(contractAddress), timeoutPromise])
        ]);
        
        console.log('Zora API result:', zoraData);
        console.log('Onchain data result:', onchainData);
        
        // Combine data from both sources
        let finalToken: Coin = { ...initialToken };
        
        // Use Zora API data if available
        if (zoraData.status === 'fulfilled' && zoraData.value) {
          const zora = zoraData.value as any;
          console.log('Zora data structure:', zora);
          
          // Handle both direct response and nested zora20Token structure
          const tokenData = zora.zora20Token || zora;
          
          finalToken = {
            ...finalToken,
            name: tokenData.name || finalToken.name,
            symbol: tokenData.symbol || finalToken.symbol,
            image_url: tokenData.mediaContent?.previewImage?.small || tokenData.mediaContent?.previewImage?.medium || finalToken.image_url,
            description: tokenData.description || finalToken.description,
            // Add Zora-specific data
            creator: tokenData.creatorProfile || tokenData.creator,
            creatorAddress: tokenData.creatorAddress,
            mediaContent: tokenData.mediaContent,
            totalSupply: tokenData.totalSupply,
            marketCap: tokenData.marketCap,
            volume24h: tokenData.volume24h,
            uniqueHolders: tokenData.uniqueHolders,
            tokenPrice: tokenData.tokenPrice,
            poolCurrencyToken: tokenData.poolCurrencyToken,
            uniswapV4PoolKey: tokenData.uniswapV4PoolKey,
            platformReferrerAddress: tokenData.platformReferrerAddress,
            payoutRecipientAddress: tokenData.payoutRecipientAddress,
            tokenUri: tokenData.tokenUri,
            chainId: tokenData.chainId,
            createdAt: tokenData.createdAt
          };
        }
        
        // Use onchain data if available (for trading info)
        if (onchainData.status === 'fulfilled' && onchainData.value && !(onchainData.value as any).hasError) {
          const onchain = onchainData.value as any;
          finalToken = {
            ...finalToken,
            // Override with onchain data if Zora data is missing
            name: finalToken.name === 'Loading...' ? (onchain.name || finalToken.name) : finalToken.name,
            symbol: finalToken.symbol === 'LOADING' ? (onchain.symbol || finalToken.symbol) : finalToken.symbol,
            // Add onchain-specific data
            ...(onchain.pool && { pool: onchain.pool }),
            ...(onchain.poolAddress && { poolAddress: onchain.poolAddress }),
            ...(onchain.marketCap && { marketCap: onchain.marketCap }),
            ...(onchain.liquidity && { liquidity: onchain.liquidity }),
            ...(onchain.totalSupply && { totalSupply: onchain.totalSupply }),
            ...(onchain.ownersCount && { ownersCount: onchain.ownersCount })
          };
        }
        
        // Handle errors
        if (zoraData.status === 'rejected') {
          console.warn('Zora API failed:', zoraData.reason);
        }
        if (onchainData.status === 'rejected') {
          console.warn('Onchain data failed:', onchainData.reason);
        }
        
        // If both APIs failed, show error
        if (zoraData.status === 'rejected' && onchainData.status === 'rejected') {
          throw new Error('Failed to load token data from both sources');
        }
        
        setToken(finalToken);
        
      } catch (error) {
        console.error('Error loading token:', error);
        // Set error token
        setToken({
          id: '0',
          name: 'Error Loading Token',
          symbol: 'ERROR',
          contract_address: contractAddress,
          image_url: '',
          description: 'Failed to load token data',
          category: '',
          creator_address: '',
          tx_hash: '',
          chain_id: 8453,
          currency: 'ETH',
          holders: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, [contractAddress]);

  const handleBack = () => {
    router.back();
  };

  if (loading || initialLoad) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"></div>
          <p className="text-art-gray-600">Loading token...</p>
          <p className="text-xs text-art-gray-500 mt-2">Fetching data from blockchain...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">❌ Token not found</div>
          <button
            onClick={handleBack}
            className="hand-drawn-btn"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 pb-20 md:pb-0">
      <CoinDetailPage token={token} onBack={handleBack} />
    </div>
  );
}