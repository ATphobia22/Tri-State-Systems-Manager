# Local AI Developer Tools for TSM — Evaluation Guide

**Date:** 2026-10-18
**Evaluated:** ollama/ollama, astral-sh/uv, vectorize-io/hindsight
**Verdict:** Adopt uv. Skip ollama on this VM (viable on better hardware). Skip hindsight (wrong tool for the job).

---

## 1. ollama — Local LLM Inference

**What it is:** Runs quantized LLMs locally via llama.cpp. REST API on `localhost:11434`. No API keys, no data egress. Real, mature, widely used.

**Can it run on this VM?** No — not practically.

| Check | This VM | Requirement |
|-------|---------|-------------|
| Total RAM | 7.7 GB | 8 GB minimum |
| Available RAM | **1.5 GB** | ~5 GB for a 7B model at Q4 |
| CPUs | 2 | Works, but 2–8 tok/sec |
| Disk free | 43 GB | 5–10 GB per model ✓ |
| AVX2 | Yes ✓ | Required ✓ |

With 1.5 GB available, even a 3B model (~2 GB at Q4) would thrash. A 7B instruct model — the smallest useful for regulatory document parsing — needs ~5 GB. **This VM cannot run ollama alongside its existing workload.**

**Where it WOULD work:** Any machine with 16 GB RAM (8 GB free). At that level:
- `llama3.1:8b` or `mistral:7b` or `qwen2.5:7b` at Q4_K_M
- CPU-only speed: 5–15 tokens/sec (slow but fine for batch document Q&A)
- Use case fit: parsing dense FEMA/LOMA PDFs offline, extracting BFE values, summarizing determination letters

**Setup (on capable hardware):**
```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh

# Pull a document-capable model (~4.7 GB)
ollama pull llama3.1:8b

# Query a FEMA document (via API)
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Extract the Base Flood Elevation and flood zone from this FIRM panel description: ...",
  "stream": false
}'
```

**TSM integration sketch** (for a future capable machine, not this VM):
```python
# scripts/flood-forecasting/fema_doc_parse.py
import requests, json

def ask_local_llm(prompt: str, model: str = "llama3.1:8b") -> str:
    r = requests.post("http://localhost:11434/api/generate",
                      json={"model": model, "prompt": prompt, "stream": False},
                      timeout=300)
    return r.json()["response"]
```

**Recommendation:** SKIP on this VM. Revisit if the user gets a machine with 16 GB+ RAM. The FEMA document work is currently better served by targeted Python parsing (pdfplumber is already installed) plus the existing manual review workflow.

---

## 2. uv — Python Package Manager (astral-sh)

**What it is:** Rust-based Python package/project manager. Replaces pip, venv, pip-tools, pyenv, and pipx with one binary. 90K+ GitHub stars, MIT/Apache-2.0.

**Verdict: ADOPT.** This is the clearest win of the three.

**Why it fits TSM:**
- TSM has `backend/requirements.txt` with pinned ranges but no lockfile — builds are not fully reproducible
- 9+ GitHub Actions workflows run `pip install` on every CI run (cold cache = slow)
- uv is 10–100× faster than pip on cold installs; near-instant on warm cache
- `uv.lock` gives deterministic, auditable builds — matches TSM's evidence-over-theater ethos

**Migration path (low-risk, incremental):**

Phase 1 — Drop-in replacement (zero config changes):
```yaml
# In .github/workflows/ci.yml, replace:
#   run: python -m pip install --upgrade pip && python -m pip install -r backend/requirements.txt
# With:
- uses: astral-sh/setup-uv@v4
  with:
    enable-cache: true
- run: uv pip install --system -r backend/requirements.txt
```
`uv pip` reads `requirements.txt` natively. No file changes needed.

Phase 2 — Lockfile (deterministic builds):
```bash
# One-time: generate uv.lock from existing requirements
uv pip compile backend/requirements.txt -o backend/requirements.lock
# Or adopt the project workflow:
cd backend && uv init --no-readme  # generates pyproject.toml
uv add $(cat requirements.txt)    # migrates deps
uv lock                            # writes uv.lock
```
Then CI uses `uv sync --frozen` which fails loudly if the lockfile is stale — no silent drift.

