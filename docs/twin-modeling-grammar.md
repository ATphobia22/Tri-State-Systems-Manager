# Twin modeling grammar (DTDL-inspired)

The twin's telemetry and entity schemas adopt the *grammar* of the Digital
Twins Definition Language v3 (Azure/opendigitaltwins-dtdl, spec under
CC-BY-4.0) — the concepts, not Azure's services. DTDL is a spec repository
with no runtime; nothing here depends on any cloud.

## Adopted metamodel classes

| DTDL class | TSM meaning |
|---|---|
| `Interface` | A typed contract for a twin entity (e.g. `RiverGauge`, `LeveeSegment`). Declares what the twin exposes. |
| `Telemetry` | A stream of emitted data: sensor readings, computed series (occupancy, stage), alerts. Never silently backfilled. |
| `Property` | Twin state: read-only (`reportedStage`) or read/write (`alertThreshold`). Writes are operator actions, logged. |
| `Command` | An explicit operator invocation (`runScreeningScenario`). Inform-only per the workbench axiom — commands never silently govern. |
| `Component` | A sub-assembly of an interface (a gauge's `PowerSubsystem`). |
| `Relationship` | Typed links between twins (`monitors`, `protects`, `drainsInto`). |

## quantitativeTypes: unit-typed values

Every numeric telemetry value and property carries an explicit unit from the
DTDL quantitativeTypes vocabulary (`metre`, `foot`, `cubicFootPerSecond`,
`degree`, …). Rationale: the LOMA case history (BFE 375.0 ft NAVD88 vs
metric DEM sources) exists because units and datums were once implicit.
Unit-typed values make that class of error structurally impossible:

```json
{
  "@type": "Telemetry",
  "name": "stage",
  "schema": {
    "@type": "Quantity",
    "unit": "foot",
    "datum": "NAVD88"
  }
}
```

`datum` is a TSM extension (DTDL has no datum concept); vertical datums are
first-class because mixing NAVD88/NGVD29 is a regulatory-grade mistake.

## What is NOT adopted

- No DTMI identifiers, no Azure Digital Twins service bindings, no DTDL
  parsers. This is a modeling convention for our own schemas and docs.
- The "three separate truths" doctrine still governs: a telemetry stream
  (computational truth) never silently becomes evidence (authoritative
  truth); promotion requires the evidence-tier gates in `docs/`.
