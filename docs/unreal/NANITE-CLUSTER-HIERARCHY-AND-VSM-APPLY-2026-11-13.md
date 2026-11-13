# Nanite Cluster Hierarchy + Virtual Shadow Maps — Apply Guide (UE 5.8 production)
**Date:** 2026-11-13  
**Target:** TSM cinematic / digital-twin path (UE 5.8). 5.9 Preview = test copies only.  
**Mode:** Soft-label only. Never hard-stop render or engineering.

## 1. Nanite cluster hierarchy (apply)

Nanite stores meshes as a **hierarchical cluster tree**. At runtime the GPU:
1. Walks the hierarchy per visible instance.
2. Culls by frustum + HZB occlusion + screen-size LOD.
3. Rasterizes only surviving clusters (pixel-scale detail).

### Simple vs Complex culling paths
| Path | Trigger | Cost |
|------|---------|------|
| **Simple** | Most static Nanite instances | Faster |
| **Complex** | Skeletal, spline, Nanite Assembly, WPO active, displacement, moved/animated this frame | Higher |

### Required project settings
- Enable **Nanite** on Static Meshes (Static Mesh Editor → Nanite Settings → Enable).
- Prefer opaque / masked materials. Translucent is not supported on Nanite.
- For WPO: set **Max World Position Offset Displacement** only as large as needed (bounds drive culling).
- Clamp displacement magnitude; excess → more clusters → overdraw.

### Console variables (apply in DefaultEngine.ini or console)
```
r.Nanite.Culling.Frustum=1
r.Nanite.Culling.HZB=1
r.Nanite.Culling.TwoPass=1
r.Nanite.Culling.DrawDistance=1
r.Nanite.MaxCandidateClusters=16777216
r.Nanite.MaxVisibleClusters=16777216
r.Nanite.Streaming.StreamingPoolSize=512   ; adjust to scene; larger = less thrash
```

### Debug
```
Nanitestats
Nanitestats List
Nanitestats Primary
r.Nanite.Visualize.Advanced 1
```

### Pitfalls (label, do not block)
- Aggregate geometry (foliage holes) weakens occlusion → overdraw. Label `NANITE_AGGREGATE_OVERDRAW`.
- Closely stacked kitbash is fine; buried geo is cheap to cull.
- Fallback mesh used for ray tracing by default.

## 2. Virtual Shadow Maps (apply all)

VSM = high-res virtualized shadow maps (conceptually 16k×16k, tiled 128×128 pages). Designed for Nanite + Lumen + large worlds. Production-ready in 5.8.

### Enable
Project Settings → Engine → Rendering → Direct Lighting → **Shadow Map Method = Virtual Shadow Maps**  
or
```
r.Shadow.Virtual.Enable=1
```

### Core CVars
```
r.Shadow.Virtual.Enable=1
r.Shadow.Virtual.OnePassProjection=1
r.Shadow.Virtual.MaxPhysicalPages=4096   ; raise if page pool overflow (stats)
r.Shadow.Virtual.NormalBias=0.5          ; raise to 1.0 if low-poly self-shadow artifacts
r.Shadow.Virtual.Stats=1                 ; debug overlay
```

### Directional lights
- No traditional cascades; clipmaps handle resolution.
- Far-distance shadowing handled by VSM itself (no separate Far Shadow Cascades needed for Nanite path).

### Performance notes
- Keep invalidations low (static geometry caches pages).
- Many small local lights still costly; prefer fewer, larger lights where possible.
- Page pool overflow → raise `MaxPhysicalPages` or lower scalability.

### Soft labels
| Condition | Label |
|-----------|-------|
| VSM page pool overflow | `VSM_PAGE_POOL_OVERFLOW` |
| Non-Nanite mesh in VSM scene | `VSM_NON_NANITE_SHADOW` |
| Self-shadow acne on low-poly | `VSM_NORMAL_BIAS_NEEDED` |

## 3. Combined production preset (DefaultEngine.ini snippet)

```ini
[/Script/Engine.RendererSettings]
r.Shadow.Virtual.Enable=1
r.Nanite.ProjectEnabled=1

[SystemSettings]
r.Nanite.Culling.Frustum=1
r.Nanite.Culling.HZB=1
r.Nanite.Culling.TwoPass=1
r.Shadow.Virtual.OnePassProjection=1
r.Shadow.Virtual.MaxPhysicalPages=4096
r.Shadow.Virtual.NormalBias=0.5
```

## 4. TSM application rules
- Cinematic + engineering packages stay on **UE 5.8**.
- 5.9 Preview: test on copy only (Lumen World Cache, AVBOIT, auto Nanite culling gains).
- All failures → soft label; MapLibre / WebGPU / stage / Merkle paths unaffected.
- Human authority final.
