"""OpenMI exchange types as an extension of the existing TSM profile.

Do NOT build a parallel OpenMI stack. The canonical transport is already
``backend/openmi_contract.py`` (``tsm.openmi.v1``) with the live gRPC service
in ``backend/openmi_service.py`` and the proto in ``tsm-console/proto/openmi.proto``.
This module adds only the explicit per-exchange metadata the pasted
OpenMI material calls for — quantity, unit, CRS, vertical datum, timestep —
and a resilient exchange function whose failure mode is an UNAVAILABLE
result, not an exception that blocks the caller.

Standard caveat (standing repo position, 2026-10-17): OGC 11-014r3 (OpenMI
2.0) is a dormant runtime-coupling standard (~2010) with no maintained
Python implementation (Java/C# only). TSM does NOT adopt OpenMI as its
coupling runtime; this profile is a transport boundary for explicitly
labeled exchanges. If true model coupling is ever needed, evaluate CSDMS
BMI (real Python support) instead. Simulated gauge values (e.g. the
rejected firecrawl_openmi_coupler.py sine-wave pattern) must never enter
an exchange: values here are passed through, never synthesized.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Any

from backend.openmi_contract import QuantityValueSet, SpatialReference


@dataclass(frozen=True)
class OpenMiExchange:
    """One explicit model exchange. Every field is required."""

    quantity: str
    unit: str
    crs: str
    vertical_datum: str
    timestep: str  # ISO-8601 timestamp of the exchange step
    value: Any
    source_component: str = ""
    target_component: str = ""


def exchange_to_quantity_value_set(exchange: OpenMiExchange, *, model_run_id: str,
                                   source_authority: str) -> QuantityValueSet:
    """Map an explicit exchange onto the canonical QuantityValueSet message.

    Raises ValueError on missing metadata or non-finite numeric values; the
    resilient wrapper below converts that into an UNAVAILABLE result.
    """
    if not exchange.quantity.strip():
        raise ValueError("quantity is required")
    if not exchange.unit.strip():
        raise ValueError("unit is required")
    if not exchange.crs.strip():
        raise ValueError("horizontal CRS is required")
    if not exchange.vertical_datum.strip():
        raise ValueError("vertical datum is required")
    if not exchange.timestep.strip():
        raise ValueError("timestep is required")
    values = exchange.value if isinstance(exchange.value, (list, tuple)) else [exchange.value]
    if not values:
        raise ValueError("exchange value must contain at least one value")
    if any(isinstance(v, float) and not math.isfinite(v) for v in values):
        raise ValueError("exchange values must be finite")
    provenance = hashlib.sha256(
        json.dumps({"quantity": exchange.quantity, "unit": exchange.unit,
                    "timestep": exchange.timestep,
                    "values": [str(v) for v in values]},
                   sort_keys=True).encode("utf-8")
    ).hexdigest()
    return QuantityValueSet(
        quantity_id=exchange.quantity,
        units=exchange.unit,
        values=[float(v) for v in values],
        timestamp=exchange.timestep,
        source_provenance_hash=provenance,
        source_component=exchange.source_component,
        target_component=exchange.target_component,
        model_run_id=model_run_id,
        spatial_reference=SpatialReference(
            horizontal_crs=exchange.crs,
            vertical_datum=exchange.vertical_datum,
        ),
        source_authority=source_authority,
        validation_status="UNVALIDATED",
    )


def try_exchange(exchange: OpenMiExchange, *, model_run_id: str,
                 source_authority: str) -> dict[str, Any]:
    """Resilient exchange: returns a result dict, never raises for bad data.

    On success: {"status": "OK", "message": QuantityValueSet}. On missing
    metadata or invalid values: {"status": "UNAVAILABLE", "message": None,
    "reason": ...}. The caller keeps running; nothing is interpolated.
    """
    try:
        message = exchange_to_quantity_value_set(
            exchange, model_run_id=model_run_id, source_authority=source_authority)
    except (ValueError, TypeError) as exc:
        return {"status": "UNAVAILABLE", "message": None, "reason": str(exc)}
    return {"status": "OK", "message": message, "reason": "ok"}
