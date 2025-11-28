"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const LiveCanvasPage = dynamic(
  () => import("../../components/activity/LiveCanvasPage"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center pb-20 md:pb-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"></div>
          <p className="text-art-gray-600">Loading live canvas...</p>
        </div>
      </div>
    ),
  }
);

export default function LiveCanvasRoute() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-art-gray-50 pb-20 md:pb-0">
      <LiveCanvasPage />
    </div>
  );
}
