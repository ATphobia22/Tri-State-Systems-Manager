"""Immutable provenance contract for external open-data registry entries.

The registry is discovery/provenance metadata. It does not elevate a dataset
above its producer's stated authority and never supplies survey certification.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Final

OPEN_DATA_REGISTRY_REPOSITORY: Final[str] = "ATphobia22/open-data-registry"
OPEN_DATA_REGISTRY_COMMIT: Final[str] = "00eb38722ad0a2d9ac0bd50d23f3ba0f11b10dfb"
INDIANA_ELEVATION_REGISTRY_PATH: Final[str] = "datasets/in-elevation.yaml"
INDIANA_ELEVATION_REGISTRY_BLOB_SHA: Final[str] = (
    "f2a5169cbae250c297679bc281abdc4c2ddc3e85"
)
OPEN_DATA_REGISTRY_BASE_URL: Final[str] = (
    "https://github.com/ATphobia22/open-data-registry"
)


@dataclass(frozen=True)
class OpenDataRegistryEntry:
    repository: str
    commit: str
    path: str
    blob_sha: str
    raw_url: str


def indiana_elevation_registry_entry() -> OpenDataRegistryEntry:
    return OpenDataRegistryEntry(
        repository=OPEN_DATA_REGISTRY_REPOSITORY,
        commit=OPEN_DATA_REGISTRY_COMMIT,
        path=INDIANA_ELEVATION_REGISTRY_PATH,
        blob_sha=INDIANA_ELEVATION_REGISTRY_BLOB_SHA,
        raw_url=(
            f"{OPEN_DATA_REGISTRY_BASE_URL}/raw/"
            f"{OPEN_DATA_REGISTRY_COMMIT}/{INDIANA_ELEVATION_REGISTRY_PATH}"
        ),
    )


def verify_registry_snapshot(content: str) -> str:
    """Return the SHA-256 of a registry snapshot for evidence sidecars."""
    if not isinstance(content, str) or not content.strip():
        raise ValueError("registry snapshot must be a non-empty UTF-8 string")
    return sha256(content.encode("utf-8")).hexdigest()
