/**
 * Initialize a new Farcaster mini-app project
 * @returns Promise<void>
 */
export function init(): Promise<void>;

// Farcaster SDK global type definitions
declare global {
  interface Window {
    farcaster?: {
      actions: {
        ready: () => Promise<void>;
      };
      events?: {
        on: (event: string, callback: () => void) => void;
        off?: (event: string, callback: () => void) => void;
      };
      wallet?: {
        ethProvider: {
          request: (args: { method: string }) => Promise<string[]>
        }
      };
      context?: {
        user?: {
          fid?: number;
          username?: string;
          displayName?: string;
          pfp?: {
            url?: string;
          };
        };
        client?: {
          safeAreaInsets?: {
            top: number;
            bottom: number;
            left: number;
            right: number;
          }
        }
      };
    };
  }
} 