Phase 3 — Local scripts:
```bash
# Install once
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run any TSM Python script with auto-managed deps (PEP 723 inline metadata)
uv run scripts/flood-forecasting/bfe_ingestion.py
```

**Caveats (honest):**
- uv is not a byte-for-byte pip clone; edge-case behavior differences exist (documented in uv's compatibility guide). The `uv pip` interface minimizes this.
- **Acquisition note:** Multiple 2026 sources report OpenAI agreed to acquire Astral (March 2026), with a public commitment that the tools stay open source. For TSM's zero-lock-in stance: uv is MIT/Apache-2.0, the binary works offline after install, and `requirements.txt`/`uv.lock` are open formats. If Astral ever went sideways, the lockfile remains usable and pip remains a fallback. Risk is low but worth knowing.
- `uv python install` downloads Python builds — on this VM, keep using the system Python and just use `uv pip`.

**Recommendation:** Adopt Phase 1 now (CI speedup, zero risk). Phase 2 when there's a quiet week. Do not touch the offline-runtime Windows workflows (they use `--no-index` local wheel installs — uv supports this via `--find-links` but it's not worth churning working code).

---

## 3. hindsight — Agent Memory (vectorize-io)

**What it is:** Open-source (MIT) persistent memory system for AI coding agents. ~38K GitHub stars (Sept 2026). Python server on PostgreSQL + pgvector, clients for Python/Node/Go, built-in MCP server. Three operations: `retain` (store facts), `recall` (hybrid search: vector + keyword + graph + temporal), `reflect` (reason over memories). An LLM extracts structured facts from each session; background jobs consolidate them into knowledge pages.

**Is it real?** Yes. It's a real, actively developed project with a published paper (Virginia Tech / Vectorize), benchmark results (LongMemEval, LoCoMo), and a real codebase at `github.com/vectorize-io/hindsight`. Not vaporware.

**Verdict: SKIP.** It's real but it's the wrong tool for TSM's actual need.

**Why it doesn't fit:**
1. **Solves a different problem.** Hindsight is for autonomous coding agents that forget everything between sessions and need to "learn" project conventions over time. TSM's need is: "the engineer (human + assistant) needs to look up past decisions." That's a retrieval problem, not a learning problem.
2. **Heavy infrastructure for the payoff.** Requires Docker + PostgreSQL + pgvector + an LLM API key for the fact-extraction pipeline. On this VM (1.5 GB RAM free), PostgreSQL + the hindsight server would not run comfortably.
3. **The LLM dependency defeats the purpose.** The consolidation pipeline needs an LLM provider (OpenAI/Anthropic API or local). If local, we're back to the ollama RAM problem. If API, it's per-token billing — against the no-PAYG constraint.
4. **TSM already has this.** `~/MEMORY.md` + daily `~/memory/*.md` notes + `muse.memory_search`/`muse.memory_get` already provide curated, searchable, persistent memory with zero infrastructure. It works. Replacing it with a PostgreSQL-backed LLM pipeline would be a downgrade in reliability for no practical gain.

**What WOULD make hindsight worth revisiting:** If TSM ever runs fully autonomous coding agents (not assistant-in-the-loop) that need to accumulate conventions across hundreds of unsupervised sessions. That's not the current workflow.

**Recommendation:** Skip. Keep the file-based memory system. If the memory files ever feel slow to search, the fix is better indexing of the Markdown, not a vector database.

---

## Summary

| Tool | Real? | Fits TSM? | Action |
|------|-------|-----------|--------|
| ollama | Yes | Not on this VM (1.5 GB RAM free) | Skip here; viable on 16 GB+ hardware for offline FEMA doc parsing |
| uv | Yes | Strong fit | **Adopt** — Phase 1 (`uv pip` in CI) now, lockfile later |
| hindsight | Yes | Wrong problem; heavy infra | Skip — file-based memory already works |

**Next steps (only the adopted one):**
1. Add `astral-sh/setup-uv` to `ci.yml` and `geospatial-ci.yml`, replacing `pip install` with `uv pip install --system`
2. Verify CI goes green
3. Later: generate `uv.lock` for `backend/` and switch to `uv sync --frozen`
