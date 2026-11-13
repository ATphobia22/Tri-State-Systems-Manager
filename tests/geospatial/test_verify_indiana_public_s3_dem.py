"""Offline tests for unsigned-source S3 metadata and atomic DEM evidence receipts."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[2] / "scripts/geospatial/verify_indiana_public_s3_dem.py"
spec = importlib.util.spec_from_file_location("verify_public_dem_s3", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def plan(*, covered=True, names=None):
    names = names or ["IN2020_26700930_12.tif"]
    return {
        "schemaVersion": "tsm.posey-official-dem-tiles.v1",
        "sourceService": mod.SERVICE,
        "sourceLayer": 0,
        "county": "Posey",
        "sourceYear": 2020,
        "authoritativeBuildingCount": 23082,
        "polygonCoverageVerified": covered,
        "buildingsWithoutCompletePolygonCoverage": 0 if covered else 100,
        "requiredFilenames": names,
        "requiredFilenameCount": len(names),
    }


class FakeS3:
    def __init__(self, content):
        self.content = content
        self.requested = []
    def head_object(self, *, Bucket, Key):
        self.requested.append((Bucket, Key))
        return {"ContentLength": len(self.content), "ETag": '"fake-not-SHA256"'}
    def download_fileobj(self, bucket, key, handle):
        handle.write(self.content)


class BrokenS3(FakeS3):
    def head_object(self, *, Bucket, Key):
        raise RuntimeError("network unavailable")


class PublicDemReceiptTests(unittest.TestCase):
    def test_fail_without_verified_full_polygon_coverage(self):
        with self.assertRaisesRegex(ValueError, "polygon coverage"):
            mod.required_names(plan(covered=False))

    def test_fail_wrong_source_metadata_and_filename(self):
        p=plan()
        p["sourceService"]="https://somewhere.invalid/query"
        with self.assertRaisesRegex(ValueError, "polygon coverage"):
            mod.required_names(p)
        for names in (["../bad.tif"], ["IN2021_26700930_12.tif"],
                      ["IN2020_26700930_12.tif"]*2):
            with self.subTest(names=names), self.assertRaises(ValueError):
                mod.required_names(plan(names=names))

    def test_dem_bucket_is_not_lidar_catalog_bucket(self):
        self.assertEqual(mod.BUCKET, "gisimageryingov")
        self.assertNotEqual(mod.BUCKET, "giselevationingov")
        self.assertEqual(mod.PREFIX, "demoptimized/statewide/2020/SPW/2.5ft/")

    def test_head_only_is_not_hash_or_datum_evidence(self):
        client=FakeS3(bytes((0x49,0x49,0x2A,0x00))+bytes(12))
        receipt=mod.survey_s3_objects(plan(),client)
        self.assertTrue(receipt["sourceObjectsHeadVerified"])
        self.assertFalse(receipt["allBytesAcquiredAndSha256Verified"])
        self.assertFalse(receipt["verticalDatumVerified"])
        self.assertFalse(receipt["rasterPixelValuesVerified"])
        self.assertEqual(client.requested[0][0],"gisimageryingov")
        self.assertEqual(client.requested[0][1],
                         "demoptimized/statewide/2020/SPW/2.5ft/IN2020_26700930_12.tif")

    def test_download_hashes_and_does_not_certify_terrain(self):
        payload=bytes((0x49,0x49,0x2A,0x00))+bytes(12)
        with tempfile.TemporaryDirectory() as folder:
            receipt=mod.survey_s3_objects(plan(),FakeS3(payload),output_dir=Path(folder))
            self.assertTrue(receipt["allBytesAcquiredAndSha256Verified"])
            self.assertFalse(receipt["rasterPixelValuesVerified"])
            self.assertFalse(receipt["poseyBuildingHeightsVerified"])
            self.assertEqual(receipt["objects"][0]["sha256"],
                             mod.sha256_file(Path(folder)/"IN2020_26700930_12.tif"))
            with self.assertRaisesRegex(ValueError,"overwrite"):
                mod.survey_s3_objects(plan(),FakeS3(payload),output_dir=Path(folder))

    def test_short_or_malformed_download_is_unverified(self):
        # HEAD advertises bytes, but downloader supplies an HTML-looking body.
        class BadDownload(FakeS3):
            def download_fileobj(self, bucket,key,handle):
                handle.write(b"<html>not a TIFF")
        with tempfile.TemporaryDirectory() as folder:
            receipt=mod.survey_s3_objects(plan(),BadDownload(bytes(20)),
                                          output_dir=Path(folder))
            self.assertFalse(receipt["allBytesAcquiredAndSha256Verified"])
            self.assertEqual(receipt["failedObjectCount"],1)
            self.assertEqual(list(Path(folder).iterdir()),[])

    def test_network_failure_produces_no_false_available_evidence(self):
        receipt=mod.survey_s3_objects(plan(),BrokenS3(b"content"))
        self.assertEqual(receipt["failedObjectCount"],1)
        self.assertFalse(receipt["sourceObjectsHeadVerified"])
        self.assertEqual(receipt["objects"][0]["status"],"ERROR_UNVERIFIED")


if __name__=="__main__":
    unittest.main()
