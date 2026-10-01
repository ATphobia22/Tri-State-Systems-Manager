# MISSING — Union County, KY parcels

**Status:** unavailable as of 2026-10-01 (re-checked; still no open source).
**Checked 2026-10-01:**
1. Union County official site (unioncountyky.org) — HTTP 403 bot block from
   acquisition network; no GIS/parcel page locatable.
2. Union County PVA website (qpublic.net/ky/union → qpublic.schneidercorp.com,
   App=UnionCountyKY, AppID=881) — HTTP 403 from acquisition network; qPublic
   is a per-parcel search viewer with paid subscription for bulk data, NOT an
   open download.
3. ArcGIS Online search ("Union County Kentucky parcels", "UnionKY",
   "UnionCountyKY", "unioncountypva") — no county parcel Feature/Map service.
4. Kentucky DGI kygisserver (WGS84WM_Services, 170 services) — the only
   county PVA parcel service published is Webster County; no Union County.
5. Kentucky open-data Hub (opengisdata.ky.gov) — 0 parcel datasets for Union.
6. Web search — only commercial aggregators (regrid, acres.com); no open source.
7. KYTC County PVA Availability service — tracks county *boundary* ownership,
   not parcel data availability; not applicable.

**Why unavailable:** KY parcel data is per-county PVA licensed. Union County
publishes parcels only through the licensed qPublic viewer. The KY DOR PVA GIS
Product License Agreement permits one-time use with destruction of the layer
after project completion (or purchase from the PVA) — not compatible with a
persistent open offline bundle. No county-direct open publication exists
(unlike Henderson County KY, which publishes its own public `pcls` service).

**Route to obtain (requires user action):** contact the Union County PVA
(Clay Wells, 100 W. Main, Morganfield, KY 42437, (270) 389-1933) for a license,
or purchase a qPublic data subscription. Not pursued — no authorization for
paid/licensed acquisition.

Missing means unavailable — never zero, never invented.
