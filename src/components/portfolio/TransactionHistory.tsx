"use client";

import React from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Transaction {
  id: string;
  tx_hash: string;
  type: 'buy' | 'sell' | 'create';
  amount_token?: number;
  amount_eth?: number;
  amount_usd?: number;
  timestamp: string;
  token_address: string;
  token_details?: {
    name: string;
    symbol: string;
    contract_address: string;
  };
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  loading?: boolean;
}

export function TransactionHistory({ transactions, loading }: TransactionHistoryProps) {
  if (loading) {
    return (
      <div className="hand-drawn-card">
        <div className="hand-drawn-header">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg">Transaction History</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-3 bg-art-gray-50 rounded animate-pulse">
              <div className="h-4 bg-art-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-art-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="hand-drawn-card">
        <div className="hand-drawn-header">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg">Transaction History</h3>
        </div>
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-art-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-art-gray-600">No transactions yet</p>
          <p className="text-sm text-art-gray-500 mt-2">Your transaction history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hand-drawn-card">
      <div className="hand-drawn-header">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg">Transaction History</h3>
      </div>
      
      <div className="space-y-2">
        {transactions.map((tx) => {
          const tokenName = tx.token_details?.name || 'Unknown Token';
          const tokenSymbol = tx.token_details?.symbol || 'N/A';
          
          return (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 bg-art-gray-50 rounded-art hover:bg-art-gray-100 transition-colors group"
            >
              <div className="flex items-center space-x-3 flex-1">
                {/* Type Icon & Badge */}
                <div className="flex-shrink-0">
                  {tx.type === 'buy' && (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  )}
                  {tx.type === 'sell' && (
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </div>
                  )}
                  {tx.type === 'create' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Transaction Info */}
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
                    <span className="text-sm font-medium text-art-gray-900 truncate">
                      {tokenName} ({tokenSymbol})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-art-gray-600">
                      {tx.amount_usd ? `$${tx.amount_usd.toFixed(2)}` : tx.amount_eth ? `${tx.amount_eth.toFixed(4)} ETH` : ''}
                    </span>
                    <span className="text-xs text-art-gray-400">•</span>
                    <span className="text-xs text-art-gray-500">
                      {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* View Token */}
                {tx.token_address && (
                  <Link
                    href={`/coin/${tx.token_address}`}
                    className="p-1.5 rounded hover:bg-art-gray-200 transition-colors group"
                    title="View Token"
                  >
                    <svg className="w-4 h-4 text-art-gray-600 group-hover:text-art-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </Link>
                )}
                
                {/* View on Basescan */}
                <a
                  href={`https://basescan.org/tx/${tx.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-art-gray-200 transition-colors group"
                  title="View on Basescan"
                >
                  <svg className="w-4 h-4 text-art-gray-600 group-hover:text-art-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
