#!/usr/bin/env python3
"""
TSM provenance-safe data ingestor (USGS 3DEP / vertical datum metadata).

Does NOT hard-code site GEOID offsets. Orthometric conversion requires an
explicit geoid_offset_m plus model ID and source URL in the intake record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("TSM-DataIngestor")

ROOT = Path(__file__).resolve().parents[2]

POSEY_CO_ECEF_BOUNDS = {
    "x_min": 150000.0,
    "x_max": 210000.0,
    "y_min": -5060000.0,
    "y_max": -5000000.0,
    "z_min": 3870000.0,
    "z_max": 3940000.0,
}


class IngestionError(Exception):
    pass


@dataclass
class VerticalDatumProvenance:
    """Required before labeling any height as NAVD88 orthometric."""

    geoid_offset_m: float
    geoid_model_id: str  # e.g. GEOID18
    source_url: str
    method: str = "H = h - N  (orthometric = ellipsoidal - geoid undulation)"
    notes: str = ""

    def validate(self) -> None:
        if not self.geoid_model_id.strip():
            raise IngestionError("geoid_model_id is required (e.g. GEOID18)")
        if not self.source_url.strip().startswith(("http://", "https://")):
            raise IngestionError("source_url must be an http(s) URL for the model/sample")
        # Offset may be positive or negative depending on sign convention documentation;
        # we only require it to be finite and explicitly supplied.
        if self.geoid_offset_m != self.geoid_offset_m:  # NaN
            raise IngestionError("geoid_offset_m is NaN")


class TSMDataIngestor:
    def __init__(self, raw_data_dir: Path, staging_dir: Path, manifest_path: Path):
        self.raw_data_dir = raw_data_dir
        self.staging_dir = staging_dir
        self.manifest_path = manifest_path
        self.staging_dir.mkdir(parents=True, exist_ok=True)

    def load_source_manifest(self) -> Dict[str, Any]:
        if not self.manifest_path.exists():
            raise IngestionError(f"Manifest not found: {self.manifest_path}")
        return json.loads(self.manifest_path.read_text(encoding="utf-8"))

    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        h = hashlib.sha256()
        with file_path.open("rb") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()

    def verify_file_checksum(self, file_path: Path, expected_sha256: Optional[str]) -> str:
        if not file_path.exists():
            raise IngestionError(f"Raw source missing: {file_path}")
        actual = self.compute_sha256(file_path)
        if expected_sha256:
            if actual != expected_sha256:
                raise IngestionError(
                    f"Checksum mismatch for {file_path.name}: "
                    f"expected {expected_sha256}, got {actual}"
                )
            logger.info("  [VERIFIED] SHA-256 matched for %s", file_path.name)
        else:
            logger.warning(
                "  [UNPINNED] No expected SHA-256 supplied for %s — recording measured hash only",
                file_path.name,
            )
        return actual

    def apply_vdatum_transformation(
        self, ellipsoidal_height_m: float, provenance: VerticalDatumProvenance
    ) -> float:
        """H = h - N when N is geoid undulation in the documented sign convention."""
        provenance.validate()
        return round(ellipsoidal_height_m - provenance.geoid_offset_m, 4)

    def validate_ecef_translation(self, tx: float, ty: float, tz: float) -> None:
        b = POSEY_CO_ECEF_BOUNDS
        if not (
            b["x_min"] <= tx <= b["x_max"]
            and b["y_min"] <= ty <= b["y_max"]
            and b["z_min"] <= tz <= b["z_max"]
        ):
            raise IngestionError(
                f"ECEF ({tx}, {ty}, {tz}) outside Posey County bounds."
            )
        if tx <= 0:
            raise IngestionError("Midwest sign trap: X must be positive near 88W.")
        logger.info("  [PASS] ECEF inside Posey envelope.")

    def stage_lidar_tile(
        self,
        tile_filename: str,
        *,
        expected_hash: Optional[str],
        sample_ecef: Tuple[float, float, float],
        ellipsoidal_height_m: Optional[float],
        vertical: Optional[VerticalDatumProvenance],
    ) -> Path:
        logger.info("Processing tile: %s", tile_filename)
        raw_file = self.raw_data_dir / tile_filename
        measured_hash = self.verify_file_checksum(raw_file, expected_hash)
        self.validate_ecef_translation(*sample_ecef)

        vertical_block: Dict[str, Any]
        if vertical is None or ellipsoidal_height_m is None:
            vertical_block = {
                "label": "ELLIPSOIDAL_OR_UNKNOWN",
                "navd88_claimed": False,
                "reason": "No geoid_offset_m + model + source_url supplied — not labeled NAVD88",
            }
            orthometric = None
        else:
            vertical.validate()
            orthometric = self.apply_vdatum_transformation(
                ellipsoidal_height_m, vertical
            )
            vertical_block = {
                "label": "NAVD88_ORTHOMETRIC_DERIVED",
                "navd88_claimed": True,
                "ellipsoidal_height_m": ellipsoidal_height_m,
                "orthometric_height_m": orthometric,
                "provenance": asdict(vertical),
            }

        payload = {
            "schema_version": "1.0.0",
            "source_file": tile_filename,
            "source_sha256": measured_hash,
            "expected_sha256": expected_hash,
            "ecef_anchor": {"x": sample_ecef[0], "y": sample_ecef[1], "z": sample_ecef[2]},
            "vertical": vertical_block,
            "status": "STAGED_READY_FOR_HLOD_REVIEW",
            "authority": "DERIVED_INGEST",
            "staged_at": datetime.now(timezone.utc).isoformat(),
            "policy": {
                "no_hardcoded_geoid_offset": True,
                "human_authority_final": True,
                "not_production_hlod_until_certified": True,
            },
        }

        out = self.staging_dir / f"processed_{Path(tile_filename).stem}.json"
        out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        logger.info("  [SUCCESS] Staged %s", out)
        return out


def main(argv: Optional[list[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--raw-dir", type=Path, default=ROOT / "data" / "raw_usgs")
    p.add_argument("--staging-dir", type=Path, default=ROOT / "assets" / "staged_ingest")
    p.add_argument(
        "--manifest",
        type=Path,
        default=ROOT / "integrations" / "registry" / "tsm-immutable-source-manifest-v1.json",
    )
    p.add_argument("--tile", type=str, help="Filename under raw-dir")
    p.add_argument("--expected-sha256", type=str, default=None)
    p.add_argument("--ecef-x", type=float, default=175550.84)
    p.add_argument("--ecef-y", type=float, default=-5039980.67)
    p.add_argument("--ecef-z", type=float, default=3892024.17)
    p.add_argument("--ellipsoidal-height-m", type=float, default=None)
    p.add_argument("--geoid-offset-m", type=float, default=None)
    p.add_argument("--geoid-model-id", type=str, default=None)
    p.add_argument("--geoid-source-url", type=str, default=None)
    p.add_argument(
        "--init-only",
        action="store_true",
        help="Only verify manifest path and print readiness",
    )
    args = p.parse_args(argv)

    try:
        ingestor = TSMDataIngestor(args.raw_dir, args.staging_dir, args.manifest)
        ingestor.load_source_manifest()
        logger.info("Manifest OK: %s", args.manifest)

        if args.init_only or not args.tile:
            logger.info(
                "Ready. Provide --tile and optional vertical provenance flags to stage."
            )
            return 0

        vertical = None
        if args.geoid_offset_m is not None:
            if not args.geoid_model_id or not args.geoid_source_url:
                raise IngestionError(
                    "When --geoid-offset-m is set, --geoid-model-id and "
                    "--geoid-source-url are required."
                )
            vertical = VerticalDatumProvenance(
                geoid_offset_m=args.geoid_offset_m,
                geoid_model_id=args.geoid_model_id,
                source_url=args.geoid_source_url,
            )

        ingestor.stage_lidar_tile(
            args.tile,
            expected_hash=args.expected_sha256,
            sample_ecef=(args.ecef_x, args.ecef_y, args.ecef_z),
            ellipsoidal_height_m=args.ellipsoidal_height_m,
            vertical=vertical,
        )
        return 0
    except IngestionError as e:
        logger.error("INGESTION FAILED: %s", e)
        return 1
    except Exception as e:  # noqa: BLE001
        logger.error("UNEXPECTED: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
