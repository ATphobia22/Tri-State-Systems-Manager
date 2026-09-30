"""Adaptive source weighting for data-acquisition scripts.

Tracks per-endpoint latency and success/failure outcomes, and ranks sources
so acquisition prefers fast, reliable endpoints. This is the honest core of
the "adaptive webhook" idea: a reward-weighted scorer with a floor that
preserves exploration. There is no quantum computation involved — a classical
simulation of Grover's algorithm provides no speedup over weighted ranking,
so none is used here.

Update rule (per recorded outcome on endpoint i):
    reward = learning_rate * r * (1000 / max(latency_ms, 10))   if success
    reward = -learning_rate * 0.5                                if failure
    weight[i] = max(floor, weight[i] + reward)

where r = +1.0 (success) or -1.0 (failure). Weights persist to JSON so
repeated acquisition runs learn which official endpoints are healthy.
"""

from __future__ import annotations

import json
import os
import time

DEFAULT_LEARNING_RATE = 0.15
DEFAULT_FLOOR = 0.1


class SourceHealth:
    """Latency/reward-weighted ranking of acquisition endpoints."""

    def __init__(
        self,
        state_path: str | None = None,
        learning_rate: float = DEFAULT_LEARNING_RATE,
        floor: float = DEFAULT_FLOOR,
    ) -> None:
        self.state_path = state_path
        self.learning_rate = learning_rate
        self.floor = floor
        self.weights: dict[str, float] = {}
        self.events: list[dict] = []
        if state_path and os.path.exists(state_path):
            self._load()

    def record(self, endpoint: str, *, success: bool,
               latency_ms: float = 100.0, reward: float = 1.0) -> float:
        """Record one outcome; return the endpoint's updated weight."""
        if success:
            delta = self.learning_rate * reward * (1000.0 / max(latency_ms, 10.0))
        else:
            delta = -self.learning_rate * 0.5
        weight = max(self.floor, self.weights.get(endpoint, 1.0) + delta)
        self.weights[endpoint] = weight
        self.events.append(
            {
                "ts": time.time(),
                "endpoint": endpoint,
                "success": success,
                "latency_ms": latency_ms,
                "reward": reward,
                "delta": delta,
                "weight": weight,
            }
        )
        if self.state_path:
            self._save()
        return weight

    def rank(self) -> list[tuple[str, float]]:
        """Endpoints ordered best-first by current weight."""
        return sorted(self.weights.items(), key=lambda kv: kv[1], reverse=True)

    def best(self, endpoints: list[str]) -> str | None:
        """Pick the highest-weighted endpoint among candidates (ties -> first)."""
        ranked = [e for e in self.rank() if e[0] in endpoints]
        if ranked:
            return ranked[0][0]
        return endpoints[0] if endpoints else None

    def _load(self) -> None:
        assert self.state_path is not None
        with open(self.state_path) as f:
            data = json.load(f)
        self.weights = {k: float(v) for k, v in data.get("weights", {}).items()}

    def _save(self) -> None:
        assert self.state_path is not None
        tmp = self.state_path + ".tmp"
        with open(tmp, "w") as f:
            json.dump({"weights": self.weights}, f, indent=2)
        os.replace(tmp, self.state_path)
