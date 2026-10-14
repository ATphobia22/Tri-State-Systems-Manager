#!/usr/bin/env python3
"""
TSM Building Height Validation Gate v2

A better gate that helps make the system work, then fails closed.

Unlike the v1 gate (simple count: 23,082 or FAIL), this gate:
1. Validates in tiers (completeness, quality, provenance)
2. Gives actionable feedback (exactly what's wrong and how to fix it)
3. Still fails closed if minimum bars aren't met

Tiers:
  TIER 1 - COMPLETENESS: What % of buildings have verified heights?
  TIER 2 - QUALITY: Are heights physically plausible?
  TIER 3 - PROVENANCE: Does every height have source + method?

Each tier has:
  - PASS: Meets the bar, proceed
  - WARN: Below ideal but acceptable with honest labeling
  - FAIL: Below minimum, block the pipeline (fail closed)

Usage:
  python3 building-height-gate-v2.py --geojson <file> --expected 23082
"""

import argparse
import json
import sys


# Minimum bars (fail closed below these)
MIN_COMPLETENESS_PCT = 95.0  # At least 95% must have verified heights
MIN_QUALITY_PCT = 99.0       # At least 99% of heights must be plausible
MIN_PROVENANCE_PCT = 100.0   # 100% of heights must have provenance (no exceptions)

# Ideal targets (warn if below, but don't block)
TARGET_COMPLETENESS_PCT = 99.0
TARGET_QUALITY_PCT = 99.9

# Physical plausibility bounds (meters)
MIN_PLAUSIBLE_HEIGHT_M = 1.0    # Below 1m is likely noise/ground
MAX_PLAUSIBLE_HEIGHT_M = 50.0   # Above 50m in Posey County is suspicious


