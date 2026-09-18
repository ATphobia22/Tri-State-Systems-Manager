#!/usr/bin/env python3
"""Fail-closed FEMA FIRM/PostGIS structural validator for TSM.

This validator verifies database integrity only. It does not determine the
current regulatory effectiveness of a FIRM panel, SFHA status, LOMA status,
or any FEMA regulatory outcome.

Required environment:
  TSM_DATABASE_URL
Optional:
  TSM_FEMA_PANEL_REGISTRY (default: data/registries/fema-firm-panel-registry-v1.json)
  TSM_FEMA_EXPECTED_BBOX_2966=minx,miny,maxx,maxy
  TSM_FEMA_TABLE=public.fema_firm_boundary_ledger

If TSM_FEMA_EXPECTED_BBOX_2966 is absent, coordinate plausibility is a hard
failure rather than silently skipped.
"""

from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2 import sql


EXPECTED_SRID = 2966
DEFAULT_TABLE = "public.fema_firm_boundary_ledger"
DEFAULT_REGISTRY = Path("data/registries/fema-firm-panel-registry-v1.json")


@dataclass(frozen=True)
class PanelTarget:
    panel_id: str
    verification_status: str


class FEMAPanelValidator:
    def __init__(
        self,
        db_connection_string: str,
        panel_registry_path: Path,
        table_name: str = DEFAULT_TABLE,
        expected_bbox: tuple[float, float, float, float] | None = None,
    ) -> None:
        if not db_connection_string:
            raise ValueError("TSM_DATABASE_URL is required.")
        if "." not in table_name:
            raise ValueError("TSM_FEMA_TABLE must be schema-qualified.")
        self.conn_str = db_connection_string
        self.panel_registry_path = panel_registry_path
        self.table_name = table_name
        self.expected_bbox = expected_bbox
        self.target_panels = self._load_registry()

    def _load_registry(self) -> list[PanelTarget]:
        payload = json.loads(self.panel_registry_path.read_text(encoding="utf-8"))
        if payload.get("horizontal_crs") != "EPSG:2966":
            raise ValueError("FEMA panel registry horizontal CRS must be EPSG:2966.")

        targets = payload.get("targets")
        if not isinstance(targets, list) or not targets:
            raise ValueError("FEMA panel registry contains no validation targets.")

        parsed: list[PanelTarget] = []
        seen: set[str] = set()
        for item in targets:
            panel_id = item.get("panel_id")
            status = item.get("verification_status")
            if not isinstance(panel_id, str) or not panel_id:
                raise ValueError("Registry contains an invalid panel_id.")
            if panel_id in seen:
                raise ValueError(f"Duplicate panel_id in registry: {panel_id}")
            if not isinstance(status, str) or not status:
                raise ValueError(f"Registry status missing for {panel_id}.")
            seen.add(panel_id)
            parsed.append(PanelTarget(panel_id=panel_id, verification_status=status))
        return parsed

    def verify_database_schema_integrity(self) -> dict[str, Any]:
        report: dict[str, Any] = {
            "status": "PASSED",
            "expected_srid": EXPECTED_SRID,
            "table": self.table_name,
            "failures": [],
            "verified_panels": [],
            "registry_panels": [panel.panel_id for panel in self.target_panels],
        }

        if self.expected_bbox is None:
            report["failures"].append(
                {
                    "reason": (
                        "COORDINATE PLAUSIBILITY GATE NOT CONFIGURED: "
                        "set TSM_FEMA_EXPECTED_BBOX_2966=minx,miny,maxx,maxy."
                    )
                }
            )

        schema_name, table_name = self.table_name.split(".", 1)

        try:
            with psycopg2.connect(self.conn_str) as conn:
                with conn.cursor() as cursor:
                    self._verify_table_schema(cursor, schema_name, table_name)

                    for panel in self.target_panels:
                        try:
                            self._verify_panel(cursor, panel, schema_name, table_name, report)
                        except Exception as panel_error:
                            report["failures"].append(
                                {
                                    "panel_id": panel.panel_id,
                                    "error": type(panel_error).__name__,
                                    "message": str(panel_error),
                                }
                            )
        except Exception as connection_error:
            return {
                **report,
                "status": "FAILED_CONNECTION",
                "error": type(connection_error).__name__,
                "message": "PostGIS database connection or transaction failed.",
            }

        if report["failures"]:
            report["status"] = "FAILED_VALIDATION"

        return report

    def _verify_table_schema(self, cursor: Any, schema_name: str, table_name: str) -> None:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema_name, table_name),
        )
        columns = {row[0] for row in cursor.fetchall()}
        required = {"panel_id", "geom"}
        missing = required - columns
        if missing:
            raise RuntimeError(
                f"FEMA ledger schema is missing required columns: {sorted(missing)}"
            )

    def _verify_panel(
        self,
        cursor: Any,
        panel: PanelTarget,
        schema_name: str,
        table_name: str,
        report: dict[str, Any],
    ) -> None:
        query = sql.SQL(
            """
            SELECT
                panel_id,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_SRID(geom) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_GeometryType(geom) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_IsValid(geom) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_IsEmpty(geom) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_XMin(ST_Envelope(geom)) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_YMin(ST_Envelope(geom)) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_XMax(ST_Envelope(geom)) END,
                CASE WHEN geom IS NULL THEN NULL ELSE ST_YMax(ST_Envelope(geom)) END
            FROM {}.{}
            WHERE panel_id = %s
            """
        ).format(sql.Identifier(schema_name), sql.Identifier(table_name))

        cursor.execute(query, (panel.panel_id,))
        rows = cursor.fetchall()

        if not rows:
            report["failures"].append(
                {
                    "panel_id": panel.panel_id,
                    "reason": "CRITICAL DATA HOLE: panel is absent from the FEMA spatial ledger.",
                }
            )
            return

        if len(rows) != 1:
            report["failures"].append(
                {
                    "panel_id": panel.panel_id,
                    "reason": f"NON-UNIQUE PANEL ID: expected 1 row, found {len(rows)}.",
                }
            )
            return

        (
            panel_id,
            current_srid,
            geometry_type,
            geometry_is_valid,
            geometry_is_empty,
            min_x,
            min_y,
            max_x,
            max_y,
        ) = rows[0]

        if current_srid is None:
            report["failures"].append(
                {"panel_id": panel_id, "reason": "NULL GEOMETRY."}
            )
            return

        if current_srid != EXPECTED_SRID:
            report["failures"].append(
                {
                    "panel_id": panel_id,
                    "reason": f"CRS MISALIGNMENT: expected SRID {EXPECTED_SRID}, got {current_srid}.",
                }
            )

        if geometry_is_empty:
            report["failures"].append(
                {"panel_id": panel_id, "reason": "EMPTY GEOMETRY."}
            )

        if not geometry_is_valid:
            report["failures"].append(
                {"panel_id": panel_id, "reason": "INVALID POSTGIS GEOMETRY."}
            )

        if geometry_type not in {"ST_Polygon", "ST_MultiPolygon"}:
            report["failures"].append(
                {
                    "panel_id": panel_id,
                    "reason": f"UNSUPPORTED FEMA BOUNDARY GEOMETRY TYPE: {geometry_type}.",
                }
            )

        if self.expected_bbox is not None:
            expected_min_x, expected_min_y, expected_max_x, expected_max_y = self.expected_bbox
            in_bounds = (
                min_x >= expected_min_x
                and min_y >= expected_min_y
                and max_x <= expected_max_x
                and max_y <= expected_max_y
            )
            if not in_bounds:
                report["failures"].append(
                    {
                        "panel_id": panel_id,
                        "reason": "COORDINATE PLAUSIBILITY FAILURE: geometry envelope is outside configured EPSG:2966 bounds.",
                        "envelope": [min_x, min_y, max_x, max_y],
                        "expected_bounds": list(self.expected_bbox),
                    }
                )

        if current_srid == EXPECTED_SRID and geometry_is_valid and not geometry_is_empty:
            report["verified_panels"].append(
                {
                    "panel_id": panel_id,
                    "registry_verification_status": panel.verification_status,
                    "geometry_type": geometry_type,
                    "envelope_2966": [min_x, min_y, max_x, max_y],
                }
            )


