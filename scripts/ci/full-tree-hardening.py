#!/usr/bin/env python3
"""Repository-wide production hardening gate.

This gate intentionally checks policy, not application semantics. It is dependency-free
so it can run before Node/Python package installation.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
TEXT_EXTENSIONS = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs", ".yml", ".yaml", ".json", ".toml", ".ini", ".env", ".sh", ".ps1", ".sql", ".md"}
PRODUCTION_CREDENTIAL_LITERALS = (
    "password=sovereign_pass",
    "password=secure_pass",
    "password=secure_dev_pass_v35",
    "POSTGRES_PASSWORD: sovereign_pass",
)
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----"),
    re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
)
UNSAFE_RUNTIME_PATTERNS = (
    re.compile(r"\bprivileged\s*:\s*true\b", re.I),
    re.compile(r"\bnetwork_mode\s*:\s*host\b", re.I),
    re.compile(r"\bFROM\s+[^\s]+:latest\b", re.I),
    re.compile(r"\bimage:\s*[^\s]+:latest\b", re.I),
)
errors: list[str] = []

def text_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "node_modules" in path.parts:
            continue
        if path.suffix.lower() in TEXT_EXTENSIONS or path.name in {"Dockerfile", "compose.yaml", "docker-compose.yml"}:
            yield path

def check_secret_literals() -> None:
    for path in text_files():
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative in {'scripts/ci/full-tree-hardening.py', 'scripts/ci/validate-security-boundary.mjs'} or relative.startswith('docs/archive/drive-import/'):
            continue
        normalized = text.lower()
        for literal in PRODUCTION_CREDENTIAL_LITERALS:
            if literal.lower() in normalized:
                # CI fixture values are permitted only in the dedicated verification workflow.
                if path.as_posix().endswith(".github/workflows/tsm-subsurface-verification.yml") and "tsm_ci_postgis_local" in normalized:
                    continue
                errors.append(f"production credential literal: {path.relative_to(ROOT)}")

        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                # Placeholder documentation containing ellipses is not a credential.
                if "..." in text and path.parts[-2:] == ("drive-import", path.name):
                    continue
                errors.append(f"credential material pattern: {path.relative_to(ROOT)}")

def check_runtime_policies() -> None:
    for path in text_files():
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith('docs/archive/drive-import/'):
            continue
        for pattern in UNSAFE_RUNTIME_PATTERNS:
            if pattern.search(text):
                errors.append(f"unsafe runtime policy: {path.relative_to(ROOT)} matches {pattern.pattern}")

def check_workflow_permissions() -> None:
    if not WORKFLOWS.exists():
        errors.append("missing .github/workflows")
        return
    for path in WORKFLOWS.glob("*.y*ml"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"^permissions:\s*$", text, re.MULTILINE) is None:
            errors.append(f"workflow missing explicit permissions: {path.relative_to(ROOT)}")
        if "pull_request_target:" in text and "actions/checkout" in text:
            errors.append(f"pull_request_target workflow requires manual security review: {path.relative_to(ROOT)}")

def check_required_boundaries() -> None:
    required = (
        "integrations/unity-mcp/gateway.mjs",
        "tsm-console/server/routing/osrm-client.mjs",
        "integrations/third-party-toolchain.json",
        "scripts/ci/validate-action-pins.mjs",
        "tsm-console/scripts/check-client-bundle-secrets.mjs",
    )
    for relative in required:
        if not (ROOT / relative).exists():
            errors.append(f"required hardening boundary missing: {relative}")

def main() -> int:
    check_secret_literals()
    check_runtime_policies()
    check_workflow_permissions()
    check_required_boundaries()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        print(f"full-tree hardening FAILED: {len(errors)} violation(s)")
        return 1
    print("full-tree hardening PASSED: credential, runtime-policy, workflow-permission, and boundary checks are clean")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
