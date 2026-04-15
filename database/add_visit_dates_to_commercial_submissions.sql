ALTER TABLE commercial_submissions
ADD COLUMN IF NOT EXISTS visit_dates JSONB NOT NULL DEFAULT '[]'::jsonb;
