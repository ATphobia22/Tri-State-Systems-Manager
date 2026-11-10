"""Source catalog and CLI contract tests; no network or external GIS is required."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.geospatial.source_discovery import read_catalog

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "geospatial" / "stage-incident-layer.py"


def test_registry_catalog_is_discovery_not_ingestion():
    result = read_catalog()
    assert result["schema"] == "tsm.geospatial-upstream-discovery.v1"
    assert result["status"] == "DISCOVERY_METADATA_ONLY_NO_FETCH"
    assert result["checkedAt"] is None
    assert result["modelOrRegulatoryValidation"] is False
    assert len(result["officialSources"]) >= 10
    assert len(result["upstreamCandidates"]) >= 60
    assert all(x["decision"] and not x["codeCopied"] and not x["bundled"]
               for x in result["upstreamCandidates"])
    assert all(x["url"].startswith("https://") for x in result["officialSources"])
    assert len(result["recordSha256"]) == 64


def test_registry_api_wired():
    r = TestClient(app).get("/api/geospatial/source-discovery")
    assert r.status_code == 200
    assert r.json()["status"] == "DISCOVERY_METADATA_ONLY_NO_FETCH"


def test_staging_cli_requires_review_and_preserves_offline_evidence(tmp_path):
    source = tmp_path / "bridge.geojson"
    source.write_text(json.dumps({"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"name": "Bridge A", "owner": "private"},
        "geometry": {"type": "Point", "coordinates": [-88.05, 37.91]}
    }]}), encoding="utf-8")
    root = tmp_path / "output"
    base = [
        sys.executable, str(SCRIPT),
        "--root", str(root), "--source-file", str(source),
        "--id", "bridge-a", "--title", "Bridge example",
        "--source-agency", "Operator sample data",
        "--source-url", "https://example.org/test",
        "--source-license", "Example-only",
        "--acquired-at", "2026-11-10T00:00:00Z",
        "--attribution", "Example fixture",
        "--authority", "CONTEXT", "--style", "circle",
        "--display-field", "name"
    ]
    blocked = subprocess.run(base, capture_output=True, text=True)
    assert blocked.returncode == 2 and not root.exists()
    dry = subprocess.run(base + ["--license-reviewed", "--approved-for-display", "--dry-run"],
                         capture_output=True, text=True)
    assert dry.returncode == 0 and not root.exists()
    result = subprocess.run(base + ["--license-reviewed", "--approved-for-display"],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    staging = json.loads(result.stdout)
    assert staging["status"] == "STAGED_LOCAL_REQUIRES_HUMAN_RUNTIME_REVIEW"
    stored = root / "bridge-a.geojson"
    assert hashlib.sha256(stored.read_bytes()).hexdigest() == staging["source_sha256"]
    rerun = subprocess.run(base + ["--license-reviewed", "--approved-for-display"],
                           capture_output=True, text=True)
    assert rerun.returncode == 2
    assert len(list(root.glob("*.geojson"))) == 1
