R-Node Bootstrapper Subsystem Implementation Plan
1. Executive Summary
The R-Node bootstrapper is a sovereign, deterministic deployment engine designed to provision, verify, and diagnose isolated edge and core nodes for the PTDT-v33 simulation architecture. It strictly enforces a Reproducibility Invariant, detecting platform capabilities rather than silently overriding failures, and emits a machine-readable environment manifest upon completion.
2. Repository Architecture (rnode/)
rnode/
├── bootstrap/
│   ├── cli.py                  # CLI entrypoint for local and automated execution
│   ├── platform.py             # OS, architecture, and kernel detection
│   ├── python_runtime.py       # Python version and virtual environment manager
│   ├── docker_runtime.py       # Docker & Compose capability detector
│   ├── gpu_runtime.py          # Vulkan/WebGPU/CUDA hardware capability probe
│   ├── usd_runtime.py          # OpenUSD library and usdview binding detector
│   ├── hecras_runtime.py       # HEC-RAS integration prerequisite validator
│   ├── archimedes_runtime.py   # Archimedes compute runtime validator
│   ├── dependency_lock.py      # Strict hash-locked dependency parser
│   ├── artifact_verifier.py    # SHA-256 binary and archive checksum verifier
│   ├── environment_manifest.py # Deterministic manifest generator
│   └── diagnostics.py          # Failure classification and reporting engine
├── installers/
│   ├── install.ps1             # PowerShell entrypoint for Windows environments
│   ├── install.sh              # Bash entrypoint for Linux/macOS environments
│   └── install.py              # Cross-platform core installer orchestrator
├── config/
│   ├── runtime.toml            # Node profile configuration (core vs edge)
│   └── dependency-lock.json    # Cryptographically pinned dependency versions
├── tests/
│   ├── unit/                   # Unit tests for detectors and manifest builders
│   ├── integration/            # Full environment smoke and validation tests
│   └── fixtures/               # Mock payloads, locks, and corrupted manifests
└── docs/
    └── rnode/                  # Subsystem operational documentation

3. Reproducibility Invariant Execution Flow
[Source Manifest] 
       ↓
[Pinned Dependency Graph] (dependency-lock.json)
       ↓
[Artifact Verification] (SHA-256 Checksums)
       ↓
[Platform Capability Detection] (OS, CPU, GPU, WebGPU, OpenUSD, HEC-RAS, Archimedes)
       ↓
[Deterministic Environment Manifest] (JSON Output)
       ↓
[Smoke & Integration Tests]
       ↓
[INSTALLATION_OK / Explicit Failure Classification]

4. Component Specifications
4.1. Core Orchestration (bootstrap/cli.py & install.py)
 * Provides command-line arguments: --config, --verify-only, --report-json, and --strict.
 * Coordinates execution phases: Environment Scan → Verification → Provisioning → Manifest Generation → Smoke Testing.
4.2. Capability Detectors (bootstrap/*_runtime.py)
 * platform.py: Identifies OS family (win32, linux, darwin), architecture (x86_64, arm64), and kernel version.
 * gpu_runtime.py: Proves WebGPU / Vulkan / CUDA runtime availability without raising unhandled exceptions on missing drivers.
 * usd_runtime.py: Verifies OpenUSD Python bindings and USD CLI utility presence.
 * hecras_runtime.py / archimedes_runtime.py / box3d: Validates structural prerequisites, DLL/so bindings, and dependency paths.
4.3. Cryptographic Verification (bootstrap/artifact_verifier.py)
 * Computes SHA-256 hashes for all downloaded or mounted binary assets.
 * Fails closed immediately if checksums deviate from dependency-lock.json.
4.4. Environment Manifest (bootstrap/environment_manifest.py)
Generates a structured JSON record containing:
 * OS & Architecture metadata
 * Python & Docker runtime versions
 * GPU vendor and API capabilities
 * OpenUSD and hydraulic integration paths
 * Git revision & dependency lock hash
 * Artifact checksum verification results & test outcomes
5. Verification & Testing Strategy
 * Unit Tests (tests/unit/): Verify that capability detectors properly classify mock hardware states (e.g., missing GPU, incompatible Python version) and that artifact verifiers catch modified SHA-256 checksums.
 * Integration Tests (tests/integration/): Execute a full dry-run bootstrap sequence and confirm that a valid environment_manifest.json is successfully produced.
