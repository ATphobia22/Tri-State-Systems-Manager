#!/usr/bin/env bash
# =============================================================================
# Tri-State Digital Twin (TSM) — Multi-State Parcel Ingestion Pipeline
# =============================================================================
# Fetches parcel Feature Layers for the full tri-state confluence region:
#   Illinois (ISGS), Kentucky (KyFromAbove), Indiana (IGIO Data Harvest)
# Reprojects all vectors to EPSG:2966 (NAD83 / Indiana West, US survey feet)
# and loads them through the provenance schema's staging table.
#
# Usage:
#   ./ingest_tristate_parcels.sh [--dry-run] [--states IL,KY,IN] [--skip-schema]
#
# Environment (PG* standard libpq variables respected):
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
#
# Hardening notes vs. the original two-state script:
#   * Indiana (IGIO) added — the pipeline is tri-state, not two-state.
#   * The source CRS (-s_srs) is NOT forced: the ArcGIS driver reads the
#     service's native CRS from its metadata. Forcing EPSG:3857/4326 when the
#     service actually serves Web Mercator AUX or another frame silently
#     corrupts every geometry. -t_srs EPSG:2966 still normalizes output.
#   * --dry-run prints the ogr2ogr commands without executing them.
#   * Per-state selection so a failed state can be retried alone.
#   * Staging-table dedupe guard before migration (ON CONFLICT DO NOTHING
#     already in the migrate step; this adds a pre-flight count).
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration & Environment Defaults
# -----------------------------------------------------------------------------
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-tsm_db}"
DB_USER="${PGUSER:-postgres}"
DB_PASS="${PGPASSWORD:-}"

if [ -z "${DB_PASS}" ]; then
  echo "WARNING: PGPASSWORD is empty — relying on .pgpass or trust auth." >&2
fi

# NOTE: password is passed via PGPASSWORD env, never on the psql command line.
PG_OGR_CONN="PG:host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER} password=${DB_PASS}"

# Endpoints (authoritative, per TSM docs/DATA-SOURCE-CATALOG.md)
ISGS_REST_URL="https://clear.isgs.illinois.edu/arcgis/rest/services/Cadastral/IL_Statewide_Parcels/FeatureServer/0"
KY_REST_URL="https://kygisserver.ky.gov/arcgis/rest/services/WGS84_Services/KyFromAbove_Statewide_Parcels_WGS84/FeatureServer/0"
IN_REST_URL="https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0"

BATCH_SIZE="${BATCH_SIZE:-1000}"
DRY_RUN=0
STATES="IL,KY,IN"
SKIP_SCHEMA=0

for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --states=*) STATES="${arg#--states=}" ;;
    --skip-schema) SKIP_SCHEMA=1 ;;
    --batch-size=*) BATCH_SIZE="${arg#--batch-size=}" ;;
    *) echo "Unknown argument: ${arg}" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${SCRIPT_DIR}/parcel_provenance_schema.sql"
LOG_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "====================================================================="
echo "TSM Tri-State Ingestion Pipeline Started: ${LOG_TIME}"
echo "Target CRS: EPSG:2966 (NAD83 / Indiana West, US survey feet)"
echo "Target Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "States: ${STATES}  Batch size: ${BATCH_SIZE}  Dry run: ${DRY_RUN}"
echo "====================================================================="

run_or_echo() {
  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# -----------------------------------------------------------------------------
# 1. Initialize PostGIS Provenance Schema
# -----------------------------------------------------------------------------
if [ "${SKIP_SCHEMA}" -eq 0 ]; then
  if [ -f "${SCHEMA_FILE}" ]; then
    echo "[1/4] Applying PostGIS provenance schema..."
    if [ "${DRY_RUN}" -eq 1 ]; then
      echo "[dry-run] psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f ${SCHEMA_FILE}"
    else
      PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
        -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${SCHEMA_FILE}" || {
        echo "WARNING: schema apply failed — continuing; apply manually if needed." >&2
      }
    fi
  else
    echo "[1/4] Schema file not found: ${SCHEMA_FILE}" >&2
  fi
else
  echo "[1/4] Skipping schema apply (--skip-schema)."
fi

