#!/usr/bin/env python3
"""
TSM Tri-State × OpenHydroNet adapter.

Integrates Google's open-source FloodHub hydrological models
(https://github.com/googlehydrology/googlehydrology, fork of NeuralHydrology,
Apache-2.0) into the TSM flood-forecasting pipeline.

Integration strategy: REFERENCE, not vendored. The framework lives at
$OPENHYDRONET_HOME (default ~/workspace/tmp-pulls/openhydronet). This script
adds that directory to sys.path, verifies the Apache-2.0 LICENSE, loads the
TSM tri-state run configuration (scripts/flood-forecasting/
tsm-tristate-openhydronet-config.yml), and executes a genuine smoke run:
instantiate MeanEmbeddingForecastLSTM (the operational FloodHub architecture,
Gauch et al. 2025 HESS 29(21):6221-6235) and run a forward pass.

Smoke-run inputs are SYNTHETIC — clearly labeled in output — because the
production data stack (Caravan-scale forcings, delineated catchments,
drainage-area-normalized targets, Caravan-pretrained weights) is not yet
built. NOT DONE yet (see status labels in output and FORK-INTEGRATIONS.md):
  - delineating the three tri-state catchments (3DEP DEM → outlet polygons)
  - static attribute table (SSURGO / 3DEP / TESSERA / PRISM)
  - dynamic forcing stack (NOAA CPC / IMERG / RTMA, ERA5-Land hindcast)
  - transfer learning from Caravan-pretrained weights (phase 1 of the config)
  - training the model on tri-state gages (phase 2)

Labels used: VERIFIED (real, checked), SYNTHETIC (random/lab data, clearly
marked), PROVISIONAL (unverified placeholder), UNAVAILABLE (cannot do yet).

Resilient behavior only: a missing framework or config never aborts the
pipeline silently — this script exits non-zero with an honest status message
and run_all.py treats it as a skipped step. Fail-closed is banned by policy.

Usage:
  python openhydronet_tristate.py              # smoke run (synthetic input)
  python openhydronet_tristate.py --check      # only verify framework presence
  python run_all.py --step openhydronet        # via the orchestrator
"""

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

DEFAULT_OPENHYDRONET_HOME = Path(
    os.environ.get(
        "OPENHYDRONET_HOME",
        str(Path.home() / "workspace" / "tmp-pulls" / "openhydronet"),
    )
)


def resolve_framework(home: Path | None = None) -> tuple[Path | None, str]:
    """Locate the OpenHydroNet clone and verify its Apache-2.0 license.

    Returns (path, status). Status is 'verified' only when the LICENSE file
    mentions the Apache License; otherwise 'unavailable' with a reason.
    """
    home = home or DEFAULT_OPENHYDRONET_HOME
    if not home.is_dir():
        return None, (
            f"UNAVAILABLE: OPENHYDRONET_HOME not found at {home}. "
            "Set OPENHYDRONET_HOME to a clone of "
            "https://github.com/googlehydrology/googlehydrology"
        )
    license_file = home / "LICENSE"
    if license_file.is_file() and "Apache License" in license_file.read_text(
        errors="replace"
    ):
        pkg = home / "googlehydrology" / "__init__.py"
        if pkg.is_file():
            return home, "verified"
        return None, f"UNAVAILABLE: {home} lacks the googlehydrology package."
    return None, f"UNAVAILABLE: {home}/LICENSE is not the Apache-2.0 license."


