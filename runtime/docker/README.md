# runtime/docker

Docker runtime boundary for the UACF platform.

**Role:** container definitions for the Node API, the Vite console, and
capability workers. See the repo-root `Dockerfile`, `Dockerfile.api`,
`docker-compose.yml`, and `docker-compose.uacf.yml`.

**Boundary rules:**
- Images are built from pinned base digests; no `latest` tags in releases.
- Secrets are injected at runtime, never baked into layers.
- Health checks must hit the real readiness endpoint (`GET /ready`); a
  container that cannot prove readiness is not routed traffic.
- The offline runtime bundle (Windows x64) is the air-gapped distribution;
  containers are the networked counterpart, not a replacement.

**Status:** definitions live at repo root; this directory documents the
boundary and reserves space for worker-specific Dockerfiles.
