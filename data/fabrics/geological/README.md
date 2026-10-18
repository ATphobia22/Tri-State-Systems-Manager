# Geological Fabric

The geological data fabric for the Tri-State Systems Manager (TSM) — the Ohio–Wabash
tri-state region (Indiana, Illinois, Kentucky). It catalogs bedrock geology, surficial
(glacial) geology, drift thickness, soils (SSURGO), and subsurface/borehole schemas
with full provenance.

## Contents

- `geological-fabric-manifest-v1.json` — canonical source registry for all geological
  data sources relevant to the tri-state region. Each entry carries authority,
  access URL, access method, coverage, vintage, CRS, license, and verification status.
- `README.md` — this file.

## Provenance doctrine

Following TSM authority-class rules: **STATE-BEST** ≠ **OBSERVED** ≠ **DERIVED**.
Published state-survey map products are STATE-BEST (authoritative for their scale
and vintage, never site-verified). The repo's subsurface PostGIS schema
(`db/migrations/V35__subsurface_layers.sql`) holds the canonical structure for
site-specific borehole data — currently EMPTY: no site borehole logs exist in
the repo (see `tsm-console/src/lib/local-ai/skills/geology.json` "not_built").

Missing sources stay UNAVAILABLE; never invent stratigraphy, soil properties,
or borehole logs.

## Verified sources (repo-grounded)

| Source | Status | Key layers |
|---|---|---|
| Illinois State Geological Survey (ISGS), Prairie Research Institute | **Verified** 2026-09-26 (HTTP 200 on service root) | Bedrock_Geology_500K_2005, Drift_Thickness, NRCS_SSURGO_Soils_Dataset |

Registry entry: `data/registries/tri-state-rest-endpoints-v1.json` (ID `IL-ISGS-ARCGIS`).
Target CRS for ISGS services: **EPSG:3435** (NAD83 / Illinois East, ftUS). Services
also publish Web Mercator. Note: an earlier strategy doc cited EPSG:3405 for
Illinois East — that is VN-2000/UTM 48N (Vietnam); the correct code is EPSG:3435.

## Researched sources (not live-verified in this session)

| Source | Coverage | Key products |
|---|---|---|
| Indiana Geological and Water Survey (IGWS), Indiana University | Indiana statewide | Seamless 1:250,000 / 1:500,000 geologic maps; 1:100,000 bedrock maps south of the 40th parallel; GeMS-compliant quadrangle GIS data; IGWS Digital Collections |
| Kentucky Geological Survey (KGS), University of Kentucky | Kentucky statewide | 1:500,000 geologic map (derived from 1988 Geologic Map of Kentucky); 707 digitized USGS 7.5-minute geologic quadrangles (DVGQ, 1996–2006); Land-Use Planning service (geology + NRCS SSURGO) |
| USGS National Geologic Map Database (NGMDB) | National | National-scale geologic map index and GeMS data |
| NRCS Web Soil Survey / Soil Data Access | National | SSURGO county soil surveys (sand/silt/clay, soil depth) — referenced as TODO in `scripts/flood-forecasting/prepare-static-attributes.py`; not yet assembled |

## Tri-state geological context (published, general)

The tri-state anchor region (Posey County, IN and surroundings) sits on the
Illinois Basin: Pennsylvanian-age bedrock (shale, sandstone, limestone, coal)
buried under thick Quaternary glacial deposits (till, outwash, alluvium) —
except in far southwestern Indiana / western Kentucky where bedrock approaches
the surface. This is general published context, NOT a site determination.

## Downstream consumers

- `scripts/flood-forecasting/prepare-static-attributes.py` — TODO: SSURGO
  sand/silt/clay for OpenHydroNet basin static attributes.
- `db/migrations/V35__subsurface_layers.sql` — `subsurface_boreholes` and
  `borehole_strata_layers` tables (EPSG:2966 / NAVD88, metric).
- `tsm-console/src/lib/local-ai/skills/geology.json` — AI advisor skill with
  repo-grounded geological facts.

## License notes

- Illinois ISGS data: public state-agency products (check service terms).
- Indiana IGWS: digital assets downloadable for personal, noncommercial use;
  contact igsacm@iu.edu for commercial use.
- Kentucky KGS: public research products of the University of Kentucky.
- USGS NGMDB: public domain (U.S. federal).
- NRCS SSURGO: public domain (U.S. federal).
