# Reproducible HEC-HMS → HEC-RAS pilot workflow

## Status and guardrails

TSM defines a strict JSON Schema Draft 2020-12 manifest, an external-readiness validator, a UTC hydrograph exchange contract, and a content-addressed artifact-store interface. The checked-in example is deliberately **NOT_APPROVED**, uses placeholder hashes and paths, and is not executable.

No licensed HEC-HMS/HEC-RAS runtime or approved watershed project is bundled. Do not invent an area, rainfall, model parameters, vertical datum, or boundary conditions. A real solver run requires an authorized AOI approval record, reviewed project inventories, version-pinned tested adapters, and qualified engineering oversight.

## Source integration research

- [HEC-HMS official software and documentation](https://www.hec.usace.army.mil/software/hec-hms/): use documentation matching the installed release.
- [HEC-HMS Technical Reference Manual (2023-10-18)](https://www.hec.usace.army.mil/software/hec-hms/documentation/HEC-HMS_Technical_Reference_Manual-20231018.pdf): hydrologic methods reference, not a substitute for current version documentation.
- [hms-commander on PyPI](https://pypi.org/project/hms-commander/) and [source](https://github.com/ATphobia22/hms-commander): candidate automation/DSS adapter. Pin an immutable release/commit and test against the actual software/DSS versions before production use.
- [HEC-Commander tools](https://github.com/ATphobia22/HEC-Commander): reference notebooks and scripts, not an audited production dependency.
- [Rainfall-runoff tutorial](https://www.researchgate.net/profile/Shanbor-Kurbah/publication/335739185_Rainfall-Runoff_Modeling_using_HEC-HMS_model_Basic_Manual_Tutorial_for_Beginners/links/5d789af9299bf1cb809827b4/Rainfall-Runoff-Modeling-using-HEC-HMS-model-Basic-Manual-Tutorial-for-Beginners.pdf): educational background only, not a source for local parameters.

## Pilot setup

1. Select an AOI through the project's authorized governance process; save source geometry, provenance, reviewer, timestamp, and approval evidence.
2. Independently delineate and check watershed area. Record horizontal CRS and vertical datum; do not assume they match between model packages.
3. Inventory the actual HMS/RAS project dependencies and hash every listed file. Pin solver versions, the TSM source commit, adapter versions, and command arguments.
4. Review rainfall/meteorology, basin topology, loss/transform/baseflow/routing methods, time step, units, control period, terrain, geometry, mesh, structures, roughness, and boundary conditions.
5. Validate DSS pathname/units/time interval and gage-to-boundary mapping. The CSV validator checks format and trapezoidal volume only; it does not prove DSS equivalence or hydrologic correctness.
6. Run calibration and independent validation against qualified, provenance-bearing observations. Document metrics, uncertainty, mass balance, solver warnings, and qualified engineering disposition.

## Current implementation boundary

`backend/engineering/hec_hms_ras_workflow.py` provides manifest validation, path-safe model inventory checks, AOI ring checks, UTC hydrograph CSV validation, a local content-addressed artifact store, and shell-free argv execution. It does not yet orchestrate a complete HEC-HMS compute, DSS conversion, or HEC-RAS plan because the real installed adapter interfaces and project-specific input contracts have not been verified. A zero exit code or present HDF5 file must never be interpreted as validated flood predictions.

Local file URIs are not shared durable storage. Configure a shared filesystem or object store before multi-worker deployment, and retain immutable input/output hashes and human-review records.
