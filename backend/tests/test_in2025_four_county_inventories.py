"""Synthetic, offline tests for four-county official Indiana leaf-on/DSM inventories."""
import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/geospatial/acquire_in2025_four_county_inventories.py"
spec = importlib.util.spec_from_file_location("in2025_counties", SCRIPT)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

IM = "https://gisimageryleafoningov.s3.amazonaws.com/imageryoptimized/2025/SPW/06in/in2025_27179775_06.tif"
DSM = "https://giselevationingov.s3.amazonaws.com/dsmoptimized/statewide/2025/SPW/1ft/in2025_27179775_06.tif"


def test_real_official_counties_and_inventory_addresses():
    assert m.COUNTIES == {"Posey": "18129", "Gibson": "18051", "Vanderburgh": "18163", "Warrick": "18173"}
    assert m.inventory_url("Gibson", "imagery") == "https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/tif/Gibson2025tif.csv"
    assert m.inventory_url("Warrick", "dsm") == "https://gisimageryleafoningov.s3.amazonaws.com/scripts/2025/dsm/Warrick2025dsm.csv"
    with pytest.raises(ValueError):
        m.inventory_url("OtherCounty", "imagery")


def test_tiff_worldfile_and_dsm_inventory_are_parsed():
    raw = ("\ufeffurl_tif\r\n" + IM + "\r\n" + IM[:-4] + ".tfw\r\n").encode()
    info = m.validate_inventory("imagery", raw)
    assert info["tif_count"] == 1
    assert info["worldfile_count"] == 1
    assert info["tile_stems"] == {"in2025_27179775_06"}
    dsm = m.validate_inventory("dsm", ("url_dsm\n" + DSM + "\n").encode())
    assert dsm["tile_stems"] == info["tile_stems"]
    assert dsm["worldfile_count"] == 0


def test_worldfile_without_tiff_rejected():
    with pytest.raises(ValueError, match="WORLD_FILE"):
        m.validate_inventory("imagery", ("url_tif\n" + IM[:-4] + ".tfw\n").encode())


@pytest.mark.parametrize("bad", [
    IM.replace("https:", "http:"),
    IM.replace("gisimageryleafoningov", "evil"),
    IM.replace("/2025/", "/2024/"),
    IM + "?redirect=https://evil.example/a",
    IM.replace("in2025_27179775_06", "../../in2025_27179775_06"),
    IM.replace(".tif", ".exe"),
    DSM,
])
def test_reject_untrusted_imagery_row(bad):
    with pytest.raises(ValueError, match="UNTRUSTED|EXTENSION|TILE"):
        m.validate_inventory("imagery", ("url_tif\n" + bad + "\n").encode())


def test_reject_duplicate_rows_and_incorrect_csv_header():
    with pytest.raises(ValueError, match="DUPLICATE"):
        m.validate_inventory("imagery", ("url_tif\n" + IM + "\n" + IM + "\n").encode())
    with pytest.raises(ValueError, match="HEADER"):
        m.validate_inventory("dsm", ("url_tif\n" + DSM + "\n").encode())


def test_declared_content_length_over_budget_is_rejected(tmp_path):
    class Response:
        headers = {"Content-Length": "9000000"}
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def geturl(self): return m.inventory_url("Posey", "imagery")

    with patch.object(m.urllib.request, "urlopen", return_value=Response()):
        with pytest.raises(ValueError, match="SIZE_BUDGET"):
            m.fetch_inventory(m.inventory_url("Posey", "imagery"), tmp_path / "test.csv", limit=10000)
    assert not (tmp_path / "test.csv").exists()


def test_reject_official_host_redirect_to_other_host(tmp_path):
    class Response:
        headers = {"Content-Length": "100"}
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def geturl(self): return "https://evil.example/scripts/2025/tif/Posey2025tif.csv"

    with patch.object(m.urllib.request, "urlopen", return_value=Response()):
        with pytest.raises(ValueError, match="REDIRECT"):
            m.fetch_inventory(m.inventory_url("Posey", "imagery"), tmp_path / "test.csv", limit=10000)


def test_fetch_writes_exact_bytes_and_sha256(tmp_path):
    url = m.inventory_url("Posey", "dsm")
    body = ("url_dsm\n" + DSM + "\n").encode()
    class Response:
        headers = {"Content-Length": str(len(body)), "ETag": '"testtag"'}
        def __init__(self): self.remaining = body
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def geturl(self): return url
        def read(self, n):
            piece, self.remaining = self.remaining[:n], self.remaining[n:]
            return piece

    with patch.object(m.urllib.request, "urlopen", return_value=Response()):
        receipt = m.fetch_inventory(url, tmp_path / "test.csv", limit=10000)
    assert (tmp_path / "test.csv").read_bytes() == body
    assert receipt["bytes"] == len(body) and len(receipt["sha256"]) == 64
    assert receipt["etag"] == '"testtag"'


def test_county_receipt_requires_matching_tile_stems():
    image = {"tile_stems": {"in2025_27179775_06"}}
    dsm = {"tile_stems": {"in2025_27179775_06", "in2025_27179750_06"}}
    with pytest.raises(ValueError, match="TILE_SET_DIVERGENCE"):
        m.require_paired_tile_sets(image, dsm)
    dsm["tile_stems"] = image["tile_stems"]
    assert m.require_paired_tile_sets(image, dsm) == 1
