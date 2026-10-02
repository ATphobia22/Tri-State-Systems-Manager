"""Pytest bootstrap for the TSM backend test suite.

Ensures the repository root is on ``sys.path`` so that test modules can
``import backend.*`` regardless of the working directory pytest is invoked
from (repo root or ``backend/``).

This fixes the ``ModuleNotFoundError: No module named 'backend'`` collection
errors seen when running ``python -m pytest tests/`` from inside ``backend/``.
"""

from __future__ import annotations

import sys
from pathlib import Path

# backend/conftest.py -> parents[1] is the repo root
REPO_ROOT = Path(__file__).resolve().parents[1]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
