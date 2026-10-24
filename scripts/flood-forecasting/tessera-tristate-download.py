#!/usr/bin/env python3
"""
TESSERA embeddings download for the TSM tri-state region.

Pulls 128-dimensional, 10m annual land embeddings (2017-2025) from the
AWS Open Data Registry Icechunk store for the Ohio-Wabash tri-state area.

Prereqs: pip install "icechunk>=2" "numcodecs[pcodec]" xarray dask s3fs pyproj numpy
(The store is Icechunk v2 format — icechunk 1.x cannot open it.)

Access is READ-ONLY and ANONYMOUS: this script never writes to the S3
bucket and never creates AWS resources. Verified live 2026-10-23
(icechunk 2.3.0, group "16N": time 2017-2025, EPSG:32616,
embeddings int8 [time,northing,easting,128], scales float32,
northing DESCENDING).

Sample clip (privacy-safe): `--sample-clip` pulls a small (~3 MB, one year)
window in the general Point Township vicinity with ROUNDED coordinates
(deliberately NOT anchor-targeted). It writes a .npy plus a
<name>.manifest.json with SHA-256 and full provenance.

Egress note (measured 2026-10-23): this VM's egress proxy truncates S3
response streams above ~4MB, which breaks icechunk's whole-chunk reads
with a TLS/streaming error. open_store() therefore wraps the Icechunk
store in _ProxySafeStore, which reissues large byte-range reads as
<=2MB sub-requests — same bytes, same order, only the request sizing
changes. Read-only throughout.

Full tri-state bbox: `python tessera-tristate-download.py --full-tristate`.
Downloads the whole tri-state bbox as 20km tiles — ~130+ GB — with an
interactive y/N confirmation. DO NOT RUN WITHOUT EXPLICIT USER APPROVAL.
Run it only on a machine with sufficient disk, and never on this VM's
ephemeral scratch.

Dataset: https://registry.opendata.aws/tessera/  (CC-BY-SA)
Docs:    https://github.com/dClimate/tessera-embeddings/blob/main/docs/global-store.md
Store:   s3://tessera-embeddings/v1.1/dclimate.icechunk (us-west-2, anonymous reads OK)

Updated 2026-10-18: Rewritten to use the working Icechunk pattern.
The geotessera client API pattern does not work — use icechunk directly.

Zone 16N covers the entire tri-state area (EPSG:32616).
Northing is DESCENDING (step -10m) — slice as slice(N_MAX, N_MIN).
Dequantize: embeddings * scales (float32). NaN scale = unembedded pixel.
"""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from tsm_config import (
    ANCHOR_UTM_E, ANCHOR_UTM_N,
    TESSERA_BUCKET, TESSERA_PREFIX, TESSERA_REGION,
    TESSERA_ZONE, TESSERA_YEAR,
    OUTPUT_DIRS,
)

# ---------------------------------------------------------------------------
# Provenance / license
# ---------------------------------------------------------------------------
TESSERA_STORE_URL = f"{TESSERA_BUCKET}/{TESSERA_PREFIX}"
TESSERA_REGISTRY_URL = "https://registry.opendata.aws/tessera/"
TESSERA_LICENSE = "CC-BY-SA"
TESSERA_CRS = "EPSG:32616"
TESSERA_YEARS = "2017-2025"

# Sample clip center: general Point Township vicinity, UTM 16N,
# ROUNDED to the nearest 100 m — deliberately NOT anchor-targeted
# (privacy directive 2026-10-23).
SAMPLE_CENTER_E = 407500
SAMPLE_CENTER_N = 4185500
SAMPLE_HALF_WIDTH_M = 400  # 800 m x 800 m -> ~3.3 MB float32 (H, W, 128)

OUT_DIR = Path(os.environ.get("TESSERA_OUT", str(OUTPUT_DIRS["tessera"])))
OUT_DIR.mkdir(parents=True, exist_ok=True)


