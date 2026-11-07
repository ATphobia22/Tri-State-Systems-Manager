"""Unit tests for semivariogram_ndhm_disagreement.py.

Synthetic fixtures are TEST data, clearly labelled as such; they are
never measurements and never presented as such. One test runs the
script's pipeline on the real nDHM probe CSV and the real archived
Posey footprints GeoJSON (paths from NDHM_PROBE_CSV /
POSEY_BUILDINGS_GEOJSON, falling back to the known workspace paths);
it is skipped when those files are absent.
"""
import importlib.util
import json
import math
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

SRC = Path(__file__).with_name("semivariogram_ndhm_disagreement.py")
spec = importlib.util.spec_from_file_location("semi_ndhm", SRC)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

# Real-data paths. These live outside the repo (probe output + archived
# IGIO asset); override with env vars when they live elsewhere.
DEFAULT_CSV = Path.home() / "workspace" / "goals" / \
    "tri-state-systems-manager-repo-fixes" / "hidden_files" / \
    "ndhm-probe-per-id.csv"
DEFAULT_GEOJSON = Path.home() / "workspace" / "tri-state-review" / "repo" / \
    "offline_packages" / "igio" / "posey-buildings-igio-23082.geojson"


def real_paths():
    csv = Path(os.environ.get("NDHM_PROBE_CSV", DEFAULT_CSV))
    gj = Path(os.environ.get("POSEY_BUILDINGS_GEOJSON", DEFAULT_GEOJSON))
    if csv.is_file() and gj.is_file():
        return csv, gj
    return None


class TestEmptyBinsAreNan(unittest.TestCase):
    """Regression test for the pasted-code defect: empty bins must be
    NaN, never 0 (``counts = np.maximum(counts, 1)`` made them 0)."""

    def test_empty_bins_nan_not_zero(self):
        # Two tight clusters ~100 m apart: lags beyond the cluster
        # separation but below max_dist have no pairs at all.
        rng = np.random.default_rng(7)
        x = np.concatenate([rng.normal(0, 5, 20), rng.normal(100, 5, 20)])
        y = np.concatenate([rng.normal(0, 5, 20), rng.normal(0, 5, 20)])
        r = rng.normal(0, 0.1, 40)
        sv = m.experimental_semivariogram(x, y, r, n_lags=10,
                                          max_dist=500.0, min_pairs=1)
        self.assertTrue(np.any(sv["counts"] == 0),
                        "fixture should contain at least one empty bin")
        for gamma, count in zip(sv["gamma_m2"], sv["counts"]):
            if count == 0:
                self.assertTrue(math.isnan(gamma),
                                "empty bin must report gamma NaN, not 0")
            else:
                self.assertTrue(math.isfinite(gamma))


class TestKnownSemivariogram(unittest.TestCase):
    def test_linear_trend_gamma_is_half_h_squared(self):
        # r = x (metres): (r_i - r_j)^2 = h^2, so gamma(h) = h^2 / 2.
        # Binned gamma must lie between the bin edges' h^2 / 2.
        x = np.arange(0, 1000, 10, dtype=float)
        y = np.zeros_like(x)
        sv = m.experimental_semivariogram(x, y, x, n_lags=5,
                                          max_dist=500.0, min_pairs=1)
        edges = sv["bin_edges_m"]
        for i, (gamma, count) in enumerate(zip(sv["gamma_m2"],
                                               sv["counts"])):
            if count:
                self.assertGreaterEqual(gamma, 0.5 * edges[i] ** 2)
                self.assertLessEqual(gamma, 0.5 * edges[i + 1] ** 2)

    def test_constant_field_gamma_zero(self):
        rng = np.random.default_rng(3)
        x = rng.uniform(0, 1000, 50)
        y = rng.uniform(0, 1000, 50)
        r = np.full(50, 2.5)
        sv = m.experimental_semivariogram(x, y, r, n_lags=4,
                                          max_dist=700.0, min_pairs=1)
        for gamma, count in zip(sv["gamma_m2"], sv["counts"]):
            if count:
                self.assertAlmostEqual(gamma, 0.0, places=12)

    def test_min_pairs_flags_thin_bins(self):
        rng = np.random.default_rng(11)
        x = rng.uniform(0, 1000, 6)
        y = rng.uniform(0, 1000, 6)
        r = rng.normal(0, 1, 6)
        sv = m.experimental_semivariogram(x, y, r, n_lags=6,
                                          max_dist=700.0, min_pairs=30)
        self.assertTrue(np.all(~sv["usable"]),
                        "6 points (at most 15 pairs, fewer within "
                        "max_dist) cannot fill any bin with >= 30 pairs")
        self.assertLessEqual(sv["n_pairs_total"], 15)

    def test_max_dist_defaults_to_half_bbox_diagonal(self):
        x = np.array([0.0, 3000.0, 3000.0, 0.0])
        y = np.array([0.0, 0.0, 4000.0, 4000.0])
        r = np.array([0.0, 1.0, 2.0, 3.0])
        sv = m.experimental_semivariogram(x, y, r, n_lags=2,
                                          min_pairs=1)
        self.assertAlmostEqual(sv["bbox_diagonal_m"], 5000.0)
        self.assertAlmostEqual(sv["max_dist_m"], 2500.0)


