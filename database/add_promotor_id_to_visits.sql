ALTER TABLE visits
ADD COLUMN IF NOT EXISTS promotor_id BIGINT REFERENCES promotors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS visits_promotor_id_idx ON visits (promotor_id);
