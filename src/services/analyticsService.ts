import { supabase } from '../lib/supabase';

export interface TransactionData {
  tx_hash: string;
  user_address: string;
  token_address: string;
  type: 'buy' | 'sell' | 'create';
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
  static async recordTransaction(data: TransactionData) {
    try {
      console.log('[AnalyticsService] Recording transaction:', data);
      
      // Check if platform_stats exists before proceeding
      const { data: platformStats, error: statsCheckError } = await supabase
        .from('platform_stats')
        .select('*')
        .eq('id', 1)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows
      
      if (statsCheckError) {
        console.error('[AnalyticsService] Platform stats check error:', statsCheckError);
      } else if (!platformStats) {
        console.warn('[AnalyticsService] Platform stats row does not exist - trigger should handle this');
      } else {
        console.log('[AnalyticsService] Platform stats exists:', platformStats);
      }
      
      // 1. Ensure user exists in users table (create if not exists)
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          address: data.user_address,
          last_active: new Date().toISOString()
        }, { 
          onConflict: 'address',
          ignoreDuplicates: false 
        });

      if (userError) {
        console.error('[AnalyticsService] User upsert error:', userError);
      } else {
        console.log('[AnalyticsService] User upserted successfully');
      }

      // 2. Insert Transaction
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
      
      console.log('[AnalyticsService] Inserting transaction:', transactionData);
      
      const { error: txError } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (txError) {
        console.error('[AnalyticsService] Transaction insert error:', txError);
        throw txError;
      } else {
        console.log('[AnalyticsService] Transaction inserted successfully');
        
        // Check platform_stats after transaction insert to see if trigger worked
        const { data: updatedStats, error: checkError } = await supabase
          .from('platform_stats')
          .select('*')
          .eq('id', 1)
          .maybeSingle(); // Use maybeSingle() to handle potential 0 rows
        
        if (checkError) {
          console.error('[AnalyticsService] Failed to check updated platform stats:', checkError);
        } else if (!updatedStats) {
          console.warn('[AnalyticsService] Platform stats still does not exist after transaction - trigger may not be working');
        } else {
          console.log('[AnalyticsService] Platform stats after transaction:', updatedStats);
        }
      }

