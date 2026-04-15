CREATE TABLE IF NOT EXISTS commercial_submissions (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  fantasy_name TEXT NOT NULL,
  cnpj VARCHAR(14),
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  total_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sales_quantity INTEGER NOT NULL DEFAULT 0,
  sold BOOLEAN NOT NULL DEFAULT FALSE,
  visit_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commercial_submissions_created_at_idx
  ON commercial_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_submissions_cnpj_idx
  ON commercial_submissions (cnpj);
