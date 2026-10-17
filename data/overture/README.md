# Overture Maps buildings — Posey AOI extracts

**Release:** 2026-09-23.1  
**Downloaded:** 2026-10-17

## Policy on “full parquet shards”

| Theme | Global scale | What we download |
|-------|--------------|------------------|
| `building` | ~2.53B features, **512** shards (~hundreds of GB) | STAC filter → **2** shards covering Posey (~1.25 GB) → bbox extract |
| `building_part` | ~4.49M features, **3** shards | STAC filter → **1** shard covering Posey (~157 MB) → bbox extract |

**Full global mirrors are not stored in-repo.** Covering shards were downloaded, filtered, and only small AOI extracts are retained.

## Extracts

### building (Posey bbox)

| Metric | Value |
|--------|--------|
| Count | **24,375** |
| With height > 0 | **18,302** |
| Median height (m) | **3.666** |

### building_part (Posey bbox)

| Metric | Value |
|--------|--------|
| Count | **15** |
| Covering global shard | `part-00000` (~157 MB) |

Posey is largely rural; few multipart 3D building models exist in Overture here.

## License

ODbL-1.0 (buildings theme).

## S3 paths

```
s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building/
s3://overturemaps-us-west-2/release/2026-09-23.1/theme=buildings/type=building_part/
```
