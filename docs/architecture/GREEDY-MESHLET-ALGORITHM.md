# TSM Greedy Meshlet Builder — Algorithm and Batch Contract

**Status:** deterministic prototype for rendering experiments. Output authority remains `SIMULATION_DEMO`; it is not survey, engineering, regulatory, or flood-model evidence.

## What a meshlet is

A meshlet is a small triangle cluster with two index levels:

1. A **global vertex remap** lists which original mesh vertices the cluster uses.
2. A **local micro-index buffer** refers to those vertices using compact local indices.

The renderer can cull a cluster as a unit before submitting its triangles. This reduces per-object submission overhead and supports GPU-driven rendering, but the result quality depends on cluster locality, bounds, and the culling strategy.

## Greedy sequential clustering used by TSM

The current portable builder deliberately preserves source triangle order. It is not the meshoptimizer cone-aware clustering algorithm. The TSM batch contract caps clusters at 64 vertices and 124 triangles; this is a project-specific conservative limit, not a claim that the meshoptimizer API uses the same triangle cap (its documented examples commonly use 64/126).

1. Validate the input arrays, triangle topology, finite positions/normals, and global index range.
2. Start an empty meshlet with a global-to-local vertex map.
3. Read the next triangle in source order. Count the distinct vertices it would add.
4. Append it if the resulting meshlet stays within **64 unique vertices** and **124 triangles**. For each triangle corner, reuse an existing local index or assign the next local index.
5. If adding the triangle would exceed either budget, close the current meshlet and retry that same triangle in a new meshlet.
6. Compute a conservative sphere from the axis-aligned bounds of the cluster's referenced vertices, write packed offsets/counts, and continue until every source triangle is assigned.
7. Validate that all meshlets obey both budgets, packed offsets are contiguous, local indices stay in range, and the output triangle count equals the input count.
8. Emit a compressed JSON MeshletPack and SHA-256 source/output records in the batch manifest.

Pseudocode:

```text
while triangles remain:
    create empty localVertexMap, localVertices, localTriangles
    while next triangle exists and triangle budget remains:
        additional = unique triangle vertices absent from localVertexMap
        if localVertexMap.size + additional > 64:
            break
        append triangle using local vertex indices
        advance source triangle cursor
    if no triangle was accepted:
        report a builder error (never loop indefinitely)
    emit meshlet descriptor, local remap, local micro-indices, and bounds
```

Because source triangle order is preserved, the builder is deterministic for a fixed input and does not search neighboring triangles to improve reuse or spatial coherence. A triangle that shares no vertices with the current cluster may force an early split even if a different triangle elsewhere would fit. Its practical complexity is linear in the number of triangles for the sequential clustering pass, plus the cost of validating and serializing the mesh. Cluster bounds are computed over each cluster's triangles.

## Why this is not a production Nanite bake

The in-repo builder does **not** produce:

- meshoptimizer's topology/culling-aware clustering;
- cone-culling metadata tuned by a cone weight;
- a hierarchy of continuous LODs, parent-child DAG, or screen-space error guarantees;
- UVs, colors, texture/material shading payloads, or full scene/material equivalence;
- proof that geometry is suitable for engineering decisions.

The production upgrade path is an offline pipeline using the upstream meshoptimizer APIs (for example, `meshopt_buildMeshlets`, followed by `meshopt_optimizeMeshlet` and bounds generation as appropriate), then a separately validated hierarchy/LOD pipeline. Meshoptimizer documents that its builder balances vertex reuse against culling efficiency; its scan variant instead greedily aggregates consecutive triangles from a vertex-cache-optimized index buffer. These are distinct algorithms and must not be described as interchangeable.

Reference: [meshoptimizer clusterization documentation](https://github.com/zeux/meshoptimizer#clusterization) and [NVIDIA mesh shader guidance](https://developer.nvidia.com/blog/introduction-turing-mesh-shaders/).

## Batch acceptance criteria

The batch job must:

- discover the expected checked-in GLB inventory and account for every discovered file;
- validate GLB 2.0 headers, chunk boundaries, embedded buffers, accessor types/strides/offsets, node transforms, triangle topology, and vertex indices;
- reject unsupported compressed, sparse, animated/skinned, morph-target, or non-triangle inputs explicitly;
- emit one success or failure record per input, with source hash and deterministic relative path;
- validate every emitted meshlet's 64/124 budgets, offsets, local-index range, and exact source-triangle coverage;
- set `complete=true` only if every input built, no failures remain, and any expected inventory count matches.

A failure ledger is part of the output contract, not permission to publish incomplete geometry as complete. Generated artifacts remain simulation/demo assets until separately validated for their intended runtime use.