def validate_geojson(path, expected_count):
    """Run the three-tier validation gate."""
    print("=" * 60)
    print("TSM Building Height Gate v2")
    print("=" * 60)
    print()

    with open(path) as f:
        data = json.load(f)

    features = data.get("features", [])
    actual_count = len(features)

    print(f"Source features: {actual_count} (expected {expected_count})")
    print()

    # Track issues for actionable feedback
    issues = []
    results = {"tiers": {}, "overall": "PENDING", "issues": []}

    # --- TIER 0: Count check ---
    if actual_count != expected_count:
        issues.append({
            "tier": "COUNT",
            "severity": "FAIL",
            "message": f"Feature count mismatch: got {actual_count}, expected {expected_count}",
            "fix": "Check for duplicates or missing features in merge step",
            "affected": abs(actual_count - expected_count),
        })

    # --- TIER 1: COMPLETENESS ---
    print("TIER 1: Completeness")
    print("-" * 40)
    with_height = 0
    missing_ids = []

    for feat in features:
        props = feat.get("properties", {})
        # Check for verified height (not null, not zero, not placeholder)
        h = props.get("height_m") or props.get("derived_height_m")
        fid = props.get("id") or props.get("OBJECTID") or "unknown"

        if h is not None and h > 0:
            with_height += 1
        else:
            missing_ids.append(str(fid))

    completeness_pct = (with_height / actual_count * 100) if actual_count > 0 else 0
    print(f"  Buildings with verified heights: {with_height}/{actual_count} ({completeness_pct:.1f}%)")

    if completeness_pct >= TARGET_COMPLETENESS_PCT:
        tier1 = "PASS"
        print(f"  ✓ PASS (target: {TARGET_COMPLETENESS_PCT}%)")
    elif completeness_pct >= MIN_COMPLETENESS_PCT:
        tier1 = "WARN"
        print(f"  ⚠ WARN (below target {TARGET_COMPLETENESS_PCT}%, above minimum {MIN_COMPLETENESS_PCT}%)")
        print(f"  → Proceed with honest 'unavailable' labels for {len(missing_ids)} buildings")
    else:
        tier1 = "FAIL"
        print(f"  ✗ FAIL (below minimum {MIN_COMPLETENESS_PCT}%)")
        issues.append({
            "tier": "COMPLETENESS",
            "severity": "FAIL",
            "message": f"Only {completeness_pct:.1f}% have heights (need {MIN_COMPLETENESS_PCT}%)",
            "fix": f"Re-run extraction for {len(missing_ids)} missing buildings. "
                   f"Check COPC tile coverage for their locations.",
            "affected": len(missing_ids),
            "sample_missing_ids": missing_ids[:10],
        })

    results["tiers"]["completeness"] = {
        "status": tier1,
        "pct": round(completeness_pct, 2),
        "with_height": with_height,
        "total": actual_count,
    }
    print()

    # --- TIER 2: QUALITY ---
    print("TIER 2: Quality (physical plausibility)")
    print("-" * 40)
    plausible = 0
    implausible = []

    for feat in features:
        props = feat.get("properties", {})
        h = props.get("height_m") or props.get("derived_height_m")
        fid = props.get("id") or props.get("OBJECTID") or "unknown"

        if h is not None and h > 0:
            if MIN_PLAUSIBLE_HEIGHT_M <= h <= MAX_PLAUSIBLE_HEIGHT_M:
                plausible += 1
            else:
                implausible.append({"id": str(fid), "height_m": h})

    quality_pct = (plausible / with_height * 100) if with_height > 0 else 0
    print(f"  Plausible heights ({MIN_PLAUSIBLE_HEIGHT_M}-{MAX_PLAUSIBLE_HEIGHT_M}m): "
          f"{plausible}/{with_height} ({quality_pct:.1f}%)")

    if quality_pct >= TARGET_QUALITY_PCT:
        tier2 = "PASS"
        print(f"  ✓ PASS (target: {TARGET_QUALITY_PCT}%)")
    elif quality_pct >= MIN_QUALITY_PCT:
        tier2 = "WARN"
        print(f"  ⚠ WARN: {len(implausible)} implausible heights need review")
        for imp in implausible[:5]:
            print(f"    - Building {imp['id']}: {imp['height_m']:.1f}m")
    else:
        tier2 = "FAIL"
        print(f"  ✗ FAIL (below minimum {MIN_QUALITY_PCT}%)")
        issues.append({
            "tier": "QUALITY",
            "severity": "FAIL",
            "message": f"Only {quality_pct:.1f}% heights are plausible (need {MIN_QUALITY_PCT}%)",
            "fix": "Review extraction algorithm. Implausible heights suggest "
                   "ground points misclassified as roof, or wrong tile overlap.",
            "affected": len(implausible),
            "sample_implausible": implausible[:10],
        })

    results["tiers"]["quality"] = {
        "status": tier2,
        "pct": round(quality_pct, 2),
        "plausible": plausible,
        "implausible_count": len(implausible),
    }
    print()

    # --- TIER 3: PROVENANCE ---
    print("TIER 3: Provenance (source tracking)")
    print("-" * 40)
    with_provenance = 0
    missing_prov = []

    for feat in features:
        props = feat.get("properties", {})
        h = props.get("height_m") or props.get("derived_height_m")
        fid = props.get("id") or props.get("OBJECTID") or "unknown"

        if h is not None and h > 0:
            # Must have source tile and method
            src = props.get("source_tile") or props.get("copc_tile")
            method = props.get("method") or props.get("height_method")
            if src and method:
                with_provenance += 1
            else:
                missing_prov.append(str(fid))

    prov_pct = (with_provenance / with_height * 100) if with_height > 0 else 0
    print(f"  Heights with full provenance: {with_provenance}/{with_height} ({prov_pct:.1f}%)")

    if prov_pct >= MIN_PROVENANCE_PCT:
        tier3 = "PASS"
        print(f"  ✓ PASS (required: {MIN_PROVENANCE_PCT}%)")
    else:
        tier3 = "FAIL"
        print(f"  ✗ FAIL (required: {MIN_PROVENANCE_PCT}%)")
        issues.append({
            "tier": "PROVENANCE",
            "severity": "FAIL",
            "message": f"Only {prov_pct:.1f}% have provenance (need {MIN_PROVENANCE_PCT}%)",
            "fix": "Every height MUST record its source COPC tile and extraction method. "
                   "No exceptions — this is the audit trail.",
            "affected": len(missing_prov),
            "sample_missing": missing_prov[:10],
        })

    results["tiers"]["provenance"] = {
        "status": tier3,
        "pct": round(prov_pct, 2),
    }
    print()

    # --- FINAL VERDICT ---
    print("=" * 60)
    statuses = [tier1, tier2, tier3]
    # Also check count tier
    count_ok = actual_count == expected_count

    if "FAIL" in statuses or not count_ok:
        overall = "FAIL_CLOSED"
        print("GATE RESULT: ✗ FAIL_CLOSED")
        print()
        print("The pipeline is BLOCKED. Fix the issues above, then re-run.")
        print()
        print("Actionable fixes:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. [{issue['tier']}] {issue['message']}")
            print(f"     Fix: {issue['fix']}")
            if issue.get("affected"):
                print(f"     Affected: {issue['affected']} buildings")
    elif "WARN" in statuses:
        overall = "PASS_WITH_WARNINGS"
        print("GATE RESULT: ⚠ PASS_WITH_WARNINGS")
        print()
        print("Proceed, but label gaps honestly in the UI.")
        print(f"  {len(missing_ids)} buildings will show 'height unavailable'")
    else:
        overall = "PASS"
        print("GATE RESULT: ✓ PASS")
        print()
        print("All tiers green. Proceed to 3D tile generation.")

    print("=" * 60)

    results["overall"] = overall
    results["issues"] = issues
    return results


def main():
    ap = argparse.ArgumentParser(description="TSM Building Height Gate v2")
    ap.add_argument("--geojson", required=True, help="Height-linked GeoJSON file")
    ap.add_argument("--expected", type=int, default=23082, help="Expected feature count")
    ap.add_argument("--json-out", help="Write results JSON to file")
    args = ap.parse_args()

    results = validate_geojson(args.geojson, args.expected)

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults written to {args.json_out}")

    # Exit code: 0 for PASS/WARN, 1 for FAIL_CLOSED
    sys.exit(0 if results["overall"] in ("PASS", "PASS_WITH_WARNINGS") else 1)


if __name__ == "__main__":
    main()
