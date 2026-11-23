"""Optional PhysicsNeMo *checkpoint inference* adapter for TSM.

PhysicsNeMo training is not bundled into the public service. A local operator
must provide a separately trained, SHA-256-allowlisted .mdlus checkpoint and
a provenance-manifested NPZ tensor. Outputs stay SIMULATION/UNVERIFIED until
compared with an independent HEC-RAS or other trusted solver baseline.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            h.update(block)
    return h.hexdigest()


def validate_contract(checkpoint: Path, inputs: Path, contract: dict) -> dict:
    if not isinstance(contract, dict):
        raise ValueError("PHYSICS_CONTRACT_OBJECT_REQUIRED")
    keys = ("modelSha256", "inputSha256", "trainingDataSha256",
            "physicalBaselineAssetId", "horizontalCrs", "verticalDatum",
            "inputUnits", "predictionUnits", "timeStart", "timeEnd",
            "physicsnemoVersion", "modelArchitecture")
    if any(not isinstance(contract.get(k), str) or not contract[k].strip() for k in keys):
        raise ValueError("PHYSICS_PROVENANCE_INCOMPLETE")
    for key in ("modelSha256", "inputSha256", "trainingDataSha256"):
        if len(contract[key]) != 64 or any(c not in "0123456789abcdef" for c in contract[key]):
            raise ValueError("INVALID_PHYSICS_SHA256")
    if contract["horizontalCrs"] not in ("EPSG:4326", "EPSG:2966"):
        raise ValueError("EXPLICIT_PHYSICS_CRS_REQUIRED")
    if contract["verticalDatum"] != "NAVD88":
        raise ValueError("PHYSICS_VERTICAL_DATUM_MUST_BE_EXPLICIT_NAVD88")
    if (checkpoint.is_symlink() or inputs.is_symlink() or
            not checkpoint.is_file() or not inputs.is_file()):
        raise ValueError("MISSING_OR_UNSAFE_PHYSICS_INPUT")
    if checkpoint.suffix != ".mdlus" or inputs.suffix != ".npz":
        raise ValueError("PHYSICS_CHECKPOINT_AND_NPZ_REQUIRED")
    if (file_sha256(checkpoint) != contract["modelSha256"]
            or file_sha256(inputs) != contract["inputSha256"]):
        raise ValueError("PHYSICS_INPUT_SHA_MISMATCH")
    trusted_sha = os.getenv("TSM_TRUSTED_PHYSICSNEMO_SHA256", "")
    if not trusted_sha or trusted_sha != contract["modelSha256"]:
        raise PermissionError("OPERATOR_ALLOWLISTED_CHECKPOINT_SHA_REQUIRED")
    if os.getenv("TSM_ENABLE_PHYSICSNEMO", "") != "1":
        raise PermissionError("OPT_IN_PHYSICSNEMO_WORKER_DISABLED")
    return contract


def predict(checkpoint: Path, inputs: Path, contract_path: Path,
            output_dir: Path, device: str = "cuda") -> dict:
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    validate_contract(checkpoint, inputs, contract)
    if device not in ("cuda", "cpu"):
        raise ValueError("UNSUPPORTED_COMPUTE_DEVICE")
    try:
        import numpy as np
        import torch
        import physicsnemo
    except ImportError as exc:
        raise RuntimeError("PHYSICSNEMO_OPTIONAL_DEPENDENCIES_NOT_INSTALLED") from exc
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA_REQUESTED_BUT_NOT_AVAILABLE")
    with np.load(inputs, allow_pickle=False) as archive:
        if "inputs" not in archive:
            raise ValueError("PHYSICS_NPZ_MISSING_INPUTS")
        values = archive["inputs"]
    if (values.dtype.kind not in "fi" or values.ndim not in (3, 4, 5, 6)
            or values.size > 20_000_000 or values.size == 0
            or not np.isfinite(values).all()):
        raise ValueError("PHYSICS_TENSOR_SHAPE_OR_VALUES_INVALID")
    # Only an explicitly approved local checkpoint can reach the deserializer.
    model = physicsnemo.Module.from_checkpoint(str(checkpoint)).to(device)
    model.eval()
    with torch.no_grad():
        forecast = model(torch.from_numpy(values.astype("float32")).to(device))
    if not isinstance(forecast, torch.Tensor):
        raise ValueError("PHYSICS_MODEL_OUTPUT_NOT_TENSOR")
    prediction = forecast.detach().to("cpu").numpy()
    if (not np.isfinite(prediction).all() or prediction.shape[0] != values.shape[0]
            or prediction.size > 30_000_000):
        raise ValueError("PHYSICS_MODEL_OUTPUT_INVALID")
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"physicsnemo-{contract['modelSha256'][:16]}-{contract['inputSha256'][:16]}.npz"
    if output.exists():
        raise FileExistsError("IMMUTABLE_PHYSICS_OUTPUT_EXISTS")
    np.savez_compressed(output, prediction=prediction)
    evidence = {
        "kind": "MODEL_OUTPUT", "modelFamily": "PHYSICSNEMO",
        "modelSha256": contract["modelSha256"],
        "inputSha256": contract["inputSha256"],
        "outputSha256": file_sha256(output),
        "physicalBaselineAssetId": contract["physicalBaselineAssetId"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "validationStatus": "UNVERIFIED",
        "useClass": "EXPERIMENTAL",
        "regulatoryDetermination": False,
        "contract": contract,
    }
    output.with_suffix(".evidence.json").write_text(
        json.dumps(evidence,indent=2,sort_keys=True), encoding="utf-8")
    return {"output": str(output), "evidence": str(output.with_suffix(".evidence.json")),
            "sha256": evidence["outputSha256"], "status": "SIMULATION_UNVERIFIED"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--contract", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--device", choices=("cuda", "cpu"), default="cuda")
    args = parser.parse_args()
    print(json.dumps(predict(args.checkpoint, args.inputs, args.contract,
                             args.output, args.device), indent=2))


if __name__ == "__main__":
    main()
