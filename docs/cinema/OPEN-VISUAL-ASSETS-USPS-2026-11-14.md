# Tri-State 4D Twin — Open Visual Assets and Postal Identity Contracts

**Reviewed:** 2026-11-14. **Status:** Implementable adapter plus tests; no assertion that all regional terrain, all Posey building meshes or a UE5.8 Shipping binary exist.

All ingestion, validation, conversion, packaging and CI stages run headlessly; only scene rendering and placement review require graphics.

## Verified upstream source licensing

| Provider | Verified source | Rights and restrictions |
|---|---|---|
| Quixel Megascans / Fab | https://quixel.com/news/update-megascans-are-going-free-again | Full library free announced Nov 5, 2026. The Fab Standard License permits incorporated project distribution but prohibits standalone free or paid redistribution. https://www.fab.com/eula |
| Poly Haven | https://polyhaven.com/license | CC0 HDRIs, textures and models. Public API at https://polyhaven.com/our-api requires unique User-Agent and visible Poly Haven credit if the live API is used. |
| ambientCG | https://docs.ambientcg.com/license/ | CC0 assets; use documented current v3 API https://docs.ambientcg.com/api/v3/assets/ |
| BlenderKit free tier | https://www.blenderkit.com/ | Per-item licensing and export rights must be reviewed. No bulk source mirroring authorized by this registry. |

The Quixel announcement is **not** a blanket right to mirror all source files in GitHub. Fab asset product listings and the binding EULA govern distribution. Custom studio licenses may differ.

## Headless registry and binary intake

The reviewed source catalog is located at:

    data/cinematic/cc0-visual-asset-source-registry.json

It inventories one independently MD5-pinned, provider-documented Poly Haven HDRI at 1K; an ambientCG metadata-only candidate; and blocked Fab/BlenderKit review queues. The HDRI is **generic artistic lighting, not an actual Indiana, Illinois or Kentucky observation**. Never substitute this cinematic asset for verified local imagery or a river-level record.

Offline inspect (no network):

    python scripts/cinema/curate_visual_assets.py --asset polyhaven-sunset-jhbcentral-hdri-1k
    python scripts/cinema/curate_visual_assets.py --asset fab-megascans-curated-import
    python -m unittest discover -s scripts/cinema -p test_curate_visual_assets.py -v

Explicit reviewed CC0 download into private staging:

    mkdir -p artifacts/cc0
    python scripts/cinema/curate_visual_assets.py --asset polyhaven-sunset-jhbcentral-hdri-1k --stage-dir artifacts/cc0/polyhaven-sunset --download

The intake script requires an independently published file digest; computes SHA-256; enforces HTTPS host allowlists, byte caps, safe paths and atomic output; and writes an acquisition-receipt.json. The receipt makes no claim of engine import success, geographic alignment, engineering authority or regulatory certification.

The GitHub Actions workflow Cinematic CC0 Intake and USPS License Gates can optionally acquire precisely this reviewed sample with workflow_dispatch and download_cc0_sample=true. Its seven-day artifact is intentionally not checked into Git. On failed live download, the workflow must fail rather than fabricate evidence.

Existing lossless chunk packaging (scripts/release/chunk_offline_assets.py) may be used for approved assets, but **only after verifying source and license provenance**. Fab raw files must not enter public downloadable art packs or open source repositories. A license-reviewed packaged project is distinct from a freely distributable source asset archive.

## Suggested cinematic set roles

1. Riverbanks: stone, wet earth, driftwood, ground cover and depth-safe foliage.
2. Agricultural areas: soil, crops, fence hardware, barn finishes.
3. Urban streets: road textures, curbs, weathering and pavement.
4. Historic areas: age-appropriate stone, timber and roof details.
5. Industrial sites: metal, concrete and utility-equipment finishes.
6. Film lighting: HDRI, ACES finishing, scene atmosphere and appropriate reflections.

These are artistic roles, not confirmed source-true asset placements. Keep parcel/building geometry, USGS elevation, FEMA panels and observed river levels separate from artistic assets. Require headed validation of occlusion, float artifacts, asset orientation, LOD, and frame budget before shipping.

## USPS Addresses 3.x: optional, server-only and disabled by default

Official APIs: https://developers.usps.com/addressesv3
Access licensing updates: https://www.usps.com/business/api-access.htm

Module path:

    scripts/address/usps_address_adapter.py

Required environment variables, supplied only to an authorized headless backend:

    TSM_USPS_ADDRESSES_ENABLED=1
    TSM_USPS_LICENSE_APPROVED=1
    TSM_USPS_CLIENT_ID=(runtime secret)
    TSM_USPS_CLIENT_SECRET=(runtime secret)

Do not set the approved flag until the applicable USPS Addresses license, account terms and permitted retention/redistribution have been confirmed. The adapter performs one USPS OAuth client-credentials request and one on-demand address standardization lookup. It returns only normalized postal fields; never logs or includes recipient/occupancy, delivery point, carrier route, bearer token or secret information; and does not persist data or credentials.

Every standardized result is explicitly POSTAL_STANDARDIZED_UNLINKED. It is not a coordinate, parcel join, LOMA determination, engineering calculation or validated flood level. A separate authoritative IN/IL/KY address-point/parcel reconciliation must prove the location, CRS, spatial join and source identifiers. A USPS postal match alone must not create a surveyed map pin.

For production activation, additionally implement operator-only request controls, per-account quota throttling, PII-free audit counters, privacy retention policy and credential rotation. Public anonymous and offline viewers must remain independent of USPS and any cloud account.

## Independent release checks

| Gate | Required evidence |
|---|---|
| Python source contracts | py_compile, unit tests with mocked network, JSON registry parse |
| Visual file integrity | Independent source digest, SHA-256 receipt and bounded file sizes |
| Fab / BlenderKit | Per-item license and project distribution review |
| Geospatial source | Actual CRS/vertical datum, authoritative geometry and time coverage |
| Building inventory | Verified Posey County completeness and height-linked geometry |
| Scene runtime | Headed Cesium and UE screenshots showing correctly aligned real assets |
| Shipping | Actual Win11 UE5.8 Shipping package with air-gapped startup |
| USPS activation | Approved account license, security controls and allowed data-use scope |

Do not claim full citywide production readiness until the independent artifact and runtime gates pass.
