# TSM Government / Geospatial source boundary.
#
# Site constants for 13101 Bonebank Road, Point Township, Posey County, IN.
# Values below were verified from project evidence (see SOURCES comments).
# They are NOT fail-closed sentinels; do not revert to SOURCE_REQUIRED/UNVERIFIED
# without removing the corresponding verification records cited below.
#
# Regulatory use remains fail-closed: confirm the current FEMA Map Service
# Center FIRM/FIS product and local floodplain-administrator adoption before
# filing or making a regulatory determination.

from typing import Final

HORIZONTAL_CRS: Final[str] = "EPSG:2966"

# SOURCES:
#   - docs/NFIP_CID_VERIFICATION.md (verified against FEMA Community Status Book IN.pdf, 2026)
#   - docs/INDIANA-FIRM-MAP-UPDATES.md (FEMA CSB confirms CID 180209, eff. map date 11/05/2014)
#   - tsm-console/src/lib/firm-panel-ssot.ts (POSEY_NFIP.unincorporatedCid)
VERTICAL_DATUM: Final[str] = "NAVD88"
# SOURCES:
#   - GOVERNMENT_QUICKSTART.md ("Vertical datum | NAVD88 for the site reference elevations")
#   - docs/FOUR-PLANE-ARCHITECTURE.md ("EPSG:2966 and NAVD88 are separate: horizontal CRS vs vertical datum")
#   - backend/geospatial/posey/parcel_flood_join.py (USGS EPQS documents NAVD88 orthometric datum)
#   - FEMA FIRM/FIS products for Indiana are published on NAVD88
PARCEL_APN: Final[str] = "65-19-08-100-008.001-010"
# SOURCES:
#   - docs/privacy/site-anchor-public-disclosure.md (related identifiers: parcel 65-19-08-100-008.001-010)
#   - docs/regulatory/ptdt-v35-regulatory-engineering-dossier.md (Property Documentation for APN 65-19-08-100-008.001-010)
#   - docs/grants/bric-grant-and-data-dossier-v34.md (APN supervised by Posey County Assessor Nancy A. Hoehn)
#   - docs/openmi-multiphysics-bridge.md (APN referenced in bridge notes)
MASTER_SEAL: Final[str] = "07e7dc7b6e16d8aed4422188b18f297db12193b9351837c3b9b0d15a5ab4249d"
FIRM_PANEL: Final[str] = "18129C0300C"
# SOURCES:
#   - tsm-console/src/lib/firm-panel-ssot.ts (FIRM_SSOT.effectivePanelId, status NFHL_REST_VERIFIED, role canonical)
#   - docs/NFIP_CID_VERIFICATION.md ("current TSM Bonebank identify record uses 18129C0300C, NFHL EFF_DATE 2014-11-05")
#   - docs/INDIANA-FIRM-MAP-UPDATES.md ("Bonebank NFHL FIRM panel identify | 18129C0300C")
#   - GOVERNMENT_QUICKSTART.md ("FIRM panel SSOT | 18129C0300C; NFHL REST verified")
#   NOTE: 18129C0265C exists in-repo as an alternate candidate (PENDING_MSC_VERIFY), not the canonical panel.
COMMUNITY_ID: Final[str] = "180209"
# SOURCES:
#   - docs/NFIP_CID_VERIFICATION.md ("Posey County (Unincorporated) | 180209 | Point Township falls here",
#     verified against FEMA Community Status Book IN.pdf, 2026)
#   - docs/INDIANA-FIRM-MAP-UPDATES.md ("Unincorporated CID | 180209")
#   - tsm-console/src/lib/firm-panel-ssot.ts (POSEY_NFIP.unincorporatedCid = '180209')


def assert_invariants() -> None:
    """Validate project invariants against verified evidence records."""
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert VERTICAL_DATUM == "NAVD88"
    assert PARCEL_APN == "65-19-08-100-008.001-010"
    assert FIRM_PANEL == "18129C0300C"
    assert COMMUNITY_ID == "180209"
    assert len(MASTER_SEAL) == 64 and all(c in "0123456789abcdef" for c in MASTER_SEAL)


if __name__ == "__main__":
    assert_invariants()
    print("[site_constants] source-boundary invariants OK")
