# Firecrawl MCP server (agent tooling)

`firecrawl-mcp-server` (MIT) exposes the Firecrawl API as Model Context
Protocol tools for coding agents. It passes `FIRECRAWL_API_URL` straight
through to the MIT js-sdk, so it works fully against the keyless
self-hosted instance — no cloud key.

## Use

Point it at the sidecar and run it alongside the agent:

```sh
cd deploy/firecrawl && docker compose up -d
export FIRECRAWL_API_URL=http://localhost:3002
npx -y firecrawl-mcp-server
```

Register the resulting stdio/SSE endpoint in the agent's MCP config.
Legitimate uses are the same as the sidecar's: public open-data pages,
HTML→Markdown, keyless metasearch. The agent inherits the operator's
responsibility for robots/ToS compliance.

Source: ATphobia22/firecrawl-mcp-server (untouched upstream mirror, MIT).
