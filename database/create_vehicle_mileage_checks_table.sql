CREATE TABLE IF NOT EXISTS vehicle_mileage_checks (
  id BIGSERIAL PRIMARY KEY,
  promotor_id BIGINT NOT NULL REFERENCES promotors(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  mileage INTEGER NOT NULL CHECK (mileage >= 0),
  image_data BYTEA NOT NULL,
  image_mime_type TEXT NOT NULL,
  image_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promotor_id, check_date)
);

CREATE INDEX IF NOT EXISTS vehicle_mileage_checks_promotor_date_idx
  ON vehicle_mileage_checks (promotor_id, check_date DESC);
