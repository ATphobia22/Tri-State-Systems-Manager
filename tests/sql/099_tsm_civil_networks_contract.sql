-- Synthetic PostGIS contract tests. Run only in a disposable CI database.
-- No real electric feeders, pipes, asset positions or CEII are stored here.
BEGIN;
DO $$
DECLARE
  target regclass;
BEGIN
  target := to_regclass('tsm.utility_network_assets');
  IF target IS NULL THEN RAISE EXCEPTION 'MUDDI-aligned utility table not installed'; END IF;
  IF to_regclass('tsm.utility_network_nodes') IS NULL THEN
    RAISE EXCEPTION 'network connectivity nodes not installed';
  END IF;
  IF to_regclass('tsm_restricted.power_cim_assets') IS NULL THEN
    RAISE EXCEPTION 'CEII-restricted CIM table not installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = target AND relrowsecurity AND relforcerowsecurity
  ) THEN RAISE EXCEPTION 'utility geometry RLS must be enabled and forced'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid='tsm_restricted.power_cim_assets'::regclass
    AND relrowsecurity AND relforcerowsecurity
  ) THEN RAISE EXCEPTION 'CIM topology RLS must be enabled and forced'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.usage_privileges
             WHERE object_name='tsm_restricted' AND object_type='SCHEMA'
             AND grantee='PUBLIC' AND privilege_type='USAGE') THEN
    RAISE EXCEPTION 'CEII schema must not grant public usage';
  END IF;
END$$;

-- QL-D historical linework cannot be elevated into a fabricated 3D depth.
DO $$
BEGIN
  BEGIN
    INSERT INTO tsm.utility_network_assets(
      asset_id, network_kind, jurisdiction, quality_level,
      geometry_xy, geometry_xyz, source_sha256
    ) VALUES (
      '00000000-0000-4000-8000-000000000001', 'water', 'IN', 'QL-D',
      ST_SetSRID(ST_MakeLine(ST_Point(500000,4200000),ST_Point(500010,4200000)),26916),
      ST_SetSRID(ST_MakeLine(ST_MakePoint(500000,4200000,100),ST_MakePoint(500010,4200000,100)),26916),
      repeat('a',64)
    );
    RAISE EXCEPTION 'QL-D 3D pipe was improperly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO tsm.utility_network_assets(
      asset_id, network_kind, jurisdiction, quality_level,
      geometry_xy, geometry_xyz, source_sha256,
      depth_status
    ) VALUES (
      '00000000-0000-4000-8000-000000000002', 'stormwater', 'IN', 'QL-B',
      ST_SetSRID(ST_MakeLine(ST_Point(500000,4200000),ST_Point(500010,4200000)),26916),
      ST_SetSRID(ST_MakeLine(ST_MakePoint(500000,4200000,100),ST_MakePoint(500010,4200000,100)),26916),
      repeat('b',64), 'INDEPENDENTLY_VERIFIED'
    );
    RAISE EXCEPTION 'missing independent 3D depth receipt was improperly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO tsm.utility_network_assets(
    asset_id, network_kind, jurisdiction, quality_level, geometry_xy, source_sha256
  ) VALUES (
    '00000000-0000-4000-8000-000000000003', 'water', 'KY', 'QL-D',
    ST_SetSRID(ST_MakeLine(ST_Point(500000,4200000),ST_Point(500010,4200000)),26916),
    repeat('c',64)
  );
  IF (SELECT geometry_xyz IS NOT NULL FROM tsm.utility_network_assets
      WHERE asset_id='00000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'QL-D record incorrectly acquired a 3D geometry';
  END IF;
END $$;
ROLLBACK;
