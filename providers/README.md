# Provider integrations

The following HTTP text-generation adapters are implemented and contract-tested with mocked transport:

- `providers/openai`: OpenAI Responses API.
- `providers/anthropic`: Anthropic Messages API.
- `providers/google`: Google Gemini `generateContent` API.
- `providers/openrouter`: OpenRouter OpenAI-compatible chat completions API.

Adapters are credential-gated, validate input bounds, enforce request timeouts, map rate limits and upstream failures into typed results, and avoid logging raw credentials or provider response bodies. Unit tests use injected fetch implementations; they do not prove live credentials, quotas, or provider account access.

The `health()` contract reports local configuration readiness, not live network reachability. Run a controlled deployment smoke test before enabling a provider in production. Do not enable an adapter merely because its package exists.

Other providers (maps, geospatial, PostGIS, MCP, OpenAPI, browser and search) are separate integration boundaries and must remain disabled until their protocol-specific behavior, authorization, SSRF controls, provenance, and contract tests are verified.
