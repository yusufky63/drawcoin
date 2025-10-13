'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Portfolio component'ini dynamic import ile yükle
const PortfolioPage = dynamic(
  () => import('../../components/portfolio/PortfolioPage'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"></div>
          <p className="text-art-gray-600">Loading portfolio...</p>
        </div>
      </div>
    )
  }
);

export default function PortfolioRoute() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"></div>
          <p className="text-art-gray-600">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 pb-20 md:pb-0">
      <PortfolioPage />
    </div>
  );
}
