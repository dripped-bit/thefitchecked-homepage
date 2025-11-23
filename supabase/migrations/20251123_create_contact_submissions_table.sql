-- Create contact_submissions table for contact form
-- Stores all contact form submissions with email routing and status tracking

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  
  -- Message details
  subject_type TEXT NOT NULL, -- dropdown value (general, support, press, etc.)
  subject_display TEXT NOT NULL, -- dropdown label for display
  message TEXT NOT NULL,
  
  -- Routing
  routed_to TEXT NOT NULL, -- which team email it was sent to
  
  -- Status tracking
  status TEXT DEFAULT 'new', -- new, in-progress, resolved
  responded_at TIMESTAMPTZ,
  
  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  -- Email tracking
  auto_response_sent BOOLEAN DEFAULT false,
  team_email_sent BOOLEAN DEFAULT false,
  
  -- Validation
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submitted ON contact_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_routed ON contact_submissions(routed_to);
CREATE INDEX IF NOT EXISTS idx_contact_type ON contact_submissions(subject_type);

-- Row Level Security
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit (public contact form)
CREATE POLICY "Anyone can submit contact form" ON contact_submissions
  FOR INSERT
  WITH CHECK (true);

-- Only service role can read (for admin dashboard)
CREATE POLICY "Service role can read all submissions" ON contact_submissions
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Service role can update status
CREATE POLICY "Service role can update submissions" ON contact_submissions
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE contact_submissions IS 'Contact form submissions with smart email routing';
COMMENT ON COLUMN contact_submissions.subject_type IS 'Dropdown value: general, support, feedback, partnership, press, careers, other';
COMMENT ON COLUMN contact_submissions.routed_to IS 'Team email address where inquiry was routed';
COMMENT ON COLUMN contact_submissions.status IS 'Status: new, in-progress, resolved';
