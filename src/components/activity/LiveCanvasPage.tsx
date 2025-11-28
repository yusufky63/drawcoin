"use client";

import React from "react";
import ActivityFeed from "./ActivityFeed";

export default function LiveCanvasPage() {
  return (
    <div className="min-h-screen bg-art-off-white pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-art-gray-900 mb-2 transform -rotate-1 font-display">
            Live Canvas 🎨
          </h1>
          <p className="text-art-gray-600">
            Watch the platform come alive with real-time trades and creations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
