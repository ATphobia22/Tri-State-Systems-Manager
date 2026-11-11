"""Offline contract tests use tiny synthetic shapefiles and rasters, not official data."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

MODULE = Path(__file__).resolve().parents[2] / "scripts/geospatial/compile_tri_state_offline_layers.py"
spec = importlib.util.spec_from_file_location("tsm_offline_gis", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture(root: Path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    import shapefile
    from pyproj import CRS
    data = root / "data/fabrics/downloads/tiger-2024"
    data.mkdir(parents=True)
    for geoid in mod.COUNTIES:
        for kind in mod.KINDS:
            folder = root / "tmp" / f"{geoid}-{kind}"
            folder.mkdir(parents=True)
            base = folder / f"tl_2024_{geoid}_{kind}"
            with shapefile.Writer(str(base), shapeType=shapefile.POLYLINE) as writer:
                writer.field("LINEARID", "C", size=24)
                writer.line([[[-88.0, 37.9], [-87.9, 38.0]]])
                writer.record(f"{geoid}{kind}")
            base.with_suffix(".prj").write_text(CRS.from_epsg(4269).to_wkt())
            dest = data / f"tl_2024_{geoid}_{kind}.zip"
            with zipfile.ZipFile(dest, "w") as zipout:
                for ext in (".shp", ".shx", ".dbf", ".prj"):
                    f = base.with_suffix(ext)
                    zipout.write(f, f.name)
    aoi = root / "data/posey-county/boundaries/posey-county.geojson"
    aoi.parent.mkdir(parents=True)
    boundary = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "properties": {"GEOID": "18129"},
        "geometry": {"type": "Polygon", "coordinates": [[
            [-88.0, 38.0], [-87.8, 37.8],
            [-88.0, 37.8], [-88.0, 38.0]]]}}]}
    aoi.write_text(json.dumps(boundary))
    dem = root / "data/fabrics/downloads/indiana-dem-2020/posey-dem-2020-2k.tif"
    dem.parent.mkdir(parents=True)
    profile = {"driver": "GTiff", "height": 64, "width": 64, "count": 1,
               "dtype": "float32", "crs": "EPSG:4326",
               "transform": from_origin(-88.1, 38.1, 0.005, 0.005),
               "nodata": -9999.0}
    with rasterio.open(dem, "w", **profile) as dst:
        dst.write(np.arange(4096, dtype="float32").reshape(64, 64), 1)


class RegionalOfflineBuildTests(unittest.TestCase):
    def test_build_and_verify_real_output_formats(self):
        import rasterio
        from PIL import Image
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "repo"
            fixture(root)
            out = Path(temp) / "artifacts"
            manifest = mod.build(root, out)
            self.assertEqual(len(manifest["vector_assets"]), 16)
            self.assertEqual(sum(sum(row.values()) for row in manifest["vector_counts"].values()), 16)
            self.assertFalse(manifest["hydrologic_aoi_approved"])
            self.assertFalse(manifest["regulatory_use"])
            for row in manifest["vector_assets"]:
                path = out / row["path"]
                self.assertEqual(mod.sha256(path), row["sha256"])
                data = json.loads(path.read_text())
                self.assertEqual(len(data["features"]), 1)
                self.assertEqual(data["type"], "FeatureCollection")
            raster = manifest["posey_raster"]
            with rasterio.open(out / raster["geoTIFF"]["path"]) as src:
                self.assertEqual(src.crs.to_epsg(), 4326)
                self.assertGreater(src.width * src.height, 0)
                self.assertEqual(src.tags()["TSM_REVIEW_STATE"], "UNREVIEWED")
                self.assertEqual(src.nodata, -9999.0)
                sampled = src.read(1)
                self.assertGreater((sampled == src.nodata).sum(), 0)
                self.assertGreater((sampled != src.nodata).sum(), 0)
            im = Image.open(out / raster["previewPNG"]["path"])
            self.assertEqual(im.mode, "RGBA")
            import numpy as np
            alphas = np.asarray(im)[:, :, 3]
            self.assertGreater((alphas == 0).sum(), 0)
            self.assertGreater((alphas == 255).sum(), 0)

    def test_missing_county_asset_blocks_completion(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "repo"
            fixture(root)
            (root / "data/fabrics/downloads/tiger-2024/tl_2024_21225_roads.zip").unlink()
            with self.assertRaises(ValueError):
                mod.build(root, Path(temp) / "artifacts")

    def test_reject_in_repo_destination(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "repo"
            fixture(root)
            with self.assertRaises(ValueError):
                mod.build(root, root / "data/offline")


if __name__ == "__main__":
    unittest.main()