class TestModelFit(unittest.TestCase):
    def test_spherical_fit_recovers_known_params(self):
        # Synthetic binned gamma from a known spherical model + noise.
        rng = np.random.default_rng(5)
        centers = np.linspace(200, 9000, 12)
        truth = m.spherical_model(centers, 0.02, 0.10, 4000.0)
        noisy = truth + rng.normal(0, 0.002, len(centers))
        counts = np.full(len(centers), 5000)
        fit = m.fit_model("spherical", centers, noisy, counts)
        self.assertAlmostEqual(fit["nugget_m2"], 0.02, delta=0.01)
        self.assertAlmostEqual(fit["sill_m2"], 0.10, delta=0.02)
        self.assertAlmostEqual(fit["range_m"], 4000.0, delta=800.0)
        self.assertGreater(fit["fit_r2"], 0.9)

    def test_exponential_reaches_sill_at_practical_range(self):
        g = m.exponential_model(np.array([4000.0]), 0.0, 1.0, 4000.0)[0]
        self.assertAlmostEqual(g, 1 - math.exp(-3.0), places=6)

    def test_localized_bound_definition(self):
        # gamma = total sill -> bound is 1.96*sqrt(2*sill).
        self.assertAlmostEqual(m.localized_95_bound_m(0.15),
                               1.96 * math.sqrt(0.30))
        self.assertAlmostEqual(m.localized_95_bound_m(0.0), 0.0)


