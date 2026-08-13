import React from "react";

export default function HowItWorks() {
  return (
    <div className="hand-drawn-card w-full max-w-7xl mx-auto bg-white p-3 md:p-8 pb-20 md:pb-8">
      <div className="text-center mb-6 md:mb-10">
        <h2 className="text-2xl md:text-4xl font-bold text-art-gray-900 mb-2 transform -rotate-1">
          How DrawCoin Works
        </h2>
        <p className="text-art-gray-600 text-sm md:text-lg max-w-2xl mx-auto">
          Turn your drawings into tradeable tokens in three simple steps
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-10">
        {/* Step 1: Draw */}
        <div className="hand-drawn-card bg-gradient-to-br from-purple-50 to-pink-50 border-3 border-purple-400 p-4 md:p-6 transform rotate-1">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-purple-500 flex items-center justify-center transform -rotate-3">
              <span className="text-white text-xl md:text-2xl font-bold">1</span>
            </div>
          </div>
          
          <h3 className="text-lg md:text-xl font-bold text-purple-900 mb-2 md:mb-3 text-center transform -rotate-1">
            Draw Your Art
          </h3>
          
          <div className="space-y-2 text-sm text-art-gray-700">
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform rotate-0.5">
              <p className="font-bold text-purple-800 mb-0.5">Custom Canvas</p>
              <p className="text-xs">Use brushes, colors, and shapes to create unique artwork</p>
            </div>
            
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform -rotate-0.5">
              <p className="font-bold text-purple-800 mb-0.5">Hand-drawn Only</p>
              <p className="text-xs">Every new DrawCoin begins with artwork you draw yourself</p>
            </div>

            <div className="bg-white/60 p-2 md:p-3 rounded-art transform rotate-0.5">
              <p className="font-bold text-purple-800 mb-0.5">Drawing Tools</p>
              <p className="text-xs">Pencil, marker, eraser, color picker, undo/redo</p>
            </div>
          </div>
        </div>

        {/* Step 2: Create Token */}
        <div className="hand-drawn-card bg-gradient-to-br from-blue-50 to-cyan-50 border-3 border-blue-400 p-4 md:p-6 transform -rotate-1">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-500 flex items-center justify-center transform rotate-2">
              <span className="text-white text-xl md:text-2xl font-bold">2</span>
            </div>
          </div>
          
          <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-2 md:mb-3 text-center transform rotate-1">
           Create Your Token
          </h3>
          
          <div className="space-y-2 text-sm text-art-gray-700">
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform -rotate-0.5">
              <p className="font-bold text-blue-800 mb-0.5">Name & Symbol</p>
              <p className="text-xs">Give your token a creative name and ticker symbol</p>
            </div>
            
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform rotate-0.5">
              <p className="font-bold text-blue-800 mb-0.5">Your Artwork</p>
              <p className="text-xs">Saved permanently on IPFS - never disappears</p>
            </div>

            <div className="bg-white/60 p-2 md:p-3 rounded-art transform -rotate-0.5">
              <p className="font-bold text-blue-800 mb-0.5">Instant Deploy</p>
              <p className="text-xs">Live on Base in seconds</p>
            </div>
          </div>
        </div>

        {/* Step 3: Trade */}
        <div className="hand-drawn-card bg-gradient-to-br from-green-50 to-emerald-50 border-3 border-green-400 p-4 md:p-6 transform rotate-1">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-green-500 flex items-center justify-center transform -rotate-2">
              <span className="text-white text-xl md:text-2xl font-bold">3</span>
            </div>
          </div>
          
          <h3 className="text-lg md:text-xl font-bold text-green-900 mb-2 md:mb-3 text-center transform -rotate-1">
            Trade & Collect
          </h3>
          
          <div className="space-y-2 text-sm text-art-gray-700">
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform rotate-0.5">
              <p className="font-bold text-green-800 mb-0.5">Buy & Sell</p>
              <p className="text-xs">Trade with ETH or USDC - instant swaps</p>
            </div>
            
            <div className="bg-white/60 p-2 md:p-3 rounded-art transform -rotate-0.5">
              <p className="font-bold text-green-800 mb-0.5">Track Portfolio</p>
              <p className="text-xs">Monitor your holdings and created tokens</p>
            </div>

            <div className="bg-white/60 p-2 md:p-3 rounded-art transform rotate-0.5">
              <p className="font-bold text-green-800 mb-0.5">Share & Discover</p>
              <p className="text-xs">Explore art from creators worldwide</p>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Features */}
      <div className="hand-drawn-card bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 border-3 border-orange-300 p-4 md:p-6 mb-4 md:mb-6 transform -rotate-0.5">
        <h3 className="text-xl md:text-2xl font-bold text-orange-900 mb-4 text-center transform rotate-1">
          Drawing Canvas Features
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div className="flex items-start gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-art bg-orange-500 flex items-center justify-center flex-shrink-0 transform rotate-3">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-800 text-sm md:text-base">Brush Styles</p>
              <p className="text-xs md:text-sm text-art-gray-600">Pencil, marker, highlighter with adjustable thickness</p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-art bg-orange-500 flex items-center justify-center flex-shrink-0 transform -rotate-2">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-800 text-sm md:text-base">Color Palette</p>
              <p className="text-xs md:text-sm text-art-gray-600">Full color picker with unlimited color options</p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-art bg-orange-500 flex items-center justify-center flex-shrink-0 transform rotate-1">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-800 text-sm md:text-base">Shape Tools</p>
              <p className="text-xs md:text-sm text-art-gray-600">Draw perfect circles, squares, and lines easily</p>
            </div>
          </div>

          <div className="flex items-start gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-art bg-orange-500 flex items-center justify-center flex-shrink-0 transform -rotate-3">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-orange-800 text-sm md:text-base">Mobile & Desktop</p>
              <p className="text-xs md:text-sm text-art-gray-600">Touch controls on mobile, mouse on desktop</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Note */}
      <div className="hand-drawn-card bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 p-3 md:p-4 text-center transform rotate-0.5">
        <p className="text-art-gray-700 text-xs md:text-base">
          <span className="font-bold text-indigo-900">Base App first:</span> DrawCoin&apos;s primary experience also works fully in mobile and desktop browsers.
          <span className="block mt-1 md:mt-2 text-indigo-700">Draw on your phone, trade on your computer, or do both anywhere!</span>
        </p>
      </div>

      {/* Social Links */}
      <div className="mt-6 mb-12 pt-4 border-t-2 border-dashed border-art-gray-200">
        <h3 className="font-bold text-center mb-3 text-art-gray-700 text-sm md:text-base">
          Join the Community
        </h3>
        <div className="flex justify-center gap-4 md:gap-6">
          <a
            href="https://twitter.com/DrawCoinBase"
            target="_blank"
            rel="noopener noreferrer"
            className="text-art-gray-600"
            title="Twitter"
          >
            <svg className="w-7 h-7 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          </a>
          <a
            href="https://farcaster.xyz/drawcoin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-art-gray-600"
            title="Farcaster"
          >
            <svg className="w-7 h-7 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.24.24H5.76A5.52 5.52 0 0 0 .24 5.76v12.48a5.52 5.52 0 0 0 5.52 5.52h12.48a5.52 5.52 0 0 0 5.52-5.52V5.76a5.52 5.52 0 0 0-5.52-5.52Zm3.72 18a3.72 3.72 0 0 1-3.72 3.72H5.76A3.72 3.72 0 0 1 2.04 18.24V5.76a3.72 3.72 0 0 1 3.72-3.72h12.48a3.72 3.72 0 0 1 3.72 3.72v12.48Z"/>
              <path d="M12 13.38a2.16 2.16 0 1 1 0-4.32 2.16 2.16 0 0 1 0 4.32Z"/>
              <path d="M12 15.84c-3.42 0-5.22 1.8-5.22 1.8s1.8-5.4 5.22-5.4 5.22 5.4 5.22 5.4-1.8-1.8-5.22-1.8Z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
