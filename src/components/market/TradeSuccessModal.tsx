import React from 'react';
import { useRouter } from 'next/navigation';
import { sdk as miniAppSdk } from '@farcaster/miniapp-sdk';
import { Coin } from '../../lib/supabase';

interface TradeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewToken: () => void;
  tradeType: 'buy' | 'sell';
  amount: string;
  token: Coin;
  tokenPrice?: string;
}

export default function TradeSuccessModal({ 
  isOpen, 
  onClose, 
  onViewToken, 
  tradeType,
  amount,
  token,
  tokenPrice
}: TradeSuccessModalProps) {
  const router = useRouter();

  const handleViewToken = () => {
    router.push(`/coin/${token.contract_address}`);
  };

  const handleShare = async () => {
    try {
      const shareText = tradeType === 'buy' 
        ? `🎨💰 Just bought ${amount} ${token.symbol} tokens! Check out this amazing hand-drawn art token on DrawCoin! 🚀`
        : `🎨📈 Just sold ${amount} ${token.symbol} tokens! Trading hand-drawn art tokens on DrawCoin! 💎`;

      await miniAppSdk.actions.composeCast({
        text: shareText,
        embeds: [`https://drawcoin-mini.vercel.app/coin/${token.contract_address}`]
      });
    } catch (error) {
      console.error('Error sharing trade:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="hand-drawn-card max-w-md w-full" 
        style={{ 
          transform: 'rotate(-0.5deg)',
          maxWidth: '500px'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-art-gray-900" style={{ borderStyle: 'dashed' }}>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              tradeType === 'buy' ? 'bg-green-100' : 'bg-green-100'
            }`} style={{ 
              transform: 'rotate(1deg)'
            }}>
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-art-gray-900 transform -rotate-0.5">
                Success!
              </h2>
              <p className="text-sm text-art-gray-500">
                {tradeType === 'buy' ? 'You bought the tokens' : 'You sold the tokens'}
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
        <div className="p-6 space-y-6">
          {/* Token Preview */}
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 bg-art-gray-50 overflow-hidden" style={{ 
              border: '3px solid #2d3748',
              borderRadius: '20px 8px 15px 12px',
              transform: 'rotate(0.5deg)'
            }}>
              {token.image_url ? (
                <img 
                  src={token.image_url} 
                  alt={token.name}
                  className="w-full h-full object-contain bg-white"
                  style={{ borderRadius: '17px 5px 12px 9px' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-art-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold text-art-gray-900 mb-1">
              {token.name}
            </h3>
            <p className="text-sm text-art-gray-500 font-mono bg-art-gray-100 px-3 py-1 rounded-art transform rotate-1 inline-block">
              {token.symbol}
            </p>
          </div>

          {/* Trade Details */}
          <div className={`border rounded-art p-4 ${
            tradeType === 'buy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`} style={{ 
            transform: 'rotate(-0.3deg)',
            borderRadius: '15px 5px 10px 8px'
          }}>
            <div className="flex items-center">
              <svg className={`w-5 h-5 mr-3 ${tradeType === 'buy' ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {tradeType === 'buy' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                )}
              </svg>
              <div>
                <p className={`text-sm font-medium ${tradeType === 'buy' ? 'text-green-800' : 'text-red-800'}`}>
                  {tradeType === 'buy' ? 'Successfully purchased' : 'Successfully sold'} {amount} {token.symbol}
                </p>
                {tokenPrice && (
                  <p className={`text-xs ${tradeType === 'buy' ? 'text-green-600' : 'text-red-600'} mt-1`}>
                    Price: ${parseFloat(tokenPrice).toFixed(8)} per token
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* View Token Button */}
            <button
              onClick={handleViewToken}
              className="hand-drawn-btn w-full text-lg py-4"
              style={{ 
                transform: 'rotate(-0.5deg)',
                backgroundColor: '#3182ce'
              }}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Token
              </div>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="hand-drawn-btn w-full text-lg py-4 secondary"
              style={{ 
                transform: 'rotate(0.5deg)'
              }}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share {tradeType === 'buy' ? 'Purchase' : 'Sale'}
              </div>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="hand-drawn-btn w-full text-lg py-4 danger"
              style={{ 
                transform: 'rotate(-0.3deg)'
              }}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
