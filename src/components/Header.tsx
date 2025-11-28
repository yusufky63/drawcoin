"use client";
import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  detectEnvironment,
  getBaseAppContext,
  getFarcasterUserContext,
} from "../utils/wallet";
import dynamic from "next/dynamic";

// Dynamic import for TokenTicker
const TokenTicker = dynamic(() => import("./market/TokenTicker"), {
  ssr: false,
});

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
}

interface UserInfo {
  name?: string;
  type?: "basename" | "farcaster" | "custom" | "wallet";
  fid?: number;
  pfpUrl?: string;
}

export default function ArtHeader({
  activeTab = "explore",
  userName,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Update currentTab based on pathname
  useEffect(() => {
    if (pathname === "/") {
      setCurrentTab("explore");
    } else if (pathname === "/create") {
      setCurrentTab("create");
    } else if (pathname === "/portfolio") {
      setCurrentTab("portfolio");
    } else if (pathname === "/watchlist") {
      setCurrentTab("watchlist");
    } else if (pathname === "/leaderboard") {
      setCurrentTab("leaderboard");
    } else if (pathname === "/how-it-works") {
      setCurrentTab("info");
    } else if (pathname === "/live-canvas") {
      setCurrentTab("live-canvas");
    } else if (pathname.startsWith("/coin/")) {
      setCurrentTab("explore"); // Coin detail pages are part of explore
    }
  }, [pathname]);

  // Auto-connect in Farcaster Mini App
  useEffect(() => {
    if (
      (userInfo.type === "farcaster" || userInfo.type === "basename") &&
      !isConnected &&
      connectors.length > 0
    ) {
      console.log("Auto-connecting in Farcaster Mini App...");
      connect({ connector: connectors[0] });
    }
  }, [userInfo.type, isConnected, connectors, connect]);

  // Fetch user info based on environment
  useEffect(() => {
    const fetchUserInfo = async () => {
      // If userName prop is provided, use it
      if (userName) {
        setUserInfo({ name: userName, type: "custom" });
        return;
      }

      const environment = detectEnvironment();

      try {
        // 1. Check for BaseApp environment
        if (environment === "baseapp") {
          const baseAppContext = await getBaseAppContext();
          if (baseAppContext?.basename) {
            setUserInfo({
              name: baseAppContext.basename,
              type: "basename",
              fid: baseAppContext.fid,
            });
            return;
          }
        }

        // 2. Check for Farcaster environment (Frame/Mini-app)
        if (environment === "farcaster" || environment === "baseapp") {
          const farcasterContext = await getFarcasterUserContext();
          if (farcasterContext?.username || farcasterContext?.displayName) {
            setUserInfo({
              name: farcasterContext.username || farcasterContext.displayName,
              type: "farcaster",
              fid: farcasterContext.fid,
              pfpUrl: farcasterContext.pfpUrl,
            });
            return;
          }
        }

        // 3. If connected via wallet in browser, check for Farcaster profile via API
        if (isConnected && address) {
          try {
            const response = await fetch(
              `/api/farcaster/user?address=${address}`
            );
            const data = await response.json();

            if (data.user) {
              setUserInfo({
                name: data.user.username || data.user.displayName,
                type: "farcaster",
                fid: data.user.fid,
                pfpUrl: data.user.pfpUrl,
              });
              return;
            }
          } catch (err) {
            console.error("Error fetching Farcaster user from API:", err);
          }
        }

        // Reset if no user info found
        setUserInfo({});
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };

    fetchUserInfo();
  }, [userName, isConnected, address]);

  return (
    <>
      {/* Sticky Container for Ticker and Header */}
      <div className="sticky top-0 z-50">
        {/* Background Filler to mask gap */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-[#fcfcfc] -z-10"></div>

        {/* Token Ticker - Above everything */}
        <TokenTicker />

        {/* Desktop Header */}
        <header
          className="hidden md:block mb-2"
          style={{
            border: "3px solid #2d3748",
            borderBottom: "3px solid #2d3748",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderRadius: "0 0 25px 10px",
            transform: "rotate(-0.5deg)",
            boxShadow: "5px 5px 0 #2d3748",
            background: "linear-gradient(135deg, #ffffff, #f7fafc)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 ">
            <div className="flex justify-between items-center h-20">
              {/* Brand */}
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-start transform rotate-1">
                  <Link
                    href="/"
                    className="text-2xl font-bold text-art-gray-900 transform -rotate-1"
                    style={{
                      textShadow: "1px 1px 0 #2d3748",
                      color: "#1a202c",
                    }}
                  >
                    DrawCoin
                  </Link>
                  <div
                    className="text-xs text-art-gray-500 transform rotate-1"
                    style={{
                      fontSize: "10px",
                      opacity: 0.7,
                      marginTop: "-2px",
                    }}
                  >
                    powered by Zora
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex space-x-4">
                  <Link
                    href="/"
                    className={`text-sm font-medium transition-all duration-200 ${
                      currentTab === "explore"
                        ? "hand-drawn-btn"
                        : "hand-drawn-btn-dotted"
                    }`}
                    style={{
                      padding: "0.5rem 1rem",
                      textDecoration: "none",
                    }}
                  >
                    Explore
                  </Link>

                  <Link
                    href="/create"
                    className={`text-sm font-medium transition-all duration-200 ${
                      currentTab === "create"
                        ? "hand-drawn-btn"
                        : "hand-drawn-btn-dotted"
                    }`}
                    style={{
                      padding: "0.5rem 1rem",
                      textDecoration: "none",
                    }}
                  >
                    Create
                  </Link>
                  <Link
                    href="/portfolio"
                    className={`text-sm font-medium transition-all duration-200 ${
                      currentTab === "portfolio"
                        ? "hand-drawn-btn"
                        : "hand-drawn-btn-dotted"
                    }`}
                    style={{
                      padding: "0.5rem 1rem",
                      textDecoration: "none",
                    }}
                  >
                    Portfolio
                  </Link>
                  <Link
                    href="/leaderboard"
                    className={`text-sm font-medium transition-all duration-200 ${
                      currentTab === "leaderboard"
                        ? "hand-drawn-btn"
                        : "hand-drawn-btn-dotted"
                    }`}
                    style={{
                      padding: "0.5rem 1rem",
                      textDecoration: "none",
                    }}
                  >
                    Leaderboard
                  </Link>
                </nav>
              </div>

              {/* User Info and Wallet */}
              <div className="flex items-center space-x-4">
                {/* Info and Watchlist Buttons */}
                <div className="flex items-center space-x-2">
                  <Link
                    href="/watchlist"
                    className={`text-sm font-medium transition-all duration-200 ${
                      currentTab === "watchlist"
                        ? "hand-drawn-btn"
                        : "hand-drawn-btn-dotted"
                    }`}
                    style={{
                      padding: "0.5rem 1rem",
                      textDecoration: "none",
                    }}
                  >
                    Watchlist
                  </Link>
                </div>

                <div className="flex items-center space-x-2">
                  {isConnected && address ? (
                    <div className="flex items-center space-x-2">
                      <div
                        className="flex items-center space-x-2 bg-art-gray-100 px-3 py-2 rounded-art transform -rotate-1"
                        style={{
                          border: "2px solid #2d3748",
                          borderRadius: "8px 3px 6px 4px",
                          boxShadow: "2px 2px 0 #2d3748",
                        }}
                      >
                        {userInfo.type === "farcaster" && userInfo.pfpUrl ? (
                          <img
                            src={userInfo.pfpUrl}
                            alt={userInfo.name}
                            className="w-5 h-5 rounded-full border border-art-gray-300"
                          />
                        ) : (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-600 font-medium">
                              Connected
                            </span>
                          </div>
                        )}

                        <span className="font-mono text-sm text-art-gray-900">
                          {userInfo.name
                            ? userInfo.type === "farcaster"
                              ? `@${userInfo.name}`
                              : userInfo.name
                            : `${address.substring(0, 6)}...${address.substring(
                                address.length - 4
                              )}`}
                        </span>
                      </div>
                      <button
                        onClick={() => disconnect()}
                        className="p-2 hover:bg-art-gray-800 rounded-art transition-colors hand-drawn-btn"
                        title="Disconnect Wallet"
                        style={{
                          border: "2px solid #2d3748",
                          borderRadius: "6px 2px 4px 3px",
                          transform: "rotate(0.5deg)",
                          boxShadow: "2px 2px 0 #2d3748",
                          backgroundColor: "#2d3748",
                        }}
                      >
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          if (
                            userInfo.type === "farcaster" ||
                            userInfo.type === "basename"
                          ) {
                            // Farcaster'da otomatik connect
                            if (connectors.length > 0) {
                              connect({ connector: connectors[0] });
                            }
                          } else {
                            // Normal browser'da wallet selection modal
                            setShowWalletModal(true);
                          }
                        }}
                        disabled={isPending}
                        className="hand-drawn-btn text-sm font-bold px-3 py-1 disabled:opacity-50"
                        style={{
                          padding: "0.5rem 1rem",
                          transform: "rotate(-0.5deg)",
                        }}
                      >
                        {isPending ? "Connecting..." : "Connect Wallet"}
                      </button>
                      <div className="text-xs text-art-gray-500 max-w-32">
                        {userInfo.type === "farcaster" ||
                        userInfo.type === "basename"
                          ? "Wallet auto-connects in Farcaster"
                          : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header
          className="md:hidden mb-2"
          style={{
            border: "3px solid #2d3748",
            borderBottom: "3px solid #2d3748",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderRadius: "0 0 25px 10px",
            transform: "rotate(-0.5deg)",
            boxShadow: "5px 5px 0 #2d3748",
            background: "linear-gradient(135deg, #ffffff, #f7fafc)",
          }}
        >
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-start transform rotate-1">
                <Link
                  href="/"
                  className="text-lg font-bold text-art-gray-900 transform -rotate-1"
                  style={{
                    textShadow: "1px 1px 0 #2d3748",
                    color: "#1a202c",
                  }}
                >
                  DrawCoin
                </Link>
                <div
                  className="text-xs text-art-gray-500 transform rotate-1"
                  style={{
                    fontSize: "8px",
                    opacity: 0.7,
                    marginTop: "-1px",
                  }}
                >
                  powered by Zora
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push("/how-it-works")}
                  className="p-1.5 text-art-gray-500 hover:text-art-gray-900 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
                {isConnected && address ? (
                  <div className="flex items-center space-x-2">
                    <div
                      className="flex items-center space-x-2 bg-art-gray-100 px-2 py-1 rounded-art transform -rotate-1"
                      style={{
                        border: "2px solid #2d3748",
                        borderRadius: "6px 2px 4px 3px",
                        boxShadow: "2px 2px 0 #2d3748",
                      }}
                    >
                      {userInfo.type === "farcaster" && userInfo.pfpUrl && (
                        <img
                          src={userInfo.pfpUrl}
                          alt={userInfo.name}
                          className="w-4 h-4 rounded-full border border-art-gray-300 mr-1"
                        />
                      )}
                      <span className="font-mono text-xs text-art-gray-900">
                        {userInfo.type === "farcaster" && userInfo.name
                          ? `@${userInfo.name}`
                          : `${address.substring(0, 4)}...${address.substring(
                              address.length - 4
                            )}`}
                      </span>
                    </div>
                    <button
                      onClick={() => disconnect()}
                      className="p-1.5 hover:bg-art-gray-800 rounded-art transition-colors hand-drawn-btn"
                      title="Disconnect Wallet"
                      style={{
                        border: "2px solid #2d3748",
                        borderRadius: "4px 1px 3px 2px",
                        transform: "rotate(0.5deg)",
                        boxShadow: "1px 1px 0 #2d3748",
                        backgroundColor: "#2d3748",
                      }}
                    >
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end space-y-1">
                    <button
                      onClick={() => {
                        if (
                          userInfo.type === "farcaster" ||
                          userInfo.type === "basename"
                        ) {
                          // Farcaster'da otomatik connect
                          if (connectors.length > 0) {
                            connect({ connector: connectors[0] });
                          }
                        } else {
                          // Normal browser'da wallet selection modal
                          setShowWalletModal(true);
                        }
                      }}
                      disabled={isPending}
                      className="hand-drawn-btn text-xs font-bold px-2 py-1 disabled:opacity-50"
                      style={{
                        padding: "0.25rem 0.5rem",
                        transform: "rotate(-0.5deg)",
                      }}
                    >
                      {isPending ? "Connecting..." : "Connect"}
                    </button>
                    <div className="text-xs text-art-gray-500 text-right max-w-20">
                      {userInfo.type === "farcaster" ||
                      userInfo.type === "basename"
                        ? "Auto-connects"
                        : ""}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
        style={{
          border: "2px solid #2d3748",
          borderTop: "3px solid #2d3748",
          borderBottom: "none",
          borderLeft: "none",
          borderRight: "none",
          borderRadius: "25px 10px 0 0",
          transform: "rotate(0.5deg)",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
          background: "linear-gradient(135deg, #ffffff, #f7fafc)",
        }}
      >
        <div className="relative pt-3 pb-2 px-4">
          {/* Grid for 4 buttons (excluding create) */}
          <div className="grid grid-cols-4 gap-2">
            {/* Explore */}
            <Link
              href="/"
              className={`flex flex-col items-center py-1.5 px-2 rounded-lg transition-all duration-200 ${
                currentTab === "explore"
                  ? "bg-art-gray-900 text-white"
                  : "bg-white text-art-gray-600"
              }`}
              style={{
                border: "1.5px solid #2d3748",
                borderRadius: "10px 3px 8px 5px",
                transform:
                  currentTab === "explore"
                    ? "rotate(-0.8deg)"
                    : "rotate(0.3deg)",
                boxShadow:
                  currentTab === "explore"
                    ? "2px 2px 0 #2d3748"
                    : "1.5px 1.5px 0 #2d3748",
                textDecoration: "none",
              }}
            >
              <svg
                className="w-5 h-5 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="text-[10px] font-bold">Explore</span>
            </Link>

            {/* Watchlist */}
            <Link
              href="/watchlist"
              className={`flex flex-col items-center py-1.5 px-2 rounded-lg transition-all duration-200 ${
                currentTab === "watchlist"
                  ? "bg-art-gray-900 text-white"
                  : "bg-white text-art-gray-600"
              }`}
              style={{
                border: "1.5px solid #2d3748",
                borderRadius: "8px 5px 10px 3px",
                transform:
                  currentTab === "watchlist"
                    ? "rotate(0.8deg)"
                    : "rotate(-0.3deg)",
                boxShadow:
                  currentTab === "watchlist"
                    ? "2px 2px 0 #2d3748"
                    : "1.5px 1.5px 0 #2d3748",
                textDecoration: "none",
              }}
            >
              <svg
                className="w-5 h-5 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="text-[10px] font-bold">Watch</span>
            </Link>

            {/* Portfolio */}
            <Link
              href="/portfolio"
              className={`flex flex-col items-center py-1.5 px-2 rounded-lg transition-all duration-200 ${
                currentTab === "portfolio"
                  ? "bg-art-gray-900 text-white"
                  : "bg-white text-art-gray-600"
              }`}
              style={{
                border: "1.5px solid #2d3748",
                borderRadius: "10px 3px 8px 5px",
                transform:
                  currentTab === "portfolio"
                    ? "rotate(-0.8deg)"
                    : "rotate(0.3deg)",
                boxShadow:
                  currentTab === "portfolio"
                    ? "2px 2px 0 #2d3748"
                    : "1.5px 1.5px 0 #2d3748",
                textDecoration: "none",
              }}
            >
              <svg
                className="w-5 h-5 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="text-[10px] font-bold">Portfolio</span>
            </Link>

            {/* Leaderboard */}
            <Link
              href="/leaderboard"
              className={`flex flex-col items-center py-1.5 px-2 rounded-lg transition-all duration-200 ${
                currentTab === "leaderboard"
                  ? "bg-art-gray-900 text-white"
                  : "bg-white text-art-gray-600"
              }`}
              style={{
                border: "1.5px solid #2d3748",
                borderRadius: "8px 5px 10px 3px",
                transform:
                  currentTab === "leaderboard"
                    ? "rotate(-0.8deg)"
                    : "rotate(-0.3deg)",
                boxShadow:
                  currentTab === "leaderboard"
                    ? "2px 2px 0 #2d3748"
                    : "1.5px 1.5px 0 #2d3748",
                textDecoration: "none",
              }}
            >
              <svg
                className="w-5 h-5 mb-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span className="text-[10px] font-bold">Top</span>
            </Link>
          </div>

          {/* Create Button - Centered and Floating Above */}
          <Link
            href="/create"
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-200"
            style={{
              top: "-20px",
              textDecoration: "none",
            }}
          >
            <div
              className={`w-14 h-14 flex items-center justify-center ${
                currentTab === "create"
                  ? "bg-art-gray-900 text-white"
                  : "bg-gradient-to-br from-white to-art-gray-100 text-art-gray-900"
              }`}
              style={{
                border: "2.5px solid #2d3748",
                borderRadius: "50% 40% 50% 40%",
                transform:
                  currentTab === "create"
                    ? "rotate(-1.5deg) scale(1.03)"
                    : "rotate(0.8deg)",
                boxShadow: "3px 3px 0 #2d3748",
              }}
            >
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ strokeWidth: 2.5 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </Link>
        </div>
      </nav>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white p-6 rounded-lg max-w-md w-full mx-4"
            style={{
              border: "3px solid #2d3748",
              borderRadius: "15px 5px 10px 8px",
              transform: "rotate(-0.5deg)",
              boxShadow: "5px 5px 0 #2d3748",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-art-gray-900">
                Connect Wallet
              </h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-art-gray-500 hover:text-art-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {connectors
                .filter((connector) => connector.id !== "farcasterMiniApp")
                .map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => {
                      connect({ connector });
                      setShowWalletModal(false);
                    }}
                    disabled={isPending}
                    className="w-full p-3 border-2 border-art-gray-300 rounded-lg hover:border-art-gray-500 transition-colors text-left disabled:opacity-50"
                    style={{
                      borderRadius: "8px 3px 6px 4px",
                      transform: "rotate(0.5deg)",
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-art-gray-100 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-art-gray-400 rounded-full"></div>
                      </div>
                      <div>
                        <div className="font-medium text-art-gray-900">
                          {connector.name}
                        </div>
                        <div className="text-sm text-art-gray-500">
                          {connector.id === "injected" &&
                            "MetaMask, Brave, etc."}
                          {connector.id === "walletConnect" && "Mobile wallets"}
                          {connector.id === "coinbaseWallet" &&
                            "Coinbase Wallet"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
