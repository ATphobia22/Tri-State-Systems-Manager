"""
TSM Visualization Plane — PTDT → Archimedes-style displacement → USD stub.
authority_class = VISUALIZATION | SIMULATION_DEMO
Not a HEC-RAS substitute. Does not redefine BFE/LAG/FFE.
"""
from __future__ import annotations
from hashlib import sha256
from time import time
from typing import Any


def process_and_export(
    sequence: int,
    content_hash_sha256: str,
    water_depths: list[float],
    body_volumes: list[float],
    stage_name: str = "TriState_Coupled_Stage",
) -> dict[str, Any]:
    seal = content_hash_sha256.lower().removeprefix("sha256:")
    n = min(len(water_depths), len(body_volumes))
    total_displaced = sum(water_depths[i] * body_volumes[i] for i in range(n))

    usd_payload = f'''#usda 1.0
(
    defaultPrim = "{stage_name}"
    doc = "TSM SIMULATION_DEMO Coupled Archimedes-style SceneState — not regulatory"
)
def Xform "{stage_name}"
{{
    custom double tsm:displacedVolume = {total_displaced}
    custom string tsm:contentHash = "{seal}"
    custom int tsm:sequence = {sequence}
    custom string tsm:authorityClass = "VISUALIZATION"
}}
'''
    leaf = f"{sequence}:{seal}:{total_displaced}:{stage_name}"
    return {
        "sequence": sequence,
        "content_hash_sha256": seal if len(seal) == 64 else sha256(seal.encode()).hexdigest(),
        "displaced_volume_total": total_displaced,
        "usd_stage_payload": usd_payload,
        "authority_class": "VISUALIZATION",
        "is_simulation_demo": True,
        "horizontal_crs": "EPSG:2966",
        "vertical_datum": "NAVD88",
        "derived_id": f"USD-{sha256(leaf.encode()).hexdigest()[:16].upper()}",
        "certified_at": time(),
    }


if __name__ == "__main__":
    import json
    print(json.dumps(process_and_export(1045, "a" * 64, [1.0, 2.0], [10.0, 5.0]), indent=2)[:500])
