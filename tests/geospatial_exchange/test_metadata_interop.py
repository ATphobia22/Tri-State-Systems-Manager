"""No downloaded data or external dependencies required."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "tools/geospatial_exchange/metadata_interop.py"
spec = importlib.util.spec_from_file_location("metadata_interop", TARGET)
interop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(interop)

FGDC = b"<metadata><idinfo><citation><citeinfo><title>FGDC Test</title><origin>Agency</origin><pubdate>20261115</pubdate></citeinfo></citation><descript><abstract>Sample only</abstract></descript><spdom><bounding><westbc>-88.1</westbc><eastbc>-87.9</eastbc><southbc>37.8</southbc><northbc>38.0</northbc></bounding></spdom></idinfo></metadata>"
ARCGIS = b"<metadata><dataIdInfo><idCitation><resTitle>ArcGIS Test</resTitle></idCitation><idAbs>Editor record</idAbs><geoBox><westBL>-88</westBL><eastBL>-87</eastBL><southBL>37</southBL><northBL>38</northBL></geoBox></dataIdInfo></metadata>"
ISO = b"""<gmd:MD_Metadata xmlns:gmd='http://www.isotc211.org/2005/gmd' xmlns:gco='http://www.isotc211.org/2005/gco'>
<gmd:identificationInfo><gmd:MD_DataIdentification><gmd:citation><gmd:CI_Citation><gmd:title><gco:CharacterString>ISO Test</gco:CharacterString></gmd:title></gmd:CI_Citation></gmd:citation><gmd:abstract><gco:CharacterString>ISO description</gco:CharacterString></gmd:abstract></gmd:MD_DataIdentification></gmd:identificationInfo>
</gmd:MD_Metadata>"""


class InteropTests(unittest.TestCase):
    def test_fema_checked_in_csdgm_is_parsed_not_promoted(self):
        source = ROOT / "data/regulatory/nfhl-indiana-20260706-metadata.xml"
        result = interop.catalog([source])
        record = result["records"][0]
        self.assertEqual(record["metadataFamily"], "FGDC_CSDGM")
        self.assertEqual(record["title"], "National Flood Hazard Layer (NFHL)")
        self.assertEqual(record["publicationDateRaw"], "20260706")
        self.assertEqual(record["verticalDatum"], None)
        self.assertEqual(record["regulatoryAuthority"], "NOT_ESTABLISHED")
        self.assertEqual(record["rawMetadataSha256"], hashlib.sha256(source.read_bytes()).hexdigest())

    def test_fgdc_bounding_box_is_only_source_reported(self):
        r = interop.parse_bytes(FGDC)
        self.assertEqual(r["geographicExtentReported"], [-88.1, 37.8, -87.9, 38.0])
        self.assertEqual(r["geographicExtentStatus"], "SOURCE_REPORTED_UNVERIFIED")

    def test_arcgis_descriptive_record(self):
        r = interop.parse_bytes(ARCGIS)
        self.assertEqual(r["metadataFamily"], "ARCGIS_METADATA")
        self.assertEqual(r["title"], "ArcGIS Test")
        self.assertEqual(r["horizontalCrs"], None)

    def test_iso19139_descriptive_record(self):
        r = interop.parse_bytes(ISO)
        self.assertEqual(r["metadataFamily"], "ISO_19139")
        self.assertEqual(r["title"], "ISO Test")
        self.assertEqual(r["abstract"], "ISO description")

    def test_unsupported_metadata_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            interop.parse_bytes(b"<foo><title>None</title></foo>")

    def test_dtd_not_allowed(self):
        with self.assertRaisesRegex(ValueError, "DTD"):
            interop.parse_bytes(b'<!DOCTYPE metadata [<!ENTITY x "y">]><metadata><idinfo/></metadata>')

    def test_size_cap(self):
        with self.assertRaisesRegex(ValueError, "2 MiB"):
            interop.parse_bytes(b"x" * (interop.MAX_XML_BYTES + 1))

    def test_manifest_contains_only_observed_parse_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "m.xml"
            file.write_bytes(FGDC)
            result = interop.catalog([file])
            record = result["records"][0]
            self.assertEqual(record["verificationStatus"], "PARSED_UNVERIFIED")
            self.assertEqual(record["rawMetadataBytes"], len(FGDC))
            self.assertEqual(record["sourceFilename"], "m.xml")
            self.assertEqual(result["importPolicy"], "DESCRIPTIVE_ONLY_NO_AUTHORITY_PROMOTION")

    def test_main_creates_new_manifest_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "m.xml"
            file.write_bytes(ISO)
            output = Path(folder) / "manifest.json"
            self.assertEqual(interop.main([str(file), "--output", str(output)]), 0)
            self.assertEqual(json.loads(output.read_text())["sourceRecordCount"], 1)
            self.assertEqual(interop.main([str(file), "--output", str(output)]), 1)


if __name__ == "__main__":
    unittest.main()
