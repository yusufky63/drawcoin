"use client";

import { sdk } from "@farcaster/frame-sdk";


/**
 * This file handles Farcaster Mini App integration
 * @see https://docs.farcaster.xyz/reference/frames/spec
 */

export type FrameContext = {
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  location?: FrameLocationContext;
  client: {
    clientFid: number;
    added: boolean;
    safeAreaInsets?: SafeAreaInsets;
    notificationDetails?: FrameNotificationDetails;
  };
};

export type FrameLocationContext =
  | CastEmbedLocationContext
  | NotificationLocationContext
  | LauncherLocationContext
  | ChannelLocationContext;

export type CastEmbedLocationContext = {
  type: 'cast_embed';
  embed: string;
  cast: {
    fid: number;
    hash: string;
  };
};

export type NotificationLocationContext = {
  type: 'notification';
  notification: {
    notificationId: string;
    title: string;
    body: string;
  };
};

export type LauncherLocationContext = {
  type: 'launcher';
};

export type ChannelLocationContext = {
  type: 'channel';
  channel: {
    key: string;
    name: string;
    imageUrl?: string;
  };
};

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type FrameNotificationDetails = {
  url: string;
  token: string;
};

/**
 * Indicates that the Mini App is ready and hides the splash screen
 */
export async function dismissSplashScreen() {
  try {
    console.log("Dismissing splash screen...");
    await sdk.actions.ready();
    console.log("Splash screen dismissed.");
  } catch (error) {
    console.error("Error dismissing splash screen:", error);
  }
}

/**
 * Checks if the app is running in a Farcaster Mini App context
 */
export async function isFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  try {
    // Check if the app is running in a mini app context
    // Using type assertion as SDK types might be behind implementation
    return await (sdk as any).isInMiniApp();
  } catch (error) {
    console.error("Error checking if in mini app:", error);
    return false;
  }
}

/**
 * Gets Farcaster context information including user, location and client details
 */
export async function getFarcasterContext(): Promise<FrameContext | null> {
  try {
    if (!(await isFarcasterMiniApp())) {
      return null;
    }
    
    const contextData = await sdk.context;
    return contextData as FrameContext;
  } catch (error) {
    console.error("Error getting Farcaster context:", error);
    return null;
  }
}

/**
 * Initializes the Farcaster app
 */
export async function initializeFarcaster() {
  if (!(await isFarcasterMiniApp())) {
    console.log("Not running in a Farcaster Mini App context");
    return null;
  }

  // Dismiss splash screen after a short delay
  await dismissSplashScreen();
  
  // Get context information
  const context = await getFarcasterContext();
  console.log("Farcaster context:", context);
  
  return context;
}

// Helper to test manifest access
export async function testManifestAccess() {
  console.log("Testing manifest access...");
  
  // Test all possible paths
  const paths = [
    '/.well-known/farcaster.json',
    '/api/farcaster.json',
    '/farcaster.json'
  ];
  
  for (const path of paths) {
    try {
      const response = await fetch(path);
      console.log(`Manifest access (${path}):`, response.status, response.statusText);
      if (response.ok) {
        const data = await response.json();
        console.log(`Manifest content (${path}):`, data);
      }
    } catch (err) {
      console.error(`Error accessing manifest (${path}):`, err);
    }
  }
} 