def smoke_config(seq_length: int = 30, lead_time: int = 3, run_dir: str = "") -> dict:
    """Minimal framework Config for a CPU smoke run.

    Mirrors the tri-state config's architecture (mean_embedding_forecast_lstm,
    regression head) at toy scale. dev_mode=True lets the framework's Config
    accept this trimmed-down key set. run_dir must contain a scaler file
    because BaseModel always loads one (we write an identity scaler there).
    """
    return {
        "dev_mode": True,
        "experiment_name": "tsm-tristate-smoke",
        "run_dir": run_dir or "./runs/tsm-tristate-smoke",
        "model": "mean_embedding_forecast_lstm",
        "hidden_size": 32,
        "seq_length": seq_length,
        "lead_time": lead_time,
        "forecast_overlap": seq_length,
        "timestep_counter": False,
        "compile": False,
        "head": "regression",
        "output_activation": "linear",
        "output_dropout": 0.0,
        "initial_forget_bias": 3.0,
        "weight_init_opts": ["lstm-ih-xavier", "lstm-hh-orthogonal", "fc-xavier"],
        "target_variables": ["streamflow"],
        # Two placeholder static attributes; the production table comes from
        # SSURGO/3DEP/TESSERA/PRISM (see config yml, section 2).
        "static_attributes": ["drainage_area_km2", "mean_elevation_m"],
        # Two placeholder dynamic features in one shared group so the
        # framework's masked-mean embedding path is exercised on both sides.
        "hindcast_inputs": {"meteo": ["precipitation_mm_d", "temperature_c"]},
        "forecast_inputs": {"meteo": ["precipitation_mm_d", "temperature_c"]},
        "statics_embedding": {
            "type": "fc",
            "hiddens": [16, 8],
            "activation": ["tanh", "linear"],
            "dropout": 0.0,
        },
        "hindcast_embedding": {
            "type": "fc",
            "hiddens": [16, 8],
            "activation": ["tanh", "linear"],
            "dropout": 0.0,
        },
        "forecast_embedding": {
            "type": "fc",
            "hiddens": [16, 8],
            "activation": ["tanh", "linear"],
            "dropout": 0.0,
        },
    }


def load_tristate_yml() -> dict:
    """Parse the repo's tri-state OpenHydroNet config for reference metadata."""
    yml = SCRIPT_DIR / "tsm-tristate-openhydronet-config.yml"
    if not yml.is_file():
        return {"status": "missing", "path": str(yml)}
    try:
        import yaml

        spec = yaml.safe_load(yml.read_text())
    except Exception as e:  # resilient: report, don't crash
        return {"status": "unparseable", "path": str(yml), "error": str(e)}
    return {
        "status": "parsed",
        "experiment_name": spec.get("experiment_name"),
        "model": spec.get("model"),
        "basins": [
            {
                "basin_id": b.get("basin_id"),
                "name": b.get("name"),
                "usgs_gage": b.get("usgs_gage"),
                "nws_gage": b.get("nws_gage"),
            }
            for b in spec.get("basins", [])
        ],
        "forecast_horizons": spec.get("forecast_horizons"),
        "note": "architectural reference only — full training needs the "
        "production data stack (see FORK-INTEGRATIONS.md)",
    }


def write_identity_scaler(run_dir: Path, features: list[str]) -> Path:
    """Write a genuine identity scaler (legacy scaler.nc format).

    BaseModel's constructor always runs Scaler.load() from run_dir, so the
    smoke run needs a real scaler file. This one is center=0/scale=1 for every
    feature — i.e. a no-op normalization — and is labeled SYNTHETIC because it
    was NOT computed from real forcing/target data. Production training must
    compute a real scaler from the tri-state data stack.
    """
    import numpy as np
    import pandas as pd
    import xarray as xr

    param_index = pd.Index(["center", "scale", "mean", "std"], name="parameter")
    values = np.array([0.0, 1.0, 0.0, 1.0], dtype=np.float64)
    names = features + [f"{f}_obs" for f in features] + [f"{f}_sim" for f in features]
    ds = xr.Dataset(
        {
            name: xr.DataArray(
                values, dims=["parameter"], coords={"parameter": param_index}, name=name
            )
            for name in names
        }
    )
    run_dir.mkdir(parents=True, exist_ok=True)
    out = run_dir / "scaler.nc"
    ds.to_netcdf(out, engine="scipy")
    return out


