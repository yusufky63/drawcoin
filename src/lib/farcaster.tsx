"use client";
import React, { useContext } from "react";
import { sdk } from '@farcaster/frame-sdk';

/**
 * Complete Farcaster SDK integration for DrawCoin
 */

// Define the Farcaster context types
export interface FarcasterContext {
  user: {
    fid: number | null;
    username: string | null;
    displayName: string | null;
    pfpUrl: string | null;
  };
  client: {
    safeAreaInsets: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
}

// Define common Farcaster actions
export interface FarcasterActions {
  ready: () => Promise<void>;
  addFrame: () => Promise<void>;
  composeCast: (options: { text: string }) => Promise<void>;
  viewProfile: (options: { fid: number }) => Promise<void>;
}

// Create a FarcasterContext for React components
const FarcasterContext = React.createContext(sdk);

// Provider component to initialize Farcaster
export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  return (
    <FarcasterContext.Provider value={sdk}>
      {children}
    </FarcasterContext.Provider>
  );
}

// Hook to use Farcaster SDK in components
export const useFarcaster = () => useContext(FarcasterContext);

export default sdk; 