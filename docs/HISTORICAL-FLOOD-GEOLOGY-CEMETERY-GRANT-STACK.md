# Historical Flood · Geology · Weiss Cemetery · Grant Stack

**Status:** Reference evidence for PE / agency review — **not** a LOMA, No-Rise, or grant award.  
**Site context:** 13101 Bonebank Rd, Point Township, Posey County, IN · NAVD88 site constants.  
**Updated:** 2026-09-11

---

## 1. NAVD88 datum shifts (what agencies need to know)

### What changed

| Datum | Era | Nature |
|-------|-----|--------|
| **NGVD29** | 1929 general adjustment | Multi-tide-gauge “sea level”; accumulated leveling distortions |
| **NAVD88** | 1991 adjustment | Single constrained origin (Father Point / Rimouski); Helmert orthometric heights |

Federal civil work and modern FIRM/FIS products use **NAVD88**. Older paper maps, some historic crest tables, and legacy engineering may still quote **NGVD29**.

### Algebra

NGS convention (VERTCON / NCAT):

```text
height_NAVD88 = height_NGVD29 + (NAVD88 − NGVD29)_model
height_NGVD29 = height_NAVD88 − (NAVD88 − NGVD29)_model
```

At MTVI3 (NWS published table):

| Category | NAVD88 | NGVD29 | Δ |
|----------|--------|--------|---|
| Gauge zero | 318.59 | 318.92 | **−0.33 ft** |
| Minor flood | 353.59 | 353.92 | −0.33 ft |
| Major flood | 370.59 | 370.92 | −0.33 ft |

**Rule for TSM:** never mix datums in one clearance equation. Convert first, then compare to BFE/LAG (NAVD88).

VERTCON is a **model** (~2 cm RMS class for mapping). **Construction / LOMA** needs PE leveling or published NAVD88 bench marks—not VERTCON alone.

Tool: [NGS NCAT / VERTCON 3.0](https://www.ngs.noaa.gov/VERTCON3/)

---

## 2. USGS Water Data API (current operator recipes)

### Runtime API — current as of 2026-09-11

TSM runtime ingestion uses the modernized USGS Water Data OGC API. The legacy `waterservices.usgs.gov/nwis/iv` and `/site` services are **not** the runtime path because USGS states that the legacy WaterServices family will be decommissioned in Q1 2027. citeturn0search9turn2search0

| Service | Current endpoint | Use |
|---------|------------------|-----|
| Latest continuous | `https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items` | Latest automated observations; parameter **00065** gage height and **00060** discharge |
| Continuous | `https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items` | Historical/replay windows; maximum query interval is constrained by the modern API |
| Monitoring locations | `https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items` | Station metadata |
| Time-series metadata | `https://api.waterdata.usgs.gov/ogcapi/v0/collections/time-series-metadata/items` | Available series/parameter metadata |

Latest continuous observations expose `monitoring_location_id`, `parameter_code`, `time`, `value`, `unit_of_measure`, approval status, qualifiers, and source metadata. citeturn2search1turn2search2

**TSM runtime rule:** `parameter_code=00065` remains **GAGE_DATUM**. TSM must retain the raw observation and only expose a NAVD88 water-surface elevation when the gage-zero datum conversion is explicitly sourced, versioned, and recorded in provenance. USGS coordinates are returned in EPSG:4326 unless another supported CRS is requested. citeturn2search0

**Posey nodes**

| Site | Role |
|------|------|
| 03378500 | Wabash @ New Harmony |
| 03322000 | Ohio @ Evansville |
| 03322420 | Ohio @ Uniontown Dam / Myers area |

### Historical compatibility

The repository retains a parser for historical WaterServices JSON fixtures so archived evidence can be replayed without mutating its historical provenance. It must **not** be used for new live retrievals.

---

## 3. Historical flood simulation sources (berm / placement verification)

Use these as **observation layers**, not as proof that a berm “should have been” present.

### NASA

| Product | What it gives |
|---------|----------------|
| **MODIS MCDWD_L3** reprocessed archive **2003–2025** | Daily ~250 m flood water maps (LAADS DAAC) |
| **VIIRS NRT Global Flood** | Near-real-time successor path |
| Landsat event pairs | e.g. May 2011 Ohio–Wabash confluence inundation (NASA Earth Observatory / Landsat 5) |

LAADS: `https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/61/MCDWD_L3/`  
User guide: NASA Earthdata NRT Global Flood Products

**How to use for berm narrative**

1. Pick crest dates from NWS MTVI3 / UNWK2 historic tables.
2. Pull NASA/MODIS or Landsat scenes ±2 days of crest.
3. Overlay structure footprint + proposed berm polyline in EPSG:2966 / NAVD88 elevation model.
4. Compare observed inundation extent to simulated stage planes (gage_height + zero).
5. Document residual uncertainty (cloud, 250 m pixels, tree canopy).

### USGS Flood Inundation Mapping

- **Wabash at New Harmony (03378500)** — SIR 2016-5119 stage–inundation library  
  `https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf`
- OKI FIM program hub for additional reaches.

### NWS impact statements (MTVI3)

Historic impact statements and crest values are **historical evidence**, not current observations. Current operational stage must come from the live NOAA/USGS source adapters and carry its own observation/retrieval timestamps.

**TSM policy:** historical layers = **OBSERVATION / VISUALIZATION**. Berm design still requires PE + IDNR/FEMA process.

---

## 4. Henry H. Gray geological records (verified)

**Henry Hamilton Gray (b. 1922)** — long-time Indiana Geological & Water Survey stratigrapher; not “Henry Greys.” Key works for SW Indiana / Posey context:

| Work | Year | Relevance |
|------|------|-----------|
| Retained source records | Historical | Geological context for SW Indiana / Posey County |

**Evidence rule:** historical references are retained as dated source evidence; they do not become current regulatory or engineering determinations merely because they are present in the TSM evidence fabric.