def smoke_run(seq_length: int = 30, lead_time: int = 3, seed: int = 20261023) -> dict:
    """Execute the genuine smoke run: instantiate + forward pass on synthetic input."""
    try:
        import torch
    except ImportError as e:
        return {"status": "UNAVAILABLE", "reason": f"torch not installed: {e}"}

    home, status = resolve_framework()
    if home is None:
        return {"status": "UNAVAILABLE", "reason": status}

    sys.path.insert(0, str(home))
    try:
        from googlehydrology.utils.config import Config
        from googlehydrology.modelzoo import get_model
        from googlehydrology import __about__ as about  # noqa: F401
    except Exception as e:
        return {"status": "UNAVAILABLE", "reason": f"import failed: {e}"}

    cfg_dict = smoke_config(seq_length, lead_time)
    import tempfile

    # BaseModel requires a scaler file in run_dir. Use a temporary dir and a
    # genuine (but SYNTHETIC, identity) scaler — never a real one.
    tmp_run_dir = Path(tempfile.mkdtemp(prefix="tsm-openhydronet-smoke-"))
    features = (
        list(cfg_dict["static_attributes"])
        + cfg_dict["hindcast_inputs"]["meteo"]
        + cfg_dict["target_variables"]
    )
    write_identity_scaler(tmp_run_dir, features)
    cfg_dict["run_dir"] = str(tmp_run_dir)
    cfg = Config(cfg_dict, dev_mode=True)
    model = get_model(cfg)
    model.eval()

    torch.manual_seed(seed)
    batch, seq = 2, seq_length
    # SYNTHETIC input: random tensors, explicitly labeled — NOT real gage data.
    data = {
        "x_s": torch.rand(batch, len(cfg.static_attributes)),
        "x_d_hindcast": {
            f: torch.rand(batch, seq, 1)
            for f in cfg.hindcast_inputs["meteo"]
        },
        "x_d_forecast": {
            f: torch.rand(batch, seq, 1)
            for f in cfg.forecast_inputs["meteo"]
        },
    }
    with torch.no_grad():
        out = model(data)

    n_params = sum(p.numel() for p in model.parameters())
    outputs = {}
    for key, tensor in out.items():
        outputs[key] = {
            "shape": list(tensor.shape),
            "all_finite": bool(torch.isfinite(tensor).all().item()),
            # Values are from SYNTHETIC input — meaningless hydrologically.
            "label": "SYNTHETIC",
        }

    return {
        "status": "VERIFIED",
        "framework": {
            "path": str(home),
            "license": "Apache-2.0 (verified in LICENSE)",
            "model": type(model).__name__,
            "parameters": n_params,
        },
        "input": {
            "label": "SYNTHETIC",
            "batch": batch,
            "seq_length": seq,
            "lead_time": lead_time,
            "static_attributes": list(cfg.static_attributes),
            "dynamic_groups": dict(cfg.hindcast_inputs),
        },
        "outputs": outputs,
        "tristate_config": load_tristate_yml(),
        "not_done": [
            "catchment delineation for the 3 tri-state basins (3DEP DEM)",
            "static attribute table (SSURGO/3DEP/TESSERA/PRISM)",
            "dynamic forcing stack (CPC/IMERG/RTMA + ERA5-Land hindcast)",
            "Caravan-pretrained weights (transfer-learning phase 1)",
            "training on tri-state gage targets (phase 2)",
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="TSM × OpenHydroNet adapter")
    ap.add_argument(
        "--check",
        action="store_true",
        help="Only verify the framework is present (no model run).",
    )
    ap.add_argument(
        "--json",
        action="store_true",
        help="Emit the result as JSON (for run_all.py / tests).",
    )
    ap.add_argument("--seq-length", type=int, default=30)
    ap.add_argument("--lead-time", type=int, default=3)
    args = ap.parse_args()

    if args.check:
        home, status = resolve_framework()
        ok = home is not None
        print("OpenHydroNet:", "VERIFIED at " + str(home) if ok else status)
        return 0 if ok else 1

    try:
        result = smoke_run(seq_length=args.seq_length, lead_time=args.lead_time)
    except Exception as e:  # resilient: honest failure, never a silent block
        result = {"status": "UNAVAILABLE", "reason": f"smoke run raised: {e}"}

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print("=" * 60)
        print("OpenHydroNet × TSM tri-state — smoke run")
        print("=" * 60)
        print(f"  status:  {result['status']}")
        if result["status"] == "VERIFIED":
            fw = result["framework"]
            print(f"  framework: {fw['path']} ({fw['license']})")
            print(f"  model:     {fw['model']} — {fw['parameters']:,} params")
            inp = result["input"]
            print(
                f"  input:     {inp['label']} "
                f"(batch={inp['batch']}, seq={inp['seq_length']}, "
                f"lead={inp['lead_time']})"
            )
            for key, o in result["outputs"].items():
                print(
                    f"  output '{key}': shape={o['shape']} "
                    f"all_finite={o['all_finite']} [{o['label']}]"
                )
            tc = result["tristate_config"]
            print(f"  tristate yml: {tc['status']}")
            if tc["status"] == "parsed":
                print(f"    experiment: {tc['experiment_name']} "
                      f"(arch: {tc['model']})")
                print(f"    basins: {', '.join(b['basin_id'] for b in tc['basins'])}")
            print("  NOT DONE (production training needs):")
            for item in result["not_done"]:
                print(f"    - {item}")
        else:
            print(f"  reason: {result.get('reason')}")
        print("=" * 60)

    return 0 if result["status"] == "VERIFIED" else 1


if __name__ == "__main__":
    sys.exit(main())
