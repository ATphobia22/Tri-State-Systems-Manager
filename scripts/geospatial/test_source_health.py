"""Tests for scripts/geospatial/source_health.py. Offline, no network."""

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from geospatial.source_health import SourceHealth


def test_success_boosts_weight_proportionally_to_speed():
    h = SourceHealth()
    fast = h.record("a", success=True, latency_ms=50)
    slow = h.record("b", success=True, latency_ms=500)
    assert fast > slow > 1.0
    # reward delta = 0.15 * 1.0 * (1000/50) = 3.0
    assert abs(fast - 4.0) < 1e-9


def test_failure_decays_weight_with_floor():
    h = SourceHealth()
    w = 1.0
    for _ in range(50):
        w = h.record("a", success=False)
    assert w == 0.1  # floored, never zero (exploration preserved)


def test_rank_and_best():
    h = SourceHealth()
    h.record("slow", success=True, latency_ms=900)
    h.record("fast", success=True, latency_ms=40)
    ranked = h.rank()
    assert ranked[0][0] == "fast"
    assert h.best(["slow", "fast"]) == "fast"
    assert h.best(["unknown"]) == "unknown"  # unseen endpoint passes through
    assert h.best([]) is None


def test_persistence_round_trip():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "health.json")
        h = SourceHealth(state_path=path)
        h.record("a", success=True, latency_ms=45.2, reward=1.2)
        h2 = SourceHealth(state_path=path)
        assert h2.weights == h.weights
        assert abs(h2.weights["a"] - (1.0 + 0.15 * 1.2 * (1000 / 45.2))) < 1e-9
