import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSecretEnvVars() {
  const seedPhrase = process.env.SEED_PHRASE;
  const fid = process.env.FID;
  
  if (!seedPhrase || !fid) {
    return null;
  }

  return { seedPhrase, fid };
}

/**
 * Utility to check if code is running in a Farcaster Mini App environment
 */
export function isFarcasterMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Farcaster SDK
  if (window.farcaster) return true;
  
  // Check for common Farcaster environment indicators
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('farcaster') || 
         userAgent.includes('farcaster') || 
         window.parent !== window;
}

/**
 * Call the Farcaster SDK ready function to dismiss splash screen
 */
export async function dismissFarcasterSplash(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Try the import from SDK first
    const { sdk } = await import('@farcaster/frame-sdk');
    if (sdk && sdk.actions && sdk.actions.ready) {
      await sdk.actions.ready();
      console.log("Farcaster splash screen dismissed with SDK");
      return;
    }
    
    // Fallback to window.farcaster
    if (window.farcaster && window.farcaster.actions && window.farcaster.actions.ready) {
      await window.farcaster.actions.ready();
      console.log("Farcaster splash screen dismissed with window.farcaster");
      return;
    }
    
    console.log("Not in Farcaster environment, no splash to dismiss");
  } catch (error) {
    console.error("Error dismissing Farcaster splash:", error);
  }
}


