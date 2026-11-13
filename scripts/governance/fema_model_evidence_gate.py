#!/usr/bin/env python3
"""Bounded advisory evidence check; never grants an NFIP regulatory approval.

Based on uploaded FEMA Guidance 98 (Dec 2020), FEMA Rev14, and cHECk-RAS
2.0.1 applicability. External agency certification cannot be inferred by code.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

HASH = re.compile(r"^[0-9a-f]{64}$")
USE = frozenset({"PUBLIC_INFORMATION", "NFIP_REGULATORY"})
ROLE = frozenset({"PREPOST_PROCESSING", "NUMERICAL_MODEL"})
RUN = frozenset({"NONE", "STEADY_1D", "UNSTEADY_1D", "UNSTEADY_2D", "OTHER"})

def _filled(value: object) -> bool:
    return isinstance(value,str) and len(value.strip()) > 0

def _digest(value: object) -> bool:
    return isinstance(value,str) and bool(HASH.fullmatch(value))

def evaluate(item: dict) -> dict:
    if not isinstance(item,dict) or item.get("requestedUse") not in USE:
        raise ValueError("invalid requested use")
    role=item.get("softwareRole")
    run=item.get("runType")
    if role not in ROLE or run not in RUN:
        raise ValueError("invalid software role or run type")
    if role=="PREPOST_PROCESSING" and run!="NONE":
        raise ValueError("pre/post processor cannot claim a native simulation run")
    required=[]
    def need(condition: bool, field: str) -> None:
        if not condition:
            required.append(field)
    if item["requestedUse"]=="NFIP_REGULATORY":
        need(role=="NUMERICAL_MODEL","model must be numerical for a regulatory analysis")
        need(_filled(item.get("modelName")),"modelName")
        need(_filled(item.get("modelVersion")),"modelVersion")
        need(run!="NONE","runType")
        for field in ("terrainSha256","inputSha256","outputSha256"):
            need(_digest(item.get(field)),field)
        need(item.get("verticalDatum")=="NAVD88","verticalDatum=NAVD88")
        need(_filled(item.get("horizontalCrs")),"horizontalCrs")
        evidence=item.get("acceptedModelEvidence")
        if not isinstance(evidence,dict):
            evidence={}
        for field in ("agency","acceptedModelVersion","jurisdiction",
                      "acceptanceReference","acceptanceDocumentSha256"):
            okay=(_digest(evidence.get(field)) if field.endswith("Sha256")
                  else _filled(evidence.get(field)))
            need(okay,"acceptedModelEvidence."+field)
        need(_filled(item.get("effectiveStudyReference")),"effectiveStudyReference")
        need(_filled(item.get("licensedProfessionalReviewReference")),
             "licensedProfessionalReviewReference")
    # The 2013 cHECk-RAS 2.0.1 manual describes only HEC-RAS 4.1.0
    # steady projects. Even a matching legacy version still needs an actual
    # independent cHECk-RAS run to claim a QA result.
    legacy_scope=(role=="NUMERICAL_MODEL" and run=="STEADY_1D"
                  and item.get("modelName")=="HEC-RAS"
                  and item.get("modelVersion")=="4.1.0")
    return {
        "schemaVersion":"tsm.fema-advisory-evidence-gate.v1",
        "requestedUse":item["requestedUse"],
        "softwareRole":role,
        "missingEvidence":sorted(set(required)),
        "reviewReadiness":("READY_FOR_HUMAN_AGENCY_REVIEW"
                           if item["requestedUse"]=="NFIP_REGULATORY" and not required
                           else ("BLOCKED_FOR_REGULATORY_USE" if item["requestedUse"]=="NFIP_REGULATORY"
                                 else "INFORMATIONAL_ONLY")),
        "regulatoryApproved":False,
        "agencyAcceptanceIndependentlyVerified":False,
        "legacyCheckRasScopeCompatible":legacy_scope,
        "legacyCheckRasTestsPerformed":False,
        "sourceGuidance":"FEMA Guidance 98 (2020) §§5-6; Rev14 SIDs 41,42,44,118,120; cHECk-RAS 2.0.1",
        "warning":"Even complete evidence fields do not constitute agency or engineering acceptance.",
    }


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--require-regulatory-ready",action="store_true")
    args=parser.parse_args()
    try:
        if args.output.exists() or args.output.resolve()==args.input.resolve():
            raise ValueError("refuse to overwrite input or prior receipt")
        if not args.input.is_file() or args.input.stat().st_size > 1024*1024:
            raise ValueError("missing or oversized evidence input")
        result=evaluate(json.loads(args.input.read_text()))
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
        print(json.dumps({"readiness":result["reviewReadiness"],"missing":len(result["missingEvidence"])}))
        return (2 if args.require_regulatory_ready and
                result["reviewReadiness"]!="READY_FOR_HUMAN_AGENCY_REVIEW" else 0)
    except (ValueError,OSError,TypeError) as e:
        print("FEMA evidence gate rejected: "+str(e))
        return 2


if __name__=="__main__":
    raise SystemExit(main())
