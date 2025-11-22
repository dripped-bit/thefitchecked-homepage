-- Create waitlist_signups table for marketing website
-- Stores email signups with confirmation tracking

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'homepage', -- homepage, blog, pricing, etc.
  
  -- Confirmation tracking
  confirmed BOOLEAN DEFAULT false,
  confirmation_token TEXT,
  confirmed_at TIMESTAMPTZ,
  
  -- Metadata
  signup_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Analytics
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Status
  unsubscribed BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_confirmed ON waitlist_signups(confirmed);
CREATE INDEX IF NOT EXISTS idx_waitlist_signup_date ON waitlist_signups(signup_date DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_confirmation_token ON waitlist_signups(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Row Level Security
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for public waitlist form)
CREATE POLICY "Anyone can sign up for waitlist" ON waitlist_signups
  FOR INSERT
  WITH CHECK (true);

-- Only service role can read (for admin dashboard)
CREATE POLICY "Service role can read all signups" ON waitlist_signups
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Service role can update (for confirmations)
CREATE POLICY "Service role can update signups" ON waitlist_signups
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE waitlist_signups IS 'Marketing website waitlist signups with email confirmation';
COMMENT ON COLUMN waitlist_signups.email IS 'User email address (unique, lowercase)';
COMMENT ON COLUMN waitlist_signups.name IS 'Optional user name from signup form';
COMMENT ON COLUMN waitlist_signups.source IS 'Page where user signed up (homepage, blog, pricing, etc.)';
COMMENT ON COLUMN waitlist_signups.confirmed IS 'Whether email has been confirmed';
COMMENT ON COLUMN waitlist_signups.confirmation_token IS 'One-time token for email confirmation';
COMMENT ON COLUMN waitlist_signups.confirmed_at IS 'Timestamp when email was confirmed';
