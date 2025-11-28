import { supabase } from "../lib/supabase";

export interface TransactionData {
  tx_hash: string;
  user_address: string;
  token_address: string;
  type: "buy" | "sell" | "create";
  amount_token?: number;
  amount_eth?: number;
  amount_usd?: number;
  price_eth?: number;
  price_usd?: number;
}

export interface PortfolioItem {
  token_address: string;
  balance: number;
  average_buy_price_usd: number;
  total_invested_usd: number;
  realized_pnl_usd: number;
  token_details?: any; // Joined from drawcoins
}

export class AnalyticsService {
  /**
   * Record a new transaction (Buy, Sell, Create)
   * Triggers in DB will automatically update User Stats and Platform Stats
   */
  /**
   * Record a new transaction (Buy, Sell, Create)
   * Triggers in DB will automatically update User Stats and Platform Stats
   */
  static async recordTransaction(data: TransactionData) {
    try {
      console.log("[AnalyticsService] Recording transaction:", data);

      // 1. Ensure user exists in users table (create if not exists)
      const { error: userError } = await supabase.from("users").upsert(
        {
          address: data.user_address,
          last_active: new Date().toISOString(),
        },
        {
          onConflict: "address",
          ignoreDuplicates: false,
        }
      );

      if (userError) {
        console.error("[AnalyticsService] User upsert error:", userError);
      }

      // 2. Insert Transaction
      // The DB Trigger 'trigger_update_portfolio' and 'trigger_update_user_stats'
      // will handle portfolio and stats updates automatically.
      const transactionData = {
        tx_hash: data.tx_hash,
        user_address: data.user_address,
        token_address: data.token_address,
        type: data.type,
        amount_token: data.amount_token || 0,
        amount_eth: data.amount_eth || 0,
        amount_usd: data.amount_usd || 0,
        price_eth: data.price_eth || 0,
        price_usd: data.price_usd || 0,
      };

      const { error: txError } = await supabase
        .from("transactions")
        .insert(transactionData);

      if (txError) {
        console.error("[AnalyticsService] Transaction insert error:", txError);
        throw txError;
      }

      // 3. TRIGGERED UPDATE: Update the coin's price in DB immediately
      // This ensures the user sees the impact of their trade instantly on the UI
      try {
        // We import dynamically to avoid circular dependencies if any
        const { getCoinDetails } = await import("./sdk/getCoins");
        const { CoinService } = await import("./coinService");

        // Fetch live data from Zora
        const zoraData: any = await getCoinDetails(data.token_address);
        const details = zoraData?.zora20Token || zoraData;

        if (details) {
          // Note: Zora SDK structure varies, ensure we get the right price field.
          // Usually 'priceInPoolToken' or derived from market cap / supply.
          // For now, we'll use the data we have. If 'price' is available in details, use it.

          // Actually, let's use the same logic as the Cron Job for consistency
          const tokenPrice = parseFloat(
            details.tokenPrice?.priceInPoolToken || "0"
          );
          const volume = parseFloat(
            details.volume24h || details.totalVolume || "0"
          );
          const supply = parseFloat(details.totalSupply || "0");
          const holders = details.uniqueHolders || 0;

          await CoinService.updateCoinPrice(
            data.token_address,
            isNaN(tokenPrice) ? 0 : tokenPrice,
            isNaN(volume) ? 0 : volume,
            isNaN(supply) ? 0 : supply,
            holders
          );
          console.log(
            `[AnalyticsService] Triggered update for ${data.token_address}`
          );
        }
      } catch (updateError) {
        console.error(
          "[AnalyticsService] Failed to trigger coin update:",
          updateError
        );
        // Don't fail the transaction record just because the background update failed
      }

      return true;
    } catch (error) {
      console.error("❌ Failed to record transaction:", error);
      return false;
    }
  }

  // updatePortfolio method is removed as it is now handled by DB triggers

