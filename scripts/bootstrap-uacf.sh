#!/usr/bin/env bash
set -euo pipefail

mkdir -p apps/{gateway,dashboard,playground,docs} \
  packages/{contracts,schemas,core,registry,router,policy,provenance,events,model-runtime,provider-runtime,capability-runtime,workflow,research,observability,credentials,mcp,openapi,artifacts,web,maps,geo,security} \
  providers/{openai,anthropic,google,local,search,maps,browser} \
  plugins/{monitoring,seo,ai-ready,engineering,digital-twin} \
  runtime/{unreal,python,rust} \
  database/{migrations,schemas,seeds} \
  evidence/{hashes,frames,snapshots}

echo '[UACF] scaffold directories created'
