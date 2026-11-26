#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
USGS OGC API Continuous Data Client — pagination-safe, limit-explicit.
Trap: omitting `limit` returns HTTP 200 with only 10 rows (silent truncation).
Always pass explicit limit, follow `next` links. waterservices decommission 2027-02-22.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Iterator, List, Optional

try:
    import requests
except ImportError:
    requests = None  # type: ignore

LOG = logging.getLogger("usgs_ogc_client")
DEFAULT_BASE = "https://api.waterdata.usgs.gov/ogcapi/v1"
DEFAULT_COLLECTION = "latest-continuous"
DEFAULT_LIMIT = 10000

class UsgsOgcError(RuntimeError):
    pass

class UsgsOgcClient:
    def __init__(self, base_url: str = DEFAULT_BASE, timeout: float = 60.0, max_retries: int = 4, session: Optional[Any] = None) -> None:
        if requests is None:
            raise UsgsOgcError("requests library required: pip install requests")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = session or requests.Session()
        self.session.headers.update({"Accept": "application/json", "User-Agent": "TSM-USGS-OGC-Client/1.0"})

    def _get(self, url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self.session.get(url, params=params, timeout=self.timeout)
                if resp.status_code == 429:
                    time.sleep(min(2 ** attempt, 30))
                    continue
                resp.raise_for_status()
                return resp.json()
            except Exception as exc:
                last_exc = exc
                time.sleep(min(2 ** attempt, 20))
        raise UsgsOgcError(f"Failed after {self.max_retries} retries: {last_exc}")

    def iter_features(self, collection: str = DEFAULT_COLLECTION, limit: int = DEFAULT_LIMIT, **filters: Any) -> Iterator[Dict[str, Any]]:
        if limit is None or int(limit) < 1:
            raise UsgsOgcError("limit is REQUIRED and must be >= 1 (silent 10-row trap)")
        params: Dict[str, Any] = {"limit": int(limit)}
        params.update({k: v for k, v in filters.items() if v is not None})
        url: Optional[str] = f"{self.base_url}/collections/{collection}/items"
        while url:
            payload = self._get(url, params=params)
            params = None  # next URL carries query
            for feat in payload.get("features") or []:
                yield feat
            url = None
            for link in payload.get("links") or []:
                if link.get("rel") == "next" and link.get("href"):
                    url = link["href"]
                    break

    def fetch_all(self, collection: str = DEFAULT_COLLECTION, limit: int = DEFAULT_LIMIT, max_rows: Optional[int] = None, **filters: Any) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for feat in self.iter_features(collection=collection, limit=limit, **filters):
            out.append(feat)
            if max_rows is not None and len(out) >= max_rows:
                break
        return out
