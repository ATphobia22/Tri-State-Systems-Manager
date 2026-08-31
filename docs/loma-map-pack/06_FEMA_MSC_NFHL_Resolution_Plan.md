# FEMA FIRM / NFHL Resolution Plan — 18129C0265C

## Purpose

Resolve the georeferencing gap for supplied FEMA FIRM panel **18129C0265C** without fabricating a spatial reference from an adjacent panel's world file.

## Current evidence

- Supplied map image: `18129C0265C.jpeg`.
- Supplied PGW candidates: `18129C0300C.pgw` and `18129C0255C.pgw`.
- Both PGW filenames identify panels different from `18129C0265C`.
- The application therefore rejects both candidates for automatic association with `18129C0265C`.

## Resolution hierarchy

1. Query the FEMA Map Service Center for the official product associated with panel `18129C0265C`.
2. Prefer an authoritative FEMA digital flood-hazard dataset/NFHL representation for machine-readable regulatory geometry where available.
3. If FEMA provides a matching `18129C0265C` world file for the scanned panel, register it as a source artifact and validate its panel association before georeferencing.
4. If a matching world file is unavailable but authoritative FEMA digital geometry exists, use that geometry as the regulatory GIS source and retain the scanned panel separately as document evidence.
5. If neither is available, retain the scanned panel as source-only evidence and do not publish a georeferenced derivative.

## Non-negotiable controls

- Never infer a world file from an adjacent panel.
- Never copy a BFE, flood zone, or regulatory boundary from a visually adjacent panel into this panel's authoritative record.
- Never treat SHA-256 integrity verification as proof of regulatory validity.
- Record FEMA product identifiers, effective/revised date, source URL, acquisition timestamp, content hash, CRS, vertical reference, and transformation chain for every accepted derivative.
- Current FEMA/NFHL data must be checked before using the historical panel for a current regulatory conclusion.

## Official source

FEMA identifies the **Flood Map Service Center (MSC)** as the official online source for NFIP flood-hazard information. FEMA also identifies the **National Flood Hazard Layer (NFHL)** as the integrated digital flood-hazard dataset containing effective digital flood-hazard information from FIRM databases and applicable map changes.

MSC: https://msc.fema.gov/portal/advanceSearch#searchresultsanchor

## System status

`18129C0265C` remains `SOURCE_ONLY / FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE` until authoritative reconciliation is completed. This is intentional: the system is correcting the data provenance problem rather than hiding it.
