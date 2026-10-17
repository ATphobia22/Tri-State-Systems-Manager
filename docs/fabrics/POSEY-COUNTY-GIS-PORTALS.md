# Posey County local GIS portals (explored 2026-10-17)

## poseyin.wthgis.com — Think GIS parcel map

- **Role:** Official Posey County **parcel / GIS** viewer (WTH Think GIS stack).
- **Tech:** Legacy tgis JS (`tgisServer2.js`, `poseyCustom.js`), parcel-focused UI.
- **Use for TSM:** Parcel boundaries / ownership context. **Not** a dam-safety or NFHL product.
- **Link:** https://poseyin.wthgis.com

## engage.xsoftinc.com/posey — XSoft Engage

- **Role:** Official **assessor / CAMA / tax** citizen portal (XSoft Engage™).
- **Routes:** `/posey/map`, `/posey/dataonly`, resources/help.
- **Use for TSM:** Property ID, assessed value, PRC documents. Subject to IC 36-1-8.5.
- **Link:** https://engage.xsoftinc.com/posey

## How TSM relates

| Need | Source |
|------|--------|
| Dam hazard inventory | USACE NID (official API) → `data/fabrics/posey-nid-official.*` |
| Flood zones / BFE | FEMA NFHL REGULATORY plane |
| Parcels / tax | County portals above (CONTEXT) |
| Building heights | TSM buildings-3d DERIVED |

Do not scrape Engage or Think GIS behind logins; use published IGIO/FEMA/NID services for automated fabrics.
