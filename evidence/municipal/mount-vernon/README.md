# Mount Vernon official planning and zoning evidence

## Verified primary references (retrieved November 19, 2026)

- [Posey County Area Plan Commission](https://www.poseycountyin.gov/county-offices/area-plan-commission/) publishes the [City of Mount Vernon Comprehensive Plan PDF](https://www.poseycountyin.gov/wp-content/uploads/2023/09/Mt-Vernon-Comp-Plan.pdf). The PDF's cover says **adopted March 9, 2023**. This is planning policy, **not a rezoning**.
- [Posey County Comprehensive Plan PDF](https://www.poseycountyin.gov/wp-content/uploads/2024/06/Posey-County-Comprehensive-Plan_FINAL-interactiveLOWres.pdf), final March 2024. This is a separate countywide planning reference. New Harmony has separate planning jurisdiction.
- [Mount Vernon zoning code §153.012](https://codelibrary.amlegal.com/codes/mtvernonin/latest/mtvernon_in/0-0-0-13895) places the *Official Zoning Map* with the Area Plan Commission.
- [Posey County UDO 0926 PDF](https://www.poseycountyin.gov/wp-content/uploads/2026/09/Posey-County-UDO-0926.pdf) describes a GIS-maintained zoning map. Legislative adoption and current map effective date are **not confirmed** by this acquisition.

**Do not mistake a comprehensive-plan map or a third-party zoning derivative for the current authoritative zoning GIS.**

## Headless download and verification

Run on a network-connected machine or authorized runner:

```sh
python3 scripts/acquire_mount_vernon_planning.py --output /secure/local/tsm-evidence --include-county
python3 -m unittest discover -s tests -p 'test_acquire_mount_vernon_planning.py'
```

The program restricts downloads to official Posey County PDF hosting, checks redirects/content type/PDF signature/maximum size, and writes original bytes with a true SHA-256 and retrieval timestamp. It **does not** claim a checksum until bytes were downloaded. Store downloaded PDFs/receipts outside the repo unless explicitly reviewed.

## Geospatial admission gates

1. Obtain custodian-confirmed current Official Zoning Map as GeoPackage, FGDB, or authoritative ArcGIS FeatureServer export, with effective ordinance/amendment date.
2. Require official source CRS WKT/EPSG, units, code domain/legend, geometry type, stable feature IDs, publication/export timestamps, legal amendments, license, and historical superseded boundaries.
3. Validate source CRS using `ogrinfo -so -al`. Target **EPSG:2966** is not evidence that original map or PDF figures are georeferenced to EPSG:2966. No PDF-image spatial transformations without verified ground control.
4. Check geometry validity, gaps/overlaps, boundary interpretation, parcel keys, map version against effective ordinances; keep policy-plan land-use features separate from regulatory zoning.
5. Require reviewed source binary SHA-256 and approved publication rights before anonymous map publication. Human Authority Final; no automated zoning decisions.

## Official zoning export request

Posey County Area Plan Commission: **areaplancommission@poseycountyin.gov**, **812-838-1323**, 126 E Third Street, Room 132, Mount Vernon, IN 47620.

> Please provide a digital copy of the current *Official Zoning Map* applicable to Mount Vernon, Indiana, preferably as a native GIS export with coordinate reference system WKT/EPSG, feature identifiers, zoning/overlay code legend, edition/effective date, amendment history, any superseded maps, accompanying adoption ordinance/resolution, and available licensing/reuse conditions. Please identify any official map service URL and the administrator responsible for boundary interpretation.

Status: **city plan official source verified; original PDF bytes not yet locally staged; official zoning map export not obtained; native CRS unknown; parcel-geometry join blocked**. Do not change these release gates until evidence supports a transition.
