# ACEScg Gamut Mapping — TSM Contract v1

**Status:** implementation contract for cinematic path only. Scientific rasters remain outside color transforms.

## Goal
Map out-of-gamut scene-linear values into **ACEScg (AP1, linear)** without hard clip, while preserving energy relationships for lighting and composite.

## Algorithm roles

| Stage | Tool | Notes |
|-------|------|-------|
| Camera → scene | IDT + optional **ACES 1.3 RGC** | Compress extreme camera RGB into AP1 before working space |
| Working space | **ACEScg** | All Grade / Merge / key ops |
| Display | ACES Output Transform (Rec.709 or Rec.2100 PQ) | Never replace ODT with a simple matrix |

## RGC (Reference Gamut Compression)
- Enable only when the pinned OCIO config exposes a supported RGC/view path.
- ACES 1.3 RGC ≠ ACES 2.0 output transform — do not mix blindly.
- Apply on **camera plates** at ingest; skip on assets already authored in ACEScg.

## Mapping rules (fail-closed)
1. Detect source primaries from EXR metadata or manifest; never assume ACEScg.
2. If source is linear Rec.709/sRGB → OCIO `ColorSpaceTransform` into ACEScg.
3. If source is display-referred sRGB (PNG/JPEG) → `Texture - sRGB` (or config equivalent) → ACEScg.
4. If source claims ACEScg → identity (no second transform).
5. Scientific channels (depth, velocity, elevation, masks, IDs) → **no** gamut map, no ODT.

## Acceptance
- Pinned `config.ocio` SHA-256 in delivery manifest.
- EXR intermediates remain Float32 linear.
- Waveform/vectorscope QC on SDR/HDR masters.
- Human authority on any claim of “ACES master.”

## References
- OpenColorIO-Config-ACES releases
- `docs/cinema/ACES-OCIO-COLOR-PIPELINE.md`
