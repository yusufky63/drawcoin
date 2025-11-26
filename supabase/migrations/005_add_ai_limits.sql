-- Add daily_ai_usage and last_reset_date to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_ai_usage INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
