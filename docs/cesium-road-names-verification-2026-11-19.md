# Cesium twin — road-name labels: verification note (2026-11-19)

Status: implemented in a local worktree only. NOT pushed, merged, published, or deployed.
Live visual check was impossible on the build machine (no WebGL) — the labels
have not been seen rendering in Cesium.

## What was built

- Build script `scripts/geospatial/build_cesium_regional_scene.py` gains
  `build_road_names()`: reads the same 9 TIGER/Line 2024 roads zips as
  `build_roads()` and writes `data/cesium-regional/road-names.json` (GeoJSON
  points, 2.87 MB). One label per (county, FULLNAME) midpoint cluster
  (greedy, 0.05 deg ≈ 5 km radius, seed = longest segment); tier `major`
  iff the seed segment is MTFCC S1100/S1200, else `local`. Unnamed
  centerlines never produce a label; no name is invented. Stable ids
  `TIGER2024:roadname:{county}:{index:05d}`; metadata records authority,
  CRS, counts, method, and per-zip SHA-256s. `main()` now calls it.
- `verify_cesium_regional_scene.py` gains road-names cross-checks: label
  count, authority, tier totals, unique ids, point geometry, non-empty
  names, tiers in {major, local}, every major (name, county) pair in
  roads.json has ≥1 label, every label (name, county) exists in the named
  roads set.
