# turbovec: Technical Assessment for TSM

**Date:** 2026-10-18
**Repo:** https://github.com/ATphobia22/turbovec (MIT, fork, 152 commits)
**Verdict:** turbovec is an **embedding vector-search index, not a geospatial file compressor**.
It cannot shrink GeoTIFFs, GeoJSONs, 3D Tiles, or PDFs. It has exactly one
legitimate application in TSM: quantizing the TESSERA embedding arrays for
fast similarity search at a fraction of the RAM.

---

## 1. What turbovec actually is

A Rust vector index with Python bindings, built on Google Research's
**TurboQuant** algorithm (arXiv:2504.19874, Zandieh et al., 2025 — CC-BY-4.0).
It compresses **high-dimensional embedding vectors** (e.g. 1536-dim float32
→ 2-bit or 4-bit per coordinate) for **approximate nearest-neighbor search**.

How it works (from the README + paper):
1. Normalize each vector (strip the norm, store as one float).
2. Apply a fixed random rotation → coordinates follow a known Beta/Gaussian
   distribution regardless of input data (data-oblivious, no training phase).
3. Per-coordinate Lloyd-Max scalar quantization (4 buckets at 2-bit, 16 at 4-bit).
4. Bit-pack: a 1536-dim float32 vector (6,144 bytes) → 384 bytes at 2-bit (**16×**).
5. Length-renormalized scoring removes inner-product bias at query time.

Key properties: online ingest (no train step), SIMD search kernels
(NEON/AVX-512, beats FAISS IndexPQFastScan by 10–19% on ARM), search-time
filtering via id allowlist, pure local / air-gapped friendly.

**What it is NOT:** a codec for rasters, vectors, meshes, or documents.
Feeding it a GeoTIFF or GeoJSON is a category error — it expects dense
float embedding matrices, not geospatial files.

---

## 2. Installation

```bash
pip install turbovec          # Python (PyPI)
# or build from source:
cargo build --release         # Rust
cd turbovec-python && maturin build --release && pip install target/wheels/*.whl
```

Optional framework integrations (drop-in vector-store replacements):
`pip install turbovec[langchain]`, `[llama-index]`, `[haystack]`, `[agno]`.

---

## 3. The one real TSM application: TESSERA embedding quantization

TSM downloads TESSERA embeddings (`tessera_2025_anchor_20km.npy`):
**shape (2000, 2000, 128), float32 = 2.0 GB** — 4M vectors × 128 dims.

If TSM ever needs *similarity search over embeddings*
(e.g. "find anchor-window patches with similar land-cover signatures"),
turbovec is the right tool for that job:

```python
import numpy as np
from turbovec import TurboQuantIndex

emb = np.load("tessera_2025_anchor_20km.npy", mmap_mode="r")
vecs = emb.reshape(-1, 128).astype(np.float32)   # (4_000_000, 128)

index = TurboQuantIndex(dim=128, bit_width=4)    # 4-bit: 8x compression
index.add(vecs)                                  # online ingest, no training
index.write("tessera_anchor_20km.tv")            # ~256 MB on disk

loaded = TurboQuantIndex.load("tessera_anchor_20km.tv")
scores, idx = loaded.search(query_vec, k=10)     # SIMD search, recall ≈ FAISS PQ
```

### Expected compression ratios (from README benchmarks)

| Config | Bytes/vector (d=128) | 4M vectors | Ratio vs float32 |
|--------|----------------------|------------|------------------|
| float32 (baseline) | 512 B | 2.0 GB | 1× |
| 4-bit TurboQuant | ~64 B + norm | ~256 MB | **~8×** |
| 2-bit TurboQuant | ~32 B + norm | ~128 MB | **~16×** |

Recall: beats FAISS `IndexPQ` by 0.2–1.9 pts R@1 at d=1536/3072;
on low-dim vectors (d=128–200) it is level-to-ahead at 4-bit, roughly
tied at 2-bit. For d=128 TESSERA embeddings, prefer **4-bit** (recall
is the priority; 8× is still a large win).

### Integration recommendation for TSM

- **Do** use turbovec if/when a "similar-patch search" feature is built
  over TESSERA embeddings (flood-forecasting analog search, land-cover
  retrieval). Add `scripts/flood-forecasting/tessera-quantize.py` wrapping
  the snippet above; store `.tv` artifacts next to the `.npy`.
- **Do not** route GeoTIFF/GeoJSON/GLB/PDF bytes through it — it will
  either error or produce garbage; it is not a general compressor.
- The full tri-state bbox tiling (~130 GB of embeddings) is exactly the
  scale where 8–16× quantization matters; keep `.npy` as the archival
  format and `.tv` as the search index.

---

## 4. What actually shrinks TSM's geospatial files

turbovec cannot help here. The correct tools per data type:

| Data type | Current pain | Right tool | Expected result |
|-----------|--------------|------------|-----------------|
| GeoTIFF DEMs (2.5 ft, 1 m 3DEP) | 10s–100s of MB each | **COG + DEFLATE/ZSTD**: `gdal_translate -of COG -co COMPRESS=ZSTD in.tif out.tif` | 2–5× smaller, streamable |
| GeoJSON parcels/floodplain (posey-parcels-2025.geojson) | 10s of MB text | **PMTiles** via `tippecanoe`: `tippecanoe -o parcels.pmtiles --drop-densest-as-needed parcels.geojson` | 5–20× smaller, single-file tiles |
| 3D building meshes (GLB) | 39 MB GLBs | **Draco** compression: `gltf-pipeline -i in.glb -o out.glb -d` | 3–10× on geometry |
| PDFs (FIS, USACE reports) | 3–10 MB | already compressed; `ocrmypdf --optimize 1` if scanned | marginal |
| Large downloads >100 MB | GitHub push rejection | **chunk + reassemble** (already the repo pattern: `chunks/` + `reassemble.sh` + `chunks.sha256`) | pushes succeed |

Chunking (the user's immediate ask) is already the established repo
pattern — see `data/fabrics/government-downloads/chunks/` with
`reassemble.sh` and `chunks.sha256`. Apply the same pattern to any new
large download:

```bash
mkdir -p data/fabrics/<source>/chunks
split -b 25M bigfile.zip data/fabrics/<source>/chunks/bigfile.zip.part-
sha256sum data/fabrics/<source>/chunks/* > data/fabrics/<source>/chunks.sha256
cat > data/fabrics/<source>/reassemble.sh <<'EOF'
#!/bin/bash
cat chunks/bigfile.zip.part-* > bigfile.zip
sha256sum -c chunks.sha256
EOF
chmod +x data/fabrics/<source>/reassemble.sh
```

Keep every chunk ≤ 25 MB (well under GitHub's 100 MB hard limit and the
50 MB soft warning). Never commit the reassembled file.

---

## 5. Bottom line

- **turbovec**: excellent at what it does (embedding quantization +
  vector search), irrelevant to TSM's file-size problem, with one
  genuine future use: TESSERA embedding similarity search at 8–16× RAM
  reduction.
- **Project size reduction**: use COG/ZSTD for rasters, PMTiles/tippecanoe
  for large GeoJSON, Draco for GLBs, and the existing chunk+reassemble
  pattern for anything that must live in git.