def _proxy_safe_store_class():
    """Build the _ProxySafeStore class on first use (needs zarr installed).

    Deferred so module import, ``--help``, and offline tests work without zarr.
    Access via module attribute ``_ProxySafeStore`` (lazy ``__getattr__``) or
    this factory directly. The built class is cached so repeated accesses
    return the identical class object.
    """
    global _cached_proxy_safe_store_class
    if _cached_proxy_safe_store_class is None:
        from zarr.abc.store import Store

        class _ProxySafeStore(Store):
            """zarr Store wrapper that splits large byte-range reads into small pieces.

            Measured 2026-10-23 on this VM: the egress proxy truncates S3 response
            streams above ~4MB (a 7.9MB range GET returned only ~4.1MB), which makes
            icechunk's chunk reader fail with a TLS/streaming error. Splitting a
            large range into <=2MB sub-requests returns the same bytes in the same
            order — only the request sizing changes. Read-only use.
            """

            _MAX_RANGE_BYTES = 2_000_000

            def __init__(self, inner):
                super().__init__(read_only=True)
                self._inner = inner

            def __eq__(self, other):
                return isinstance(other, _ProxySafeStore) and self._inner == other._inner

            def __hash__(self):
                return hash(("proxy-safe", self._inner))

            @staticmethod
            def _split(start, end):
                from zarr.abc.store import RangeByteRequest

                step = _ProxySafeStore._MAX_RANGE_BYTES
                return [RangeByteRequest(s, min(s + step, end))
                        for s in range(start, end, step)]

            @staticmethod
            def _is_big(byte_range):
                from zarr.abc.store import RangeByteRequest

                return (isinstance(byte_range, RangeByteRequest)
                        and byte_range.end - byte_range.start > _ProxySafeStore._MAX_RANGE_BYTES)

            async def get(self, key, prototype, byte_range=None):
                if self._is_big(byte_range):
                    parts = []
                    for sub in self._split(byte_range.start, byte_range.end):
                        buf = await self._inner.get(key, prototype, sub)
                        if buf is None:
                            return None
                        parts.append(buf.to_bytes())
                    return prototype.buffer.from_bytes(b"".join(parts))
                return await self._inner.get(key, prototype, byte_range)

            async def get_partial_values(self, prototype, key_ranges):
                import asyncio

                from zarr.abc.store import RangeByteRequest

                key_ranges = list(key_ranges)
                # Expand big ranges into pieces; remember how to reassemble.
                expanded = []          # (key, sub_range) in fetch order
                plan = []              # per input: list of positions into expanded, or None
                for key, byte_range in key_ranges:
                    if self._is_big(byte_range):
                        pos = []
                        for sub in self._split(byte_range.start, byte_range.end):
                            pos.append(len(expanded))
                            expanded.append((key, sub))
                        plan.append(pos)
                    else:
                        plan.append(len(expanded))
                        expanded.append((key, byte_range))

                got = await self._inner.get_partial_values(prototype, expanded)

                out = []
                for p in plan:
                    if isinstance(p, list):
                        bufs = [got[i] for i in p]
                        if any(b is None for b in bufs):
                            out.append(None)
                        else:
                            out.append(prototype.buffer.from_bytes(
                                b"".join(b.to_bytes() for b in bufs)))
                    else:
                        out.append(got[p])
                return out

            async def exists(self, key):
                return await self._inner.exists(key)

            async def set(self, key, value):
                raise NotImplementedError("proxy-safe store is read-only")

            async def delete(self, key):
                raise NotImplementedError("proxy-safe store is read-only")

            async def clear(self):
                raise NotImplementedError("proxy-safe store is read-only")

            async def list(self):
                async for k in self._inner.list():
                    yield k

            async def list_prefix(self, prefix):
                async for k in self._inner.list_prefix(prefix):
                    yield k

            async def list_dir(self, prefix):
                async for k in self._inner.list_dir(prefix):
                    yield k

            @property
            def supports_writes(self):
                return False

            @property
            def supports_deletes(self):
                return False

            @property
            def supports_listing(self):
                return self._inner.supports_listing

            @property
            def read_only(self):
                return True

        _cached_proxy_safe_store_class = _ProxySafeStore
    return _cached_proxy_safe_store_class


_cached_proxy_safe_store_class = None


def __getattr__(name):
    # Lazy alias so `MODULE._ProxySafeStore` keeps working (needs zarr).
    if name == "_ProxySafeStore":
        return _proxy_safe_store_class()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")