  /**
   * Get User Stats
   */
  static async getUserStats(address: string) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("address", address)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error("❌ Failed to get user stats:", error);
      return null;
    }
  }

  /**
   * Get User Portfolio (from Zora SDK + Our Database)
   * Fetches real on-chain balances and filters for tokens created on our platform
   */
  static async getPortfolio(address: string): Promise<PortfolioItem[]> {
    try {
      // 1. Fetch all user balances from Zora SDK
      const zoraBalancesModule = await import("../services/portfolioService");
      const { balances: zoraBalances } =
        await zoraBalancesModule.getUserBalances(address, 100);

      if (!zoraBalances || zoraBalances.length === 0) {
        return [];
      }

      // 2. Get all token addresses from our platform (drawcoins)
      const { data: platformTokens, error: tokensError } = await supabase
        .from("drawcoins")
        .select("contract_address, name, symbol, image_url, creator_address");

      if (tokensError) {
        console.error("Error fetching platform tokens:", tokensError);
        return [];
      }

      // Create a map for quick lookup
      const platformTokensMap = new Map(
        (platformTokens || []).map((token) => [
          token.contract_address.toLowerCase(),
          token,
        ])
      );

      // 3. Filter Zora balances for tokens on our platform
      const portfolioItems: PortfolioItem[] = [];

      for (const zoraBalance of zoraBalances) {
        const tokenAddress = zoraBalance.coin?.address?.toLowerCase();
        if (!tokenAddress) continue;

        // Only include tokens from our platform
        const platformToken = platformTokensMap.get(tokenAddress);
        if (!platformToken) continue;

        // Get on-chain balance
        const balance = parseFloat(zoraBalance.balance || "0") / 1e18;
        if (balance <= 0) continue;

        // Try to get transaction history for this token to calculate avg price
        // We can now use the portfolio table which is automatically updated by triggers
        const { data: portfolioData } = await supabase
          .from("portfolio")
          .select("average_buy_price_usd, total_invested_usd, realized_pnl_usd")
          .eq("user_address", address)
          .eq("token_address", tokenAddress)
          .single();

        const avgPrice = portfolioData?.average_buy_price_usd || 0;
        const totalInvested = portfolioData?.total_invested_usd || 0;
        const realizedPnl = portfolioData?.realized_pnl_usd || 0;

        portfolioItems.push({
          token_address: tokenAddress,
          balance: balance,
          average_buy_price_usd: avgPrice,
          total_invested_usd: totalInvested,
          realized_pnl_usd: realizedPnl,
          token_details: {
            ...platformToken,
            name: zoraBalance.coin?.name || platformToken.name,
            symbol: zoraBalance.coin?.symbol || platformToken.symbol,
            // Use CDN-optimized image from Zora instead of raw IPFS
            image_url:
              zoraBalance.coin?.mediaContent?.previewImage?.medium ||
              zoraBalance.coin?.mediaContent?.previewImage?.small ||
              platformToken.image_url,
            // Include full Zora coin data for additional information
            zora_data: zoraBalance.coin,
            // Map market data fields for UI consistency
            marketCap: zoraBalance.coin?.marketCap,
            change24h: zoraBalance.coin?.marketCapDelta24h,
            volume24h:
              zoraBalance.coin?.volume24h || zoraBalance.coin?.totalVolume,
            holders: zoraBalance.coin?.uniqueHolders,
          },
        });
      }

      return portfolioItems;
    } catch (error) {
      console.error("❌ Failed to get portfolio:", error);
      return [];
    }
  }

  /**
   * Get Global Platform Stats
   */
  static async getGlobalStats() {
    try {
      const { data, error } = await supabase
        .from("platform_stats")
        .select("*")
        .eq("id", 1)
        .single();

      if (error)
        return {
          total_volume_usd: 0,
          total_trades: 0,
          total_coins_created: 0,
          total_users: 0,
          total_unique_traders: 0,
          total_volume_24h: 0,
          top_coin_address: null,
        };
      return data;
    } catch (error) {
      console.error("❌ Failed to get global stats:", error);
      return {
        total_volume_usd: 0,
        total_trades: 0,
        total_coins_created: 0,
        total_users: 0,
        total_unique_traders: 0,
        total_volume_24h: 0,
        top_coin_address: null,
      };
    }
  }

  /**
   * Get Leaderboard
   */
  static async getLeaderboard(type: "volume" | "created", limit: number = 10) {
    try {
      let query = supabase.from("users").select("*");

      if (type === "volume") {
        // Now we can use the total_buy_volume column directly
        query = query.order("total_buy_volume", { ascending: false });
      } else {
        query = query.order("coins_created", { ascending: false });
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get leaderboard:", error);
      return [];
    }
  }

  /**
   * Get Top Buyers (by USD volume)
   */
  static async getTopBuyers(limit: number = 10) {
    try {
      // OPTIMIZED: Use the pre-calculated total_buy_volume column from users table
      const { data, error } = await supabase
        .from("users")
        .select("address, total_buy_volume")
        .order("total_buy_volume", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Map to expected format
      return (data || []).map((user) => ({
        address: user.address,
        total_volume_usd: user.total_buy_volume || 0,
      }));
    } catch (error) {
      console.error("❌ Failed to get top buyers:", error);
      return [];
    }
  }

  /**
   * Get Top Tokens (by Holders)
   */
  static async getTopTokens(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .order("holders", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get top tokens:", error);
      return [];
    }
  }

  /**
   * Get Most Watchlisted Tokens
   */
  static async getMostWatchlisted(limit: number = 10, offset: number = 0) {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .gt("watchlist_count", 0)
        .order("watchlist_count", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get most watchlisted tokens:", error);
      return [];
    }
  }

  /**
   * Get Top AI Art Tokens
   */
  static async getTopAI(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .eq("creation_type", "ai")
        .order("watchlist_count", { ascending: false }) // Sort by live watchlist count
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get top AI tokens:", error);
      return [];
    }
  }

  /**
   * Get Top Hand-Drawn Tokens
   */
  static async getTopHandDrawn(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .eq("creation_type", "hand-drawn")
        .order("watchlist_count", { ascending: false }) // Sort by live watchlist count
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get top hand-drawn tokens:", error);
      return [];
    }
  }

  /**
   * Get User Transaction History
   */
  static async getTransactionHistory(address: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          token_details:drawcoins!transactions_token_address_fkey(*)
        `
        )
        .eq("user_address", address)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get transaction history:", error);
      return [];
    }
  }

  /**
   * Get Recent Platform Transactions (for global stats page)
   */
  static async getRecentTransactions(
    limit: number = 20,
    offset: number = 0,
    type?: "buy" | "sell" | "create"
  ) {
    try {
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          token_details:drawcoins!transactions_token_address_fkey(*),
          user:users!transactions_user_address_fkey(username, avatar_url)
        `
        )
        .order("timestamp", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("❌ Failed to get recent transactions:", error);
      return [];
    }
  }
}
