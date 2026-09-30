# Regulatory references

Authoritative-source references vendored for offline work. Nothing here is
evidence — these document the vintage and rules of the flood data TSM
consumes (three-separate-truths doctrine: authoritative, computational,
visual).

## Contents

| File | Description | Source | SHA-256 |
|---|---|---|---|
| `nfhl-indiana-20260706-metadata.xml` | FEMA FGDC metadata for the Indiana statewide NFHL dataset (FIPS 18), publication date 2026-07-06, edition Version 1.1.1.0. Documents the vintage of the NFHL TSM layers consume. Note: bounding box and some dates in the file are FEMA template boilerplate; the `pubdate`/`caldate` (20260706) and `edition` are the operative vintage fields. | FEMA Flood Map Service Center (msc.fema.gov) | `aa7baee3…e2fe7ce` |
| `tsm-floodway-rules-v1.json` | Machine-readable floodway rules (FEMA no-rise, Indiana 0.14 ft cumulative criterion) | TSM-authored from statute/regulation | — |

## Why the NFHL vintage matters

The NFHL is updated monthly and folds in Letters of Map Revision (LOMRs),
so panel identifiers drift over time. The anchor's case paperwork references
FIRM panel **18129C0265C** while the live NFHL serves **18129C0300C** — panel
drift is expected, not an error. Record the dataset vintage whenever flood
determinations are compared across sources.
