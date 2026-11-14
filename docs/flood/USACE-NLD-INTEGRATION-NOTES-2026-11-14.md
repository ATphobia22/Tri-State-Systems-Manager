# USACE National Levee Database (NLD) — TSM Integration Notes

## Authority
NLD is the USACE authoritative inventory of levees (CONUS + AK/HI). Public map + data services; advanced features may need NLD account.

## Access

| Resource | Use |
|----------|-----|
| Portal | https://levees.sec.usace.army.mil/ |
| NLD2 API (OpenAPI 3.1) | https://levees.sec.usace.army.mil/developer/ — REST |
| ArcGIS Feature/Map Service | Core mapping layers |
| OGC WMS/WFS | Single OWS endpoint |
| Export | CSV, GeoJSON, SHP, KML |

## Data model (public)
- Horizontal: NAD83
- Vertical: NAVD88
- Units: international feet (recent standard)
- Features: system alignment, segments, structures, inspections (permission-dependent)

## TSM gates
1. Read-only overlay for Posey / lower Wabash–Ohio context.
2. Never invent levee accreditation or freeboard from NLD alone — cite system ID and inspection status from source.
3. Align vertical claims to NAVD88; document any NGVD29 conversions separately.
4. NFIP levee provision / provisionally accredited status remains FEMA process — NLD supports, does not replace.
5. Contact: NLD@usace.army.mil / 1-877-LEVEEUS for account or restricted layers.

## Non-claims
TSM does not assert levee performance, residual risk, or certification. Human + agency authority final.
