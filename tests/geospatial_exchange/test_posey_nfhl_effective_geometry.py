"""Offline synthetic tests. No actual FEMA polygon or survey is represented here."""
from copy import deepcopy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from shapely.geometry import box, mapping

from tools.geospatial_exchange import posey_nfhl_effective_geometry as nfhl


def feature(oid, bounds, **props):
    return {"type": "Feature", "geometry": mapping(box(*bounds)),
            "properties": {"OBJECTID": oid, "DFIRM_ID": "18129C", **props}}


def parcel(oid, bounds):
    f = feature(oid, bounds)
    f["properties"].update(county_fips="18129", objectid=oid,
                           state_parcel_id=f"FAKE-SYNTHETIC-{oid}")
    return f


def panel(oid, bounds, ident):
    return feature(oid, bounds, FIRM_PAN=ident, EFF_DATE=1415145600000)


def zone(oid, bounds, sfha, label):
    return feature(oid, bounds, FLD_ZONE=label, SFHA_TF=sfha)


class FEMAEffectiveGeometryTests(unittest.TestCase):
    def setUp(self):
        self.panels = [panel(10, (0, 0, 2, 2), "18129C0005C")]
        self.zones = [zone(20, (0, 0, 1, 2), "T", "AE"),
                      zone(21, (1, 0, 2, 2), "F", "X")]
        self.registry = {
            "dfirmId": "18129C", "panelCount": 1,
            "panels": [{"firmPan": "18129C0005C"}],
        }

    def test_live_reference_35_count_is_not_automatic_validation(self):
        file = Path(__file__).resolve().parents[2] / \
            "data/posey-county/offline/2026-09-30/fema-effective-firm-panels-18129C.json"
        registry = json.loads(file.read_text())
        self.assertEqual(registry["panelCount"], 35)
        self.assertEqual(len({x["firmPan"] for x in registry["panels"]}), 35)
        self.assertEqual(registry["dfirmId"], "18129C")

    def test_join_splits_fema_sfha_and_non_sfha(self):
        items = [parcel(1, (0.1, .1, .9, .9)), parcel(2, (1.1, .1, 1.9, .9))]
        report = nfhl.analyze_parcels(items, self.panels, self.zones,
                                      nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual([r["screeningStatus"] for r in report["rows"]], [
            "FEMA_SFHA_POLYGON_OVERLAP_REVIEW",
            "NO_SFHA_POLYGON_OVERLAP_IN_PINNED_FEMA_SNAPSHOT",
        ])
        self.assertEqual([r["femaSfhaAreaOverlap"] for r in report["rows"]], [True, False])
        self.assertTrue(all(x["reviewStatus"] == "INSUFFICIENT_EVIDENCE" for x in report["rows"]))
        self.assertTrue(all(x["femaDetermination"] is None for x in report["rows"]))
        self.assertTrue(all(x["bfeNavd88Ft"] is None for x in report["rows"]))

    def test_touches_sfha_at_boundary_only_not_area_overlap(self):
        report = nfhl.analyze_parcels([parcel(2, (1, 0.1, 1.5, .9))],
                                     self.panels, self.zones, nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual(report["rows"][0]["screeningStatus"],
                         "NO_SFHA_POLYGON_OVERLAP_IN_PINNED_FEMA_SNAPSHOT")

    def test_missing_flood_zone_is_not_equated_with_outside_sfha(self):
        report = nfhl.analyze_parcels([parcel(1, (.5, .1, 1.5, .9))],
                                     self.panels, [self.zones[0]],
                                     nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual(report["rows"][0]["screeningStatus"], "FEMA_ZONE_COVERAGE_INCOMPLETE")
        self.assertIsNone(report["rows"][0]["femaSfhaAreaOverlap"])

    def test_missing_firm_panel_is_not_a_valid_non_flood_result(self):
        report = nfhl.analyze_parcels([parcel(1, (1.5, .1, 2.5, .9))],
                                     self.panels, self.zones,
                                     nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual(report["rows"][0]["screeningStatus"], "FEMA_PANEL_COVERAGE_INCOMPLETE")

    def test_unknown_sfha_flag_fails_visible(self):
        bad = [deepcopy(self.zones[0]), self.zones[1]]
        bad[0]["properties"]["SFHA_TF"] = "?"
        report = nfhl.analyze_parcels([parcel(1, (.1, .1, .9, .9))], self.panels, bad,
                                     nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual(report["rows"][0]["screeningStatus"], "FEMA_ZONE_ATTRIBUTE_OR_INDEX_UNVERIFIED")
        self.assertIsNone(report["rows"][0]["femaSfhaAreaOverlap"])

    def test_panel_changes_trigger_manual_review(self):
        altered = [panel(10, (0, 0, 2, 2), "18129C0006C")]
        audit = nfhl.compare_panels(altered, self.registry)
        self.assertEqual(audit["missingLegacyPanelIds"], ["18129C0005C"])
        report = nfhl.analyze_parcels([parcel(1, (.1,.1,.9,.9))], altered,
                                     self.zones, audit)
        self.assertEqual(report["rows"][0]["screeningStatus"], "FEMA_PANEL_INVENTORY_CHANGED_REVIEW")

    def test_invalid_parcel_does_not_generate_spurious_zone(self):
        p = parcel(1, (.1,.1,.9,.9))
        p["geometry"] = None
        report = nfhl.analyze_parcels([p], self.panels, self.zones,
                                     nfhl.compare_panels(self.panels, self.registry))
        self.assertEqual(report["rows"][0]["screeningStatus"], "PARCEL_GEOMETRY_UNAVAILABLE")

    def test_duplicate_parcel_objectid_rejected(self):
        p = parcel(1, (.1,.1,.9,.9))
        with self.assertRaisesRegex(nfhl.EvidenceError, "duplicate parcel"):
            nfhl.analyze_parcels([p, p], self.panels, self.zones,
                                 nfhl.compare_panels(self.panels, self.registry))

    def test_non_posey_parcel_is_rejected(self):
        p = parcel(1, (.1,.1,.9,.9))
        p["properties"]["county_fips"] = "18163"
        with self.assertRaisesRegex(nfhl.EvidenceError, "Non-Posey"):
            nfhl.analyze_parcels([p], self.panels, self.zones,
                                 nfhl.compare_panels(self.panels, self.registry))

    def source_fetch(self, name="firm_panels", invalid=None):
        lid = nfhl.LAYERS[name]
        rows = self.panels if name == "firm_panels" else self.zones
        def fetch(url, params):
            if not url.endswith("/query"):
                return {"id": lid, "geometryType": "esriGeometryPolygon",
                        "sourceSpatialReference": {"wkid": 4269},
                        "fields": [{"name": x} for x in nfhl.REQUIRED_FIELDS[name]]}
            if params.get("returnCountOnly") == "true":
                return {"count": len(rows) + (1 if invalid == "count" else 0)}
            if params.get("returnIdsOnly") == "true":
                return {"objectIds": [x["properties"]["OBJECTID"] for x in rows]}
            self.assertEqual(params["outSR"], "4326")
            self.assertEqual(params["f"], "geojson")
            subset = [deepcopy(f) for f in rows
                      if f["properties"]["OBJECTID"] in
                      [int(s) for s in params["objectIds"].split(",")]]
            if invalid == "wrong_id":
                subset[0]["properties"]["DFIRM_ID"] = "18163C"
            return {"type": "FeatureCollection", "features": subset}
        return fetch

    def test_bounded_offline_acquisition_and_replayed_hashes(self):
        with TemporaryDirectory() as folder:
            folder = Path(folder)
            for name in nfhl.LAYERS:
                metadata = nfhl.acquire_layer(name, folder / name,
                                               fetch=self.source_fetch(name), page_size=1)
                rows, reread, sha = nfhl.load_layer(folder / name, name)
                self.assertEqual(len(rows), metadata["objectIdCount"])
                self.assertEqual(reread["featureCount"], len(rows))
                self.assertEqual(len(sha), 64)
                self.assertFalse(reread["scientificCertification"])
            registry_path = folder / "registry.json"
            parcel_path = folder / "parcels.json"
            registry_path.write_text(json.dumps(self.registry))
            parcel_path.write_text(json.dumps({"type":"FeatureCollection",
                                                 "features":[parcel(1, (.1,.1,.9,.9))]}))
            result = nfhl.screen(folder, parcel_path, registry_path)
            self.assertEqual(result["nfhlLayerCounts"], {"firmPanels": 1, "floodHazardZones": 2})
            self.assertEqual(result["rows"][0]["screeningStatus"], "FEMA_SFHA_POLYGON_OVERLAP_REVIEW")
            self.assertFalse(result["regulatoryEligibilityEstablished"])

    def test_sha_tamper_is_not_silent(self):
        with TemporaryDirectory() as folder:
            source = Path(folder) / "firm_panels"
            nfhl.acquire_layer("firm_panels", source, self.source_fetch(), page_size=1)
            bad = source / "features-0000.geojson"
            bad.write_bytes(bad.read_bytes() + b" ")
            with self.assertRaisesRegex(nfhl.EvidenceError, "SHA-256"):
                nfhl.load_layer(source, "firm_panels")

    def test_reject_count_mismatch_and_wrong_dfirm_id(self):
        for kind in ("count", "wrong_id"):
            with self.subTest(kind=kind), TemporaryDirectory() as folder:
                with self.assertRaises(nfhl.EvidenceError):
                    nfhl.acquire_layer("firm_panels", Path(folder) / "new",
                                       fetch=self.source_fetch(invalid=kind))

    def test_explicit_projected_crs_must_not_be_mislabeled_crs84(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            for name in nfhl.LAYERS:
                nfhl.acquire_layer(name, root / name,
                                  fetch=self.source_fetch(name))
            r = root / "registry.json"
            p = root / "parcel.json"
            r.write_text(json.dumps(self.registry))
            p.write_text(json.dumps({"type":"FeatureCollection",
                                     "crs":{"properties":{"name":"EPSG:2966"}},
                                     "features":[parcel(1,(.1,.1,.9,.9))]}))
            with self.assertRaisesRegex(nfhl.EvidenceError, "CRS84"):
                nfhl.screen(root, p, r)


if __name__ == "__main__":
    unittest.main()
