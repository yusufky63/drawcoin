"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchCoinComments } from "../../services/sdk/getCoins";

interface CoinCommentsProps {
  tokenAddress: string;
}

interface Comment {
  node: {
    id: string;
    comment: string;
    commenter: {
      address: string;
      handle?: string;
      avatar?: {
        previewImage?: {
          small?: string;
        };
      };
    };
    timestamp: string;
    createdAt: string;
  };
}

interface CommentsResponse {
  comments: Comment[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
}

export default function CoinComments({ tokenAddress }: CoinCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch initial comments
  const loadComments = useCallback(async (after?: string | null) => {
    try {
      if (after) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetchCoinComments(tokenAddress, 20, after || undefined) as CommentsResponse;

      if (after) {
        // Append to existing comments
        setComments(prev => [...prev, ...response.comments]);
      } else {
        // Replace comments
        setComments(response.comments);
      }

      setPageInfo(response.pageInfo);
      setTotalCount(response.totalCount);
    } catch (err: any) {
      console.error("Error loading comments:", err);
      setError(err.message || "Failed to load comments");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    if (tokenAddress) {
      loadComments();
    }
  }, [tokenAddress, loadComments]);

  const handleLoadMore = () => {
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      loadComments(pageInfo.endCursor);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  if (loading) {
    return (
      <div className="hand-drawn-card">
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-art-gray-900"></div>
            <span className="ml-3 text-art-gray-600">Loading comments...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hand-drawn-card">
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-red-500 mb-3">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-art-gray-700 mb-4">{error}</p>
            <button
              onClick={() => loadComments()}
              className="hand-drawn-btn text-sm font-bold px-4 py-2 transform rotate-1"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px 3px 6px 4px",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="hand-drawn-card">
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-art-gray-400 mb-3">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-art-gray-600 font-bold transform -rotate-1">No comments yet</p>
            <p className="text-sm text-art-gray-500 mt-2">Be the first to comment on Zora!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hand-drawn-card">
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-art-gray-900 transform -rotate-1">
            Comments ({totalCount})
          </h3>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.map((comment, index) => (
            <div
              key={comment.node.id || index}
              className="bg-art-gray-50 rounded-art p-4 transform hover:scale-[1.01] transition-transform"
              style={{
                borderRadius: "12px 6px 10px 8px",
                transform: `rotate(${index % 2 === 0 ? "0.3deg" : "-0.3deg"})`,
                border: "2px solid #2d3748",
              }}
            >
              {/* Comment Header */}
              <div className="flex items-center space-x-3 mb-3">
                {/* Avatar */}
                <div
                  className="flex-shrink-0"
                  style={{
                    transform: `rotate(${index % 3 === 0 ? "-2deg" : "2deg"})`,
                  }}
                >
                  {comment.node.commenter?.avatar?.previewImage?.small ? (
                    <img
                      src={comment.node.commenter.avatar.previewImage.small}
                      alt={comment.node.commenter.handle || "User"}
                      className="w-10 h-10 rounded-full border-2 border-art-gray-900"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-art-gray-300 border-2 border-art-gray-900 flex items-center justify-center">
                      <svg className="w-6 h-6 text-art-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-art-gray-900 truncate">
                      {comment.node.commenter?.handle || 
                       `${comment.node.commenter.address.substring(0, 6)}...${comment.node.commenter.address.substring(38)}`}
                    </span>
                    <span className="text-xs text-art-gray-500">•</span>
                    <span className="text-xs text-art-gray-500">
                      {formatTimeAgo(comment.node.timestamp || comment.node.createdAt)}
                    </span>
                  </div>
                  {comment.node.commenter?.handle && (
                    <div className="text-xs text-art-gray-500 font-mono truncate">
                      {comment.node.commenter.address.substring(0, 10)}...{comment.node.commenter.address.substring(38)}
                    </div>
                  )}
                </div>
              </div>

              {/* Comment Content */}
              <div className="pl-13">
                <p className="text-sm text-art-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {comment.node.comment}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {pageInfo?.hasNextPage && (
          <div className="mt-6 text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="hand-drawn-btn text-sm font-bold px-6 py-3 transform rotate-1 disabled:opacity-50"
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "10px 4px 8px 5px",
              }}
            >
              {loadingMore ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-art-gray-900"></div>
                  <span>Loading...</span>
                </span>
              ) : (
                `Load More Comments`
              )}
            </button>
            <p className="text-xs text-art-gray-500 mt-2">
              Showing {comments.length} of {totalCount}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
