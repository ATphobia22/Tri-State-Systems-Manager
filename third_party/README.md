# TSM Third-Party Engineering Toolchain

This directory intentionally contains **source locks and acquisition tooling**, not copied upstream repositories.

The Tier-1 stack is large and has incompatible licenses/build systems. TSM therefore acquires exact revisions into an isolated build cache and records the resolved commit and artifact hashes. This avoids silently vendoring GPL applications or mixing DCC/solver code into the Unreal runtime.

Run:

`node scripts/third-party/bootstrap.mjs --all`

The bootstrapper:
- clones the pinned revisions from `contracts/dependencies/tsm-open-source-lock-v1.json`;
- refuses mutable revisions unless `--allow-mutable` is supplied;
- records resolved commits;
- never writes into `tsm-native/Content`;
- keeps external source under `.cache/tsm-third-party/`.

For release packaging, copy only reviewed binaries/artifacts into the appropriate worker image/package and generate the SBOM from the resolved lock.
