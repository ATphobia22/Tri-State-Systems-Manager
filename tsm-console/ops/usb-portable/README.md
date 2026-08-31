# PTDT / TSM USB portability (ops)

## Safety

- `flash-usb-duplicator.ps1` performs **raw sector writes** to physical USB disks.
- Requires elevated PowerShell, explicit confirmation string, and excludes system/boot disks.
- **Run only** on a controlled workstation with the intended media inserted.
- This repository stores the script for **distribution engineering**; CI must never execute it.

## Paths

| Path | Role |
|------|------|
| Path A | Tiny11 Windows To Go bootable USB |
| Path B | Portable app suite on host Windows 11 (pgsql + frontend/backend) |

## TBW mitigation (PostgreSQL on flash)

Documented knobs (ops-only): `synchronous_commit=off`, `wal_compression=on`, longer `checkpoint_timeout`, reduced bgwriter aggressiveness, `random_page_cost≈1.1` for SSD/flash planners.

Trade-off: durability vs flash wear — acceptable for **field demo** nodes; not a substitute for server-grade evidence store.

## Gate 5 invariants

Must match `VIEWPORT_CONFIG.portable` / site constants:

- EPSG:**2966**
- NAVD88
- BFE **375.0** ft, LAG **377.2** ft
- APN **65-19-08-100-008.001-010**

## Evidence–presentation boundary

Viewport (MapLibre / Three.js / optional WebGPU) **must not** mutate evidence ledger or hydraulic solvers. Human authority final.

