# Real-Time Gauge Data Dictionary

| Field | Meaning |
|---|---|
| station_id | Canonical provider station identifier |
| provider | Authoritative observation provider |
| observedAt | Source observation timestamp |
| retrievedAt | TSM retrieval timestamp |
| stageFt | Stage/gage-height observation |
| dischargeCfs | Discharge observation |
| status | LIVE, STALE or SOURCE_UNAVAILABLE |
| provisional | Source quality/provisional flag |
| sourceUri | Authoritative source reference |
| cacheAgeSeconds | Age of cached observation when surfaced as stale |

## Datum rule

Raw gage height remains in its source gage datum. TSM must not label it NAVD88 without a validated station/product-specific conversion relationship.

## Freshness rule

A current claim requires live retrieval. Cached observations are explicitly stale, and unavailable sources are represented as unavailable rather than synthesized.

## Provenance rule

Observation identity, source URI, timestamps, units, datum metadata and quality flags travel with the observation into downstream derived products.
