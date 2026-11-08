-- Residual checkpoints + uncertainty surfaces (DERIVED only).
-- NEVER map these columns into certified LAG / LOMA elevation fields.

CREATE TABLE IF NOT EXISTS elevation_residual_checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT,
  epsg INTEGER NOT NULL CHECK (epsg > 0),
  x_m DOUBLE PRECISION NOT NULL,
  y_m DOUBLE PRECISION NOT NULL,
  z_dem_m DOUBLE PRECISION,
  z_survey_m DOUBLE PRECISION,
  residual_m DOUBLE PRECISION GENERATED ALWAYS AS (
    CASE
      WHEN z_dem_m IS NULL OR z_survey_m IS NULL THEN NULL
      ELSE z_dem_m - z_survey_m
    END
  ) STORED,
  survey_authority TEXT,
  dem_source TEXT,
  observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authority_class TEXT NOT NULL DEFAULT 'DERIVED'
    CHECK (authority_class = 'DERIVED')
);

CREATE INDEX IF NOT EXISTS elevation_residual_checkpoints_site_idx
  ON elevation_residual_checkpoints (site_id);

CREATE TABLE IF NOT EXISTS elevation_uncertainty_surfaces (
  surface_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT,
  method TEXT NOT NULL CHECK (method IN ('empirical_semivariogram', 'spherical_fit', 'exponential_fit', 'nssda_global')),
  nugget DOUBLE PRECISION,
  sill DOUBLE PRECISION,
  range_m DOUBLE PRECISION,
  rmse_fit DOUBLE PRECISION,
  nssda_accuracy_z_m DOUBLE PRECISION,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authority_class TEXT NOT NULL DEFAULT 'DERIVED'
    CHECK (authority_class = 'DERIVED'),
  notes TEXT DEFAULT 'DERIVED uncertainty only; forbidden as certified LAG/FFE/LOMA elev'
);

COMMENT ON TABLE elevation_residual_checkpoints IS
  'DEM-minus-survey residuals for geostatistics. DERIVED. Do not copy into certified_lag.';
COMMENT ON TABLE elevation_uncertainty_surfaces IS
  'Semivariogram / NSSDA reporting artifacts. Zero LOMA certification authority.';
