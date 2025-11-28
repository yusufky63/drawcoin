-- Add watchlist_count column to drawcoins table
ALTER TABLE drawcoins 
ADD COLUMN IF NOT EXISTS watchlist_count INTEGER DEFAULT 0;

-- Create index for sorting by watchlist count
CREATE INDEX IF NOT EXISTS idx_drawcoins_watchlist_count ON drawcoins(watchlist_count DESC);

-- Function to increment watchlist count
CREATE OR REPLACE FUNCTION increment_watchlist_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE drawcoins
  SET watchlist_count = watchlist_count + 1
  WHERE contract_address = NEW.token_address;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement watchlist count
CREATE OR REPLACE FUNCTION decrement_watchlist_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE drawcoins
  SET watchlist_count = watchlist_count - 1
  WHERE contract_address = OLD.token_address;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for INSERT (Increment)
DROP TRIGGER IF EXISTS trigger_increment_watchlist_count ON watchlists;
CREATE TRIGGER trigger_increment_watchlist_count
AFTER INSERT ON watchlists
FOR EACH ROW
EXECUTE FUNCTION increment_watchlist_count();

-- Trigger for DELETE (Decrement)
DROP TRIGGER IF EXISTS trigger_decrement_watchlist_count ON watchlists;
CREATE TRIGGER trigger_decrement_watchlist_count
AFTER DELETE ON watchlists
FOR EACH ROW
EXECUTE FUNCTION decrement_watchlist_count();

-- Optional: Recalculate existing counts (run once)
-- UPDATE drawcoins d
-- SET watchlist_count = (
--   SELECT COUNT(*) 
--   FROM watchlists w 
--   WHERE w.token_address = d.contract_address
-- );
