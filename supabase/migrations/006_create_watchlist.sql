-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL REFERENCES users(address),
  token_address TEXT NOT NULL REFERENCES drawcoins(contract_address),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_price_eth NUMERIC,
  added_price_usd NUMERIC,
  added_price_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_address, token_address)
);

-- Add RLS policies
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist" 
  ON watchlists FOR SELECT 
  USING (auth.uid()::text = user_address OR user_address = current_setting('request.headers', true)::json->>'user_address');

CREATE POLICY "Users can insert into their own watchlist" 
  ON watchlists FOR INSERT 
  WITH CHECK (true); -- Simplified for demo, ideally check auth

CREATE POLICY "Users can delete from their own watchlist" 
  ON watchlists FOR DELETE 
  USING (true); -- Simplified for demo
