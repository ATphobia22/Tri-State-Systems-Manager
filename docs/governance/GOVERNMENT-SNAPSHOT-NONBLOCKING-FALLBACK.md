# Nonblocking government source fallback for the 3D digital twin

**Policy:** rendering never fails merely because current FEMA, USGS, NOAA, IGIO, or other government feeds are stale or unavailable. Attempt dated source snapshots first; when a current snapshot is absent or old, select the newest eligible reviewed historical archive. If none qualifies, continue 3D terrain, buildings, camera, and other available layers while displaying **NO_GOVERNMENT_SNAPSHOT**. This is not an authorization to synthesize elevations or classify obsolete data as effective regulatory records.

## Web runtime controls

- `VITE_TSM_GOVERNMENT_PMTILES_MANIFEST` and `VITE_TSM_GOVERNMENT_PMTILES_URL`: optional current PMTiles archive and provenance metadata.
- `VITE_TSM_GOVERNMENT_PMTILES_FALLBACKS`: JSON array, maximum 20 entries, each with `manifestUrl`, `archiveUrl`, `agency`, `capturedAt` and `sourceRecordUrl`. Dates require timezone-qualified ISO 8601; candidates are sorted newest to oldest.
- `VITE_TSM_GOVERNMENT_TRUSTED_MERKLE_ROOTS`: comma-separated SHA-256 Merkle roots pinned in the reviewed build configuration. **Do not populate this from a downloaded source manifest**: a source must not authorize its own hash.

Example catalog (illustrative placeholders only; not a data connection):

```json
[
  {
    "manifestUrl": "https://your-approved-host.example/releases/2024/pmtiles-manifest.json",
    "archiveUrl": "https://your-approved-host.example/releases/2024/buildings.pmtiles",
    "agency": "INDIANA GIO",
    "capturedAt": "2024-04-01T00:00:00Z",
    "sourceRecordUrl": "https://gisdata.in.gov/"
  }
]
```

For historical fallback, the manifest must include the existing `GovernmentTileManifest` fields `datasetId`, `sourceSha256`, `tilesSha256`, `layer`, `classification`, `validation`, `attribution` and `horizontalCrs`, plus:

```json
{
  "sourceVersion": "exact-official-release-id",
  "capturedAt": "2024-04-01T00:00:00Z",
  "merkleRootSha256": "64-lowercase-hex-build-pinned-root",
  "releaseVerification": {
    "status": "PASS",
    "archiveSha256": "same-sha256-as-tilesSha256",
    "sourceSha256": "same-sha256-as-sourceSha256",
    "merkleRootSha256": "same-build-pinned-root",
    "verifiedAt": "2026-11-09T00:00:00Z"
  }
}
```

The release receipt must result from actual SHA-256 verification of the PMTiles archive and source evidence by the **offline staging/release pipeline**. The runtime checks consistency, date, issuer label and build-pinned Merkle root, then probes archive availability. The HTTP byte-range probe **does not hash the whole PMTiles archive**; the UI must not claim runtime byte verification. The resulting Merkle pin protects against arbitrary replacement of the receipt, but public archive distribution and root signing remain distinct provenance controls.

Rendering validation permits an integrity-verified historical archive labeled `BUILT_NOT_FIELD_VERIFIED`; that does **not** establish survey accuracy or design validity. The HUD displays capture timestamp, agency, source URL, version and Merkle root, or shows that no government archive is usable. Current FEMA effective mapping, geodesy, water levels, site-specific engineering, and licensing/agency decisions retain separate evidence requirements and are never silently inferred from stale presentation layers.

## Integration and acceptance

- Selector: `tsm-console/src/lib/government-pmtiles-overlay.ts`
- Pure rejection tests: `tsm-console/tests/government-snapshot-policy.test.mjs`
- Scene HUD: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Dedicated CI: `.github/workflows/government-snapshot-resilience.yml`

**Outstanding:** configure an actual independently verified government PMTiles snapshot and reviewed Merkle root; separately test a disconnected packaged native runtime with that archive. These are not implied by passing contract tests.
