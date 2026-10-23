# PMTiles Workflow for TSM

**Status:** ✅ Working — tested 2026-10-23

PMTiles is a single-file archive format for map tiles. One `.pmtiles` file replaces
thousands of individual tile files or a running tile server. This directly enables TSM's
**"local first, air gapped, USB deployable"** goal.

## Why PMTiles for TSM

| Approach | Files | Server needed? | USB deployable? |
|----------|-------|----------------|-----------------|
| XYZ tile folders | 10,000+ | No (but messy) | Painful |
| MBTiles (SQLite) | 1 | Needs tile server | Yes |
| **PMTiles** | **1** | **No — HTTP range requests** | **Yes** |

PMTiles files can be served from:
- Local disk (file:// or simple HTTP server)
- USB drive
- Static web hosting (no backend needed)
- MapLibre GL JS reads them directly via the `pmtiles` JS library

## Quick Start

### Install (no account required)

```bash
python3 -m venv venv
./venv/bin/pip install pmtiles mapbox-vector-tile
```

### Convert GeoJSON to PMTiles

```bash
./venv/bin/python geojson_to_pmtiles.py input.geojson output.pmtiles
```

This script:
1. Reads a GeoJSON FeatureCollection
2. Projects features to web mercator tiles (z10 by default)
3. Encodes each tile as Mapbox Vector Tile (MVT) with GZIP compression
4. Writes a PMTiles v3 archive

### Verify the output

```python
from pmtiles.reader import Reader, MmapSource

with open('output.pmtiles', 'rb') as f:
    reader = Reader(MmapSource(f))
    header = reader.header()
    print(f"PMTiles v{header['version']}")
    print(f"Tiles: {header['addressed_tiles_count']}")
    print(f"Zoom: {header['min_zoom']}-{header['max_zoom']}")

    # Read a specific tile
    tile_data = reader.get(z, x, y)  # returns gzip-compressed MVT bytes
```

## Demo

Run the included demo:
```bash
./venv/bin/python geojson_to_pmtiles.py tsm-sample.geojson tsm-demo.pmtiles
```

**Input:** `tsm-sample.geojson` — 5 TSM features:
- Anchor site (13101 Bonebank Rd)
- 3 gauges (New Harmony, Shawneetown, Mount Vernon)
- Zone AE floodplain polygon (demo)

**Output:** `tsm-demo.pmtiles` — 788 bytes, 3 tiles at z10, PMTiles spec v3

**Verified:** Round-trip read confirms all 5 features decode correctly from MVT.

## Using PMTiles in MapLibre GL JS

```javascript
import { Protocol } from "pmtiles";

// Register the pmtiles:// protocol (no npm account needed, use CDN)
maplibregl.addProtocol("pmtiles", new Protocol().tile);

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      "tsm-data": {
        type: "vector",
        url: "pmtiles:///path/to/tsm-demo.pmtiles"
      }
    },
    layers: [{
      id: "flood-zones",
      source: "tsm-data",
      "source-layer": "polygons",
      type: "fill",
      paint: { "fill-color": "#85c1e9", "fill-opacity": 0.5 }
    }]
  }
});
```

## Limitations of This Implementation

This pure-Python converter is a **working proof of concept**, not a production tile pipeline:

- **Single zoom level** (z10) — production needs multiple zooms (tippecanoe handles this)
- **No tile clipping** — features crossing tile boundaries are clamped, not split
- **No simplification** — large polygons aren't simplified per zoom (tippecanoe does this)
- **Points and Polygons only** — no LineString support yet

For production TSM tile generation, **tippecanoe** is the right tool:
```bash
# Install tippecanoe (requires build from source)
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe && make && sudo make install

# Generate MBTiles, then convert to PMTiles
tippecanoe -o output.mbtiles -z14 input.geojson
pmtiles convert output.mbtiles output.pmtiles  # pmtiles Go CLI
```

## Files

| File | Description |
|------|-------------|
| `geojson_to_pmtiles.py` | GeoJSON → MVT → PMTiles converter (working) |
| `tsm-sample.geojson` | Demo input with 5 TSM features |
| `tsm-demo.pmtiles` | Demo output (788 bytes, verified) |
| `venv/` | Python virtualenv with pmtiles + mapbox-vector-tile |

## Spec Reference

- PMTiles Specification v3: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
- Python library: https://github.com/protomaps/pmtiles (protomaps/pmtiles, MIT)
- No account or API key required for any of this.
