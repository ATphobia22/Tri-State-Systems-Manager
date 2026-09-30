# TSM HEC-RAS Automation Architecture

## Status

Implemented compatibility architecture for HEC-RAS 6.x plus a version-independent hydraulic contract prepared for HEC-RAS 2025.

## Runtime boundary

- **HEC-RAS 6.x:** controlled local execution on Windows; Python adapter and HDF5 result reader.
- **HEC-RAS 2025:** reserved adapter boundary for the official public C#/.NET API; do not treat the Beta as a production dependency.
- **HDF5:** read-only result ingestion and inspection, not TSM's canonical model schema.
- **TSM:** owns hydraulic model, execution receipt, provenance, validation, and solver-result contracts.

## Safety and provenance

A solver result is not regulatory evidence merely because a solver completed. Every execution must retain model/input/result hashes, engine/version identity, timestamps, spatial/vertical reference, validation status, and a human-review gate.

TSM must never synthesize WSE, depth, velocity, arrival time, or engineering recommendations from a flood polygon alone.

## Python environment

Install the compatibility reader on a Windows HEC-RAS 6.x worker:

```text
python -m venv .venv
.venv\\Scripts\\python.exe -m pip install -r packages/hydraulics/python/requirements.txt
```

The HDF5 reader can inspect an existing result without modifying it. Actual HEC-RAS execution requires a locally installed, licensed/authorized HEC-RAS runtime and a real project file.

## 2025 migration

Implement `HecRas2025Adapter` against the first-party API when the target HEC-RAS 2025 release is production-supported. Keep the adapter behind the same TSM contracts so downstream simulation, spatial federation, provenance, and visualization do not change.
