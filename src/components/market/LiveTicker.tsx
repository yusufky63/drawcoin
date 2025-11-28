"use client";

import React, { useEffect, useState } from "react";

interface ActivityItem {
  tx_hash: string;
  type: "buy" | "sell" | "create";
  amount_token: number;
  amount_usd: number;
  token_details?: {
    symbol: string;
  };
}

export default function LiveTicker() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetch("/api/activity?limit=10")
      .then((res) => res.json())
      .then((data) => setActivities(data.data || []))
      .catch((err) => console.error(err));
  }, []);

  if (activities.length === 0) return null;

  return (
    <div className="w-full bg-art-gray-900 text-white overflow-hidden py-1.5 border-b border-art-gray-900">
      <div className="flex animate-scroll whitespace-nowrap">
        {[...activities, ...activities].map((activity, i) => (
          <div
            key={`${activity.tx_hash}-${i}`}
            className="inline-flex items-center mx-4 text-xs"
          >
            <span
              className={`font-bold mr-1.5 ${
                activity.type === "create"
                  ? "text-purple-400"
                  : activity.type === "buy"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {activity.type.toUpperCase()}
            </span>
            <span className="font-medium mr-1.5 text-white">
              {activity.token_details?.symbol || "TOKEN"}
            </span>
            <span className="text-art-gray-400">
              {activity.type === "create"
                ? "Created"
                : `$${activity.amount_usd.toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
