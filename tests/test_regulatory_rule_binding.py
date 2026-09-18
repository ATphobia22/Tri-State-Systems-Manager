import unittest

from backend.engineering.no_rise import load_verified_regulatory_rule


class RegulatoryRuleBindingTests(unittest.TestCase):
    def test_indiana_rule_is_source_bound(self) -> None:
        rule = load_verified_regulatory_rule("IN-FLOODWAY-CAPACITY-0.15FT", "IN")
        self.assertEqual(rule["status"], "VERIFIED_OFFICIAL_SOURCE")
        self.assertEqual(rule["threshold"], 0.15)

    def test_jurisdiction_mismatch_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            load_verified_regulatory_rule("IN-FLOODWAY-CAPACITY-0.15FT", "KY")


if __name__ == "__main__":
    unittest.main()
