#!/usr/bin/env python3
"""Audit TSM's UE5.8 plugin declaration without requiring Unreal or a network."""
import argparse
import json
from pathlib import Path

REQUIRED = {"CesiumForUnreal", "SQLiteCore", "SQLiteSupport"}
EDITOR_ONLY = {"PythonScriptPlugin", "EditorScriptingUtilities"}
OPTIONAL_EDITOR = {"PCG", "GeoReferencing"}

def audit(project):
    data = json.loads(Path(project).read_text(encoding="utf-8"))
    plugins = {p["Name"]: p for p in data.get("Plugins", [])}
    errors, warnings = [], []
    if data.get("EngineAssociation") != "5.8":
        errors.append("Expected EngineAssociation 5.8")
    for name in sorted(REQUIRED):
        if not plugins.get(name, {}).get("Enabled", False):
            errors.append(f"Required plugin missing or disabled: {name}")
    for name in sorted(EDITOR_ONLY):
        p = plugins.get(name, {})
        if p.get("Enabled") and "Editor" not in p.get("TargetAllowList", []):
            errors.append(f"Editor automation plugin exposed to Shipping: {name}")
    for name in sorted(OPTIONAL_EDITOR):
        if name not in plugins:
            warnings.append(f"Optional plugin not declared: {name}")
    for name in ("UnrealSharp", "UnrealEnginePython", "Voxel", "FastNoise", "ProceduralDungeon"):
        if plugins.get(name, {}).get("Enabled"):
            warnings.append(f"Third-party runtime plugin requires UE5.8, license and offline audit: {name}")
    return {"status": "FAIL" if errors else "PASS_STATIC_DECLARATION_ONLY",
            "project": str(project), "errors": errors, "warnings": warnings,
            "required": sorted(REQUIRED), "editor_only": sorted(EDITOR_ONLY),
            "note": "Does not establish plugin installation, compilation, asset availability, offline operation or rendering."}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2] / "tsm-native" / "TSMNative.uproject")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(args.project)
    report = json.dumps(result, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report, encoding="utf-8")
    print(report, end="")
    return 1 if result["errors"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
