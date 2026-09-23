"""Posey County WTHGIS source adapter metadata.

Source endpoint: http://poseyin.wthgis.com/

The public system exposes Posey County parcel/property-record pages. Observed
record pages can contain StateParcelNumber, ParcelNumber, LocationAddress,
LegalDescription, DeedBook, DeedPage, Document, and ownership-transfer
information.

This adapter is metadata-only by design. It does not scrape undocumented
endpoints, infer title, or convert an assessment record into a certified deed.
Recorded deed evidence remains a Recorder/title-record responsibility.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode


POSEY_WTHGIS_BASE_URL = "http://poseyin.wthgis.com/"
POSEY_PROPERTY_RECORD_BASE = f"{POSEY_WTHGIS_BASE_URL}tgis/custom.aspx"


@dataclass(frozen=True)
class PoseyGISSource:
    name: str = "Posey County WTHGIS"
    base_url: str = POSEY_WTHGIS_BASE_URL
    authority: str = "Posey County, Indiana GIS/property-record system"

    def property_record_url(self, feature_id: int) -> str:
        if feature_id <= 0:
            raise ValueError("feature_id must be positive")
        return f"{POSEY_PROPERTY_RECORD_BASE}?{urlencode({'DSID': 205, 'FeatureID': feature_id, 'RequestType': 'PropertyRecordCard'})}"

    def tax_history_url(self, feature_id: int) -> str:
        if feature_id <= 0:
            raise ValueError("feature_id must be positive")
        return f"{POSEY_PROPERTY_RECORD_BASE}?{urlencode({'DSID': 205, 'FeatureID': feature_id, 'RequestType': 'TaxHistoryData'})}"


def source_manifest() -> dict[str, str]:
    return {
        "source_id": "POSEY_WTHGIS",
        "source_name": "Posey County WTHGIS",
        "base_url": POSEY_WTHGIS_BASE_URL,
        "authority": "Posey County, Indiana GIS/property-record system",
        "record_type": "parcel/property record",
        "deed_authority": "GIS record only; recorder/title records remain authoritative for recorded deed evidence.",
    }