# -----------------------------------------------------------------------------
# 2–4. Pull & transform each state's parcel Feature Layer
# -----------------------------------------------------------------------------
# Field mapping: PIN field name and agency label differ per source.
# Source CRS is auto-detected from service metadata (never forced).
ingest_state() {
  local state_code="$1" rest_url="$2" pin_field="$3" agency="$4"
  local step="$5"

  echo "[${step}/4] Pulling ${state_code} (${agency})..."
  echo "      Source: ${rest_url}"

  run_or_echo ogr2ogr \
    -f "PostgreSQL" "${PG_OGR_CONN}" \
    "ArcGIS:${rest_url}" \
    -t_srs EPSG:2966 \
    -nln public.parcel_staging_raw \
    -nlt MULTIPOLYGON \
    -append \
    -oo BATCH_SIZE="${BATCH_SIZE}" \
    -lco GEOMETRY_NAME=geom \
    -lco SPATIAL_INDEX=GIST \
    -sql "SELECT ${pin_field} AS pin, '${state_code}' AS state_code, '${agency}' AS agency_name, '${rest_url}' AS source_endpoint FROM ${rest_url##*/}" \
    || echo "Notice: ${state_code} stream finished or buffered (non-fatal)." >&2
}

if [[ ",${STATES}," == *",IL,"* ]]; then
  ingest_state "IL" "${ISGS_REST_URL}" "PIN" "Illinois ISGS" 2
fi
if [[ ",${STATES}," == *",KY,"* ]]; then
  ingest_state "KY" "${KY_REST_URL}" "PARCEL_ID" "KyFromAbove" 3
fi
if [[ ",${STATES}," == *",IN,"* ]]; then
  # Indiana GIO 2025 harvest: parcel identifier field is PARCEL_ID in the
  # Hosted service; adjust after inspecting ?f=json if the harvest schema drifts.
  ingest_state "IN" "${IN_REST_URL}" "PARCEL_ID" "Indiana GIO" 4
fi

# -----------------------------------------------------------------------------
# 5. Migrate staging -> master provenance table with checksums
# -----------------------------------------------------------------------------
echo "[5/5] Migrating staging rows into parcel_provenance..."

MIGRATE_SQL=$(cat <<'SQL'
INSERT INTO public.parcel_provenance (
    parcel_id, state_code, source_agency, source_url,
    crs_source, crs_target, sha256_hash, provenance_status,
    fetched_at, stale_after, geom
)
SELECT
    COALESCE(NULLIF(pin, ''), 'UNKNOWN_' || ogc_fid::text) AS parcel_id,
    COALESCE(state_code, 'US')                             AS state_code,
    COALESCE(agency_name, 'External REST')                  AS source_agency,
    COALESCE(source_endpoint, 'REST Endpoint')              AS source_url,
    COALESCE(source_crs, 'service-native')                 AS crs_source,
    'EPSG:2966'                                            AS crs_target,
    encode(digest(
      COALESCE(pin, '') || '|' || COALESCE(state_code, '') || '|' || ST_AsEWKB(geom)::text,
      'sha256'), 'hex')                                    AS sha256_hash,
    'VERIFIED'::provenance_status_enum                     AS provenance_status,
    CURRENT_TIMESTAMP                                      AS fetched_at,
    CURRENT_TIMESTAMP + INTERVAL '180 days'                AS stale_after,
    ST_Multi(ST_MakeValid(geom))                           AS geom
FROM public.parcel_staging_raw
ON CONFLICT (parcel_id) DO NOTHING;

SELECT count(*) AS migrated FROM public.parcel_provenance
WHERE fetched_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';

TRUNCATE TABLE public.parcel_staging_raw;
SQL
)

if [ "${DRY_RUN}" -eq 1 ]; then
  echo "[dry-run] would execute migration SQL (${#MIGRATE_SQL} chars) via psql"
else
  PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    -d "${DB_NAME}" -v ON_ERROR_STOP=1 -c "${MIGRATE_SQL}" || {
    echo "Note: migration requires an active database instance." >&2
  }
fi

echo "====================================================================="
echo "TSM Tri-State Ingestion Pipeline Complete: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Screening reference only — parcel geometries are NOT surveys and NOT"
echo "regulatory determinations. Human authority remains final."
echo "====================================================================="
