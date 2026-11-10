# Mount Vernon Digital Twin · evidence-aware scene contract

Production-scene integration foundation for the Tri-State Systems Manager (TSM). This directory holds the tested NWS MTVI3 station contract, manually invoked NWPS telemetry retrieval, immutable regulatory isolation, and evidence-guarded building inspector normalization.

The complete locally runnable interactive prototype and the **23,082-footprint visualization snapshot** were generated as a separate conversation ZIP. These datasets are not silently uploaded to the repository. Stage the snapshot with its checksum in TSMData after an explicit data asset review.

## Verify

```bash
node --test tests/contracts/mount-vernon-scene-contract.test.mjs
```

## Technical caveats

- MTVI3 is NWS Mount Vernon on the **Ohio River**. USGS 03379000 historically identifies Little Wabash near Clay City, **not** this gauge.
- NWS thresholds are 28/35/45/52 feet relative to **gage datum**, not NAVD88. No stage-to-NAVD88 conversion without station-specific verified gauge zero receipt.
- Full IGIO source 23,082 footprints has 23,082 distinct IDs but 12 geometries needed repair in visualization copies.
- Existing enriched footprint heights are estimates: 12,155 DEFAULT_RURAL_MEDIAN and 10,927 OVERTURE_NEAREST_20M. This does not independently support claims of 22,815 verified heights.
- No regulatory FEMA flood surface, calibrated HEC-RAS inundation output, final NAVD88 terrain, verified LoD2 mesh inventory or native UE5.8 Shipping binary is delivered by this change.
- No autonomous legal or regulatory approval; `NOT_A_REGULATORY_DETERMINATION` on every selection. All missing values remain `PENDING_EVIDENCE`.
- A scene screenshot validation attempt failed because Chromium itself timed out; native headed UE5.8 verification remains a separate blocked/pending release gate.

Reference official services: https://api.water.noaa.gov/nwps/v1/docs/ and https://www.weather.gov/source/erh/mmefs/ohrfc.GEFS.table.html
