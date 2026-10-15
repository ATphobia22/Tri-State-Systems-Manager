#!/usr/bin/env python3
"""PointTube temporal data structure with strict state semantics.

Audit 2026-10-07: PointTube carries spatio-temporal observations for TSM
features. State types (never interpolate categorical state):

  OBSERVED     - direct measurement at timestamp (LiDAR return, survey shot)
  DERIVED      - computed from observations (median roof-ground height)
  INTERPOLATED - linear interpolation between two OBSERVED/DERIVED states
  FORECAST     - model-projected future state (explicitly labeled, not evidence)
  SIMULATED    - synthetic scenario state (ISOLATED; never enters authoritative set)
  EVENT        - discrete occurrence anchored to a timestamp (flood crest date)

Rules:
  * Categorical state is NEVER interpolated: get_state_at(t) returns the
    state valid at t or raises; it does not blend OBSERVED with SIMULATED.
  * Numeric positions may interpolate ONLY between OBSERVED/DERIVED anchors
    using the declared interpolation method.
  * Out-of-range timestamps -> TemporalRangeError, NOT silent extrapolation.
  * Every sample records: timestamp, validity interval, state type, source,
    confidence, interpolation method (for interpolated samples).

This module is the data structure only. Populating it with SIMULATED or
FORECAST states does not make them authoritative; see docs/TSM-BRANCH-ISOLATION.md.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum


class StateType(str, Enum):
    OBSERVED = "OBSERVED"
    DERIVED = "DERIVED"
    INTERPOLATED = "INTERPOLATED"
    FORECAST = "FORECAST"
    SIMULATED = "SIMULATED"
    EVENT = "EVENT"


class TemporalRangeError(ValueError):
    """Raised when a timestamp is outside the tube's validity range."""


@dataclass(frozen=True)
class TubeSample:
    timestamp: float            # decimal year, e.g. 2023.5
    coords: tuple[float, float, float]  # (x, y, z) in declared CRS
    state: StateType
    source: str                 # provenance URI or description
    confidence: str             # e.g. "HIGH", "MEDIUM", "LOW", "SCREENING"
    valid_from: float           # validity interval start
    valid_to: float             # validity interval end
    interpolation: str = "none"  # "none" | "linear"