- Viewer `tsm-console/src/lib/cesium-regional-scene.ts`: new SceneLayer
  `'roadNames'`; a separate `roadLabels` LabelCollection (the replay
  `labels` collection's `setTime()` `removeAll()` never touches it);
  `loadRoadNames()` fetches `road-names.json` and validates it with the
  new pure `parseRoadNames()` in `tsm-console/src/lib/cesium-road-names.ts`
  (count, geometry, name, tier, finite coords). Tiered fading: major
  labels stay readable to ~60–90 km, local labels only under ~6–9 km.
  Toggle via `setLayer('roadNames', show)`; loaded eagerly, on by default.
- View `tsm-console/src/routes/CesiumRegionalTwinView.tsx`: layer entry
  "Road names (TIGER/Line 2024)", initial on; footer note that names are
  TIGER/Line 2024 FULLNAME values and unnamed centerlines stay unlabeled.
- Tests: 4 new Python unit tests in `scripts/geospatial/test_cesium_regional_scene.py`
  (clustering, major tier, unnamed never labeled, stable ids); 6 new vitest
  tests in `tsm-console/tests/cesium-road-names.test.ts`.
- User decision applied 2026-11-19: `ROAD_NAME_DISPLAY_OVERRIDES` in the
  build script renames three Posey labels at generation time ('Co Rd 400 E'
  → 'Lamont Road', 'Co Rd 500 E' → 'Pumpkin Run Road', 'W 2nd St' →
  'Pearl Street'); each overridden label keeps its TIGER name in
  `tiger_name`, the metadata records the overrides with their basis, the
  verify script translates display names back to TIGER names for its
  subset checks and asserts the three display names present, the three
  TIGER names absent, and the four split-conflict roads still on TIGER.
  The viewer footer now states the three exceptions. Python tests cover
  the three overrides and the four kept-TIGER roads.

Verified counts, BFE 369.1 ft, and all existing layers untouched. roads.json
output is unchanged (29,461 features).

## Inventory (TIGER/Line 2024, 9 counties)

| County | Total | Named | Unnamed |
|---|---|---|---|
| Gallatin IL 17059 | 1,172 | 750 | 422 |
| Wabash IL 17185 | 3,632 | 787 | 2,845 |
| White IL 17193 | 5,672 | 1,505 | 4,167 |
| Gibson IN 18051 | 4,278 | 1,930 | 2,348 |
| Posey IN 18129 | 3,024 | 1,545 | 1,479 |
| Vanderburgh IN 18163 | 4,634 | 4,308 | 326 |
| Warrick IN 18173 | 2,861 | 2,681 | 180 |
| Henderson KY 21101 | 2,793 | 1,654 | 1,139 |
| Union KY 21225 | 1,395 | 1,106 | 289 |
| **Total** | **29,461** | **16,266 (55.2%)** | **13,195 (44.8%)** |

Unique names 9,581; (name, county) pairs 11,264; major (S1100/S1200)
pairs 420. Labels generated: **12,751** (460 major, 12,291 local) —
more labels than pairs because long roads repeat along their length.
Longest single segments: 'US Hwy 60' 0.4247 deg (Henderson),
'State Rte 14' 0.378 deg (White), 'US Hwy 60 E' 0.3768 deg (Union),
'I- 64' 0.3611 deg (Warrick), 'I- 69' 0.2541 deg (Gibson).
Top names by segment count: 'Main St' 45, '2nd St' 33, 'Oak St' 31,
'County Line Rd' 31, 'Co Rd 1200 E' 30. 'Bonebank Rd': 1 pair, Posey.

## Verification (72-road sample, 2026-11-19)

Baseline: TIGER/Line 2024 FULLNAME. Independent sources:
- OpenStreetMap main API map endpoint (bbox ±0.008 deg around the TIGER
  midpoint; nearest highway way by segment distance; name/ref/highway
  recorded). Overpass (overpass-api.de) returned HTTP 406 and
  overpass.kumi.systems was unreachable — OSM main API used instead.
- IndianaMap `Road_Centerlines_of_Indiana_Current` (Hosted service,
  nearest feature within 50 m; Indiana counties only).

After normalizing abbreviations (St→Street, Rd→Road, E→East, Co→County,
"State Rd"/"State Highway"→"State Route", "I- 64"→"I-64"): **27 MATCH,
28 MISMATCH, 17 OSM-UNNAMED.**

- **Wording variants, same road (4):** 'State Rd 66/68/69' (Posey) and
  'State Rd 68' (Warrick) vs OSM 'State Highway 66/68/69' — "Road" vs
  "Highway" wording only.
- **Dual naming — both names true (11):** route number vs local street
  name on the same road. 'E Church St' carries SR 66; 'State Rd 269' IS
  'County Road 325 North' (TIGER lists both names on different segments);
  'Co Rd 925 N' carries SR 65; 'State Rd 65' = 'Evansville Street';
  'New Harmony Byp' carries SR 69; 'State Rd 66' (Vanderburgh) =
  'West Diamond Avenue'; 'State Rd 161' = 'Lincoln Trail Road';
  'State Rte 14' = 'East Main Street' (Carmi); 'State Hwy 136' =
  'Alzey-Mt Vernon Road'; 'Co Rd 200 N' (Gallatin) = '23000N', ref IL 141;
  'Co Rd 1200 E' = 'South Posey County Line Road'; 'W Lloyd Expy' =
  'South Posey County Line Road' at the county line. Display keeps the
  TIGER name; the local name is the same road, not a conflict.
- **OSM-UNNAMED (17):** 13 are route-confirmed by OSM `ref` (SR 69, SR 165,
  SR 62, US 41, I 69, I 64, IL 1, US 60, KY 56) — OSM carries the route
  ref but no `name` tag, so the road is identified, just not named in OSM.
  Remaining 4: 'Co Rd 950 N' (IndianaMap: 'Stewartsville Road'),
  'Jackson Rd' (IndianaMap confirms 'Jackson Road'), 'US Hwy 45' and
  'Co Rd 11' (nearest OSM way was a residential street — method noise, see below).

### Genuine name conflicts — decided by the user 2026-11-19

Decision: use the agreed name where OSM + IndianaMap both agree against
TIGER; keep TIGER everywhere else. Applied in
`ROAD_NAME_DISPLAY_OVERRIDES` in `build_cesium_regional_scene.py` at
label-generation time, so `road-names.json` carries the display names and
each overridden label keeps its TIGER FULLNAME in `tiger_name`. The TIGER
source data and `roads.json` (29,461 features) are untouched.

Decided — display the agreed name:
1. **'Co Rd 400 E' (Posey) → 'Lamont Road'** — OSM + IndianaMap agree against TIGER.
2. **'Co Rd 500 E' (Posey) → 'Pumpkin Run Road'** — OSM + IndianaMap agree against TIGER.
3. **'W 2nd St' (Posey) → 'Pearl Street'** — OSM + IndianaMap agree against TIGER.

Kept on TIGER per the same decision (split sources):
4. 'Blaylock Rd' (Posey) vs 'Overton Road' — OSM only; IndianaMap agrees with TIGER ('Blaylock Road').
5. 'Gum St' (Posey) vs 'Locust Street' — OSM only; IndianaMap agrees with TIGER ('Gum Street').
6. 'Big Barn Rd' (Gallatin IL) vs 'Round Pond Road' — OSM only, no Indiana source (Illinois).
7. 'Co Rd 10' (White IL) vs 'County Road 2000 North' — OSM only, no Indiana source (Illinois).

Uncertain, NOT counted as conflicts: 'Greeley St' vs 'Greely St' is a
TIGER-internal spelling split for one street (IndianaMap: 'Greeley
Street'; both OSM midpoints fell on adjacent Church St); 'I- 64'
(Posey) vs OSM 'Ramsey Road' (nearest-way picked a residential street —
the motorway way is ref-only); 'St Francis St' vs OSM 'East 2nd Avenue'
(midpoint likely at the intersection; IndianaMap agrees with TIGER);
'State Rd 168' vs IndianaMap 'North HILLCREST Street' (IndianaMap
nearest-feature noise — OSM agrees with TIGER); 'John James Audubon
State Park' vs OSM '…State Park Road' (trivial suffix).

### TIGER quirks recorded, not silently fixed

- Interstates carry a space after the hyphen in FULLNAME: 'I- 64', 'I- 69'
  (displayed verbatim; OSM writes 'I-64').
- State Road 65 in Gibson appears as '65 N', 'Rd 65 N', 'Hwy 65',
  'Hwy 65 N' on different segments.
- 'Hwy 41 N' (Vanderburgh) vs 'US Hwy 41' vs 'S US Hwy 41' variants.
- 'Greeley St' AND 'Greely St' both exist in Posey (see conflict list).

### Method limits (honest)

- Nearest-way-to-midpoint can pick a crossing or adjacent street when the
  target way is unnamed (ref-only) or the midpoint sits at an intersection.
  Cases where OSM names a residential/service way while IndianaMap agrees
  with TIGER were treated as uncertain, not as conflicts.
- IndianaMap's nearest-feature query (50 m) can return a cross street;
  its composed names for state routes are often just the number
  ('65', '69 North'), which confirms the route, not the street name.
- Sample is 72 roads weighted to majors and longest segments; it is not a
  full 29,461-road audit. A complete audit would need the same check run
  over all 11,264 (name, county) pairs.

## Checks run (exact commands, 2026-11-19)

- `~/workspace/tsm-venv/bin/python -m unittest test_cesium_regional_scene`
  (scripts/geospatial): **10/10 OK** (6 pre-existing + 4 new road-name tests).
- `tsm-console: ./node_modules/.bin/tsc --noEmit -p tsconfig.json`: **exit 0**.
- `tsm-console: ./node_modules/.bin/vitest run tests/cesium-road-names.test.ts tests/cesium-osm-building-style.test.ts`: **11/11 passed**.
- `tsm-console: ./node_modules/.bin/vite build`: **built in 7.48 s** (chunk-size
  warning on the Cesium view is pre-existing).
- Full `vitest run` (252 files): 725/726 tests pass. The 153 `.mjs` file
  "failures" are vitest being the wrong runner for the repo's node:test
  files (repo runs them with `node --test`). The 1 failed test is
  `src/lib/tiles-3d-renderer-layer.runtime.test.ts` ("degrades textures…",
  expected 45640 got 46088) — **proven pre-existing**: it fails identically
  on pristine edfb0987 with this work stashed. Untouched by this change.
- Generated `roads.json` (29,461) + `road-names.json` (12,751) with the
  real build functions into /tmp and ran the verify-script predicates
  against them: **all pass** (counts, tiers, unique ids, major coverage,
  label ⊆ named-roads). The full `verify_cesium_regional_scene.py` was
  not run end-to-end because it requires the whole generated scene
  (terrain DEMs, buildings archive) that the full build regenerates.

### Re-verification after the 2026-11-19 override decision

- Python unittest: **12/12 OK** (10 previous + 2 new override tests).
- Regenerated `roads.json` + `road-names.json` with the real build
  functions into /tmp and ran the verify-script road-name predicates
  (including the new override checks) against them: **all pass**.
  Label count unchanged at 12,751; exactly three overridden roads —
  'Co Rd 400 E' → 'Lamont Road' (2 labels), 'Co Rd 500 E' →
  'Pumpkin Run Road' (2 labels), 'W 2nd St' → 'Pearl Street' (2 labels),
  all Posey 18129, each label carrying its TIGER name in `tiger_name`;
  the four split-conflict roads keep their TIGER names; `roads.json`
  still 29,461 features with TIGER names untouched; metadata `overrides`
  lists exactly the three decided overrides.
- `tsc --noEmit`: **exit 0**. Vitest on the two touched files:
  **11/11 passed**. `vite build`: **built in 7.64 s** (same pre-existing
  chunk-size warning). The full `verify_cesium_regional_scene.py` was
  again not run end-to-end (whole-scene requirement, as above); its new
  override assertions were exercised by the replicated predicates and
  the script compiles clean (`py_compile` OK).

## What remains before going live

1. Still open (not part of the 2026-11-19 decision): the 'I- 64' spacing /
   Greeley-vs-Greely / SR 65 variant display choices.
2. Push/merge/deploy — the user's separate call; nothing was pushed.
   The deploy pipeline (`deploy-pages.yml`) runs
   `build_cesium_regional_scene.py`, so `road-names.json` will be
   generated at deploy time once this lands; no checked-in data file
   needs to ship with it.
3. Live visual check on a WebGL machine: labels at regional zoom
   (majors) and close zoom (locals), toggle on/off, no overlap storms
   on dense street grids. Not verifiable on this VM.
4. Optional follow-on (not built here): a full 11,264-pair audit with
   the same verification method, and per-road dual-name display
   (route + local name) if the user wants it.

## Where paint/material wiring plugs in later (not built)

`tsm-console/src/lib/cesium-osm-building-style.ts` already has style
modes including `wall-material`, with `setOsmBuildingStyle` applied to
the ion 96188 OSM buildings layer in `cesium-regional-scene.ts`, and
`inspectOsmBuilding` bounds untrusted OSM attributes. Once the
paint/material datasets land (separate job), per-building
`building:material` / `building:colour` / `roof:material` / `roof:colour`
values feed new style rules there — the same ESTIMATED labeling
discipline as the OSM overlay applies, and verified heights are never
mixed with estimated material data.
