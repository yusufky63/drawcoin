import { supabase, type Coin } from '../lib/supabase'

// Re-export the Coin type for use in other components
export type { Coin }

export interface CreateCoinData {
  name: string
  symbol: string
  description: string
  contract_address: string
  image_url: string
  category: string
  creator_address: string
  creator_name?: string
  tx_hash: string
  chain_id?: number
  currency?: string
  platform_referrer?: string
}

export class CoinService {
  /**
   * Save a newly created coin to the database
   */
  static async saveCoin(coinData: CreateCoinData): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from('drawcoins')
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
          currency: coinData.currency || 'ETH',
          platform_referrer: coinData.platform_referrer,
          holders: 1, // Creator is the first holder
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving coin:', error)
        throw error
      }

      console.log('✅ Coin saved to database:', data)
      return data
    } catch (error) {
      console.error('❌ Failed to save coin:', error)
      return null
    }
  }

  /**
   * Get all coins with optional filters
   */
  static async getCoins(params?: {
    category?: string
    creator_address?: string
    limit?: number
    offset?: number
    search?: string
  }): Promise<Coin[]> {
    try {
      let query = supabase
        .from('drawcoins')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (params?.category) {
        query = query.eq('category', params.category)
      }

      if (params?.creator_address) {
        query = query.eq('creator_address', params.creator_address)
      }

      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,symbol.ilike.%${params.search}%,description.ilike.%${params.search}%`)
      }

      if (params?.limit) {
        query = query.limit(params.limit)
      }

      if (params?.offset) {
        query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching coins:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch coins:', error)
      return []
    }
  }

  /**
   * Get a single coin by contract address
   */
  static async getCoinByAddress(contractAddress: string): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from('drawcoins')
        .select('*')
        .eq('contract_address', contractAddress)
        .single()

      if (error) {
        console.error('Error fetching coin:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('❌ Failed to fetch coin:', error)
      return null
    }
  }

  /**
   * Get only coin addresses (and created_at) for lightweight pagination
   */
  static async getCoinAddresses(params?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<Array<{ contract_address: string; created_at: string }>> {
    try {
      let query = supabase
        .from('drawcoins')
        .select('contract_address,created_at')
        .order('created_at', { ascending: false })

      if (params?.search) {
        // Search cannot be applied to address-only selection reliably; keep simple contains on contract
        query = query.or(`contract_address.ilike.%${params.search}%`)
      }

      if (params?.limit) {
        query = query.limit(params.limit)
      }

      if (params?.offset) {
        query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1)
      }

      const { data, error } = await query
      if (error) {
        console.error('Error fetching coin addresses:', error)
        return []
      }
      return (data || []) as Array<{ contract_address: string; created_at: string }>
    } catch (err) {
      console.error('❌ Failed to fetch coin addresses:', err)
      return []
    }
  }

  /**
   * Update coin information (price, holders, etc.)
   */
  static async updateCoin(contractAddress: string, updates: Partial<Coin>): Promise<Coin | null> {
    try {
      const { data, error } = await supabase
        .from('drawcoins')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('contract_address', contractAddress)
        .select()
        .single()

      if (error) {
        console.error('Error updating coin:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('❌ Failed to update coin:', error)
      return null
    }
  }

  /**
   * Get coins by category
   */
  static async getCoinsByCategory(category: string): Promise<Coin[]> {
    return this.getCoins({ category })
  }

  /**
   * Get coins by creator
   */
  static async getCoinsByCreator(creatorAddress: string): Promise<Coin[]> {
    return this.getCoins({ creator_address: creatorAddress })
  }

  /**
   * Get latest coins (default 20 per page)
   */
  static async getLatestCoins(limit: number = 20): Promise<Coin[]> {
    return this.getCoins({ limit })
  }

  /**
   * Search coins
   */
  static async searchCoins(searchTerm: string): Promise<Coin[]> {
    return this.getCoins({ search: searchTerm })
  }

  /**
   * Check if a coin already exists
   */
  static async coinExists(contractAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('drawcoins')
        .select('id')
        .eq('contract_address', contractAddress)
        .single()

      return !!data && !error
    } catch (error) {
      return false
    }
  }

  /**
   * Get total count of coins for pagination
   */
  static async getTotalCoinsCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('drawcoins')
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error('Error getting total coins count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('❌ Failed to get total coins count:', error)
      return 0
    }
  }

  /**
   * Get coin statistics
   */
  static async getCoinStats(): Promise<{
    totalCoins: number
    totalCreators: number
    categoryCounts: Record<string, number>
  }> {
    try {
      // Total coins
      const { count: totalCoins } = await supabase
        .from('drawcoins')
        .select('*', { count: 'exact', head: true })

      // Unique creators
      const { data: creatorsData } = await supabase
        .from('drawcoins')
        .select('creator_address')

      const uniqueCreators = new Set(creatorsData?.map(c => c.creator_address) || [])

      // Category counts
      const { data: categoryData } = await supabase
        .from('drawcoins')
        .select('category')

      const categoryCounts = categoryData?.reduce((acc, coin) => {
        acc[coin.category] = (acc[coin.category] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return {
        totalCoins: totalCoins || 0,
        totalCreators: uniqueCreators.size,
        categoryCounts,
      }
    } catch (error) {
      console.error('❌ Failed to fetch coin stats:', error)
      return {
        totalCoins: 0,
        totalCreators: 0,
        categoryCounts: {},
      }
    }
  }
} 
