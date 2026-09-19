# WebGPU Presentation Contract

## Scope

The TSM Open-World Twin uses MapLibre GL JS as the primary browser map renderer.
MapLibre custom layers render in MapLibre's WebGL context. The optional WebGPU
renderer therefore runs as a separate presentation renderer and must not claim
to be a MapLibre WebGPU custom layer.

## Source requirements

The WebGPU terrain renderer requires a caller-supplied:

- height texture;
- satellite texture;
- height encoding scale/offset;
- metric terrain bounds;
- horizontal CRS;
- vertical datum;
- source/provenance URI; and
- SHA-256 provenance hash.

There are no dummy terrain textures and no hard-coded BFE, LAG, FFE or berm
elevations.

## Coordinate contract

The renderer's camera matrix and position are metric local coordinates supplied
by the caller. MapLibre Web Mercator coordinates are not silently passed to this
renderer as engineering metres or feet. A future bridge must perform and record
the explicit coordinate transformation before rendering.

## Authority boundary

The renderer produces transient presentation pixels only. It does not write to
PostGIS, HEC-RAS state, the Evidence Ledger, regulatory artifacts, or human
governance state.

## Browser fallback

WebGPU is optional. When unavailable or when a verified terrain source is not
bound, the application keeps the existing MapLibre/WebGL visualization path.
