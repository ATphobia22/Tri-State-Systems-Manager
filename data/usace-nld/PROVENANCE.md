# Provenance — `leveed-areas-wabash-v1.geojson`

Leveed-area polygons for the Wabash River levee systems near the Tri-State
anchor site (13101 Bonebank Road, Point Township, Posey County, IN).

## Source

| Field | Value |
|---|---|
| Source | USACE National Levee Database API v2 (`https://levees.sec.usace.army.mil/api`) |
| Endpoint | `GET /leveed-areas-{systemId}.geojson` |
| Retrieved | 2026-10-06 |
| Authority | USACE (U.S. Army Corps of Engineers), National Levee Database |
| Data class | **evidence** — descriptive inventory geometry; NOT a regulatory flood-determination. Flood-risk determinations remain FEMA NFHL's role. |
| CRS | NAD83 (horizontal), per NLD documentation |
| Vertical datum | NAVD88, per NLD documentation |
| Stored file | `data/usace-nld/leveed-areas-wabash-v1.geojson` |
| SHA-256 | `695bb9bda179f75cb15dc7261e4cd966fc7668beb581ea0e365e7592e41a519d` |
| Size | 97,484 bytes; 1 FeatureCollection feature (MultiPolygon) |

## Systems covered

The stored file contains the leveed-area polygon for system **270005000005**
(Wabash Levee Unit 1 — property `leveedId: 270006000009`, `fcSystemId:
270005000005`). System **270005000006** (Wabash Levee Unit 2) is NOT present
in this v1 file; use `tools/acquisition/usace/fetch-leveed-areas.mjs --ids
270005000005,270005000006` to acquire or re-verify both.

## Reproducibility

Re-run the acquisition script from the repo root:

```
node tools/acquisition/usace/fetch-leveed-areas.mjs \
  --ids 270005000005,270005000006 \
  --out data/usace-nld/leveed-areas-wabash-v1.geojson
```

The script validates the response (FeatureCollection with a non-empty
`features` array), writes a `.sha256` sidecar, and emits a JSON validation
receipt. It fails closed on non-2xx HTTP, invalid JSON, or empty features.

## Authority-class note

Per TSM authority-class standards: USACE NLD is an authoritative source for
levee-system inventory geometry. Keep the NLD update/assessment metadata with
any derivative; never silently promote this evidence geometry into a
regulatory flood determination.
