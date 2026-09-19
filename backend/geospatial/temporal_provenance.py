"""Temporal provenance primitives shared by source and derived artifacts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


def _aware(value: datetime, field: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    return value.astimezone(timezone.utc)


@dataclass(frozen=True, slots=True)
class TemporalProvenance:
    valid_time: datetime
    knowledge_time: datetime
    change_time: datetime | None = None

    def __post_init__(self) -> None:
        valid = _aware(self.valid_time, "valid_time")
        knowledge = _aware(self.knowledge_time, "knowledge_time")
        change = None if self.change_time is None else _aware(self.change_time, "change_time")
        if change is not None and change > knowledge:
            raise ValueError("change_time cannot be later than knowledge_time")
        object.__setattr__(self, "valid_time", valid)
        object.__setattr__(self, "knowledge_time", knowledge)
        object.__setattr__(self, "change_time", change)
