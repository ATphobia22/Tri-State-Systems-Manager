#!/usr/bin/env python3
"""Regression tests for conservative geometric-error policy on empty HLOD nodes."""
from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("build-hlod-tileset.py")
SPEC = importlib.util.spec_from_file_location("hlod_tileset", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

FALLBACK_ERROR_M = 12.0


def make_item(source_id: int, x: float, y: float, error: float):
    bounds = [x, y, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
    tile = {
        "boundingVolume": {"box": bounds},
        "geometricError": error,
        "content": {"uri": f"source-{source_id}.glb"},
        "extras": {"tsm": {"sourceObjectId": source_id}},
    }
    center = MODULE.V(x, y, 0.0)
    lo = MODULE.V(x - 1.0, y - 1.0, -1.0)
    hi = MODULE.V(x + 1.0, y + 1.0, 1.0)
    return MODULE.Item(tile=tile, sid=source_id, center=center, lo=lo, hi=hi)


def walk(node: dict):
    yield node
    for child in node.get("children", []):
        yield from walk(child)


def make_hierarchy():
    # Multiple quadrants and at least one deeper branch exercise spatial partitioning.
    coords = [
        (0.0, 0.0), (2.0, 2.0), (8.0, 2.0), (10.0, 0.0),
        (0.0, 10.0), (2.0, 8.0), (8.0, 8.0), (10.0, 10.0),
    ]
    errors = [0.0, 0.25, 0.0, 1.5, 0.0, 0.0, 3.0, 0.0]
    items = [make_item(index + 1, x, y, errors[index])
             for index, (x, y) in enumerate(coords)]
    return MODULE.Q(items, 0, max_items=1, max_depth=4, fallback_error=FALLBACK_ERROR_M), items


def test_contentless_nodes_use_conservative_fallback() -> None:
    hierarchy, source_items = make_hierarchy()
    root = hierarchy.tile(FALLBACK_ERROR_M)
    nodes = list(walk(root))
    empty_nodes = [node for node in nodes if "content" not in node]
    assert len(empty_nodes) > 1, "fixture must exercise nested contentless nodes"
    for node in empty_nodes:
        assert node["geometricError"] >= FALLBACK_ERROR_M, (
            "an empty internal node must not lower its traversal error by tree depth"
        )
    source_by_id = {item.sid: item.tile["geometricError"] for item in source_items}
    actual_by_id = {
        node["extras"]["tsm"]["sourceObjectId"]: node["geometricError"]
        for node in nodes
        if "content" in node and "extras" in node
    }
    assert actual_by_id == source_by_id, "source leaf errors must be preserved"


def test_errors_are_validated_and_deterministic() -> None:
    first, _ = make_hierarchy()
    second, _ = make_hierarchy()
    assert first.tile(FALLBACK_ERROR_M) == second.tile(FALLBACK_ERROR_M)

    for bad in (-1.0, math.nan, math.inf, True):
        hierarchy, items = make_hierarchy()
        items[0].tile["geometricError"] = bad
        try:
            MODULE.Q(items, 0, max_items=1, max_depth=4,
                     fallback_error=FALLBACK_ERROR_M)
        except ValueError:
            pass
        else:
            raise AssertionError(f"invalid source geometricError should reject: {bad!r}")

    for bad_fallback in (-1.0, math.nan, math.inf, True):
        try:
            MODULE.Q([], 0, max_items=1, max_depth=4, fallback_error=bad_fallback)
        except ValueError:
            pass
        else:
            raise AssertionError(f"invalid fallback should reject: {bad_fallback!r}")


if __name__ == "__main__":
    test_contentless_nodes_use_conservative_fallback()
    test_errors_are_validated_and_deterministic()
    print("HLOD geometric-error regression: PASS")
