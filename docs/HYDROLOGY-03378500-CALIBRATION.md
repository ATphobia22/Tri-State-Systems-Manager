# USGS 03378500 vertical calibration

## Authoritative distinction

TSM stores two different USGS values because they are not interchangeable:

| Quantity | Value | Meaning | Source |
|---|---:|---|---|
| Published streamgage datum | **352.67 ft NAVD88** | Datum used to convert gage-height stage to station WSE | USGS SIR 2016-5119 |
| Current monitoring-location altitude | **352.71 ft NAVD88** | USGS monitoring-location metadata altitude of gage/land surface | USGS monitoring-location page |

The production WSE conversion therefore remains:

`WSE_NAVD88 = gage_height + 352.67 ft`

For a 4.31-ft gage-height observation, the station WSE is **356.98 ft NAVD88**.

The 352.71-ft metadata altitude must not silently replace the published 352.67-ft streamgage datum. The four-centimeter difference is retained as provenance rather than discarded.

## Flood thresholds

The registered NHRI3/NWS thresholds are:

- Action: 10.0 ft
- Minor: 15.0 ft
- Moderate: 20.0 ft
- Major: 23.0 ft

These are stage thresholds at the New Harmony gage, not building elevations and not FEMA BFEs.

## Site-transfer rule

The New Harmony station WSE is **not** a Point Township site WSE. A site WSE requires a validated hydraulic profile/model transfer with explicit cross-section/profile lineage and common vertical datum.

Until that evidence exists:

- station WSE display: operational/observational;
- site WSE: unavailable;
- structural freeboard: unavailable when LAG/FFE/BFE are unverified;
- hydraulic extrusion: blocked;
- physical actuation: blocked.

## FEMA evidence rule

FEMA FIS/FIRM products must be retrieved from the FEMA Map Service Center and recorded with product ID, effective date, report/profile page, stream/reach identifier, profile station, elevation, datum, and source hash. A candidate value without this lineage is not an authoritative BFE.

## Notification rule

TSM may evaluate stage thresholds and prepare an advisory notification payload. Email delivery requires an explicitly configured notification adapter and recipient allowlist. No stage threshold may directly actuate physical infrastructure.

Sources:

- https://waterdata.usgs.gov/monitoring-location/USGS-03378500/
- https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf
- https://forecast.weather.gov/product.php?format=TXT&glossary=1&issuedby=WBL&product=RVF&site=REV&version=1
- https://msc.fema.gov/portal/home
