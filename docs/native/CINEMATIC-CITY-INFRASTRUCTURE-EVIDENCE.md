# TSM cinematic city + engineering evidence contract

## Native headed user experience

The existing Unreal Slate engineering dashboard now exposes navigation for:
- **Utility layers:** storm/sanitary sewer, drinking water, electricity, gas, telecom, drainage, roads, parcels, rights-of-way and proposed construction.
- **City materials:** accurate road and building materials, roofs, sidewalks, street furniture and vegetation only where sourced and licensed.
- **Weather and lighting:** day/night, rain, fog, wind, clouds, reflections and storms, explicitly marked **cinematic** until linked to verified time-stamped weather data.
- **Evidence and grants:** a headless PDF evidence register.

These are **navigation and disclosure panels**, not finished layer renderers, weather animation controls, imported Mount Vernon utility geometry or fully functional editor menus. Implement native Unreal UI state and scene bindings and verify them on a headed Windows GPU runner before calling those features functional.

## Offline evidence export

Install `reportlab` in the **headless** Python toolchain and run:

```bash
python scripts/native/export-engineering-evidence-pdf.py --input evidence.json --output evidence.pdf
python -m unittest discover -s tests/native -p test_evidence_pdf_export.py -v
```

Example input (NOT an actual engineering record):

```json
{
  "project": "Mount Vernon, Indiana - conceptual engineering",
  "evidence": [
    {
      "layer": "sanitary_sewer",
      "status": "NOT_EVIDENCED",
      "description": "Authoritative surveyed alignment and pipe inverts not supplied"
    },
    {
      "layer": "proposed_construction",
      "status": "PENDING",
      "description": "Concept geometry requires licensed survey and engineering review"
    }
  ]
}
```

A `VERIFIED` row must contain `sha256` (64 hex characters), `source`, `acquired_utc`, `crs`, `vertical_datum`, `units` and `verification_method`. The exporter validates field presence but **does not verify** source hashes or scientific claims; independent provenance verification must precede assigning VERIFIED. It refuses to overwrite a prior PDF.

## Fidelity and safety

For Mount Vernon, street/building footprints, material classifications, road surfaces and utility alignments need separately verified source assets and datum transformations. The interface must distinguish **observed**, **historical**, **simulated** and **cinematic** clocks. Cinematic rain is not a measured storm, and a utility layer legend is not an excavation-safe underground utility map.

For grants, attach original funding-program criteria and evidence references; a PDF register is not an application or award. Human authority remains final.

## Acceptance gates still open

1. Unreal 5.8 C++/UHT compile and real Slate interaction tests.
2. Material and mesh sourcing with legal licensing and correct georeferencing.
3. Native weather and lighting controls connected to GPU render state.
4. Layer toggles, visibility, clipping, styling, editing and provenance drill-down.
5. Headless PDF test, actual sample render and visual inspection.
6. Windows Shipping packaging, offline startup and GPU screenshots.