class PointTube:
    """A single feature's temporal trajectory with strict state semantics."""

    def __init__(self, tube_id: str, crs: str = "EPSG:2966",
                 vertical_datum: str = "NAVD88"):
        self.tube_id = tube_id
        self.crs = crs
        self.vertical_datum = vertical_datum
        self._samples: list[TubeSample] = []

    def add(self, sample: TubeSample) -> None:
        if not isinstance(sample.state, StateType):
            raise ValueError(f"state must be StateType, got {sample.state!r}")
        if not isinstance(sample.coords, (tuple, list)) or len(sample.coords) != 3:
            raise ValueError("coords must contain exactly three numeric values")
        numeric_values = (sample.timestamp, sample.valid_from, sample.valid_to, *sample.coords)
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)
               for value in numeric_values):
            raise ValueError("timestamp, validity bounds, and all three coordinates must be finite numbers")
        if sample.valid_from > sample.valid_to:
            raise ValueError("valid_from > valid_to")
        if not (sample.valid_from <= sample.timestamp <= sample.valid_to):
            raise ValueError("timestamp outside validity interval")
        if not sample.source.strip() or not sample.confidence.strip():
            raise ValueError("source and confidence provenance are required")
        if sample.interpolation not in ("none", "linear"):
            raise ValueError(f"unsupported interpolation metadata {sample.interpolation!r}")
        if sample.state == StateType.INTERPOLATED and sample.interpolation != "linear":
            raise ValueError("INTERPOLATED samples must declare interpolation='linear'")
        if sample.state != StateType.INTERPOLATED and sample.interpolation != "none":
            raise ValueError(f"{sample.state.value} samples cannot declare interpolation")
        if sample.state in (StateType.OBSERVED, StateType.DERIVED):
            if any(s.state in (StateType.OBSERVED, StateType.DERIVED) and s.timestamp == sample.timestamp
                   for s in self._samples):
                raise ValueError(f"duplicate numeric anchor timestamp {sample.timestamp}")
        self._samples.append(sample)
        self._samples.sort(key=lambda s: (s.timestamp, s.state.value))

    def _anchors(self) -> list[TubeSample]:
        """Numeric interpolation anchors: OBSERVED and DERIVED only."""
        return [s for s in self._samples
                if s.state in (StateType.OBSERVED, StateType.DERIVED)]

    def get_position_at(self, t: float, method: str = "linear") -> TubeSample:
        """Numeric position at time t.

        Interpolates ONLY between OBSERVED/DERIVED anchors. Out-of-range
        timestamps raise TemporalRangeError (no silent extrapolation).
        """
        if not math.isfinite(t):
            raise TemporalRangeError(f"tube {self.tube_id}: timestamp must be finite")
        anchors = self._anchors()
        if not anchors:
            raise TemporalRangeError(f"tube {self.tube_id}: no OBSERVED/DERIVED anchors")
        times = [s.timestamp for s in anchors]
        if t < times[0] or t > times[-1]:
            raise TemporalRangeError(
                f"tube {self.tube_id}: t={t} outside anchor range "
                f"[{times[0]}, {times[-1]}]; refusing extrapolation")
        # Exact anchor
        for s in anchors:
            if s.timestamp == t:
                return s
        if method != "linear":
            raise ValueError(f"unsupported interpolation {method!r}")
        # Linear interpolation between bounding anchors
        prev = max(s for s in anchors if s.timestamp < t)
        nxt = min(s for s in anchors if s.timestamp > t)
        f = (t - prev.timestamp) / (nxt.timestamp - prev.timestamp)
        coords = tuple(p + f * (n - p) for p, n in zip(prev.coords, nxt.coords))
        return TubeSample(
            timestamp=t, coords=coords, state=StateType.INTERPOLATED,
            source=f"interpolated({prev.source} -> {nxt.source})",
            confidence="INTERPOLATED",
            valid_from=prev.valid_from, valid_to=nxt.valid_to,
            interpolation="linear",
        )

    def get_state_at(self, t: float) -> StateType:
        """Categorical state valid at time t. NEVER interpolated.

        Returns the state of the sample whose validity interval contains t.
        Raises TemporalRangeError if no sample covers t.
        """
        if not math.isfinite(t):
            raise TemporalRangeError(f"tube {self.tube_id}: timestamp must be finite")
        matches = [s for s in self._samples if s.valid_from <= t <= s.valid_to]
        if len(matches) == 1:
            return matches[0].state
        if len(matches) > 1:
            states = {s.state for s in matches}
            if len(states) == 1:
                return matches[0].state
            raise TemporalRangeError(
                f"tube {self.tube_id}: ambiguous overlapping categorical validity intervals at t={t}")
        raise TemporalRangeError(
            f"tube {self.tube_id}: no sample covers t={t}; "
            f"categorical state is never interpolated")

    def to_dict(self) -> dict:
        return {
            "tube_id": self.tube_id,
            "crs": self.crs,
            "vertical_datum": self.vertical_datum,
            "samples": [
                {"timestamp": s.timestamp,
                 "coords": list(s.coords),
                 "state": s.state.value,
                 "source": s.source,
                 "confidence": s.confidence,
                 "valid_from": s.valid_from,
                 "valid_to": s.valid_to,
                 "interpolation": s.interpolation}
                for s in self._samples
            ],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "PointTube":
        tube = cls(d["tube_id"], d.get("crs", "EPSG:2966"),
                   d.get("vertical_datum", "NAVD88"))
        for s in d.get("samples", []):
            tube.add(TubeSample(
                timestamp=s["timestamp"], coords=tuple(s["coords"]),
                state=StateType(s["state"]), source=s["source"],
                confidence=s["confidence"], valid_from=s["valid_from"],
                valid_to=s["valid_to"], interpolation=s.get("interpolation", "none")))
        return tube
