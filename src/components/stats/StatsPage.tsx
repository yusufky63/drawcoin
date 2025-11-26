"use client";

import React, { useState, useEffect } from "react";
import { AnalyticsService } from "../../services/analyticsService";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function StatsPage() {
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [stats, transactions] = await Promise.all([
          AnalyticsService.getGlobalStats(),
          AnalyticsService.getRecentTransactions(15)
        ]);
        setGlobalStats(stats);
        setRecentTx(transactions);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-art-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-art-gray-900 mx-auto mb-4"></div>
          <p className="text-art-gray-600">Loading platform stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-art-gray-50 p-4">
      <div className="max-w-7xl  mx-auto space-y-6">
        {/* Header */}
        <div className="hand-drawn-card">
          <div className="hand-drawn-header">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h1 className="text-2xl font-bold">Platform Statistics</h1>
          </div>
          <p className="text-art-gray-600">
            Real-time analytics for the DrawCoin platform
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Volume */}
          <div className="hand-drawn-card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-blue-700 font-medium mb-1">Total Volume</div>
                <div className="text-3xl font-bold text-blue-900">
                  ${globalStats?.total_volume_usd?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  24h: ${globalStats?.total_volume_24h?.toLocaleString() || '0'}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Trades */}
          <div className="hand-drawn-card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-green-700 font-medium mb-1">Total Trades</div>
                <div className="text-3xl font-bold text-green-900">
                  {globalStats?.total_trades?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Traders: {globalStats?.total_unique_traders || '0'}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Coins Created */}
          <div className="hand-drawn-card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-purple-700 font-medium mb-1">Coins Created</div>
                <div className="text-3xl font-bold text-purple-900">
                  {globalStats?.total_coins_created?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-purple-600 mt-2">
                  Creators: {globalStats?.total_users || '0'}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="hand-drawn-card bg-gradient-to-br from-orange-50 to-orange-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-orange-700 font-medium mb-1">Total Users</div>
                <div className="text-3xl font-bold text-orange-900">
                  {globalStats?.total_users?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-orange-600 mt-2">
                  Active participants
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="hand-drawn-card">
          <div className="hand-drawn-header">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold">Recent Transactions</h2>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-art-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-art-gray-600">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTx.map((tx: any) => {
                const tokenName = tx.token_details?.name || 'Unknown Token';
                const tokenSymbol = tx.token_details?.symbol || 'N/A';

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-art-gray-50 rounded-art hover:bg-art-gray-100 transition-colors group"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      {/* Type Icon */}
                      <div className="flex-shrink-0">
                        {tx.type === 'buy' && (
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                        )}
                        {tx.type === 'sell' && (
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </div>
                        )}
                        {tx.type === 'create' && (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Transaction Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`
                            px-2 py-0.5 rounded text-xs font-medium
                            ${tx.type === 'buy' ? 'bg-green-100 text-green-700' : ''}
                            ${tx.type === 'sell' ? 'bg-red-100 text-red-700' : ''}
                            ${tx.type === 'create' ? 'bg-blue-100 text-blue-700' : ''}
                          `}>
                            {tx.type.toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold text-art-gray-900 truncate">
                            {tokenName} ({tokenSymbol})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-art-gray-600">
                          <span className="truncate max-w-[120px]">
                            {tx.user_address}
                          </span>
                          {tx.amount_usd > 0 && (
                            <>
                              <span className="text-art-gray-400">•</span>
                              <span className="font-medium">${tx.amount_usd.toFixed(2)}</span>
                            </>
                          )}
                          <span className="text-art-gray-400">•</span>
                          <span>{formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/coin/${tx.token_address}`}
                        className="p-2 rounded hover:bg-art-gray-200 transition-colors"
                        title="View Token"
                      >
                        <svg className="w-4 h-4 text-art-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <a
                        href={`https://basescan.org/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded hover:bg-art-gray-200 transition-colors"
                        title="View on Basescan"
                      >
                        <svg className="w-4 h-4 text-art-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
