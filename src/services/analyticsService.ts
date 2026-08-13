import { supabase } from "../lib/supabase";
import { COIN_CARD_COLUMNS, type Coin } from "./coinService";

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
  token_details?: Record<string, unknown>; // Joined from drawcoins
}

type WatchlistedCoin = Coin & {
  price_change_24h?: number;
  watchlist_count?: number;
};

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

      if (data.type === "create") {
        // Coin creation is verified and recorded by /api/coins/create together
        // with the official Zora CoinCreatedV4 event.
        return true;
      }

      const response = await fetch("/api/transactions/record", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_hash: data.tx_hash,
          user_address: data.user_address,
          token_address: data.token_address,
          type: data.type,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Base transaction verification failed.");
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
      // 1. Fetch Zora balances page-by-page with bounded, cursor-safe pagination.
      const zoraBalancesModule = await import("../services/portfolioService");
      const zoraBalances: Array<{
        balance?: string | number;
        coin?: {
          address?: string;
          name?: string;
          symbol?: string;
          mediaContent?: {
            previewImage?: { medium?: string; small?: string };
          };
          marketCap?: unknown;
          marketCapDelta24h?: unknown;
          volume24h?: unknown;
          totalVolume?: unknown;
          uniqueHolders?: unknown;
        };
      }> = [];
      const seenBalanceAddresses = new Set<string>();
      const seenCursors = new Set<string>();
      const pageSize = 100;
      const maxPages = 20;
      let cursor: string | undefined;

      for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
        const page = (await zoraBalancesModule.getUserBalances(
          address,
          pageSize,
          cursor
        )) as {
          balances?: typeof zoraBalances;
          hasMore?: boolean;
          nextCursor?: unknown;
        };

        for (const balance of page.balances ?? []) {
          const tokenAddress = balance.coin?.address?.toLowerCase();
          if (!tokenAddress || seenBalanceAddresses.has(tokenAddress)) continue;

          seenBalanceAddresses.add(tokenAddress);
          zoraBalances.push(balance);
        }

        if (!page.hasMore) break;
        if (pageNumber === maxPages - 1) {
          console.warn(
            `Stopped Zora portfolio pagination after ${maxPages} pages.`
          );
          break;
        }

        const nextCursor =
          typeof page.nextCursor === "string" && page.nextCursor.trim()
            ? page.nextCursor
            : undefined;
        if (
          !nextCursor ||
          nextCursor === cursor ||
          seenCursors.has(nextCursor)
        ) {
          console.warn("Stopped Zora portfolio pagination on an invalid cursor.");
          break;
        }

        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }

      if (zoraBalances.length === 0) {
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

      // 3. Filter Zora balances for tokens on our platform.
      type PlatformToken = NonNullable<typeof platformTokens>[number];
      const matchedBalances: Array<{
        tokenAddress: string;
        balance: number;
        platformToken: PlatformToken;
        zoraBalance: (typeof zoraBalances)[number];
      }> = [];

      for (const zoraBalance of zoraBalances) {
        const tokenAddress = zoraBalance.coin?.address?.toLowerCase();
        if (!tokenAddress) continue;

        // Only include tokens from our platform
        const platformToken = platformTokensMap.get(tokenAddress);
        if (!platformToken) continue;

        // Get on-chain balance
        const balance =
          Number.parseFloat(String(zoraBalance.balance ?? "0")) / 1e18;
        if (!Number.isFinite(balance) || balance <= 0) continue;

        matchedBalances.push({
          tokenAddress,
          balance,
          platformToken,
          zoraBalance,
        });
      }

      if (matchedBalances.length === 0) return [];

      // 4. Load all persisted cost-basis rows in one query instead of N .single() calls.
      const tokenAddresses = matchedBalances.map((item) => item.tokenAddress);
      const { data: portfolioRows, error: portfolioError } = await supabase
        .from("portfolio")
        .select(
          "token_address, average_buy_price_usd, total_invested_usd, realized_pnl_usd"
        )
        .eq("user_address", address)
        .in("token_address", tokenAddresses);

      if (portfolioError) {
        console.error("Error fetching portfolio cost basis:", portfolioError);
      }

      const portfolioRowsMap = new Map(
        (portfolioRows ?? []).map((row) => [
          row.token_address.toLowerCase(),
          row,
        ])
      );
      const toFiniteNumber = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return matchedBalances.map(
        ({ tokenAddress, balance, platformToken, zoraBalance }) => {
          const portfolioData = portfolioRowsMap.get(tokenAddress);

          return {
            token_address: tokenAddress,
            balance,
            average_buy_price_usd: toFiniteNumber(
              portfolioData?.average_buy_price_usd
            ),
            total_invested_usd: toFiniteNumber(
              portfolioData?.total_invested_usd
            ),
            realized_pnl_usd: toFiniteNumber(
              portfolioData?.realized_pnl_usd
            ),
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
          };
        }
      );
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
  static async getLeaderboard(
    type: "volume" | "created",
    limit: number = 10,
    options?: { throwOnError?: boolean }
  ) {
    try {
      let query = supabase
        .from("users")
        .select("address, username, avatar_url, coins_created, total_buy_volume");

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
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get leaderboard:", error);
      return [];
    }
  }

  /**
   * Get Top Buyers (by USD volume)
   */
  static async getTopBuyers(
    limit: number = 10,
    options?: { throwOnError?: boolean }
  ) {
    try {
      // OPTIMIZED: Use the pre-calculated total_buy_volume column from users table
      const { data, error } = await supabase
        .from("users")
        .select("address, username, avatar_url, total_buy_volume")
        .order("total_buy_volume", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Map to expected format
      return (data || []).map((user) => ({
        address: user.address,
        username: user.username,
        avatar_url: user.avatar_url,
        total_volume_usd: user.total_buy_volume,
      }));
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get top buyers:", error);
      return [];
    }
  }

  /**
   * Get Top Tokens (by Holders)
   */
  static async getTopTokens(
    limit: number = 10,
    options?: { throwOnError?: boolean }
  ) {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select("*")
        .order("holders", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get top tokens:", error);
      return [];
    }
  }

  /**
   * Get Most Watchlisted Tokens
   */
  static async getMostWatchlisted(
    limit: number = 10,
    offset: number = 0,
    options?: { throwOnError?: boolean }
  ): Promise<WatchlistedCoin[]> {
    try {
      const { data, error } = await supabase
        .from("drawcoins")
        .select(COIN_CARD_COLUMNS)
        .gt("watchlist_count", 0)
        .order("watchlist_count", { ascending: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data ?? []) as unknown as WatchlistedCoin[];
    } catch (error) {
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get most watchlisted tokens:", error);
      return [];
    }
  }

  /**
   * Get Top AI Art Tokens
   */
  static async getTopAI(
    limit: number = 10,
    options?: { throwOnError?: boolean }
  ) {
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
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get top AI tokens:", error);
      return [];
    }
  }

  /**
   * Get Top Hand-Drawn Tokens
   */
  static async getTopHandDrawn(
    limit: number = 10,
    options?: { throwOnError?: boolean }
  ) {
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
      if (options?.throwOnError) throw error;
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
    type?: "buy" | "sell" | "create",
    options?: { throwOnError?: boolean }
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
      if (options?.throwOnError) throw error;
      console.error("❌ Failed to get recent transactions:", error);
      return [];
    }
  }
}