def parse_bbox(value: str | None) -> tuple[float, float, float, float] | None:
    if not value:
        return None
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        raise ValueError(
            "TSM_FEMA_EXPECTED_BBOX_2966 must contain four comma-separated numbers."
        )
    try:
        numbers = tuple(float(part) for part in parts)
    except ValueError as exc:
        raise ValueError("FEMA EPSG:2966 bounds must contain numeric values.") from exc
    if not all(math.isfinite(number) for number in numbers):
        raise ValueError("FEMA EPSG:2966 bounds must contain finite values.")
    min_x, min_y, max_x, max_y = numbers
    if not min_x < max_x or not min_y < max_y:
        raise ValueError("FEMA EPSG:2966 bounds must have min values below max values.")
    return numbers


def main() -> int:
    database_url = os.environ.get("TSM_DATABASE_URL")
    registry_path = Path(
        os.environ.get("TSM_FEMA_PANEL_REGISTRY", str(DEFAULT_REGISTRY))
    )
    table_name = os.environ.get("TSM_FEMA_TABLE", DEFAULT_TABLE)

    if not registry_path.is_file():
        print(
            json.dumps(
                {
                    "status": "FAILED_CONFIGURATION",
                    "error": f"Panel registry not found: {registry_path}",
                },
                indent=2,
            )
        )
        return 1

    try:
        bbox = parse_bbox(os.environ.get("TSM_FEMA_EXPECTED_BBOX_2966"))
        validator = FEMAPanelValidator(
            database_url,
            registry_path,
            table_name=table_name,
            expected_bbox=bbox,
        )
        report = validator.verify_database_schema_integrity()
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "FAILED_CONFIGURATION",
                    "error": type(error).__name__,
                    "message": str(error),
                },
                indent=2,
            )
        )
        return 1

    print(json.dumps(report, indent=2))

    return 0 if report["status"] == "PASSED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
