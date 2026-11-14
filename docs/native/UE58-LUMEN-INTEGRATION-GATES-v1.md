# UE5.8 Lumen Integration Gates — TSM v1

**Status:** integration contract. Does **not** assert a Shipping build or calibrated GI on Posey assets.

## Scope
Lumen provides dynamic global illumination and reflections in UE5.8. TSM uses it only for **cinematic / visualization** paths — never as regulatory flood evidence.

## Required project settings (editor)
- `r.DynamicGlobalIlluminationMethod = 1` (Lumen)
- `r.ReflectionMethod = 1` (Lumen)
- Hardware ray tracing optional; Software Lumen is the default offline path.
- Nanite meshes + Lumen mesh cards where building LODs exist.

## Integration with TSM planes
| Plane | Lumen role |
|-------|-----------|
| Public Visualization | Allowed for cinematic MRQ / Sequencer |
| Scientific / Simulation | **Off** — no GI rewrite of water depth or elevation |
| Evidence / Governance | Receipts must label frames `SIMULATION_DEMO` or cinematic until human-authorized |

## Cesium / 3D Tiles interaction
- Lumen samples Nanite / static meshes; Cesium tiles need mesh proxy or capture cards for stable GI.
- Prefer baked or distant sky for large outdoor river scenes if Lumen cost exceeds budget.
- Do not treat Lumen bounce light as measured irradiance for LOMA evidence.

## Gates before Shipping claim
1. Windows UE5.8 runner with Lumen enabled in a non-Shipping config — log present.
2. Frame receipt includes GI method, resolution, and whether RT was used.
3. Side-by-side still: Lumen on vs off for the same camera (no scientific claim).
4. Human review signs cinematic path; scientific rasters untouched.

## Non-claims
- No calibrated physical lighting for engineering.
- No automatic enable on headless CI without GPU.
- No replacement of OpenMI / hydraulic results with Lumen visuals.

See also: PR #577 native physics/HLOD branch; `docs/cinema/SIX-COUNTY-UE58-CINEMATIC-PRODUCTION.md`.
