import React from 'react';
import { Coin } from '../../lib/supabase';
import TokenCard from './TokenCard';

interface TokenGridProps {
  tokens: Coin[];
  onTrade: (token: Coin) => void;
  onView: (token: Coin) => void;
  loading?: boolean;
  viewMode?: 'grid' | 'list';
}

export default function TokenGrid({ tokens, onTrade, onView, loading = false, viewMode = 'grid' }: TokenGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-art-white rounded-art-lg shadow-art p-6 border border-art-gray-100 animate-pulse">
            <div className="aspect-square bg-art-gray-200 rounded-art-lg mb-4"></div>
            <div className="space-y-3">
              <div className="h-5 bg-art-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-art-gray-200 rounded w-1/2"></div>
              <div className="flex justify-between">
                <div className="h-6 bg-art-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-art-gray-200 rounded w-1/4"></div>
              </div>
              <div className="h-4 bg-art-gray-200 rounded w-1/2"></div>
            </div>
            <div className="mt-6 pt-4 border-t border-art-gray-100">
              <div className="h-10 bg-art-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-art-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-art-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-art-gray-900 mb-2">No tokens found</h3>
        <p className="text-art-gray-500">Try adjusting your search or filters to find more art tokens.</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {tokens.map((token, index) => {
          return (
           <div 
             key={token.id} 
             className="hand-drawn-card relative p-3 md:p-4 cursor-pointer group"
             onClick={() => window.location.href = `/coin/${token.contract_address}`}
             style={{ transform: `rotate(${index % 2 === 0 ? '-0.5deg' : '0.5deg'})` }}
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
               <div className="flex gap-2 md:gap-4">
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     window.location.href = `/coin/${token.contract_address}`;
                   }}
                   className="hand-drawn-btn text-xs md:text-sm font-bold py-2 md:py-3 px-3 md:px-6 transform -rotate-1 hover:scale-105 transition-transform duration-200"
                   style={{ 
                     borderRadius: '12px 4px 8px 6px',
                     backgroundColor: '#4299e1',
                     minWidth: '70px'
                   }}
                 >
                   View
                 </button>
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     onTrade(token);
                   }}
                   className="hand-drawn-btn text-xs md:text-sm font-bold py-2 md:py-3 px-3 md:px-6 transform rotate-1 hover:scale-105 transition-transform duration-200"
                   style={{ 
                     borderRadius: '8px 6px 12px 4px',
                     backgroundColor: '#22c55e',
                     minWidth: '70px'
                   }}
                 >
                   Trade
                 </button>
               </div>
             </div>
            <div className="flex items-center gap-3 md:gap-4">
              {/* Token Logo */}
              <div className="w-16 h-16 md:w-20 md:h-20 bg-art-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ 
                border: '2px solid #2d3748',
                borderRadius: '15px 5px 10px 8px',
                transform: 'rotate(1deg)',
                aspectRatio: '1/1'
              }}>
                {(() => {
                  const imageUrl = (token as any).mediaContent?.previewImage?.small || token.image_url;
                  return imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={(token as any).name || token.name}
                      className="w-auto h-auto max-w-[85%] max-h-[85%] object-contain bg-white"
                      style={{ borderRadius: '13px 3px 8px 6px' }}
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
                  className="w-full h-full flex items-center justify-center text-art-gray-400 text-xl md:text-2xl font-bold"
                  style={{ 
                    borderRadius: '13px 3px 8px 6px',
                    display: 'none'
                  }}
                >
                  🎨
                </div>
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2 md:mb-3">
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-art-gray-900 text-sm md:text-lg truncate transform -rotate-0.5">
                      {(token as any).name || token.name}
                    </h3>
                    <p className="text-xs md:text-sm text-art-gray-500 font-mono bg-art-gray-100 px-1 md:px-2 py-0.5 md:py-1 rounded-art transform rotate-1 inline-block">
                      {(token as any).symbol || token.symbol}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm md:text-lg font-bold ${(() => {
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
                    <div className="text-xs text-art-gray-500">24h Change</div>
                  </div>
                </div>

                {/* Market Data */}
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                  <div className="bg-art-gray-50 p-1 md:p-2 rounded-art text-center transform rotate-1" style={{ borderRadius: '10px 3px 8px 5px' }}>
                    <div className="text-xs md:text-sm font-bold text-art-gray-900">
                      {(() => {
                        const mc = (token as any).marketCap;
                        return mc ? `$${parseFloat(mc).toFixed(2)}` : '—';
                      })()}
                    </div>
                    <div className="text-xs text-art-gray-500">MC</div>
                  </div>
                  <div className="bg-art-gray-50 p-1 md:p-2 rounded-art text-center transform -rotate-1" style={{ borderRadius: '8px 5px 10px 3px' }}>
                    <div className="text-xs md:text-sm font-bold text-art-gray-900">
                      {(() => {
                        const vol = (token as any).volume24h;
                        return vol ? `$${parseFloat(vol).toFixed(2)}` : '—';
                      })()}
                    </div>
                    <div className="text-xs text-art-gray-500">VOL</div>
                  </div>
                  <div className="bg-art-gray-50 p-1 md:p-2 rounded-art text-center transform rotate-0.5" style={{ borderRadius: '12px 4px 6px 8px' }}>
                    <div className="text-xs md:text-sm font-bold text-art-gray-900">
                      {(token as any).uniqueHolders || 0}
                    </div>
                    <div className="text-xs text-art-gray-500">HOLDERS</div>
                  </div>
                </div>
              </div>


            </div>
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-2">
      {tokens.map((token) => (
        <TokenCard
          key={token.id || token.contract_address}
          token={token}
          onTrade={onTrade}
          onView={onView}
        />
      ))}
    </div>
  );
}


