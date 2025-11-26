-- Add creation_type column to drawcoins table
-- This tracks whether a coin was created using AI or hand-drawn method

ALTER TABLE drawcoins 
ADD COLUMN creation_type TEXT DEFAULT 'hand-drawn' CHECK (creation_type IN ('ai', 'hand-drawn'));

-- Add comment for documentation
COMMENT ON COLUMN drawcoins.creation_type IS 'Method used to create the coin artwork: ai or hand-drawn';

-- Update existing coins to 'hand-drawn' as default
UPDATE drawcoins 
SET creation_type = 'hand-drawn' 
WHERE creation_type IS NULL;

-- Create index for filtering
CREATE INDEX idx_drawcoins_creation_type ON drawcoins(creation_type);
