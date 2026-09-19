# TSM Evidence / Analysis / Presentation Boundary

TSM maintains three explicitly separated planes:

1. **Evidence plane** — source records, immutable input manifests, hashes, acquisition/validity metadata, authoritative agency references, and human attestations.
2. **Analysis plane** — reprojection, terrain derivatives, hydraulic models, HEC-RAS/HEC-HMS execution, uncertainty calculations, and derived outputs.
3. **Presentation plane** — MapLibre/WebGL, WebGPU, Three.js, 3D Tiles, photogrammetry, Gaussian splats, story maps, and other visualization.

Presentation outputs MUST NOT be promoted to engineering evidence merely because they look realistic or reproduce a source visually. Derived results MUST retain their input hashes and transformation metadata. Regulatory determinations remain outside rendering code and require the applicable authoritative rules, model evidence, and human review.
