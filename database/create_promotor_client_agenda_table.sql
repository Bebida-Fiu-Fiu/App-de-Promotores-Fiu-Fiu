CREATE TABLE IF NOT EXISTS promotor_client_agenda (
  id BIGSERIAL PRIMARY KEY,
  promotor_id BIGINT NOT NULL REFERENCES promotors(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nickname TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promotor_client_agenda_promotor_idx
  ON promotor_client_agenda (promotor_id, created_at);
