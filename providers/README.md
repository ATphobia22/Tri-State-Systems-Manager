# Provider integrations

Provider adapters belong under this directory and must implement explicit interfaces, bounded timeouts, caller cancellation, typed error mapping, health checks, and secret redaction. Provider availability must be configuration-gated; no adapter should silently fall back to an unapproved endpoint or model. OpenAI currently has a minimal Responses API adapter; Anthropic, Google, OpenRouter, and local-provider adapters must not be considered implemented until each has a real adapter and contract tests.
