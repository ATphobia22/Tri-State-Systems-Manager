# PDAL stream mode — TSM guidance

## Standard vs stream

| Mode | Behavior | When |
|------|----------|------|
| **Standard** | Load all points into memory, then process | Neighbor/sort/cluster algorithms |
| **Stream** | Process points in **chunks**; lower RAM | Filters that only need local point attributes |

`pdal pipeline` / `pdal translate` **prefer stream mode** when every stage is streamable; otherwise fall back to standard. Force standard with `--nostream`.

## Streamable stages (examples)

Typically streamable:

- `readers.las` / many readers  
- `filters.crop`, `filters.expression`, `filters.range`  
- many writers (`writers.las`, `writers.text`)

Typically **not** streamable:

- neighbor / global algorithms: `filters.cluster`, many SM RF variants needing full neighborhood context  
- stages that build KD-trees over the full cloud  

A pipeline is streamable **only if all stages** are streamable. Check per-stage docs (blue “streamable” bar) or Python: `stage.streamable`.

## Python API

```python
import pdal
pipe = pdal.Reader.las("tile.las") | pdal.Filter.expression(expression="Classification == 2") | pdal.Writer.las(filename="ground.laz")
assert pipe.streamable  # True if entire chain streams

# Chunk iteration (no full materialization)
for arr in pipe.iterator(chunk_size=100_000):
    ...

# Or execute writers in streaming mode
pipe.execute_streaming(chunk_size=100_000)
```

## TSM LOMA pipelines

`lag_extract_optimized.json` and `ground_extract_stream.json` use crop + expression + writer — intended to **stream**.

Avoid inserting non-streamable ground classifiers mid-LAG path unless necessary; prefer pre-classified Class 2 from GIO products when available.

## Bonebank note

Structure LAG 377.2 ft is **outside** low-ground tile `IN2020_26800940_12` max (~366.5 ft). Stream crop to foundation buffer; still ingest **adjacent higher tiles** for valid LAG.

