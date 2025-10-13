"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Coin } from "../../lib/supabase";
import { getOnchainTokenDetails } from "../../services/sdk/getOnchainData";
import { getCoinDetails } from "../../services/sdk/getCoins";
import { executeTrade, executeERC20Trade, getZORATokenAddress } from "../../services/sdk/getTradeCoin";
import { getETHPrice } from "../../services/ethPrice";

interface CoinDetailPageProps {
  token: Coin;
  onBack?: () => void;
}

export default function CoinDetailPage({ token, onBack }: CoinDetailPageProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // State
  const [loading, setLoading] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState(0.05); // Dynamic slippage
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<'ETH' | 'USDC'>('ETH');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<Array<{symbol: string, address: string, balance: string}>>([]);
  const [onchainData, setOnchainData] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);

  // Token addresses on Base
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // Fetch ETH price
  useEffect(() => {
    const fetchETHPrice = async () => {
      try {
        const price = await getETHPrice();
        setEthPrice(price);
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }
    };
    fetchETHPrice();
  }, []);


  // Fetch market data from Zora API (always fetch, regardless of user connection)
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const details = await getCoinDetails(token.contract_address);
        setMarketData(details);
      } catch (error) {
        console.error('Error fetching market data:', error);
      }
    };

    fetchMarketData();
  }, [token.contract_address]);

  // Fetch onchain data (always fetch, regardless of user connection)
  useEffect(() => {
    const fetchOnchainData = async () => {
      try {
        const details = await getOnchainTokenDetails(token.contract_address);
        setOnchainData(details);
      } catch (error) {
        console.error('Error fetching onchain data:', error);
      }
    };

    fetchOnchainData();
  }, [token.contract_address]);

  // Fetch balances (only when user is connected)
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !publicClient) return;

      try {
        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ address });
        setEthBalance((Number(ethBalance) / 1e18).toFixed(4));

        // Fetch USDC balance
        const usdcBalance = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: [{
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
          }],
          functionName: "balanceOf",
          args: [address as `0x${string}`]
        });
        setUsdcBalance((Number(usdcBalance) / 10**6).toFixed(2));

        // Fetch token balance
        const tokenBalance = await publicClient.readContract({
          address: token.contract_address as `0x${string}`,
          abi: [
            {
              "constant": true,
              "inputs": [{"name": "_owner", "type": "address"}],
              "name": "balanceOf",
              "outputs": [{"name": "balance", "type": "uint256"}],
              "type": "function"
            }
          ],
          functionName: 'balanceOf',
          args: [address]
        });
        setTokenBalance((Number(tokenBalance) / 1e18).toFixed(4));
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [address, publicClient, token.contract_address]);

  // Fetch available tokens for selection
  useEffect(() => {
    const fetchAvailableTokens = async () => {
      if (address && publicClient) {
        try {
          const tokens = [
            { symbol: 'ETH', address: 'ETH', balance: ethBalance },
            { symbol: 'USDC', address: USDC_ADDRESS, balance: usdcBalance }
          ];
          setAvailableTokens(tokens);
        } catch (error) {
          console.error("Failed to fetch available tokens:", error);
        }
      }
    };
    fetchAvailableTokens();
  }, [address, publicClient, ethBalance, usdcBalance]);

  const handleTrade = async () => {
    if (!isConnected || !walletClient || !publicClient || !address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    // Token addresses on Base
    const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const loadingToast = toast.loading("Processing trade...");

    try {
      if (tradeType === 'buy') {
        // Buying with different currencies
        if (selectedCurrency === 'ETH') {
          // ETH to Token
          const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
          await executeTrade({
            direction: 'buy',
            coinAddress: token.contract_address,
            amountIn: amountInWei.toString(),
            recipient: address,
            slippage: slippage,
            walletClient,
            publicClient,
            account: address
          });
        } else {
          // USDC to Token
          const sellTokenAddress = USDC_ADDRESS;
          const decimals = 6;
          const amountInBigInt = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
          
          // Update loading message for ERC20 trades
          toast.loading(
            `Approving ${selectedCurrency} for trading... This may require 2 transactions.`,
            { 
              id: "trade-toast",
              duration: 0
            }
          );
          
          await executeERC20Trade({
            sellTokenAddress,
            buyTokenAddress: token.contract_address,
            amountIn: amountInBigInt,
            recipient: address,
            slippage: slippage,
            walletClient,
            publicClient,
            account: address,
          });
        }
      } else {
        // Selling token for ETH
        const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
        await executeTrade({
          direction: 'sell',
          coinAddress: token.contract_address,
          amountIn: amountInWei.toString(),
          recipient: address,
          slippage: 0.05,
          walletClient,
          publicClient,
          account: address
        });
      }

      toast.success(`${tradeType === 'buy' ? 'Buy' : 'Sell'} successful!`);
      
      // Refresh balances
      const ethBalance = await publicClient.getBalance({ address });
      setEthBalance((Number(ethBalance) / 1e18).toFixed(4));

      // Refresh USDC balance
      const usdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: [{
          "constant": true,
          "inputs": [{"name": "_owner", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"name": "balance", "type": "uint256"}],
          "type": "function"
        }],
        functionName: "balanceOf",
        args: [address as `0x${string}`]
      });
      setUsdcBalance((Number(usdcBalance) / 10**6).toFixed(2));


      const tokenBalance = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
        abi: [
          {
            "constant": true,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
          }
        ],
        functionName: 'balanceOf',
        args: [address]
      });
      setTokenBalance((Number(tokenBalance) / 1e18).toFixed(4));

      setAmount('');
    } catch (error: any) {
      console.error('Trade error:', error);
      
      // User-friendly error messages
      let errorMessage = 'Transaction failed';
      
      if (error?.message?.includes('User rejected') || error?.message?.includes('denied transaction')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds';
      } else if (error?.message?.includes('gas')) {
        errorMessage = 'Transaction failed - try again';
      } else if (error?.message?.includes('Quote failed') || error?.message?.includes('500')) {
        errorMessage = 'Token not ready for trading yet';
      } else if (error?.message?.includes('Internal Server Error')) {
        errorMessage = 'Service temporarily unavailable';
      } else if (error?.message) {
        // Keep original message but make it shorter
        errorMessage = error.message.length > 50 ? error.message.substring(0, 50) + '...' : error.message;
      }
      
      toast.error(`❌ ${tradeType === 'buy' ? 'Buy' : 'Sell'} failed: ${errorMessage}`);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleQuickPercent = (percent: number) => {
    const balance = tradeType === 'buy' 
      ? (() => {
          switch (selectedCurrency) {
            case 'ETH': return ethBalance;
            case 'USDC': return usdcBalance;
            default: return ethBalance;
          }
        })()
      : tokenBalance;
    const newAmount = (parseFloat(balance) * percent / 100).toFixed(4);
    setAmount(newAmount);
  };

  const maxBalance = tradeType === 'buy' 
    ? (() => {
        switch (selectedCurrency) {
          case 'ETH': return parseFloat(ethBalance);
          case 'USDC': return parseFloat(usdcBalance);
          default: return parseFloat(ethBalance);
        }
      })()
    : parseFloat(tokenBalance);
  const usdValue = (() => {
    if (!amount) return 0;
    if (tradeType === 'buy') {
      if (selectedCurrency === 'USDC') {
        // USDC is already in USD
        return parseFloat(amount);
      } else if (selectedCurrency === 'ETH') {
        // ETH to USD conversion
        return parseFloat(amount) * ethPrice;
      }
    } else {
      // Token to USD conversion
      const tokenPrice = (token as any).tokenPrice?.priceInUsdc;
      return tokenPrice ? parseFloat(amount) * parseFloat(tokenPrice) : 0;
    }
  })();

  return (
    <div className="min-h-screen bg-art-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="hand-drawn-btn text-sm font-bold px-3 py-1 transform rotate-1 mb-2"
            style={{ 
              padding: '0.25rem 0.75rem',
              borderRadius: '6px 2px 4px 3px'
            }}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-art-gray-900 transform -rotate-1">
            {token.name} ({token.symbol})
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Image */}
          <div className="hand-drawn-card">
            <div className="bg-art-gray-100 rounded-art-lg overflow-hidden p-4" style={{ borderRadius: '20px 10px 25px 15px' }}>
              {token.image_url ? (
                <img
                  src={token.image_url}
                  alt={token.name}
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const nextElement = target.nextElementSibling as HTMLElement;
                    if (nextElement) {
                      nextElement.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div 
                className="w-full h-64 flex items-center justify-center text-6xl font-bold text-art-gray-400"
                style={{ display: token.image_url ? 'none' : 'flex' }}
              >
                🎨
              </div>
            </div>
          </div>

          {/* Right Side - Trading */}
          <div className="hand-drawn-card">
            <div className="p-4">
              {/* Trade Type Toggle */}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setTradeType('buy')}
                  className={`flex-1 py-2 px-3 text-sm font-bold transition-all duration-200 ${
                    tradeType === 'buy'
                      ? 'bg-art-gray-900 text-art-white'
                      : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                  }`}
                  style={{ 
                    borderRadius: '12px 3px 8px 6px',
                    transform: tradeType === 'buy' ? 'rotate(-1deg)' : 'rotate(0.5deg)',
                    border: '2px solid #2d3748',
                    boxShadow: tradeType === 'buy' ? '2px 2px 0 #2d3748' : '1px 1px 0 #2d3748'
                  }}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradeType('sell')}
                  className={`flex-1 py-2 px-3 text-sm font-bold transition-all duration-200 ${
                    tradeType === 'sell'
                      ? 'bg-art-gray-900 text-art-white'
                      : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                  }`}
                  style={{ 
                    borderRadius: '8px 12px 6px 10px',
                    transform: tradeType === 'sell' ? 'rotate(1deg)' : 'rotate(-0.5deg)',
                    border: '2px solid #2d3748',
                    boxShadow: tradeType === 'sell' ? '2px 2px 0 #2d3748' : '1px 1px 0 #2d3748'
                  }}
                >
                  Sell
                </button>
              </div>

              {/* Slippage Setting - Toggle */}
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-art-gray-500">
                    Slippage: {Math.round(slippage * 100)}%
                  </div>
                  <button
                    onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                    className="text-xs text-art-gray-600 hover:text-art-gray-800 transform rotate-1"
                  >
                    {showSlippageSettings ? 'Hide' : 'Custom'}
                  </button>
                </div>
                
                {showSlippageSettings && (
                  <div className="mt-2 p-3 bg-art-gray-50 rounded-art transform -rotate-0.5" style={{ borderRadius: '10px 5px 8px 6px' }}>
                    <div className="space-y-2">
                      <div className="text-xs text-art-gray-600 font-bold">Slippage Tolerance</div>
                      
                      {/* Quick Slippage Options */}
                      <div className="flex gap-2">
                        {[0.01, 0.05, 0.1, 0.5].map((value) => (
                          <button
                            key={value}
                            onClick={() => setSlippage(value)}
                            className={`px-2 py-1 text-xs font-bold transition-all duration-200 ${
                              slippage === value
                                ? 'bg-art-gray-900 text-white'
                                : 'bg-white text-art-gray-700 hover:bg-art-gray-100'
                            }`}
                            style={{
                              borderRadius: '6px 2px 4px 3px',
                              transform: slippage === value ? 'rotate(-1deg)' : 'rotate(0.5deg)',
                              border: '1px solid #2d3748'
                            }}
                          >
                            {Math.round(value * 100)}%
                          </button>
                        ))}
                      </div>
                      
                      {/* Custom Slippage Input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.1"
                          max="50"
                          step="0.1"
                          value={slippage * 100}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value >= 0.1 && value <= 50) {
                              setSlippage(value / 100);
                            }
                          }}
                          className="hand-drawn-input flex-1 text-xs"
                          style={{ padding: '0.5rem' }}
                          placeholder="Custom %"
                        />
                        <span className="text-xs text-art-gray-500">%</span>
                      </div>
                      
                      <div className="text-xs text-art-gray-500">
                        {slippage < 0.01 && '⚠️ Very low slippage may cause failed transactions'}
                        {slippage > 0.1 && '⚠️ High slippage may result in unfavorable prices'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount Input with Currency Selection */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-art-gray-600 transform -rotate-0.5">
                    Amount
                  </label>
                  <div className="text-xs text-art-gray-500">
                    {tradeType === 'buy' 
                      ? `Your ${selectedCurrency}: ${(() => {
                          switch (selectedCurrency) {
                            case 'ETH': return `${ethBalance} ETH`;
                            case 'USDC': return `${usdcBalance} USDC`;
                            default: return `${ethBalance} ETH`;
                          }
                        })()}`
                      : `Your ${token.symbol}: ${tokenBalance} ${token.symbol}`
                    }
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* Amount Input */}
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="hand-drawn-input flex-1 p-2 font-mono text-lg"
                  />
                  {/* Currency Selection */}
                  {tradeType === 'buy' && (
                    <button
                      onClick={() => setShowTokenSelect(true)}
                      className="hand-drawn-btn text-sm font-bold py-2 px-3 transform rotate-1 flex-shrink-0"
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px 3px 6px 4px',
                        minWidth: '80px'
                      }}
                    >
                      {selectedCurrency}
                    </button>
                  )}
                </div>
                {amount && (
                  <div className="mt-1 text-xs text-art-gray-500">
                    ≈ ${usdValue?.toFixed(2) || '0.00'} USD
                  </div>
                )}
              </div>

              {/* Amount Slider */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-art-gray-600 mb-2 transform rotate-0.5">
                  Amount Slider
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={(() => {
                    if (!amount || !maxBalance) return 0;
                    return (parseFloat(amount) / maxBalance) * 100;
                  })()}
                  onChange={(e) => {
                    const percentage = parseFloat(e.target.value) / 100;
                    const newAmount = (maxBalance * percentage).toFixed(4);
                    setAmount(newAmount);
                  }}
                  className="hand-drawn-input w-full h-3"
                  style={{ 
                    background: (() => {
                      if (!amount || !maxBalance) return 'linear-gradient(to right, #e2e8f0 0%, #e2e8f0 100%)';
                      const percentage = (parseFloat(amount) / maxBalance) * 100;
                      return `linear-gradient(to right, #4299e1 0%, #4299e1 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
                    })()
                  }}
                />
                <div className="flex justify-between text-xs text-art-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Quick Percentage Buttons */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-art-gray-600 mb-2 transform -rotate-0.5">
                  Quick Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.25,0.5,0.75,1].map((p, index) => (
                    <button 
                      key={p} 
                      onClick={()=>{
                        const newAmount = (maxBalance * p).toFixed(4);
                        setAmount(newAmount);
                      }} 
                      className="hand-drawn-btn text-xs font-bold"
                      style={{ 
                        padding: '0.5rem 0.75rem',
                        transform: `rotate(${index % 2 === 0 ? '1deg' : '-1deg'})`
                      }}
                    >
                      {Math.round(p*100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade Summary */}
              {amount && (
                <div className="bg-art-gray-50 p-2 rounded-art transform rotate-0.3 mb-4" style={{ borderRadius: '8px 6px 10px 4px' }}>
                  <div className="text-xs text-art-gray-600">
                    {tradeType === 'buy' ? 'Buy' : 'Sell'} {parseFloat(amount).toFixed(4)} {tradeType === 'buy' ? 'ETH' : token.symbol}
                    <span className="text-art-gray-500 ml-2">
                      ≈ ${usdValue?.toFixed(2) || '0.00'} USD
                    </span>
                  </div>
                </div>
              )}

              {/* ERC20 Token Info */}
              {tradeType === 'buy' && selectedCurrency !== 'ETH' && (
                <div className="border rounded-art p-3 mb-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs text-blue-800">
                      {selectedCurrency} trading may require 2 transactions: approval + trade
                    </p>
                  </div>
                </div>
              )}

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
              <div className="pt-2">
                <button 
                  onClick={handleTrade}
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  className="w-full hand-drawn-btn text-sm font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    padding: '0.75rem 1rem',
                    transform: 'rotate(-0.5deg)'
                  }}
                >
                  {loading ? 'Processing...' : `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${token.symbol}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Coin Details */}
        <div className="mt-2">
          <div className="hand-drawn-card">
            <div className="p-4">
              <h2 className="text-xl font-bold text-art-gray-900 mb-4 transform -rotate-1">
                Token Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-art-gray-900">Basic Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Name:</span>
                      <span className="text-sm font-bold text-art-gray-900">{token.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Symbol:</span>
                      <span className="text-sm font-bold text-art-gray-900">{token.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Contract:</span>
                      <span className="text-sm font-mono text-art-gray-700">
                        {token.contract_address?.substring(0, 6)}...{token.contract_address?.substring(token.contract_address.length - 4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Creator:</span>
                      <div className="flex items-center space-x-2">
                        {token.creator?.avatar?.previewImage?.small && (
                          <img 
                            src={token.creator.avatar.previewImage.small} 
                            alt="Creator" 
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span className="text-sm font-mono text-art-gray-700">
                          {token.creator?.handle || token.creatorAddress?.substring(0, 6)}...{token.creatorAddress?.substring(token.creatorAddress.length - 4)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Market Data */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-art-gray-900">Market Data</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Price:</span>
                      <span className="text-sm font-bold text-art-gray-900">
                        {marketData?.tokenPrice?.priceInUsdc ? `$${parseFloat(marketData.tokenPrice.priceInUsdc).toFixed(8)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Market Cap:</span>
                      <span className="text-sm font-bold text-art-gray-900">
                        {marketData?.marketCap ? `$${parseFloat(marketData.marketCap).toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">24h Volume:</span>
                      <span className="text-sm font-bold text-art-gray-900">
                        {marketData?.volume24h ? `$${parseFloat(marketData.volume24h).toLocaleString()}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">Holders:</span>
                      <span className="text-sm font-bold text-art-gray-900">
                        {marketData?.uniqueHolders ? marketData.uniqueHolders.toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-art-gray-600">24h Change:</span>
                      <span className={`text-sm font-bold ${
                        (() => {
                          const marketCap = parseFloat(marketData?.marketCap);
                          const delta24h = parseFloat(marketData?.marketCapDelta24h);
                          if (marketCap && delta24h && marketCap !== delta24h) {
                            const previousMC = marketCap - delta24h;
                            if (previousMC > 0) {
                              const changePct = (delta24h / previousMC) * 100;
                              return changePct > 0 ? 'text-green-600' : 'text-red-600';
                            }
                          }
                          return 'text-gray-600';
                        })()
                      }`}>
                        {(() => {
                          const marketCap = parseFloat(marketData?.marketCap);
                          const delta24h = parseFloat(marketData?.marketCapDelta24h);
                          if (marketCap && delta24h && marketCap !== delta24h) {
                            const previousMC = marketCap - delta24h;
                            if (previousMC > 0) {
                              const changePct = (delta24h / previousMC) * 100;
                              return `${changePct.toFixed(2)}%`;
                            }
                          }
                          return 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Onchain Data */}
                {onchainData && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-art-gray-900">Onchain Data</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-art-gray-600">Total Supply:</span>
                        <span className="text-sm font-bold text-art-gray-900">
                          {onchainData.totalSupply?.formatted || (token as any).totalSupply || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-art-gray-600">Liquidity:</span>
                        <span className="text-sm font-bold text-art-gray-900">
                          {onchainData.liquidity?.formatted ? `${onchainData.liquidity.formatted} ETH` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-art-gray-600">Pool Address:</span>
                        <span className="text-sm font-bold text-art-gray-900">
                          {onchainData.poolAddress ? `${onchainData.poolAddress.slice(0, 6)}...${onchainData.poolAddress.slice(-4)}` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {token.description && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-art-gray-900 mb-2">Description</h3>
                  <p className="text-sm text-art-gray-700 leading-relaxed">
                    {token.description}
                  </p>
                </div>
              )}

              {/* Links */}
              <div className="mt-6 flex space-x-4">
                <a
                  href={`https://zora.co/coin/base:${token.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hand-drawn-btn text-sm font-bold px-4 py-2 transform rotate-1"
                  style={{ 
                    padding: '0.5rem 1rem',
                    borderRadius: '8px 3px 6px 4px'
                  }}
                >
                  View on Zora
                </a>
                <a
                  href={`https://dexscreener.com/base/${token.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hand-drawn-btn text-sm font-bold px-4 py-2 transform -rotate-1"
                  style={{ 
                    padding: '0.5rem 1rem',
                    borderRadius: '6px 4px 8px 3px'
                  }}
                >
                  View on DexScreener
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Select Modal */}
      {showTokenSelect && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="hand-drawn-card w-full max-w-md" style={{ transform: 'rotate(0.5deg)' }}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-art-gray-900 transform -rotate-1">
                  Select Token
                </h3>
                <button
                  onClick={() => setShowTokenSelect(false)}
                  className="text-art-gray-400 hover:text-art-gray-600 transform rotate-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-2">
                {availableTokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      setSelectedCurrency(token.symbol as 'ETH' | 'USDC');
                      setShowTokenSelect(false);
                    }}
                    className={`w-full p-3 text-left rounded-art transition-all duration-200 ${
                      selectedCurrency === token.symbol
                        ? 'bg-art-gray-900 text-art-white'
                        : 'bg-art-gray-100 text-art-gray-700 hover:bg-art-gray-200'
                    }`}
                    style={{
                      borderRadius: selectedCurrency === token.symbol ? '12px 3px 8px 6px' : '8px 12px 6px 10px',
                      transform: selectedCurrency === token.symbol ? 'rotate(-1deg)' : 'rotate(0.5deg)',
                      border: '2px solid #2d3748',
                      boxShadow: selectedCurrency === token.symbol ? '2px 2px 0 #2d3748' : '1px 1px 0 #2d3748'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{token.symbol}</div>
                        <div className="text-xs opacity-75">
                          {token.symbol === 'ETH' ? 'Ethereum' : 
                           token.symbol === 'USDC' ? 'USD Coin' : 'ZORA Token'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{token.balance}</div>
                        <div className="text-xs opacity-75">{token.symbol}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