class TestLoadingAndCrs(unittest.TestCase):
    def test_ftus_factor_is_exact_us_survey_foot(self):
        self.assertAlmostEqual(m.FTUS_TO_M, 1200.0 / 3937.0, places=12)
        self.assertNotEqual(m.FTUS_TO_M, 0.3048)

    def test_degree_like_coords_rejected(self):
        gj = {"type": "FeatureCollection", "features": [
            {"type": "Feature",
             "properties": {"objectid": 1},
             "geometry": {"type": "Polygon", "coordinates": [[
                 [2700000, 950000], [2700100, 950000],
                 [2700100, 950100], [2700000, 950100],
                 [2700000, 950000]]]}}
        ]}
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "feet.geojson"
            path.write_text(json.dumps(gj), encoding="utf-8")
            with self.assertRaises(ValueError):
                m.load_footprint_centroids(path)

    def test_embedded_crs_refused(self):
        gj = {"type": "FeatureCollection",
              "crs": {"type": "name",
                      "properties": {"name": "urn:ogc:def:crs:EPSG::2966"}},
              "features": []}
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "crs.geojson"
            path.write_text(json.dumps(gj), encoding="utf-8")
            with self.assertRaises(ValueError):
                m.load_footprint_centroids(path)

    def test_centroid_and_join(self):
        gj = {"type": "FeatureCollection", "features": [
            {"type": "Feature",
             "properties": {"objectid": 42},
             "geometry": {"type": "Polygon", "coordinates": [[
                 [-87.90, 38.22], [-87.89, 38.22],
                 [-87.89, 38.23], [-87.90, 38.23],
                 [-87.90, 38.22]]]}},
            {"type": "Feature",
             "properties": {"objectid": 43},
             "geometry": {"type": "MultiPolygon", "coordinates": [[[
                 [-87.91, 38.22], [-87.90, 38.22],
                 [-87.90, 38.23], [-87.91, 38.23],
                 [-87.91, 38.22]]]]}},
        ]}
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "small.geojson"
            path.write_text(json.dumps(gj), encoding="utf-8")
            cents = m.load_footprint_centroids(path)
        self.assertAlmostEqual(cents[42][0], -87.895, places=6)
        self.assertAlmostEqual(cents[42][1], 38.225, places=6)
        x, y = m.project_centroids_to_metres(cents, np.array([42, 43]))
        # Posey County in EPSG:2966 is roughly E 2.67-2.78M ftUS,
        # N 0.93-1.09M ftUS; in metres E ~814-847 km, N ~283-332 km.
        self.assertTrue(np.all((x > 800_000) & (x < 860_000)))
        self.assertTrue(np.all((y > 270_000) & (y < 340_000)))
        # Unjoined id must raise, never be invented.
        with self.assertRaises(ValueError):
            m.project_centroids_to_metres(cents, np.array([42, 999]))

    def test_csv_loading_skips_incomplete_rows(self):
        text = ("sourceObjectId,purdueNDHM2017_2019HeightM,"
                "diff2020MinusPurdueM\n"
                "1,5.0,0.010\n2,,0.020\n3,4.0,\n4,3.0,-0.500\n")
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "probe.csv"
            path.write_text(text, encoding="utf-8")
            ids, r = m.load_disagreement_csv(path)
        self.assertEqual(list(ids), [1, 4])
        self.assertEqual(list(r), [0.010, -0.500])


@unittest.skipIf(real_paths() is None,
                  "real nDHM probe CSV / Posey footprints GeoJSON absent")
class TestRealDataSmoke(unittest.TestCase):
    """Runs the full pipeline on the real dataset; checks outputs sane.

    Expected values come from the 2026-11-07 run and are asserted with
    tolerance, not exact equality, so a re-run on the same pinned
    inputs still passes while a broken join or CRS error cannot.
    """

    def test_real_run(self):
        csv_path, gj_path = real_paths()
        result = m.run(csv_path, gj_path, n_lags=12, max_dist_m=None,
                       min_pairs=30,
                       sensitivity_drop_abs_gt=1.0)
        ds = result["dataset"]
        self.assertEqual(ds["n_points"], 1893)
        self.assertEqual(ds["n_joined_to_footprints"], 1893)
        gs = ds["global_stats_m"]
        self.assertAlmostEqual(gs["mean"], 0.0033, delta=0.001)
        self.assertAlmostEqual(gs["std_ddof1"], 0.3698, delta=0.001)
        self.assertEqual(gs["agree_within_1m_count"], 1886)
        sv = result["semivariogram"]
        self.assertEqual(sv["n_pairs_total"], 1601863)
        self.assertEqual(sv["n_usable_bins"], 12)
        self.assertTrue(all(math.isfinite(g)
                            for g in sv["gamma_m2"]
                            if g is not None))
        for name, fit in result["model_fits"].items():
            self.assertTrue(math.isfinite(fit["nugget_m2"]))
            self.assertTrue(math.isfinite(fit["sill_m2"]))
            self.assertGreater(fit["sill_m2"], 0)
            self.assertGreater(fit["range_m"], 0)
            self.assertTrue(math.isfinite(fit["fit_r2"]))
        self.assertIn(result["selected_model"]["model"],
                      ("spherical", "exponential"))
        sub = result["sensitivity_drop_large_disagreements"]
        self.assertEqual(sub["kept_points"], 1886)
        self.assertEqual(sub["dropped_points"], 7)
        # Without the 7 large disagreements the variance collapses:
        # the full-data signal is outlier-driven, not a broad field.
        self.assertLess(sub["variance_of_r_m2"], 0.01)
        self.assertLess(sub["variance_of_r_m2"],
                        ds["global_stats_m"]["std_ddof1"] ** 2 / 10.0)


if __name__ == "__main__":
    unittest.main()
