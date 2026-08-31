# FIRM 18129C0265C Evidence Linkage

## Supported by the supplied panel

- Identification of the FEMA FIRM panel as `18129C0265C`.
- The panel's printed community/map identity and effective date visible on the supplied source image.
- Preservation of the source image as an evidence artifact.
- A basis for later reconciliation against FEMA's current NFHL/FIRM digital data.

## Not established by the supplied image alone

- Current regulatory flood-zone status at a specific parcel.
- Current BFE at a specific site.
- Indiana construction/floodplain permit eligibility.
- FEMA insurance eligibility or premium determination.
- Engineering certification.
- Grant eligibility.
- Hydraulic model calibration.
- A georeferenced local raster derived from either mismatched PGW candidate supplied with the image.

## Grant/hazard workflow rule

Grant and hazard-mitigation records may reference the panel evidence by immutable evidence ID. They must not copy an unsupported flood-zone, BFE, regulatory, cost-benefit, or eligibility conclusion into an authoritative field.

Any consequential conclusion requires the applicable current authority layer, documented rule version, transformation chain, uncertainty, and human review.

## Current source state

The local evidence manifest intentionally reports `FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE`. The supplied `18129C0300C.pgw` and `18129C0255C.pgw` are retained as separate candidate artifacts and are rejected for automatic association with panel `18129C0265C` because their declared panel IDs differ.

FEMA's Map Service Center is the authoritative public source for official flood maps and FIRM products. The NFHL is the digital geospatial flood-hazard database; it incorporates FIRM databases and subsequent LOMRs and is updated as FEMA data changes.
