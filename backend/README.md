# TSM Companion API (FastAPI)

A minimal, real FastAPI service that lives alongside — not inside — the Node
API in `tsm-console/server`. It handles evidence-packet intake, hydrologic-node reads, bounded Posey geospatial reads, HEC-RAS model-output intake, and a fail-closed human-authorization ledger boundary as a separate process.

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
| POST | `/evidence/lock-packet` | Validate explicit site/model elevations, calculate freeboard, and emit a hashed evidence-lock artifact. Human authorization remains explicit and the response never represents a FEMA determination. |
| GET | `/api/geospatial/posey/manifest` | Return the registered Posey 2020 asset manifest and CRS/provenance metadata. |
| GET | `/api/geospatial/posey/raster` | Stream bounded Posey terrain/orthophoto imagery only from allowlisted HTTPS sources; AOI, dimensions, pixel count, redirects, content type, and response bytes are fail-closed. |
| POST | `/api/engineering/ras-results` | Validate and persist operator-supplied HEC-RAS depth cells as provisional MODEL_OUTPUT evidence. Maximum 100,000 cells; no regulatory status is inferred. |
| POST | `/api/ledger/append` | Append an accepted model artifact to the local audit ledger only after a configured human reviewer allowlist authorizes it. Fails closed when `TSM_REVIEWER_SUBJECTS` is absent or the reviewer is unauthorized. |

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


## API hardening contract

The API surface is now treated as executable contract rather than documentation. Every documented FastAPI endpoint appears in the generated OpenAPI schema and has a regression test for route presence or fail-closed validation.

### Security boundaries

- Posey raster access is restricted to the registered site bounds and two HTTPS upstream hosts: Indiana geospatial imagery and the federal imagery geoplatform.
- Raster requests are bounded to 256–4096 pixels per dimension, 12 million pixels total, and 128 MiB of streamed response data.
- Redirects and JSON/text responses from raster upstreams are rejected.
- HEC-RAS results remain MODEL_OUTPUT/DERIVATION; the API does not convert model output into a regulatory determination.
- HEC-RAS payloads are capped at 100,000 cells and persist with both the supplied source-file SHA-256 and a canonical-payload SHA-256.
- Ledger mutation is fail-closed until TSM_REVIEWER_SUBJECTS is explicitly configured. Human authorization is required and recorded; the ledger does not represent agency approval.
- No endpoint guesses CRS or vertical datum. Posey raster responses expose the registered CRS and whether the manifest has verified vertical-datum metadata.
