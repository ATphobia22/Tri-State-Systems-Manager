# TSM Evidence Hygiene — Powerpipe mod stub (ops-only, non-regulatory)
# Requires: powerpipe + SQL connection to evidence export (Postgres/DuckDB)
# Does NOT authorize floodway, FARA, or No-Rise determinations.

mod "tsm_evidence_hygiene" {
  title = "TSM Evidence Hygiene"
  description = "Dashboards/benchmarks for EvidenceArtifact completeness — not scientific truth."
}

# Example control shape (wire SQL when evidence store is Postgres-backed):
# control "artifacts_require_crs" {
#   title = "Artifacts declare horizontal CRS"
#   sql = <<-EOQ
#     select artifact_id as resource,
#       case when horizontal_crs is null then 'alarm' else 'ok' end as status,
#       horizontal_crs as reason
#     from evidence_artifacts
#   EOQ
# }
