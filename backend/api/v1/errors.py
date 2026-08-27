# PTDT v35 — Structured Error Handling
from __future__ import annotations

from typing import Any, Dict, Optional


class PTDTError(Exception):
    """Base sovereign error."""

    code: str = "PTDT_ERROR"

    def __init__(self, message: str, *, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {"code": self.code, "message": self.message, "details": self.details}


class TransformationContractViolationError(PTDTError):
    code = "TRANSFORM_CONTRACT"

    def __init__(self, message: str, code: str = "TRANSFORM_CONTRACT", **kwargs: Any) -> None:
        super().__init__(message, details=kwargs)
        self.code = code


class HydraulicSolverError(PTDTError):
    code = "HYDRAULIC_SOLVER"

    def __init__(self, message: str, *, stage_ft: Optional[float] = None, engine: Optional[str] = None) -> None:
        super().__init__(message, details={"stage_ft": stage_ft, "engine": engine})


class GeodeticInvariantError(PTDTError):
    code = "GEODETIC_INVARIANT"


class NoRiseViolationError(PTDTError):
    code = "NO_RISE_VIOLATION"


class RasterAccuracyError(PTDTError):
    """Raised when DEM/LiDAR exceeds QL2 RMSEZ ≤ 0.328 ft bound."""
    code = "RASTER_ACCURACY"
