"""Strict metadata contracts for IndianaMap/IGIO source records.

The adapter intentionally records provenance and authority metadata without
turning a public geospatial service into a regulatory determination.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping
from urllib.parse import urlparse

ALLOWED_SERVICE_TYPES = {"FeatureServer", "ImageServer", "MapServer", "WFS", "COG", "download"}
ALLOWED_AUTHORITY = {"authoritative_government", "derived_government", "reference"}


@dataclass(frozen=True, slots=True)
class IndianaMapDataset:
    dataset_id: str
    title: str
    service_url: str
    service_type: str
    source_agency: str
    authority_class: str
    spatial_reference: str
    vertical_datum: str | None
    resolution: str | None
    acquisition_date: datetime | None
    metadata_url: str | None = None


def _https_url(value: str, field: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"{field} must be an absolute HTTPS URL")


def validate_dataset(record: Mapping[str, Any]) -> IndianaMapDataset:
    required = ("dataset_id", "title", "service_url", "service_type", "source_agency",
                "authority_class", "spatial_reference")
    missing = [key for key in required if not isinstance(record.get(key), str) or not record[key].strip()]
    if missing:
        raise ValueError(f"missing required metadata: {', '.join(missing)}")

    service_type = record["service_type"]
    authority_class = record["authority_class"]
    if service_type not in ALLOWED_SERVICE_TYPES:
        raise ValueError(f"unsupported service_type: {service_type}")
    if authority_class not in ALLOWED_AUTHORITY:
        raise ValueError(f"unsupported authority_class: {authority_class}")
    _https_url(record["service_url"], "service_url")

    acquisition = record.get("acquisition_date")
    if acquisition is not None and not isinstance(acquisition, datetime):
        raise TypeError("acquisition_date must be datetime or None")
    metadata_url = record.get("metadata_url")
    if metadata_url is not None:
        if not isinstance(metadata_url, str):
            raise TypeError("metadata_url must be a string or None")
        _https_url(metadata_url, "metadata_url")

    return IndianaMapDataset(
        dataset_id=record["dataset_id"].strip(), title=record["title"].strip(),
        service_url=record["service_url"].strip(), service_type=service_type,
        source_agency=record["source_agency"].strip(), authority_class=authority_class,
        spatial_reference=record["spatial_reference"].strip(),
        vertical_datum=record.get("vertical_datum"), resolution=record.get("resolution"),
        acquisition_date=acquisition, metadata_url=metadata_url,
    )