      // 3. Update Portfolio (if buy/sell)
      if (data.type === 'buy' || data.type === 'sell') {
        await this.updatePortfolio(data);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to record transaction:', error);
      return false;
    }
  }

  /**
   * Update user portfolio based on transaction
   */
  private static async updatePortfolio(data: TransactionData) {
    try {
      // Get current portfolio item
      const { data: currentItem } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_address', data.user_address)
        .eq('token_address', data.token_address)
        .single();

      let newBalance = currentItem?.balance || 0;
      let newTotalInvested = currentItem?.total_invested_usd || 0;
      let newRealizedPnl = currentItem?.realized_pnl_usd || 0;
      let newAvgPrice = currentItem?.average_buy_price_usd || 0;

      const amountToken = Number(data.amount_token || 0);
      const amountUsd = Number(data.amount_usd || 0);

      if (data.type === 'buy') {
        // Buying: Increase balance and total invested
        newBalance += amountToken;
        newTotalInvested += amountUsd;
        // Recalculate average buy price
        if (newBalance > 0) {
          newAvgPrice = newTotalInvested / newBalance;
        }
      } else if (data.type === 'sell') {
        // Selling: Decrease balance
        // Calculate PnL: (Sell Price - Avg Buy Price) * Amount Sold
        const costBasis = amountToken * newAvgPrice;
        const pnl = amountUsd - costBasis;
        
        newRealizedPnl += pnl;
        newBalance -= amountToken;
        newTotalInvested -= costBasis; // Reduce invested amount by the cost of tokens sold
        
        if (newBalance <= 0) {
            newBalance = 0;
            newTotalInvested = 0;
            newAvgPrice = 0;
        }
      }

      // Upsert portfolio item
      const { error } = await supabase
        .from('portfolio')
        .upsert({
          user_address: data.user_address,
          token_address: data.token_address,
          balance: newBalance,
          average_buy_price_usd: newAvgPrice,
          total_invested_usd: newTotalInvested,
          realized_pnl_usd: newRealizedPnl,
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_address, token_address' });

      if (error) throw error;

    } catch (error) {
      console.error('❌ Failed to update portfolio:', error);
    }
  }

  /**
   * Get User Stats
   */
  static async getUserStats(address: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('address', address)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('❌ Failed to get user stats:', error);
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
      const zoraBalancesModule = await import('../services/portfolioService');
      const { balances: zoraBalances } = await zoraBalancesModule.getUserBalances(address, 100);
      
      if (!zoraBalances || zoraBalances.length === 0) {
        return [];
      }

      // 2. Get all token addresses from our platform (drawcoins)
      const { data: platformTokens, error: tokensError } = await supabase
        .from('drawcoins')
        .select('contract_address, name, symbol, image_url, creator_address');

      if (tokensError) {
        console.error('Error fetching platform tokens:', tokensError);
        return [];
      }

      // Create a map for quick lookup
      const platformTokensMap = new Map(
        (platformTokens || []).map(token => [
          token.contract_address.toLowerCase(),
          token
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
        const balance = parseFloat(zoraBalance.balance || '0') / 1e18;
        if (balance <= 0) continue;

        // Try to get transaction history for this token to calculate avg price
        const { data: userTransactions } = await supabase
          .from('transactions')
          .select('type, amount_token, amount_usd')
          .eq('user_address', address)
          .eq('token_address', tokenAddress)
          .in('type', ['buy', 'sell']);

        // Calculate metrics from transactions
        let totalBought = 0;
        let totalInvested = 0;
        let realizedPnl = 0;

        if (userTransactions && userTransactions.length > 0) {
          for (const tx of userTransactions) {
            if (tx.type === 'buy') {
              totalBought += parseFloat(tx.amount_token || '0');
              totalInvested += parseFloat(tx.amount_usd || '0');
            } else if (tx.type === 'sell') {
              const soldAmount = parseFloat(tx.amount_token || '0');
              const soldUsd = parseFloat(tx.amount_usd || '0');
              const avgBuyPrice = totalBought > 0 ? totalInvested / totalBought : 0;
              const costBasis = soldAmount * avgBuyPrice;
              realizedPnl += (soldUsd - costBasis);
            }
          }
        }

        const avgPrice = totalBought > 0 ? totalInvested / totalBought : 0;

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
            image_url: zoraBalance.coin?.mediaContent?.previewImage?.medium || 
                      zoraBalance.coin?.mediaContent?.previewImage?.small || 
                      platformToken.image_url,
            // Include full Zora coin data for additional information
            zora_data: zoraBalance.coin,
            // Map market data fields for UI consistency
            marketCap: zoraBalance.coin?.marketCap,
            change24h: zoraBalance.coin?.marketCapDelta24h,
            volume24h: zoraBalance.coin?.volume24h || zoraBalance.coin?.totalVolume,
            holders: zoraBalance.coin?.uniqueHolders
          }
        });
      }

      return portfolioItems;
    } catch (error) {
      console.error('❌ Failed to get portfolio:', error);
      return [];
    }
  }

  /**
   * Get Global Platform Stats
   */
  static async getGlobalStats() {
    try {
      const { data, error } = await supabase
        .from('platform_stats')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) return { 
        total_volume_usd: 0, 
        total_trades: 0, 
        total_coins_created: 0,
        total_users: 0,
        total_unique_traders: 0,
        total_volume_24h: 0,
        top_coin_address: null
      };
      return data;
    } catch (error) {
      console.error('❌ Failed to get global stats:', error);
      return { 
        total_volume_usd: 0, 
        total_trades: 0, 
        total_coins_created: 0,
        total_users: 0,
        total_unique_traders: 0,
        total_volume_24h: 0,
        top_coin_address: null
      };
    }
  }
  
  /**
   * Get Leaderboard
   */
  static async getLeaderboard(type: 'volume' | 'created', limit: number = 10) {
      try {
          let query = supabase.from('users').select('*');
          
          if (type === 'volume') {
              query = query.order('total_volume_usd', { ascending: false });
          } else {
              query = query.order('coins_created', { ascending: false });
          }
          
          const { data, error } = await query.limit(limit);
          
          if (error) throw error;
          return data || [];
      } catch (error) {
          console.error('❌ Failed to get leaderboard:', error);
          return [];
      }
  }
  
  /**
   * Get User Transaction History
   */
  static async getTransactionHistory(address: string, limit: number = 50) {
   try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          token_details:drawcoins!transactions_token_address_fkey(*)
        `)
        .eq('user_address', address)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Failed to get transaction history:', error);
      return [];
    }
  }
  
  /**
   * Get Recent Platform Transactions (for global stats page)
   */
  static async getRecentTransactions(limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          token_details:drawcoins!transactions_token_address_fkey(*),
          user:users!transactions_user_address_fkey(username, avatar_url)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Failed to get recent transactions:', error);
      return [];
    }
  }
}
