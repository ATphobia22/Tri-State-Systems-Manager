# TSM OpenMI Multi-Physics Bridge

## Scope

TSM contains a **TSM-owned gRPC/Protobuf transport profile** for exchanging
OpenMI-style model state between independent engineering components.

OpenMI 2.0 is an OGC interface standard for runtime exchange between process
simulation models. It does **not** prescribe gRPC or Protobuf as its wire
format. TSM therefore treats `tsm-console/proto/openmi.proto` as a transport
profile that preserves OpenMI concepts without claiming standards conformance
from the transport alone.

## Current architecture

```text
HEC-RAS worker ─┐
                ├─> TSM OpenMIService ─> ExchangeRouter ─> downstream adapters
MODFLOW 6 adapter┤                              │
EPA SWMM adapter ┤                              └─> evidence/provenance plane
Bishop solver ───┘
```

The bridge transports values and metadata; it does not invent hydraulic or
groundwater results.

### Exchange contract

Each `QuantityValueSet` carries:

- quantity identifier and units;
- one or more numeric values;
- ISO-8601 timestamp;
- source component and optional target component;
- model-run identifier;
- element identifiers when values map to a spatial discretization;
- horizontal CRS and vertical datum;
- source authority;
- software/model versions;
- a 64-character SHA-256 `source_provenance_hash`;
- validation status.

The bridge rejects missing provenance, missing datum metadata, non-finite
values, malformed timestamps, and mismatched spatial element/value counts.

## Intended component mapping

| Component | Candidate exchange quantities | Contract status |
|---|---|---|
| HEC-RAS | SurfaceWaterElevation, SurfaceDischarge, Velocity | transport-compatible |
| MODFLOW 6 | HydraulicHead, GroundwaterFlux | transport-compatible |
| EPA SWMM | Runoff, NodeDepth, ConduitFlow | transport-compatible |
| Bishop | FactorOfSafety, PoreForce | transport-compatible |
| LISFLOOD-FP / Itzï | Depth, Velocity, InundationExtent | transport-compatible |

“Transport-compatible” means the bridge can carry the contract. It does **not**
mean the external solver is bundled, licensed, installed, validated, or
automatically executed by TSM.

## Provenance and evidence

Every cross-model value is required to carry a source provenance hash. This
connects the bridge to TSM's existing BFE/evidence architecture without
pretending that a hash alone establishes engineering validity or legal
admissibility.

NIST finalized FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) in August 2024. Those
standards are references for future cryptographic transport/evidence work, but
this bridge does not claim FIPS validation and does not embed a home-grown
post-quantum cryptosystem.

## Regulatory boundary

The bridge remains advisory. TSM's existing Archimedes engine records that
numerical screening is not a regulatory determination and requires human
review.

The repository's current rule binding also preserves jurisdiction-specific
logic:

- Indiana DNR uses a 0.15 ft criterion for the defined adverse floodway effect
  under 312 IAC 10; FEMA no-rise processes are a separate control.
- Illinois Part 3700 defines the floodway around a 0.1 ft stage increase, with
  context-specific construction standards.
- Kentucky 401 KAR 4:060 defines "no impact" separately from its one-foot
  floodway-boundary criterion.

## Operations

The Python bridge is in `backend/openmi_service.py`.

```bash
python -m unittest backend.test_openmi_service -v
python -m backend.openmi_service
```

The default listener is an insecure development endpoint. Production deployment
requires authenticated TLS or a mutually authenticated service mesh.

## Non-goals

- no fabricated survey elevations;
- no automatic professional certification;
- no silent regulatory determination;
- no claim that a nearby FEMA BFE is the property's applicable BFE;
- no assumption that external solver executables are installed;
- no cryptographic claim of FIPS validation merely because FIPS algorithms are
  referenced.


## Posey County GIS evidence source

TSM also registers the Posey County WTHGIS endpoint as a parcel/property-record
source:

`http://poseyin.wthgis.com/`

The observed WTHGIS property-record interface exposes county parcel records
through `/tgis/custom.aspx` and can contain parcel number, location address,
legal description, deed book/page/document fields, and transfer history.

The TSM adapter in `backend/posey_wthgis.py` records these URL patterns without
assuming that any individual field is present. A missing deed book/page/document
is an unresolved evidence gap, not a value to be inferred.

**Evidence hierarchy:** WTHGIS is useful county GIS/property-record evidence;
the Posey County Recorder remains the authoritative channel for obtaining a
recorded deed or certified copy. WTHGIS data must not be represented as a
professional survey, title opinion, or certified elevation.

For the FEMA LOMA anchor, the known parcel identifier remains
`65-19-08-100-008.001-010`. The current public WTHGIS search did not expose a
stable indexed feature ID for that exact parcel, so TSM does not fabricate one.
The adapter can consume a verified FeatureID when obtained from the county
interface.
