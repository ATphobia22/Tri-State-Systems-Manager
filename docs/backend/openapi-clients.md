# Typed API clients via openapi-generator

The FastAPI backend generates its own contract (`backend/app/openapi.json`,
exported from the app — regenerate with the snippet at the bottom of this
doc). openapi-generator (Apache-2.0, OpenAPITools/openapi-generator) turns
that contract into **typed clients** at dev time:

- TypeScript for `tsm-console` (axios or fetch)
- Python for data-acquisition scripts

## Why

Hand-rolled fetch calls drift from the backend. Generated clients make
endpoint renames and schema changes compile-time errors instead of runtime
surprises.

## Workflow (dev machine — needs Java or Docker)

```sh
# 1. Regenerate the contract from the backend
python - <<'EOF'
from backend.app.main import app
import json
json.dump(app.openapi(), open("backend/app/openapi.json", "w"), indent=2)
EOF

# 2. Generate the TypeScript client (Java required locally)
npx @openapitools/openapi-generator-cli generate \
  -i backend/app/openapi.json \
  -g typescript-axios \
  -o tsm-console/src/lib/api-client \
  --additional-properties=supportsES6=true

# 3. Generate the Python client for scripts
npx @openapitools/openapi-generator-cli generate \
  -i backend/app/openapi.json \
  -g python \
  -o scripts/vendor/tsm-api-client-python
```

## Rules

- **Dev-time only.** The generator is never vendored (500M+) and never runs
  in CI. Commit the generated output; regenerate when the contract changes.
- Do NOT use `openapi-generator-online` — it is a hosted service; the local
  CLI keeps the air-gap posture.
- The checked-in `openapi.json` is the contract of record. If the generated
  client and the backend disagree, the backend is wrong — fix the app, not
  the client.

## openapi-generator's own tooling note

The project's `openapi-generator-cli` npm wrapper downloads the generator
JAR on first run (needs a JRE). On machines without Java, use the Docker
image `openapitools/openapi-generator-cli` with the same arguments.
