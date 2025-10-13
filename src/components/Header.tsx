"use client"
import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { detectEnvironment, getBaseAppContext, getFarcasterUserContext } from '../utils/wallet';

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
}

interface UserInfo {
  name?: string;
  type?: 'basename' | 'farcaster' | 'custom';
  fid?: number;
}

export default function ArtHeader({
  activeTab = "explore",
  onTabChange,
  userName,
}: HeaderProps) {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Update currentTab based on pathname
  useEffect(() => {
    if (pathname === '/') {
      setCurrentTab('explore');
    } else if (pathname === '/create') {
      setCurrentTab('create');
    } else if (pathname === '/portfolio') {
      setCurrentTab('portfolio');
    } else if (pathname.startsWith('/coin/')) {
      setCurrentTab('explore'); // Coin detail pages are part of explore
    }
  }, [pathname]);

  // Auto-connect in Farcaster Mini App
  useEffect(() => {
    if ((userInfo.type === 'farcaster' || userInfo.type === 'basename') && !isConnected && connectors.length > 0) {
      console.log('Auto-connecting in Farcaster Mini App...');
      connect({ connector: connectors[0] });
    }
  }, [userInfo.type, isConnected, connectors, connect]);

  // Fetch user info based on environment
  useEffect(() => {
    const fetchUserInfo = async () => {
      // If userName prop is provided, use it
      if (userName) {
        setUserInfo({ name: userName, type: 'custom' });
        return;
      }

      const environment = detectEnvironment();
      
      try {
        if (environment === 'baseapp') {
          const baseAppContext = await getBaseAppContext();
          if (baseAppContext?.basename) {
            setUserInfo({
              name: baseAppContext.basename,
              type: 'basename',
              fid: baseAppContext.fid
            });
            return;
          }
        }

        if (environment === 'farcaster' || environment === 'baseapp') {
          const farcasterContext = await getFarcasterUserContext();
          if (farcasterContext?.username || farcasterContext?.displayName) {
            setUserInfo({
              name: farcasterContext.username || farcasterContext.displayName,
              type: 'farcaster',
              fid: farcasterContext.fid
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserInfo();
  }, [userName]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-50 mb-2" style={{ 
        border: '3px solid #2d3748',
        borderBottom: '3px solid #2d3748',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderRadius: '0 0 25px 10px',
        transform: 'rotate(-0.5deg)',
        boxShadow: '5px 5px 0 #2d3748',
        background: 'linear-gradient(135deg, #ffffff, #f7fafc)'
      }}>
        <div className="max-w-7xl mx-auto px-4 ">
          <div className="flex justify-between items-center h-20">
            {/* Brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 transform rotate-1">
                <h1 className="text-2xl font-bold text-art-gray-900 transform -rotate-1" style={{ 
                  textShadow: '1px 1px 0 #2d3748',
                  color: '#1a202c'
                }}>
                  DrawCoin
                </h1>
              </div>
              
              {/* Navigation */}
              <nav className="flex space-x-6">
                <Link
                  href="/"
                  className="hand-drawn-btn text-sm font-medium transition-all duration-200"
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: currentTab === "explore" ? '#ffffff' : '#ffffff',
                    color: currentTab === "explore" ? '#ffffff' : '#ffffff',
                    transform: currentTab === "explore" ? 'rotate(-1deg)' : 'rotate(1deg)',
                    textDecoration: 'none'
                  }}
                >
                  Explore
                </Link>
                <Link
                  href="/create"
                  className="hand-drawn-btn text-sm font-medium transition-all duration-200"
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: currentTab === "create" ? '#ffffff' : '#ffffff',
                    color: currentTab === "create" ? '#ffffff' : '#ffffff',
                    transform: currentTab === "create" ? 'rotate(-1deg)' : 'rotate(1deg)',
                    textDecoration: 'none'
                  }}
                >
                  Create
                </Link>
                <Link
                  href="/portfolio"
                  className="hand-drawn-btn text-sm font-medium transition-all duration-200"
                  style={{ 
                    padding: '0.5rem 1rem',
                    backgroundColor: currentTab === "portfolio" ? '#2d3748' : '#ffffff',
                    color: currentTab === "portfolio" ? '#ffffff' : '#ffffff',
                    transform: currentTab === "portfolio" ? 'rotate(-1deg)' : 'rotate(1deg)',
                    textDecoration: 'none'
                  }}
                >
                  Portfolio
                </Link>
              </nav>
            </div>

            {/* User Info and Wallet */}
            <div className="flex items-center space-x-4">
              {userInfo.name && (
                <div className="text-sm text-art-gray-600 transform rotate-1">
                  {userInfo.type === 'basename' ? 'Base: ' : userInfo.type === 'farcaster' ? 'FC: ' : ''}
                  <span className=" font-bold text-art-gray-900">{userInfo.name}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                {isConnected && address ? (
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 bg-art-gray-100 px-3 py-2 rounded-art transform -rotate-1" style={{
                      border: '2px solid #2d3748',
                      borderRadius: '8px 3px 6px 4px',
                      boxShadow: '2px 2px 0 #2d3748'
                    }}>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      </div>
                      <span className="font-mono text-sm text-art-gray-900">
                        {address.substring(0, 6)}...{address.substring(address.length - 4)}
                      </span>
                    </div>
                    <button
                      onClick={() => disconnect()}
                      className="p-2 hover:bg-art-gray-800 rounded-art transition-colors hand-drawn-btn"
                      title="Disconnect Wallet"
                      style={{
                        border: '2px solid #2d3748',
                        borderRadius: '6px 2px 4px 3px',
                        transform: 'rotate(0.5deg)',
                        boxShadow: '2px 2px 0 #2d3748',
                        backgroundColor: '#2d3748'
                      }}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        if (userInfo.type === 'farcaster' || userInfo.type === 'basename') {
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
                        padding: '0.5rem 1rem',
                        transform: 'rotate(-0.5deg)'
                      }}
                    >
                      {isPending ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                    <div className="text-xs text-art-gray-500 max-w-32">
                      {userInfo.type === 'farcaster' || userInfo.type === 'basename' 
                        ? 'Wallet auto-connects in Farcaster' 
                        : ''
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 mb-2" style={{ 
        border: '3px solid #2d3748',
        borderBottom: '3px solid #2d3748',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderRadius: '0 0 25px 10px',
        transform: 'rotate(-0.5deg)',
        boxShadow: '5px 5px 0 #2d3748',
        background: 'linear-gradient(135deg, #ffffff, #f7fafc)'
      }}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 transform rotate-1">
              <h1 className="text-lg font-bold text-art-gray-900 transform -rotate-1" style={{ 
                textShadow: '1px 1px 0 #2d3748',
                color: '#1a202c'
              }}>
                DrawCoin
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              {isConnected && address ? (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 bg-art-gray-100 px-2 py-1 rounded-art transform -rotate-1" style={{
                    border: '2px solid #2d3748',
                    borderRadius: '6px 2px 4px 3px',
                    boxShadow: '2px 2px 0 #2d3748'
                  }}>
                   
                    <span className="font-mono text-xs text-art-gray-900">
                      {address.substring(0, 4)}...{address.substring(address.length - 4)}
                    </span>
                  </div>
                  <button
                    onClick={() => disconnect()}
                    className="p-1.5 hover:bg-art-gray-800 rounded-art transition-colors hand-drawn-btn"
                    title="Disconnect Wallet"
                    style={{
                      border: '2px solid #2d3748',
                      borderRadius: '4px 1px 3px 2px',
                      transform: 'rotate(0.5deg)',
                      boxShadow: '1px 1px 0 #2d3748',
                      backgroundColor: '#2d3748'
                    }}
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-end space-y-1">
                  <button
                    onClick={() => {
                      if (userInfo.type === 'farcaster' || userInfo.type === 'basename') {
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
                      padding: '0.25rem 0.5rem',
                      transform: 'rotate(-0.5deg)'
                    }}
                  >
                    {isPending ? 'Connecting...' : 'Connect'}
                  </button>
                  <div className="text-xs text-art-gray-500 text-right max-w-20">
                    {userInfo.type === 'farcaster' || userInfo.type === 'basename' 
                      ? 'Auto-connects' 
                      : ''
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]" style={{ 
        border: '2px solid #2d3748',
        borderTop: '3px solid #2d3748',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderRadius: '25px 10px 0 0',
        transform: 'rotate(0.5deg)',
        boxShadow: '0 0px 0px 0 #2d3748',
        background: 'linear-gradient(135deg, #ffffff, #f7fafc)'
      }}>
        <div className="flex items-center justify-around py-2">
          <Link
            href="/"
            className={`flex flex-col items-center py-1 px-2 transition-all duration-200 ${
              currentTab === "explore"
                ? "text-art-gray-900"
                : "text-art-gray-500"
            }`}
            style={{ transform: currentTab === "explore" ? 'rotate(-1deg)' : 'rotate(1deg)', textDecoration: 'none' }}
          >
            <div className={`w-8 h-8 border-2 border-art-gray-900 rounded-full flex items-center justify-center mb-1 ${
              currentTab === "explore" ? 'bg-art-gray-900' : 'bg-art-white'
            }`} style={{ borderRadius: '50% 30% 50% 30%' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ stroke: currentTab === "explore" ? 'white' : '#6b7280', strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-[10px]  font-bold">Explore</span>
          </Link>

          <Link
            href="/create"
            className={`flex flex-col items-center py-1 px-2 transition-all duration-200 ${
              currentTab === "create"
                ? "text-art-gray-900"
                : "text-art-gray-500"
            }`}
            style={{ transform: currentTab === "create" ? 'rotate(-1deg)' : 'rotate(1deg)', textDecoration: 'none' }}
          >
            <div className={`w-10 h-10 border-2 border-art-gray-900 rounded-full flex items-center justify-center mb-1 ${
              currentTab === "create" 
                ? "bg-art-gray-900 text-art-white" 
                : "bg-art-white text-art-gray-500"
            }`} style={{ borderRadius: '50% 30% 50% 30%' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-[10px]  font-bold">Create</span>
          </Link>

          <Link
            href="/portfolio"
            className={`flex flex-col items-center py-1 px-2 transition-all duration-200 ${
              currentTab === "portfolio"
                ? "text-art-gray-900"
                : "text-art-gray-500"
            }`}
            style={{ transform: currentTab === "portfolio" ? 'rotate(-1deg)' : 'rotate(1deg)', textDecoration: 'none' }}
          >
            <div className={`w-8 h-8 border-2 border-art-gray-900 rounded-full flex items-center justify-center mb-1 ${
              currentTab === "portfolio" ? 'bg-art-gray-900' : 'bg-art-white'
            }`} style={{ borderRadius: '50% 30% 50% 30%' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ stroke: currentTab === "portfolio" ? 'white' : '#6b7280', strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-[10px]  font-bold">Portfolio</span>
          </Link>
        </div>
      </nav>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" style={{
            border: '3px solid #2d3748',
            borderRadius: '15px 5px 10px 8px',
            transform: 'rotate(-0.5deg)',
            boxShadow: '5px 5px 0 #2d3748'
          }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-art-gray-900">Connect Wallet</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-art-gray-500 hover:text-art-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              {connectors.filter(connector => connector.id !== 'farcasterMiniApp').map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setShowWalletModal(false);
                  }}
                  disabled={isPending}
                  className="w-full p-3 border-2 border-art-gray-300 rounded-lg hover:border-art-gray-500 transition-colors text-left disabled:opacity-50"
                  style={{
                    borderRadius: '8px 3px 6px 4px',
                    transform: 'rotate(0.5deg)'
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
                        {connector.id === 'injected' && 'MetaMask, Brave, etc.'}
                        {connector.id === 'walletConnect' && 'Mobile wallets'}
                        {connector.id === 'coinbaseWallet' && 'Coinbase Wallet'}
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
