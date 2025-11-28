-- Migration: Optimize Analytics (Triggers & Schema)
-- Description: Adds total_buy_volume to users, and creates triggers for automatic stats and portfolio updates.

-- 1. Add total_buy_volume to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS total_buy_volume NUMERIC DEFAULT 0;

-- 2. Function to update User Stats (Buy Volume) on new transaction
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process 'buy' transactions
    IF NEW.type = 'buy' THEN
        UPDATE public.users
        SET total_buy_volume = COALESCE(total_buy_volume, 0) + COALESCE(NEW.amount_usd, 0),
            last_active = NOW()
        WHERE address = NEW.user_address;
        
        -- If user doesn't exist (shouldn't happen due to app logic, but safe to handle), insert them
        IF NOT FOUND THEN
            INSERT INTO public.users (address, total_buy_volume, last_active)
            VALUES (NEW.user_address, COALESCE(NEW.amount_usd, 0), NOW());
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for User Stats
DROP TRIGGER IF EXISTS trigger_update_user_stats ON public.transactions;
CREATE TRIGGER trigger_update_user_stats
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();


-- 3. Function to update Portfolio on new transaction
CREATE OR REPLACE FUNCTION update_portfolio_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_balance NUMERIC := 0;
    current_invested NUMERIC := 0;
    current_pnl NUMERIC := 0;
    current_avg_price NUMERIC := 0;
    
    new_balance NUMERIC := 0;
    new_invested NUMERIC := 0;
    new_pnl NUMERIC := 0;
    new_avg_price NUMERIC := 0;
    
    cost_basis NUMERIC := 0;
    
    existing_record RECORD;
BEGIN
    -- Get current portfolio state
    SELECT * INTO existing_record FROM public.portfolio 
    WHERE user_address = NEW.user_address AND token_address = NEW.token_address;
    
    IF FOUND THEN
        current_balance := COALESCE(existing_record.balance, 0);
        current_invested := COALESCE(existing_record.total_invested_usd, 0);
        current_pnl := COALESCE(existing_record.realized_pnl_usd, 0);
        current_avg_price := COALESCE(existing_record.average_buy_price_usd, 0);
    END IF;

    -- Calculate new values based on transaction type
    IF NEW.type = 'buy' THEN
        new_balance := current_balance + COALESCE(NEW.amount_token, 0);
        new_invested := current_invested + COALESCE(NEW.amount_usd, 0);
        new_pnl := current_pnl;
        
        IF new_balance > 0 THEN
            new_avg_price := new_invested / new_balance;
        ELSE
            new_avg_price := 0;
        END IF;
        
    ELSIF NEW.type = 'sell' THEN
        -- Cost basis for the sold amount
        cost_basis := COALESCE(NEW.amount_token, 0) * current_avg_price;
        
        new_balance := current_balance - COALESCE(NEW.amount_token, 0);
        new_invested := current_invested - cost_basis;
        new_pnl := current_pnl + (COALESCE(NEW.amount_usd, 0) - cost_basis);
        new_avg_price := current_avg_price; -- Avg price doesn't change on sell
        
        -- Handle full exit or negative dust
        IF new_balance <= 0 THEN
            new_balance := 0;
            new_invested := 0;
            new_avg_price := 0;
        END IF;
        
    ELSE
        -- For 'create' or other types, do nothing for now
        RETURN NEW;
    END IF;

    -- Upsert into portfolio
    INSERT INTO public.portfolio (
        user_address, 
        token_address, 
        balance, 
        average_buy_price_usd, 
        total_invested_usd, 
        realized_pnl_usd, 
        last_updated
    )
    VALUES (
        NEW.user_address, 
        NEW.token_address, 
        new_balance, 
        new_avg_price, 
        new_invested, 
        new_pnl, 
        NOW()
    )
    ON CONFLICT (user_address, token_address) 
    DO UPDATE SET
        balance = EXCLUDED.balance,
        average_buy_price_usd = EXCLUDED.average_buy_price_usd,
        total_invested_usd = EXCLUDED.total_invested_usd,
        realized_pnl_usd = EXCLUDED.realized_pnl_usd,
        last_updated = EXCLUDED.last_updated;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Portfolio
DROP TRIGGER IF EXISTS trigger_update_portfolio ON public.transactions;
CREATE TRIGGER trigger_update_portfolio
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_on_transaction();

-- 4. Backfill total_buy_volume for existing users (Optional but recommended)
-- This query aggregates existing buy transactions and updates the users table.
WITH user_volumes AS (
    SELECT user_address, SUM(amount_usd) as total_volume
    FROM public.transactions
    WHERE type = 'buy'
    GROUP BY user_address
)
UPDATE public.users
SET total_buy_volume = user_volumes.total_volume
FROM user_volumes
WHERE users.address = user_volumes.user_address;
