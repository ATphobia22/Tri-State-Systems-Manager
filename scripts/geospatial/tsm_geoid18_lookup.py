#!/usr/bin/env python3
"""
GEOID18 geoid height (N) lookup helpers for TSM.

Preferred path: operator runs NGS intg interactively or uses NGS web computation.
This script optionally automates intg.exe via stdin — verify output against
interactive NGS results before batch production use.

Does NOT implement unverified direct binary seeks as a default.
"""

from __future__ import annotations

import argparse
import logging
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("TSM-GEOID18Lookup")

# CONUS geoid height sanity window (meters) — not a Posey constant
N_MIN, N_MAX = -60.0, 20.0


def parse_geoid_height_from_text(text: str) -> Optional[float]:
    """Best-effort parse of N from intg-like stdout."""
    candidates: List[float] = []
    for line in text.splitlines():
        # Prefer labeled lines
        if re.search(r"geoid\s*height|\bN\s*=", line, re.I):
            for tok in re.findall(r"[-+]?\d+\.\d+", line):
                val = float(tok)
                if N_MIN <= val <= N_MAX:
                    candidates.append(val)
    if candidates:
        return candidates[-1]
    # Fallback: last in-range float in output
    for tok in re.findall(r"[-+]?\d+\.\d+", text):
        val = float(tok)
        if N_MIN <= val <= N_MAX:
            candidates.append(val)
    return candidates[-1] if candidates else None


def query_intg(
    lat: float,
    lon: float,
    intg_exe: Path,
    grid_bin: Path,
    decimal_degrees_code: str = "D",
) -> float:
    if not intg_exe.is_file():
        raise FileNotFoundError(f"intg executable not found: {intg_exe}")
    if not grid_bin.is_file():
        raise FileNotFoundError(f"GEOID18 grid not found: {grid_bin}")

    # Prompt sequence is NGS-version dependent. Operators must validate once interactively.
    payload = f"{grid_bin.name}\n{decimal_degrees_code}\n{lat} {lon}\n"
    result = subprocess.run(
        [str(intg_exe)],
        input=payload,
        text=True,
        capture_output=True,
        cwd=str(intg_exe.parent),
        check=False,
    )
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    if result.returncode != 0:
        logger.error("intg exited %s\n%s", result.returncode, combined)
        raise RuntimeError("intg execution failed")

    n = parse_geoid_height_from_text(combined)
    if n is None:
        raise RuntimeError(
            "Could not parse geoid height from intg output. "
            "Run intg interactively and pass --geoid-offset-m manually.\n"
            + combined
        )
    logger.info("Lat %s Lon %s -> N = %s m (parsed from intg)", lat, lon, n)
    return n


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--lat", type=float, default=37.84589)
    p.add_argument("--lon", type=float, default=-88.00510)
    p.add_argument(
        "--intg",
        type=Path,
        default=Path("data/raw_hydro/geoid18/intg.exe"),
    )
    p.add_argument(
        "--grid",
        type=Path,
        default=Path("data/raw_hydro/geoid18/g2018u0.bin"),
    )
    args = p.parse_args(argv)

    try:
        n = query_intg(args.lat, args.lon, args.intg, args.grid)
        print(f"{n:.4f}")
        return 0
    except Exception as e:  # noqa: BLE001
        logger.error("%s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