def open_store():
    """Open the TESSERA Icechunk store (anonymous, read-only).

    The raw store is wrapped in _ProxySafeStore so large chunk payloads
    are fetched as <=2MB range requests (this VM's egress proxy truncates
    S3 streams above ~4MB).
    """
    import icechunk

    storage = icechunk.s3_storage(
        bucket=TESSERA_BUCKET.replace("s3://", ""),
        prefix=TESSERA_PREFIX,
        region=TESSERA_REGION,
        anonymous=True,
    )
    repo = icechunk.Repository.open(storage=storage)
    session = repo.readonly_session(branch="main")
    return _proxy_safe_store_class()(session.store)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(out_path: Path, *, year: int, center_e: int, center_n: int,
                   half_width_m: int, anchor_targeted: bool) -> Path:
    """Write a provenance manifest next to a downloaded .npy clip."""
    manifest_path = out_path.with_suffix(".manifest.json")
    manifest = {
        "artifact": out_path.name,
        "sha256": sha256_file(out_path),
        "size_bytes": out_path.stat().st_size,
        "store_url": TESSERA_STORE_URL,
        "registry": TESSERA_REGISTRY_URL,
        "access_date_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "vintage": {
            "year": year,
            "time_index": year - 2017,
            "store_years": TESSERA_YEARS,
            "years_present": 9,
        },
        "crs": TESSERA_CRS,
        "license": TESSERA_LICENSE,
        "attribution": (
            "TESSERA land embeddings by dClimate, served via the AWS "
            "Registry of Open Data. Licensed CC-BY-SA: attribute dClimate "
            "and share derived products alike."
        ),
        "access": "anonymous read-only S3 (no writes, no resource creation)",
        "dequantization": "embeddings(int8) * scales(float32); NaN scale = unembedded pixel (set to 0)",
        "bbox_utm_16n_approx": {
            "easting_min": center_e - half_width_m,
            "easting_max": center_e + half_width_m,
            "northing_min": center_n - half_width_m,
            "northing_max": center_n + half_width_m,
            "note": "UTM 16N meters; rounded to 100 m; northing descending in store",
        },
        "anchor_targeted": anchor_targeted,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[{year}] manifest: {manifest_path}")
    return manifest_path


def download_window(
    year: int = TESSERA_YEAR,
    center_e: int = ANCHOR_UTM_E,
    center_n: int = ANCHOR_UTM_N,
    half_width_m: int = 10000,
    zone: str = TESSERA_ZONE,
    anchor_targeted: bool = True,
) -> Path:
    """
    Download a square window of TESSERA embeddings centered on (E, N).

    Default: 20km x 20km centered on anchor site, year 2025.
    Output: float32 dequantized array, shape (H, W, 128), plus a
    provenance manifest JSON written next to it.
    """
    import xarray as xr

    tag = "anchor" if anchor_targeted else "sample"
    width_m = half_width_m * 2
    size_tag = f"{width_m // 1000}km" if width_m >= 1000 else f"{width_m}m"
    out_path = OUT_DIR / f"tessera_{year}_{tag}_{size_tag}.npy"
    if out_path.exists():
        print(f"[{year}] already downloaded: {out_path}")
        return out_path

    print(f"[{year}] opening TESSERA store (zone {zone})...")
    store = open_store()

    group_path = f"{zone}"
    print(f"[{year}] opening group: {group_path}")

    try:
        ds = xr.open_zarr(store, group=group_path, chunks={})
    except Exception as e:
        # Resilient: report the store failure honestly, never fake a sample.
        raise RuntimeError(
            f"TESSERA store unavailable (group {group_path}): {e}. "
            "No sample was downloaded."
        ) from e
    print(f"  Dims: {dict(ds.sizes)}")

    # Time index: 0=2017, ..., 8=2025
    time_idx = year - 2017
    if not 0 <= time_idx < ds.sizes["time"]:
        raise ValueError(
            f"Year {year} not in store (time index {time_idx} of "
            f"{ds.sizes['time']}, years {TESSERA_YEARS})."
        )

    e_min, e_max = center_e - half_width_m, center_e + half_width_m
    n_min, n_max = center_n - half_width_m, center_n + half_width_m

    print(f"[{year}] window: E {e_min}-{e_max}, N {n_min}-{n_max}")
    print(f"[{year}] loading embeddings...")

    # Northing is descending — slice(max, min)
    emb = ds["embeddings"].isel(time=time_idx).sel(
        easting=slice(e_min, e_max),
        northing=slice(n_max, n_min),
    )
    scales = ds["scales"].isel(time=time_idx).sel(
        easting=slice(e_min, e_max),
        northing=slice(n_max, n_min),
    )

    emb_vals = emb.values.astype(np.float32)
    scale_vals = scales.values.astype(np.float32)

    valid = ~np.isnan(scale_vals)
    print(f"[{year}] valid pixels: {valid.sum():,} / {valid.size:,} "
          f"({100*valid.sum()/valid.size:.1f}%)")
    print(f"  Embeddings shape: {emb_vals.shape}")
    print(f"  Scales shape: {scale_vals.shape}")

    if emb_vals.shape[-1] == 128:
        dequant = emb_vals * scale_vals[..., np.newaxis]
    elif emb_vals.shape[0] == 128:
        dequant = np.transpose(emb_vals * scale_vals[np.newaxis, ...], (1, 2, 0))
    else:
        raise ValueError(f"Unexpected embeddings shape: {emb_vals.shape}")

    if dequant.shape[-1] == 128:
        dequant[~valid] = 0

    print(f"[{year}] dequantized shape: {dequant.shape}, dtype: {dequant.dtype}")
    print(f"[{year}] saving ({dequant.nbytes / 1e6:.1f} MB)...")
    np.save(out_path, dequant)
    print(f"[{year}] done: {out_path}")
    write_manifest(out_path, year=year, center_e=center_e, center_n=center_n,
                   half_width_m=half_width_m, anchor_targeted=anchor_targeted)
    return out_path


