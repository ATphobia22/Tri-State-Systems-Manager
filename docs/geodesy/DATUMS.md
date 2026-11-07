# Datums

Position is not elevation. Every TSM artifact that carries a height must
record all five: EPSG, horizontal datum, vertical datum, geoid model, and
units. A number without those five is not a height — it is a rumor.

## Horizontal

- **NAD83(2011), epoch 2010.0** is the project frame for survey-grade work.
- **EPSG:2966 (NAD83 / Indiana West)** is the projected CRS for Indiana
  West calculations. It uses **US survey feet** — Posey County eastings are
  on the order of 2.7 million ftUS, not hundreds of thousands.
- **WGS84 longitude/latitude** is for GeoJSON interchange (RFC 7946) only,
  never silently reinterpreted as projected coordinates.

## Vertical

- **NAVD88** is the orthometric height system. All regulatory elevations
  (FEMA BFEs, gage datums) are stated in NAVD88 unless explicitly labeled
  otherwise.
- **GEOID18** is the NGS hybrid geoid that turns NAD83(2011) ellipsoid
  heights into NAVD88 orthometric heights. It carries a known systematic
  error relative to a pure gravimetric geoid — roughly 0.5 m bias and 1 m
  coast-to-coast tilt; see `docs/geodesy/GEOID18-BIAS-VS-TILT.md`.
- **GEOID12B** is the earlier NGS hybrid model, and it is what the 2020
  Indiana elevation data actually carries (2020 DEM, 3DEP 1 m tiles, and
  the nDHM sample tile all record NAVD88/GEOID12B). Do not relabel
  GEOID12B heights as GEOID18.
- **NGVD29** is superseded. NGVD29↔NAVD88 has **no constant offset** — the
  shift varies by location from tenths of a foot to several feet. Use NGS
  VERTCON/NCAT at the location; never apply a single assumed shift.

## Units

- **ftUS (US survey foot)** is the unit. 1 ftUS = 1200/3937 m exactly.
- Bare `ft` is ambiguous (international foot vs US survey foot) and must
  not appear where the distinction matters. The code enforces this in
  `packages/geo/src/geodesy/UnitRegistry.ts` (`ftUS` is a distinct unit)
  and `UnitConversion.ts` (finite checks, `UNSUPPORTED_LINEAR_UNIT`).

## Stage is not elevation

Water surface elevation = stage + gage datum elevation, all in NAVD88.

- USGS 03378500 (Wabash River at New Harmony, IN) gage datum is
  **352.71 ft NAVD88** as implemented (`tsm-console/src/lib/gage-datums.ts`).
  A 352.67 ft candidate from USGS SIR 2016-5119 is an open, unclosed
  conflict — it is recorded in the code, not silently resolved.
- Regulatory BFE at FEMA FIS section A is **369.1 ft NAVD88**
  (FIS 18129CV000A Table 9). A stage value without a datum cannot be
  compared to a BFE, a survey elevation, a DEM elevation, or a model
  result.

## Where the vocabulary lives

- Code enum: `packages/geo/src/geodesy/VerticalDatum.ts`
  (NAVD88, NGVD29, ELLIPSOID, MLLW, MHW, GAGE_DATUM, UNKNOWN).
- Database reference table: `database/migrations/098_tsm_vertical_datums.sql`
  (`tsm.vertical_datums`; UNKNOWN is intentionally not seeded — it is a
  sentinel for missing data, not a datum).
- Validators: `packages/geo/src/geodesy/DatumValidator.ts`,
  `CrsValidator.ts`, `ElevationValidator.ts`.
- Stage conversion: `packages/geo/src/geodesy/GageStageConverter.ts`
  (station/datum matching, explicit unit conversion) and
  `backend/evidence/gage_datum.py` (NAVD88 enforcement, UNAVAILABLE
  pattern).
