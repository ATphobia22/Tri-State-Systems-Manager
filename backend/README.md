# TSM Companion API (FastAPI)

A minimal, real FastAPI service that lives alongside — not inside — the Node
API in `tsm-console/server`. It handles evidence-packet intake and
hydrologic-node reads as a separate process.

## Run

```bash
cd <repo-root>
python3 -m pip install -r backend/requirements.txt   # includes fastapi, uvicorn
TSM_REPO_ROOT=$(pwd) python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8790
```

Health check: `curl http://127.0.0.1:8790/health`

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe |
| POST | `/api/evidence/push` | Validate packet SHA-256 + schema, write to local outbox, return signed intake receipt (202). 422 fail-closed on invalid. **The receipt is intake-only; it never claims FEMA submission.** |
| GET | `/api/hydrologic/nodes` | Serve the USACE hydrologic node registry example (`data/schemas/examples/usace-hydrologic-node.example.json`). Read-only. |
| POST | `/api/webhooks/gauge-ingest` | Accept gauge reading arrays into quarantine with per-reading provenance hashes (202). Always `human_review_required: true`. |

## Relation to the Node API

`tsm-console/server/token-proxy.mjs` is the primary TSM API (auth, proxying,
engineering routes). This companion service does not replace it and is not
wired into it. It exists because some integrations (evidence intake pipelines,
Python-based model tooling) are easier to serve from Python. If you need both,
run them side by side on different ports.

## Governing axiom

"Technology informs people; it does not silently govern people. Human
authority remains final." This service is provisional intake tooling only.

## Tests

```bash
python3 -m pytest backend/tests/test_api.py -v
```
