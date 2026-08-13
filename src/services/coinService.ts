import { supabase, type Coin } from "../lib/supabase";
import { COIN_SNAPSHOT_COLUMNS } from "../lib/market/coinSnapshot";
import { buildPostgrestCoinSearchFilter } from "../lib/market/requestPolicy";

// Re-export the Coin type for use in other components
export type { Coin };

export const COIN_CARD_COLUMNS = COIN_SNAPSHOT_COLUMNS;

export type CoinQueryParams = {
  category?: string;
  creator_address?: string;
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  creation_type?: string;
};

type CoinCountParams = Pick<
  CoinQueryParams,
  "category" | "creator_address" | "search" | "creation_type"
>;

export interface CreateCoinData {
  name: string;
  symbol: string;
  description: string;
  contract_address: string;
  image_url: string;
  category: string;
  creator_address: string;
  creator_name?: string;
  tx_hash: string;
  chain_id?: number;
  currency?: string;
  platform_referrer?: string;
  creation_type?: "ai" | "hand-drawn";
}

export class CoinService {
  /**
   * Save a newly created coin to the database
   */
  static async saveCoin(coinData: CreateCoinData): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .insert({
          name: coinData.name,
          symbol: coinData.symbol,
          description: coinData.description,
          contract_address: coinData.contract_address,
          image_url: coinData.image_url,
          category: coinData.category,
          creator_address: coinData.creator_address,
          creator_name: coinData.creator_name,
          tx_hash: coinData.tx_hash,
          chain_id: coinData.chain_id || 8453, // Default to Base mainnet
          currency: coinData.currency || "ETH",
          platform_referrer: coinData.platform_referrer,
          creation_type: coinData.creation_type || "hand-drawn", // Default to hand-drawn
          holders: 1, // Creator is the first holder
          // Initialize numeric fields
          current_price: 0,
          volume_24h: 0,
          total_supply: 0,
          last_synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving coin:", error);
        throw error;
      }

      console.log("✅ Coin saved to database:", data);
      return data;
    } catch (error) {
      console.error("❌ Failed to save coin:", error);
      return null;
    }
  }

  /**
   * Get all coins with optional filters
   */
  static async getCoins(
    params?: CoinQueryParams,
    options?: { throwOnError?: boolean }
  ): Promise<Coin[]> {
    try {
      let query = supabase.from("drawcoins").select(COIN_CARD_COLUMNS);

      // PostgREST preserves the order chain. Every public sort therefore ends
      // with stable tie-breakers so pagination cannot shuffle equal values.
      switch (params?.sort) {
        case "market-cap":
          query = query
            .order("market_cap", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
        case "oldest":
          query = query
            .order("created_at", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true });
          break;
        case "most-watched":
          query = query
            .order("watchlist_count", {
              ascending: false,
              nullsFirst: false,
            })
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
        case "newest":
        default:
          query = query
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
      }

      // Apply filters
      if (params?.category) {
        query = query.eq("category", params.category);
      }

      if (params?.creator_address) {
        query = query.eq("creator_address", params.creator_address);
      }

      if (params?.creation_type) {
        query = query.eq("creation_type", params.creation_type);
      }

      if (params?.search) {
        query = query.or(buildPostgrestCoinSearchFilter(params.search, true));
      }

      if (params?.limit) {
        const offset = params.offset ?? 0;
        query = query.range(offset, offset + params.limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching coins:", error);
        throw error;
      }

      return (data ?? []) as unknown as Coin[];
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to fetch coins:", error);
      return [];
    }
  }

  /**
   * Returns one deterministic page and its filtered total from the same
   * PostgREST request. This avoids a second network round trip and prevents
   * the rows/count pair from observing different snapshots.
   */
  static async getCoinsPage(
    params: CoinQueryParams,
    options?: { throwOnError?: boolean }
  ): Promise<{ coins: Coin[]; total: number }> {
    try {
      let query = supabase
        .from("drawcoins")
        .select(COIN_CARD_COLUMNS, { count: "exact" });

      switch (params.sort) {
        case "market-cap":
          query = query
            .order("market_cap", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
        case "oldest":
          query = query
            .order("created_at", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true });
          break;
        case "most-watched":
          query = query
            .order("watchlist_count", {
              ascending: false,
              nullsFirst: false,
            })
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
        case "newest":
        default:
          query = query
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
          break;
      }

      if (params.category) query = query.eq("category", params.category);
      if (params.creator_address) {
        query = query.eq("creator_address", params.creator_address);
      }
      if (params.creation_type) {
        query = query.eq("creation_type", params.creation_type);
      }
      if (params.search) {
        query = query.or(buildPostgrestCoinSearchFilter(params.search, true));
      }

      if (params.limit) {
        const offset = params.offset ?? 0;
        query = query.range(offset, offset + params.limit - 1);
      }

      const { count, data, error } = await query;
      if (error) {
        // PostgREST returns 416 when an offset is beyond the final row. Some
        // supported supabase-js versions do not preserve its PGRST103 code,
        // so verify the boundary with a count instead of pattern matching the
        // error. A real failure on an in-range page remains visible.
        const offset = params.offset ?? 0;
        if (offset > 0) {
          const total = await this.getTotalCoinsCount(params, {
            throwOnError: true,
          });
          if (offset >= total) return { coins: [], total };
        }
        throw error;
      }

      return {
        coins: (data ?? []) as unknown as Coin[],
        total: count ?? 0,
      };
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("Failed to fetch the coin page:", error);
      return { coins: [], total: 0 };
    }
  }

  /**
   * Get a single coin by contract address
   */
  static async getCoinByAddress(contractAddress: string): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .eq("contract_address", contractAddress)
        .single();

      if (error) {
        console.error("Error fetching coin:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("❌ Failed to fetch coin:", error);
      return null;
    }
  }

  /**
   * Get only coin addresses (and created_at) for lightweight pagination
   */
  static async getCoinAddresses(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<
    Array<{
      contract_address: string;
      created_at: string;
      name?: string;
      symbol?: string;
      description?: string;
    }>
  > {
    try {
      let query = supabase
        .from("drawcoins")
        .select("contract_address,created_at,name,symbol,description")
        .order("created_at", { ascending: false });

      if (params?.search) {
        // Search in name, symbol, and description fields
        query = query.or(buildPostgrestCoinSearchFilter(params.search, true));
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(
          params.offset,
          params.offset + (params.limit || 10) - 1
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching coin addresses:", error);
        return [];
      }
      return (data || []) as Array<{
        contract_address: string;
        created_at: string;
        name?: string;
        symbol?: string;
        description?: string;
      }>;
    } catch (err) {
      console.error("❌ Failed to fetch coin addresses:", err);
      return [];
    }
  }

  /**
   * Update coin information (price, holders, etc.)
   */
  static async updateCoin(
    contractAddress: string,
    updates: Partial<Coin>
  ): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_address", contractAddress)
        .select()
        .single();

      if (error) {
        console.error("Error updating coin:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("❌ Failed to update coin:", error);
      return null;
    }
  }

  /**
   * Update coin price and volume (Specific method for sync/trade)
   */
  static async updateCoinPrice(
    contractAddress: string,
    price: number,
    volume: number,
    supply?: number,
    holders?: number
  ): Promise<boolean> {
    try {
      const updates: any = {
        current_price: price,
        volume_24h: volume,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (supply !== undefined) updates.total_supply = supply;
      if (holders !== undefined) updates.holders = holders;

      const { error } = await supabase
        .from("drawcoins")
        .update(updates)
        .eq("contract_address", contractAddress);

      if (error) {
        console.error("Error updating coin price:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("❌ Failed to update coin price:", error);
      return false;
    }
  }

  /**
   * Get coins by category
   */
  static async getCoinsByCategory(category: string): Promise<Coin[]> {
    return this.getCoins({ category });
  }

  /**
   * Get coins by creator
   */
  static async getCoinsByCreator(creatorAddress: string): Promise<Coin[]> {
    return this.getCoins({ creator_address: creatorAddress });
  }

  /**
   * Get latest coins (default 20 per page)
   */
  static async getLatestCoins(limit: number = 20): Promise<Coin[]> {
    return this.getCoins({ limit });
  }

  /**
   * Search coins
   */
  static async searchCoins(searchTerm: string): Promise<Coin[]> {
    return this.getCoins({ search: searchTerm });
  }

  /**
   * Check if a coin already exists
   */
  static async coinExists(contractAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("id")
        .eq("contract_address", contractAddress)
        .single();

      return !!data && !error;
    } catch {
      return false;
    }
  }

  /**
   * Get total count of coins for pagination
   */
  static async getTotalCoinsCount(
    params?: CoinCountParams,
    options?: { throwOnError?: boolean }
  ): Promise<number> {
    try {
      let query = supabase
        .from("drawcoins")
        .select("id", { count: "exact", head: true });

      if (params?.category) {
        query = query.eq("category", params.category);
      }
      if (params?.creator_address) {
        query = query.eq("creator_address", params.creator_address);
      }
      if (params?.creation_type) {
        query = query.eq("creation_type", params.creation_type);
      }
      if (params?.search) {
        query = query.or(buildPostgrestCoinSearchFilter(params.search, true));
      }

      const { count, error } = await query;

      if (error) {
        console.error("Error getting total coins count:", error);
        if (options?.throwOnError) throw error;
        return 0;
      }

      return count || 0;
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get total coins count:", error);
      return 0;
    }
  }

  /**
   * Get coin statistics
   */
  static async getCoinStats(): Promise<{
    totalCoins: number;
    totalCreators: number;
    categoryCounts: Record<string, number>;
  }> {
    try {
      // Total coins
      const { count: totalCoins, error: countError } = await supabase
        .from("drawcoins")
        .select("*", { count: "exact", head: true });
      if (countError) throw countError;

      // Unique creators
      const { data: creatorsData, error: creatorsError } = await supabase
        .from("drawcoins")
        .select("creator_address");
      if (creatorsError) throw creatorsError;

      const uniqueCreators = new Set(
        creatorsData?.map((c) => c.creator_address) || []
      );

      // Category counts
      const { data: categoryData, error: categoryError } = await supabase
        .from("drawcoins")
        .select("category");
      if (categoryError) throw categoryError;

      const categoryCounts =
        categoryData?.reduce((acc, coin) => {
          acc[coin.category] = (acc[coin.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

      return {
        totalCoins: totalCoins || 0,
        totalCreators: uniqueCreators.size,
        categoryCounts,
      };
    } catch (error) {
      console.error("❌ Failed to fetch coin stats:", error);
      throw error;
    }
  }
}