def download_sample_clip(year: int = TESSERA_YEAR) -> Path:
    """
    Privacy-safe proof-of-access sample: a small (~3 MB) window in the
    general Point Township vicinity with rounded, NOT anchor-targeted
    coordinates. Writes .npy + SHA-256 provenance manifest.
    """
    print("TESSERA sample clip: general Point Township vicinity "
          f"(E {SAMPLE_CENTER_E}, N {SAMPLE_CENTER_N} UTM 16N, rounded; "
          "NOT anchor-targeted).")
    return download_window(
        year=year,
        center_e=SAMPLE_CENTER_E,
        center_n=SAMPLE_CENTER_N,
        half_width_m=SAMPLE_HALF_WIDTH_M,
        anchor_targeted=False,
    )


def download_tristate_tiled(year: int = TESSERA_YEAR, tile_km: int = 20):
    """Download full tri-state bbox as tiles (130+ GB — use with caution)."""
    E_MIN, E_MAX = 349932, 482560
    N_MIN, N_MAX = 4161455, 4262663

    tile_m = tile_km * 1000
    n_tiles_x = (E_MAX - E_MIN + tile_m - 1) // tile_m
    n_tiles_y = (N_MAX - N_MIN + tile_m - 1) // tile_m
    total = n_tiles_x * n_tiles_y

    print(f"Full tri-state: {n_tiles_x}x{n_tiles_y} = {total} tiles (~130+ GB)")
    confirm = input(f"FULL-BBOX DOWNLOAD of {total} tiles (~130+ GB, read-only "
                    "anonymous S3). Only proceed with explicit user approval. [y/N]: ")
    if confirm.lower() != "y":
        print("Cancelled.")
        return

    for ix in range(n_tiles_x):
        for iy in range(n_tiles_y):
            cx = E_MIN + ix * tile_m + tile_m // 2
            cy = N_MIN + iy * tile_m + tile_m // 2
            print(f"\nTile {ix*n_tiles_y+iy+1}/{total}: ({cx}, {cy})")
            try:
                download_window(year, cx, cy, tile_m // 2)
            except Exception as e:
                print(f"  FAILED: {e}")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="TESSERA download (Icechunk)")
    ap.add_argument("--year", type=int, default=TESSERA_YEAR)
    ap.add_argument("--half-width-m", type=int, default=10000)
    ap.add_argument("--full-tristate", action="store_true",
                      help="Full tri-state tiled download (~130+ GB). "
                           "REQUIRES EXPLICIT USER APPROVAL; do not run casually.")
    ap.add_argument("--sample-clip", action="store_true",
                      help="Privacy-safe small sample clip (~3 MB) + provenance manifest.")
    ap.add_argument("--tile-km", type=int, default=20)
    args = ap.parse_args()

    if args.full_tristate:
        download_tristate_tiled(args.year, args.tile_km)
    elif args.sample_clip:
        download_sample_clip(args.year)
    else:
        download_window(args.year, half_width_m=args.half_width_m)
