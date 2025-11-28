-- Convert text columns to numeric for proper sorting
ALTER TABLE public.drawcoins
ALTER COLUMN current_price TYPE numeric USING NULLIF(current_price, '')::numeric,
ALTER COLUMN volume_24h TYPE numeric USING NULLIF(volume_24h, '')::numeric,
ALTER COLUMN total_supply TYPE numeric USING NULLIF(total_supply, '')::numeric;

-- Add last_synced_at column to track freshness
ALTER TABLE public.drawcoins
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for sorting by price and volume
CREATE INDEX IF NOT EXISTS idx_drawcoins_current_price ON public.drawcoins (current_price DESC);
CREATE INDEX IF NOT EXISTS idx_drawcoins_volume_24h ON public.drawcoins (volume_24h DESC);
CREATE INDEX IF NOT EXISTS idx_drawcoins_last_synced_at ON public.drawcoins (last_synced_at);
