-- Migration: Create drawcoins table
-- Created: 2024-01-01
-- Description: Creates the main drawcoins table with all necessary fields and constraints

-- drawcoins tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.drawcoins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT NOT NULL,
    contract_address TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    category TEXT NOT NULL,
    creator_address TEXT NOT NULL,
    creator_name TEXT,
    tx_hash TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 8453,
    currency TEXT NOT NULL DEFAULT 'ZORA',
    platform_referrer TEXT,
    total_supply TEXT,
    current_price TEXT,
    volume_24h TEXT,
    holders INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index'ler oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_drawcoins_contract_address ON public.drawcoins(contract_address);
CREATE INDEX IF NOT EXISTS idx_drawcoins_creator_address ON public.drawcoins(creator_address);
CREATE INDEX IF NOT EXISTS idx_drawcoins_category ON public.drawcoins(category);
CREATE INDEX IF NOT EXISTS idx_drawcoins_created_at ON public.drawcoins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drawcoins_chain_id ON public.drawcoins(chain_id);

-- Full-text search için index
CREATE INDEX IF NOT EXISTS idx_drawcoins_search ON public.drawcoins USING gin(
    to_tsvector('english', name || ' ' || symbol || ' ' || description)
);

-- updated_at otomatik güncelleme için trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drawcoins_updated_at 
    BEFORE UPDATE ON public.drawcoins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) politikaları
ALTER TABLE public.drawcoins ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Anyone can read drawcoins" ON public.drawcoins
    FOR SELECT USING (true);

-- Herkes insert edebilir (token oluşturma için)
CREATE POLICY "Anyone can insert drawcoins" ON public.drawcoins
    FOR INSERT WITH CHECK (true);

-- Sadece coin creator'ı update edebilir
CREATE POLICY "Creator can update their drawcoins" ON public.drawcoins
    FOR UPDATE USING (auth.uid()::text = creator_address);

-- Sadece coin creator'ı delete edebilir
CREATE POLICY "Creator can delete their drawcoins" ON public.drawcoins
    FOR DELETE USING (auth.uid()::text = creator_address);
