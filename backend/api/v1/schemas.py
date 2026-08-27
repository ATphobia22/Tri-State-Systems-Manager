# PTDT v35 — Pydantic V2 Validation (fail-closed)
# Requires: pydantic>=2.5
from __future__ import annotations

from typing import Final, Literal, Optional
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

BFE_FT: Final[float] = 375.0
LAG_FT: Final[float] = 377.2
HORIZONTAL_CRS: Final[str] = "EPSG:2966"
MASTER_SEAL_LEN: Final[int] = 64
QL2_RMSEZ_FT: Final[float] = 0.328  # USGS 3DEP QL2 non-vegetated


class SiteElevations(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", str_strip_whitespace=True)

    bfe_ft: float = Field(default=BFE_FT)
    lag_ft: float = Field(default=LAG_FT)
    ffe_ft: float = Field(default=382.5)
    berm_crest_ft: float = Field(default=379.8)

    @field_validator("bfe_ft")
    @classmethod
    def bfe_locked(cls, v: float) -> float:
        if abs(v - BFE_FT) > 1e-6:
            raise ValueError(f"BFE must be {BFE_FT} ft NAVD88 (got {v})")
        return v

    @field_validator("lag_ft")
    @classmethod
    def lag_locked(cls, v: float) -> float:
        if abs(v - LAG_FT) > 1e-6:
            raise ValueError(f"LAG must be {LAG_FT} ft NAVD88 (got {v})")
        return v

    @model_validator(mode="after")
    def freeboard_clearance(self) -> SiteElevations:
        if abs(self.lag_ft - self.bfe_ft - 2.2) > 1e-6:
            raise ValueError("LAG - BFE must equal +2.2 ft natural clearance")
        return self


class GeodeticFrame(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    horizontal_crs: str = Field(default=HORIZONTAL_CRS)
    vertical_datum: str = Field(default="NAVD88")

    @field_validator("horizontal_crs")
    @classmethod
    def crs_must_be_2966(cls, v: str) -> str:
        if v != "EPSG:2966":
            raise ValueError(f"Rejected CRS {v}. Authoritative frame is EPSG:2966 only.")
        return v

    @field_validator("vertical_datum")
    @classmethod
    def vertical_navd88(cls, v: str) -> str:
        if v != "NAVD88":
            raise ValueError(f"Vertical datum must be NAVD88 (got {v})")
        return v


class HydraulicRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage_ft: float = Field(..., ge=300.0, le=400.0)
    fill_volume_cy: float = Field(default=0.0, ge=0.0)
    project_path: Optional[str] = None


class HydraulicResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    engine: Literal["pure_python_saint_venant", "hecrasapi_2d"]
    hydraulic_area_sqft: float
    velocity_fps: float
    fost: float
    required_cut_cy: float
    bishop_fos: float
    no_rise_compliant: bool
    critical_path: bool
    crs: str
    bfe_ft: float
    lag_ft: float
    master_seal: str

    @field_validator("crs")
    @classmethod
    def response_crs(cls, v: str) -> str:
        if v != "EPSG:2966":
            raise ValueError("Response CRS must remain EPSG:2966")
        return v

    @field_validator("master_seal")
    @classmethod
    def seal_format(cls, v: str) -> str:
        if len(v) != MASTER_SEAL_LEN or any(c not in "0123456789abcdef" for c in v):
            raise ValueError("master_seal must be 64-char lowercase hex")
        return v


class CompensatoryStorageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fill_volume_cy: float = Field(..., ge=0.0)
    actual_cut_cy: float = Field(..., ge=0.0)
    safety_factor: float = Field(default=1.20, ge=1.20, le=1.50)

    @model_validator(mode="after")
    def no_rise_check(self) -> CompensatoryStorageRequest:
        required = self.fill_volume_cy * self.safety_factor
        if self.actual_cut_cy < required:
            raise ValueError(
                f"No-Rise violation: actual_cut_cy {self.actual_cut_cy} < required {required:.2f}"
            )
        return self
