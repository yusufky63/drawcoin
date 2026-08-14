import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable");
}

// Browser-safe public client. Service-role credentials must never be imported
// from this module; server code uses src/lib/supabaseAdmin.ts instead.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export interface Coin {
  id?: number;
  name: string;
  symbol: string;
  description?: string;
  contract_address: string;
  image_url?: string;
  category?: string;
  creator_address?: string;
  creator_name?: string;
  tx_hash?: string;
  current_price?: number;
  market_cap?: number;
  volume_24h?: number;
  total_supply?: number;
  holders?: number;
  last_trade_at?: string | null;
  last_trade_type?: "buy" | "sell" | null;
  verified_trade_count?: number;
  last_synced_at?: string;
  created_at?: string;
  updated_at?: string;
  change24hPct?: string;
  creation_type?: "ai" | "hand-drawn";
  creator?: any;
  creatorAddress?: string;
  mediaContent?: any;
  metadata?: any;
  pool?: any;
  poolAddress?: string;
  marketCap?: any;
  liquidity?: any;
  totalSupply?: any;
  ownersCount?: number;
  uniqueHolders?: number;
  volume24h?: string;
  tokenPrice?: any;
  poolCurrencyToken?: any;
  uniswapV4PoolKey?: any;
  platformReferrerAddress?: string;
  payoutRecipientAddress?: string;
  tokenUri?: string;
  chainId?: number;
  createdAt?: string;
}

export interface Database {
  public: {
    Tables: {
      drawcoins: {
        Row: Coin;
        Insert: Omit<Coin, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Coin, "id" | "created_at" | "updated_at">>;
      };
      siwe_nonces: {
        Row: {
          nonce_hash: string;
          client_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          nonce_hash: string;
          client_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          nonce_hash?: string;
          client_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
      siwe_nonce_rate_limits: {
        Row: {
          client_hash: string;
          request_count: number;
          window_started_at: string;
          reset_at: string;
        };
        Insert: {
          client_hash: string;
          request_count: number;
          window_started_at: string;
          reset_at: string;
        };
        Update: {
          client_hash?: string;
          request_count?: number;
          window_started_at?: string;
          reset_at?: string;
        };
      };
      paymaster_grants: {
        Row: {
          grant_id: string;
          account: string;
          contract_address: string;
          chain_id: number;
          token_id: string;
          claim_nonce: string;
          claim_calldata_hash: string;
          expires_at: string;
          stub_calls: number;
          data_calls: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          grant_id: string;
          account: string;
          contract_address: string;
          chain_id: number;
          token_id: string;
          claim_nonce: string;
          claim_calldata_hash: string;
          expires_at: string;
          stub_calls?: number;
          data_calls?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          grant_id?: string;
          account?: string;
          contract_address?: string;
          chain_id?: number;
          token_id?: string;
          claim_nonce?: string;
          claim_calldata_hash?: string;
          expires_at?: string;
          stub_calls?: number;
          data_calls?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      creator_identity_cache: {
        Row: {
          address: string;
          basename: string | null;
          source: "profile" | "base-l2" | "ensip19" | "none";
          checked_at: string;
          expires_at: string;
          updated_at: string;
        };
        Insert: {
          address: string;
          basename?: string | null;
          source?: "profile" | "base-l2" | "ensip19" | "none";
          checked_at?: string;
          expires_at: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          basename?: string | null;
          source?: "profile" | "base-l2" | "ensip19" | "none";
          checked_at?: string;
          expires_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      issue_siwe_nonce: {
        Args: {
          p_nonce_hash: string;
          p_client_hash: string;
          p_expires_at: string;
        };
        Returns: Array<{
          allowed: boolean;
          reason: string;
          retry_after_seconds: number;
        }>;
      };
      issue_paymaster_grant: {
        Args: {
          p_grant_id: string;
          p_account: string;
          p_contract_address: string;
          p_chain_id: number;
          p_token_id: string;
          p_claim_nonce: string;
          p_claim_calldata_hash: string;
          p_expires_at: string;
        };
        Returns: boolean;
      };
      reserve_paymaster_grant: {
        Args: {
          p_grant_id: string;
          p_account: string;
          p_contract_address: string;
          p_chain_id: number;
          p_token_id: string;
          p_claim_nonce: string;
          p_claim_calldata_hash: string;
          p_expires_at: string;
          p_request_method: string;
        };
        Returns: boolean;
      };
      reserve_ipfs_upload: {
        Args: {
          p_client_key: string;
          p_image_bytes: number;
        };
        Returns: Array<{
          allowed: boolean;
          retry_after_seconds: number;
        }>;
      };
      commit_legacy_activity_verification: {
        Args: {
          p_entity_type: "drawcoin" | "transaction";
          p_entity_id: string;
          p_chain_id: number;
          p_tx_hash: string;
          p_block_number: string;
          p_log_index: number;
          p_event_name: "CoinCreatedV4" | "CoinBuy" | "CoinSell";
          p_verified_at: string;
        };
        Returns: boolean;
      };
      commit_legacy_trade_verification: {
        Args: {
          p_entity_id: string;
          p_chain_id: number;
          p_tx_hash: string;
          p_block_number: string;
          p_log_index: number;
          p_event_name: "CoinBuy" | "CoinSell";
          p_proof_kind: "universal_router_transfer" | "entrypoint_transfer";
          p_verified_at: string;
        };
        Returns: boolean;
      };
      reconfirm_legacy_watchlists: {
        Args: {
          p_address: string;
        };
        Returns: Array<{
          confirmed_count: number;
          remaining_count: number;
        }>;
      };
    };
  };
}
