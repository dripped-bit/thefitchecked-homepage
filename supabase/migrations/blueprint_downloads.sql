-- Blueprint Downloads Table Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/kxmtbetklikewluwntyx/sql

-- Create blueprint_downloads table for lead magnet signups with referral tracking
CREATE TABLE IF NOT EXISTS public.blueprint_downloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
    referred_by TEXT,
    referral_count INTEGER DEFAULT 0,
    unlocked_full_guide BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint after table exists (allows self-referencing)
ALTER TABLE public.blueprint_downloads
ADD CONSTRAINT fk_referred_by
FOREIGN KEY (referred_by)
REFERENCES public.blueprint_downloads(referral_code)
ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_blueprint_downloads_referral_code ON public.blueprint_downloads(referral_code);
CREATE INDEX IF NOT EXISTS idx_blueprint_downloads_referred_by ON public.blueprint_downloads(referred_by);
CREATE INDEX IF NOT EXISTS idx_blueprint_downloads_email ON public.blueprint_downloads(email);

-- Enable Row Level Security
ALTER TABLE public.blueprint_downloads ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (needed for the frontend to work)
CREATE POLICY "Allow public inserts" ON public.blueprint_downloads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public reads" ON public.blueprint_downloads
    FOR SELECT USING (true);

CREATE POLICY "Allow public updates" ON public.blueprint_downloads
    FOR UPDATE USING (true);

-- Create function to update referral count when someone signs up with a referral code
CREATE OR REPLACE FUNCTION update_referrer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referred_by IS NOT NULL THEN
        UPDATE public.blueprint_downloads
        SET referral_count = referral_count + 1,
            unlocked_full_guide = CASE WHEN referral_count + 1 >= 3 THEN TRUE ELSE FALSE END,
            updated_at = NOW()
        WHERE referral_code = NEW.referred_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function after insert
DROP TRIGGER IF EXISTS on_blueprint_signup ON public.blueprint_downloads;
CREATE TRIGGER on_blueprint_signup
    AFTER INSERT ON public.blueprint_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_referrer_count();

-- Add comment for documentation
COMMENT ON TABLE public.blueprint_downloads IS 'Stores blueprint lead magnet signups with referral tracking';
