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

HORIZONTAL_CRS: Final[str] = "EPSG:2966"
MASTER_SEAL_LEN: Final[int] = 64


class SiteElevations(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", str_strip_whitespace=True)

    bfe_ft: float
    lag_ft: float
    ffe_ft: float | None = None
    berm_crest_ft: float | None = None
    vertical_datum: str

    @field_validator("vertical_datum")
    @classmethod
    def vertical_datum_required(cls, v: str) -> str:
        if not v or v.upper() == "UNVERIFIED":
            raise ValueError("site vertical datum must be established by project evidence")
        return v


class GeodeticFrame(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    horizontal_crs: str = Field(default=HORIZONTAL_CRS)
    vertical_datum: str

    @field_validator("horizontal_crs")
    @classmethod
    def crs_is_explicit(cls, v: str) -> str:
        if not v.startswith("EPSG:"):
            raise ValueError("horizontal CRS must be an explicit EPSG identifier")
        return v

    @field_validator("vertical_datum")
    @classmethod
    def vertical_datum_is_explicit(cls, v: str) -> str:
        if not v or v.upper() == "UNVERIFIED":
            raise ValueError("vertical datum must be established by source/project evidence")
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
    required_cut_cy: float = Field(..., ge=0.0)
    rule_id: str = Field(..., min_length=1)
    jurisdiction: str = Field(..., min_length=2)

    @model_validator(mode="after")
    def no_rise_check(self) -> CompensatoryStorageRequest:
        if self.actual_cut_cy < self.required_cut_cy:
            raise ValueError(
                "actual_cut_cy is below the source-bound required cut volume"
            )
        return self
