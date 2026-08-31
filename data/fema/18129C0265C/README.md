# FEMA FIRM Panel 18129C0265C

This directory registers the supplied FIRM panel image and the two supplied PGW world-file candidates as source artifacts.

## Source identity

- Panel: `18129C0265C`
- Community: Posey County, Indiana
- Product: Flood Insurance Rate Map (FIRM)
- Effective date visible on supplied panel: `2014-11-05`
- Source authority: FEMA Flood Map Service Center / National Flood Insurance Program
- Source artifact supplied in conversation: `18129C0265C.jpeg`

## Georeferencing status

The supplied panel image is named `18129C0265C`, but the supplied world files are named `18129C0300C.pgw` and `18129C0255C.pgw`. They are therefore retained as separate candidate source artifacts and **must not be attached to panel 18129C0265C without authoritative reconciliation**.

The application deliberately fails closed for this mismatch. It does not infer a world file from visual adjacency or filename similarity.

FEMA documents that downloaded FIRM panels may be accompanied by PGW/TFW world files and that the original effective panel and later changes should be distinguished. The authoritative FEMA Map Service Center remains the source for current product status.

## Evidence classification

- Supplied JPEG: `AUTHORITATIVE_SOURCE_ARTIFACT` pending source-provenance verification.
- Supplied PGWs: `CANDIDATE_SOURCE_ARTIFACT`, not georeferencing evidence for panel 18129C0265C.
- Any future georeferenced raster: `DERIVED`, with a transformation chain and parent evidence IDs.
- Any extracted flood-zone geometry: `DERIVED` unless directly ingested from an authoritative FEMA digital service and retained with its service metadata.

SHA-256 values are integrity checks only; they are not legal certification or proof of scientific validity.
