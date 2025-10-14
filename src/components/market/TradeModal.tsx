import React, { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getOnchainTokenDetails } from '../../services/sdk/getOnchainData';
import { executeTrade } from '../../services/sdk/getTradeCoin';
import { showTradeMessages, showError } from '../../utils/toastUtils';
import { Coin } from '../../lib/supabase';
import { sdk as miniAppSdk } from '@farcaster/miniapp-sdk';
import TradeSuccessModal from './TradeSuccessModal';

interface TradeModalProps {
  token: Coin | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TokenDetails {
  address: string;
  name: string;
  symbol: string;
  marketCap: { raw: string; formatted: string };
  liquidity: { raw: string; formatted: string };
  totalSupply: { raw: string; formatted: string };
  ownersCount: number;
  userBalance?: { raw: string; formatted: string };
}

export default function TradeModal({ token, isOpen, onClose }: TradeModalProps) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();

  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.05);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const quickEthOptions = ['0.01','0.02','0.05'];

  // Fetch token details from Zora API
  useEffect(() => {
    if (isOpen && token && address) {
      fetchTokenDetails();
    }
  }, [isOpen, token, address]);


  const fetchTokenDetails = async () => {
    if (!token?.contract_address) return;

    setLoading(true);
    try {
      const details = await getOnchainTokenDetails(token.contract_address, address);
      if (details) {
        setTokenDetails(details as TokenDetails);
      }
    } catch (error) {
      console.error('Error fetching token details:', error);
      showError('Failed to load token data', 'token data loading');
    } finally {
      setLoading(false);
    }
  };

  const handleShareTrade = async () => {
    if (!token) return;

    try {
      const shareText = tradeType === 'buy' 
        ? `Just bought ${amount} ${token.symbol} tokens! 🎨💰 Check out this amazing hand-drawn art token on DrawCoin!`
        : `Just sold ${amount} ${token.symbol} tokens! 🎨📈 Trading hand-drawn art tokens on DrawCoin!`;

      await miniAppSdk.actions.composeCast({
        text: shareText,
        embeds: [`https://drawcoin-mini.vercel.app/coin/${token.contract_address}`]
      });
    } catch (error) {
      console.error('Error sharing trade:', error);
      showError('Failed to share trade', 'share trade');
    }
  };

  const handleTrade = async () => {
    if (!isConnected || !address || !walletClient || !publicClient || !token || !tokenDetails) {
      showError('Please connect your wallet', 'wallet connection');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showError('Please enter a valid amount', 'form validation');
      return;
    }

    // Set trading state immediately to show loading UI
    setTrading(true);
    showTradeMessages.loading(tradeType, amount, token.symbol);

    try {
      // Pass human-readable amount; executeTrade will convert based on direction
      const result = await executeTrade({
        direction: tradeType,
        coinAddress: token.contract_address,
        amountIn: amount,
        recipient: address,
        slippage,
        walletClient,
        publicClient,
        account: address,
        switchChain
      });
      // If no error thrown, treat as success
      showTradeMessages.success(tradeType);
      
      // Show success modal instead of auto-sharing
      setShowSuccessModal(true);
      
      // Refresh token details
      await fetchTokenDetails();
    } catch (error: any) {
      console.error('Trade error:', error);
      showTradeMessages.error(error);
    } finally {
      setTrading(false);
    }
  };

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="hand-drawn-card max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ 
        transform: 'rotate(-0.5deg)',
        maxWidth: '500px',
        maxHeight: '600px'
      }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-art-gray-900" style={{ borderStyle: 'dashed' }}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-art-gray-50 overflow-hidden" style={{ 
              border: '2px solid #2d3748',
              borderRadius: '15px 5px 10px 8px',
              transform: 'rotate(0.5deg)'
            }}>
              {token.image_url ? (
                <img 
                  src={token.image_url} 
                  alt={token.name}
                  className="w-full h-full object-contain bg-white"
                  style={{ borderRadius: '13px 3px 8px 6px' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-art-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-art-gray-900 transform -rotate-0.5">
                {token.name}
              </h2>
              <p className="text-sm text-art-gray-500 font-mono bg-art-gray-100 px-2 py-0.5 rounded-art transform rotate-1 inline-block">
                {token.symbol}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-art-gray-400 hover:text-art-gray-600 transition-colors transform rotate-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">

          {/* Token Stats */}
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 bg-art-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-art-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-art-gray-200 rounded animate-pulse"></div>
            </div>
          ) : tokenDetails ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-art-gray-50 p-2 rounded-art transform rotate-1" style={{ borderRadius: '10px 3px 8px 5px' }}>
                <div className="text-art-gray-500 text-xs">Market Cap</div>
                <div className="font-bold text-art-gray-900">
                  {tokenDetails.marketCap?.formatted || '0'} ETH
                </div>
              </div>
              <div className="bg-art-gray-50 p-2 rounded-art transform -rotate-1" style={{ borderRadius: '8px 5px 10px 3px' }}>
                <div className="text-art-gray-500 text-xs">Liquidity</div>
                <div className="font-bold text-art-gray-900">
                  {tokenDetails.liquidity?.formatted || '0'} ETH
                </div>
              </div>
              <div className="bg-art-gray-50 p-2 rounded-art transform rotate-0.5" style={{ borderRadius: '12px 4px 6px 8px' }}>
                <div className="text-art-gray-500 text-xs">Holders</div>
                <div className="font-bold text-art-gray-900">
                  {tokenDetails.ownersCount || 0}
                </div>
              </div>
              <div className="bg-art-gray-50 p-2 rounded-art transform -rotate-0.5" style={{ borderRadius: '6px 8px 12px 4px' }}>
                <div className="text-art-gray-500 text-xs">Your Balance</div>
                <div className="font-bold text-art-gray-900">
                  {tokenDetails.userBalance?.formatted || '0'} {tokenDetails.symbol}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-art-gray-500">Failed to load token data</p>
            </div>
          )}

          {/* Trade Type */}
          <div>
            <label className="block text-sm font-bold text-art-gray-600 mb-2 transform rotate-0.5">
              Trade Type
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setTradeType('buy')}
                className={`hand-drawn-btn flex-1 text-sm font-bold ${
                  tradeType === 'buy' ? 'secondary' : ''
                }`}
                style={{ 
                  transform: tradeType === 'buy' ? 'rotate(-1deg)' : 'rotate(0.5deg)',
                  backgroundColor: tradeType === 'buy' ? undefined : 'transparent',
                  color: tradeType === 'buy' ? undefined : '#2d3748'
                }}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeType('sell')}
                className={`hand-drawn-btn flex-1 text-sm font-bold ${
                  tradeType === 'sell' ? 'danger' : ''
                }`}
                style={{ 
                  transform: tradeType === 'sell' ? 'rotate(1deg)' : 'rotate(-0.5deg)',
                  backgroundColor: tradeType === 'sell' ? undefined : 'transparent',
                  color: tradeType === 'sell' ? undefined : '#2d3748'
                }}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-bold text-art-gray-600 mb-2 transform -rotate-0.5">
              Amount ({tradeType === 'buy' ? 'ETH' : token.symbol})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter ${tradeType === 'buy' ? 'ETH' : token.symbol} amount`}
              className="hand-drawn-input w-full text-sm"
              disabled={trading}
            />
            {/* Quick amount buttons */}
            <div className="flex items-center gap-2 mt-2">
              {tradeType === 'buy' ? quickEthOptions.map((v, index) => (
                <button 
                  key={v} 
                  onClick={() => setAmount(v)} 
                  className="hand-drawn-btn text-xs font-bold"
                  style={{ 
                    padding: '0.4rem 0.6rem',
                    transform: `rotate(${index % 2 === 0 ? '1deg' : '-1deg'})`
                  }}
                >
                  {v} ETH
                </button>
              )) : (
                <>
                  <button onClick={() => setAmount('0.25')} className="hand-drawn-btn text-xs font-bold" style={{ padding: '0.4rem 0.6rem', transform: 'rotate(1deg)' }}>25%</button>
                  <button onClick={() => setAmount('0.5')} className="hand-drawn-btn text-xs font-bold" style={{ padding: '0.4rem 0.6rem', transform: 'rotate(-1deg)' }}>50%</button>
                  <button onClick={() => setAmount((tokenDetails?.userBalance?.formatted || '0'))} className="hand-drawn-btn text-xs font-bold" style={{ padding: '0.4rem 0.6rem', transform: 'rotate(0.5deg)' }}>Max</button>
                </>
              )}
            </div>
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-sm font-bold text-art-gray-600 mb-2 transform rotate-0.5">
              Slippage Tolerance
            </label>
            <div className="flex space-x-2">
            {[0.01, 0.05, 0.1].map((value, index) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded-art text-sm font-bold transition-colors transform ${
                    slippage === value
                      ? 'bg-art-gray-900 text-art-white'
                      : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                  }`}
                  style={{ 
                    borderRadius: '10px 3px 8px 5px',
                    transform: `rotate(${index % 2 === 0 ? '1deg' : '-1deg'})`
                  }}
                >
                  {(value * 100).toFixed(1)}%
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Connection Status */}
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-art p-3 mb-4">
              <div className="flex items-center">
                <svg
                  className="w-4 h-4 text-yellow-600 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-xs text-yellow-800">
                  Please connect your wallet to trade
                </p>
              </div>
            </div>
          )}

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={trading || !amount || !isConnected}
            className={`hand-drawn-btn w-full text-sm font-bold ${
              tradeType === 'buy' ? 'secondary' : 'danger'
            }`}
            style={{ 
              padding: '0.75rem 1.5rem',
              transform: 'rotate(-0.5deg)',
              opacity: (!amount || !isConnected) ? 0.5 : 1
            }}
          >
            {trading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {tradeType === 'buy' ? 'Buying...' : 'Selling...'}
              </div>
            ) : !isConnected ? (
              'Connect Wallet'
            ) : (
              `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${token.symbol}`
            )}
          </button>

        </div>
      </div>

      {/* Trade Success Modal */}
      <TradeSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
        }}
        onViewToken={() => {
          setShowSuccessModal(false);
          onClose();
          // Navigate to token page
          window.open(`/coin/${token.contract_address}`, '_blank');
        }}
        tradeType={tradeType}
        amount={amount}
        token={token}
        tokenPrice={tokenDetails?.marketCap?.formatted}
      />
    </div>
  );
}
