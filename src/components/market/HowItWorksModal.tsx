import React from "react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-art w-full max-w-3xl max-h-[90vh] overflow-hidden"
        style={{ 
          border: '3px solid #2d3748',
          borderRadius: '20px 10px 25px 15px',
          boxShadow: '5px 5px 0 #2d3748',
          transform: 'rotate(-0.3deg)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-art-gray-900" style={{ borderStyle: 'dashed' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-art-gray-900 transform -rotate-1 flex items-center">
              <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How DrawCoin Works
            </h2>
            <button
              onClick={onClose}
              className="text-art-gray-400 hover:text-art-gray-600 transition-colors transform rotate-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-art-gray-900 text-white flex items-center justify-center font-bold flex-shrink-0 transform rotate-2">
                1
              </div>
              <div>
                <h3 className="font-bold text-lg text-art-gray-800">Draw & Create</h3>
                <p className="text-art-gray-600 text-sm">
                  Use our canvas to draw your unique token image. AI helps you refine your art!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-art-gray-900 text-white flex items-center justify-center font-bold flex-shrink-0 transform -rotate-1">
                2
              </div>
              <div>
                <h3 className="font-bold text-lg text-art-gray-800">Launch Token</h3>
                <p className="text-art-gray-600 text-sm">
                  Deploy your token on Base instantly. No coding required.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-art-gray-900 text-white flex items-center justify-center font-bold flex-shrink-0 transform rotate-1">
                3
              </div>
              <div>
                <h3 className="font-bold text-lg text-art-gray-800">Trade & Earn</h3>
                <p className="text-art-gray-600 text-sm">
                  Trade tokens with our built-in swap. Creators earn fees from trading volume.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-dashed border-art-gray-200">
            <h3 className="font-bold text-center mb-4 text-art-gray-700">Join our Community</h3>
            <div className="flex justify-center gap-6">
              <a
                href="https://twitter.com/DrawCoinBase"
                target="_blank"
                rel="noopener noreferrer"
                className="text-art-gray-600 hover:text-[#1DA1F2] transition-colors transform hover:scale-110 duration-200"
                title="Twitter"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a
                href="https://farcaster.xyz/drawcoin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-art-gray-600 hover:text-[#855DCD] transition-colors transform hover:scale-110 duration-200"
                title="Farcaster"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.24.24H5.76A5.52 5.52 0 0 0 .24 5.76v12.48a5.52 5.52 0 0 0 5.52 5.52h12.48a5.52 5.52 0 0 0 5.52-5.52V5.76a5.52 5.52 0 0 0-5.52-5.52Zm3.72 18a3.72 3.72 0 0 1-3.72 3.72H5.76A3.72 3.72 0 0 1 2.04 18.24V5.76a3.72 3.72 0 0 1 3.72-3.72h12.48a3.72 3.72 0 0 1 3.72 3.72v12.48Z"/>
                  <path d="M12 13.38a2.16 2.16 0 1 1 0-4.32 2.16 2.16 0 0 1 0 4.32Z"/>
                  <path d="M12 15.84c-3.42 0-5.22 1.8-5.22 1.8s1.8-5.4 5.22-5.4 5.22 5.4 5.22 5.4-1.8-1.8-5.22-1.8Z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

