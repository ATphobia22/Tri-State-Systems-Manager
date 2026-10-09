BEGIN;
CREATE TABLE IF NOT EXISTS tsm.fema_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL,
  effective_date date,
  source_evidence_id uuid REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  footprint_uri text,
  vertical_datum text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fema_products_code_date_idx ON tsm.fema_products(product_code, effective_date DESC);
INSERT INTO tsm.schema_migrations(version) VALUES ('094_tsm_fema') ON CONFLICT DO NOTHING;
COMMIT;
