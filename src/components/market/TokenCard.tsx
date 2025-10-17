import React from 'react';
import { Coin } from '../../lib/supabase';

interface TokenCardProps {
  token: Coin;
  onTrade: (token: Coin) => void;
  onView: (token: Coin) => void;
  showBalance?: boolean; // Optional prop to show user balance
}

export default function TokenCard({ token, onTrade, onView, showBalance = false }: TokenCardProps) {
  const handleCardClick = () => {
    // Navigate to coin detail page
    window.location.href = `/coin/${token.contract_address}`;
  };

  const handleTradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrade(token);
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/coin/${token.contract_address}`;
  };

  return (
    <div 
      className="hand-drawn-card group cursor-pointer relative"
      onClick={handleCardClick}
      style={{ transform: 'rotate(-0.5deg)' }}
    >
      {/* NEW Badge */}
      {(token as any).isNew && (
        <div className="absolute -top-3 -right-3 z-50 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full transform rotate-12 shadow-lg border-2 border-white" style={{ 
          borderRadius: '10px 3px 8px 5px',
          fontSize: '10px',
          lineHeight: '1',
          zIndex: 50,
          top: '-12px',
          right: '-12px'
        }}>
          NEW
        </div>
      )}

      {/* Hover Overlay with Buttons */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 overflow-hidden rounded-art">
        <div className="flex gap-3">
          <button
            onClick={handleViewClick}
            className="hand-drawn-btn text-sm font-bold py-3 px-6 transform -rotate-1 hover:scale-105 transition-transform duration-200"
            style={{ 
              borderRadius: '12px 4px 8px 6px',
              backgroundColor: '#4299e1',
              minWidth: '80px'
            }}
          >
            View
          </button>
          <button
            onClick={handleTradeClick}
            className="hand-drawn-btn text-sm font-bold py-3 px-6 transform rotate-1 hover:scale-105 transition-transform duration-200"
            style={{ 
              borderRadius: '8px 6px 12px 4px',
              backgroundColor: '#48bb78',
              minWidth: '80px'
            }}
          >
            Trade
          </button>
        </div>
      </div>
      {/* Token Image */}
      <div className="w-full bg-art-gray-50 rounded-art-lg mb-2 md:mb-3 overflow-hidden relative flex items-center justify-center" style={{ 
        border: '2px solid #2d3748',
        borderRadius: '20px 10px 25px 15px',
        transform: 'rotate(0.5deg)',
        height: '200px',
        minHeight: '180px',
        aspectRatio: '1/1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {(() => {
          const imageUrl = (token as any).mediaContent?.previewImage?.small || token.image_url;
          return imageUrl ? (
            <img 
              src={imageUrl} 
              alt={(token as any).name || token.name}
              className="w-auto h-auto max-w-[90%] max-h-[90%] object-contain bg-white group-hover:scale-105 transition-transform duration-300"
              style={{ borderRadius: '18px 8px 23px 13px' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextElement) {
                  nextElement.style.display = 'flex';
                }
              }}
            />
          ) : null;
        })()}
        {/* Default Image */}
        <div 
          className="w-auto h-auto max-w-[90%] max-h-[90%] bg-art-gray-100 flex items-center justify-center text-art-gray-400 text-4xl font-bold"
          style={{ 
            borderRadius: '18px 8px 23px 13px',
            display: 'none'
          }}
        >
          🎨
        </div>
        {(() => {
          const imageUrl = (token as any).mediaContent?.previewImage?.small || token.image_url;
          return !imageUrl ? (
            <div className="w-full h-full flex items-center justify-center text-art-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          ) : null;
        })()}
      </div>

      {/* Token Info */}
      <div className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="font-bold text-art-gray-900 text-sm leading-tight truncate transform rotate-0.5">
                {(token as any).name || token.name}
              </h3>
              <p className="text-[10px] text-art-gray-500 font-mono bg-art-gray-100 px-1 py-0.5 rounded-art transform -rotate-1">
                {(token as any).symbol || token.symbol}
              </p>
            </div>
            <div className={`text-[12px] font-bold ${(() => {
              const priceChange = (token as any).marketCapDelta24h;
              if (priceChange && parseFloat(priceChange) > 0) return 'text-green-600';
              if (priceChange && parseFloat(priceChange) < 0) return 'text-red-600';
              return 'text-art-gray-900';
            })()}`}>
              {(() => {
                const priceChange = (token as any).marketCapDelta24h;
                return priceChange ? `${parseFloat(priceChange) >= 0 ? '+' : ''}${parseFloat(priceChange).toFixed(2)}%` : '0.00%';
              })()}
            </div>
          </div>
          {(token as any).creatorProfile?.handle && (
            <p className="text-[11px] text-art-gray-500 truncate transform -rotate-0.5">by {(token as any).creatorProfile.handle}</p>
          )}
        </div>

        {/* User Balance (only shown in portfolio) */}
        {showBalance && (token as any).userBalanceFormatted && (
          <div className="bg-blue-50 border border-blue-200 p-2 rounded-art transform -rotate-0.5 mb-2" style={{ borderRadius: '8px 12px 6px 10px' }}>
            <div className="text-center">
              <div className="text-sm font-bold text-blue-900">
                {(token as any).userBalanceFormatted} {(token as any).symbol || token.symbol}
              </div>
              <div className="text-xs text-blue-600">Your Balance</div>
            </div>
          </div>
        )}

        {/* Market Data */}
        <div className="grid grid-cols-3 gap-1 md:gap-2 text-center">
          <div className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-1" style={{ borderRadius: '15px 5px 10px 8px' }}>
            <div className="text-sm font-bold text-art-gray-900">
              {(() => {
                const mc = (token as any).marketCap;
                return mc ? `$${parseFloat(mc).toFixed(2)}` : '—';
              })()}
            </div>
            <div className="text-xs text-art-gray-400">MC</div>
          </div>
          <div className="bg-art-gray-50 p-1 md:p-2 rounded-art transform -rotate-1" style={{ borderRadius: '10px 8px 15px 5px' }}>
            <div className="text-sm font-bold text-art-gray-900">
              {(() => {
                const vol = (token as any).volume24h;
                return vol ? `$${parseFloat(vol).toFixed(2)}` : '—';
              })()}
            </div>
            <div className="text-xs text-art-gray-400">VOL</div>
          </div>
          <div className="bg-art-gray-50 p-1 md:p-2 rounded-art transform rotate-0.5" style={{ borderRadius: '12px 6px 18px 10px' }}>
            <div className="text-sm font-bold text-art-gray-900">
              {(token as any).uniqueHolders || 0}
            </div>
            <div className="text-xs text-art-gray-400">HOLDERS</div>
          </div>
        </div>
      </div>


      {/* Hand-drawn decoration */}
    </div>
  );
}


