/**
 * Utility functions for wallet connection in different environments
 */

export type AppEnvironment = 'farcaster' | 'baseapp' | 'browser' | 'unknown';

/**
 * Detects the current app environment
 */
export function detectEnvironment(): AppEnvironment {
  if (typeof window === 'undefined') return 'unknown';

  // Check for BaseApp indicators
  const hasEthereumProvider = typeof window.ethereum !== 'undefined';
  const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
  const hostname = window.location.hostname;
  
  // Enhanced BaseApp detection
  const isBaseApp = (
    // Check for BaseApp specific client FID (309857)
    (window as any).farcaster?.context?.client?.clientFid === 309857 ||
    // Check user agent
    userAgent.includes('base') || 
    userAgent.includes('coinbase') ||
    // Check hostname
    hostname.includes('base') ||
    // Check for BaseApp specific window properties
    (window as any).BaseApp !== undefined ||
    // Check for Coinbase wallet in user agent (BaseApp uses Coinbase infrastructure)
    (hasEthereumProvider && window.ethereum?.isCoinbaseWallet)
  );

  if (hasEthereumProvider && isBaseApp) {
    return 'baseapp';
  }

  // Enhanced Farcaster detection (only treat as Farcaster if host is trusted)
  const isFarcaster = (
    (
      userAgent.includes('farcaster') ||
      (window as any).farcaster !== undefined ||
      // Check for embedded frame context
      ((window as any).top !== window && (window as any).parent?.postMessage)
    ) && isTrustedFarcasterHost()
  );

  if (isFarcaster) {
    return 'farcaster';
  }

  // Browser detection with wallet
  if (hasEthereumProvider) {
    return 'browser';
  }

  return 'unknown';
}

/**
 * Gets the appropriate connector ID for the current environment
 */
export function getPreferredConnectorId(environment: AppEnvironment): string {
  switch (environment) {
    case 'baseapp':
    case 'browser':
      return 'injected';
    case 'farcaster':
      // Connector id varies by package version; prefer a generic hint
      return 'farcaster';
    default:
      return 'injected'; // fallback
  }
}

/**
 * Checks if wallet connection is available in the current environment
 */
export function isWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  const environment = detectEnvironment();
  
  switch (environment) {
    case 'baseapp':
    case 'browser':
      return typeof window.ethereum !== 'undefined';
    case 'farcaster':
      return true; // Farcaster should always have wallet available
    default:
      return false;
  }
}

/**
 * Gets a user-friendly message about wallet availability
 */
export function getWalletAvailabilityMessage(environment: AppEnvironment): string {
  switch (environment) {
    case 'baseapp':
      return 'Connect your wallet using BaseApp';
    case 'farcaster':
      return 'Connect your wallet using Farcaster';
    case 'browser':
      return 'Connect your wallet using browser extension';
    case 'unknown':
      return 'Wallet connection not available in this environment';
    default:
      return 'Please use a supported wallet';
  }
}

/**
 * Gets BaseApp context including user basename if available
 */
export async function getBaseAppContext(): Promise<{
  basename?: string;
  address?: string;
  fid?: number;
} | null> {
  if (typeof window === 'undefined') return null;
  
  const environment = detectEnvironment();
  if (environment !== 'baseapp') return null;

  try {
    // Try to get context from BaseApp
    if ((window as any).farcaster?.context) {
      const context = (window as any).farcaster.context;
      return {
        basename: context.user?.username || context.user?.displayName,
        fid: context.user?.fid,
        address: context.user?.walletAddress
      };
    }

    // Fallback: Try to get from Farcaster SDK if available
    if ((window as any).sdk?.context) {
      const context = await (window as any).sdk.context;
      return {
        basename: context.user?.username || context.user?.displayName,
        fid: context.user?.fid,
        address: context.user?.walletAddress
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting BaseApp context:', error);
    return null;
  }
}

/**
 * Gets Farcaster context for username display
 */
export async function getFarcasterUserContext(): Promise<{
  username?: string;
  displayName?: string;
  fid?: number;
  pfpUrl?: string;
} | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    // Import Farcaster SDK dynamically
    const { sdk } = await import('@farcaster/frame-sdk');
    const context = await sdk.context;
    
    return {
      username: context.user?.username,
      displayName: context.user?.displayName,
      fid: context.user?.fid,
      pfpUrl: context.user?.pfpUrl
    };
  } catch (error) {
    console.error('Error getting Farcaster context:', error);
    return null;
  }
}

/**
 * Returns true if the current frame appears to be embedded by a trusted
 * Farcaster host (e.g., farcaster.xyz / warpcast.com). Used to avoid
 * attempting Farcaster-specific connectors when running in generic iframes
 * during development (e.g., cloudflare tunnels).
 */
export function isTrustedFarcasterHost(): boolean {
  if (typeof document === 'undefined') return false;
  const ref = document.referrer?.toLowerCase?.() || '';
  return ref.includes('farcaster') || ref.includes('farcaster.xyz');
}

/**
 * Detects whether Farcaster runtime/SDK is available in the page
 */
export function hasFarcasterRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w: any = window as any;
  return !!(w.farcaster || w.sdk);
}
