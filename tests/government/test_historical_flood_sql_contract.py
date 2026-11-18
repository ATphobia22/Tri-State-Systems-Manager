"""Static regression for PostGIS DDL compatibility; runtime smoke is in CI.

This file catches divergent schema/seed contracts before using a database.
It is not a substitute for executing both files on PostGIS.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "scripts/geospatial/historical_flood_evidence_schema.sql"
SEED = ROOT / "scripts/geospatial/historical_flood_source_seeds.sql"


class HistoricalPostgisContractTests(unittest.TestCase):
    def test_one_authoritative_historical_index_table_definition(self):
        schema = SCHEMA.read_text(encoding="utf-8")
        seed = SEED.read_text(encoding="utf-8")
        definition = r"CREATE TABLE IF NOT EXISTS tsm_flood_history\\.historical_map_index\\s*\\("
        self.assertEqual(len(re.findall(definition, schema, re.IGNORECASE)), 1)
        self.assertEqual(len(re.findall(definition, seed, re.IGNORECASE)), 0,
                         "Seed must never silently create a divergent table shape")

    def test_historical_index_insert_columns_match_schema(self):
        schema = SCHEMA.read_text(encoding="utf-8")
        seed = SEED.read_text(encoding="utf-8")
        table = re.search(
            r"CREATE TABLE IF NOT EXISTS tsm_flood_history\\.historical_map_index\\s*\\((.*?)\\n\\);",
            schema, re.IGNORECASE | re.DOTALL,
        )
        self.assertIsNotNone(table)
        defined = set(re.findall(
            r"^\\s{4}([a-z][a-z0-9_]*)\\s+(?:bigserial|char|text|integer|date|boolean)\\b",
            table.group(1), re.MULTILINE | re.IGNORECASE,
        ))
        insertion = re.search(
            r"INSERT INTO tsm_flood_history\\.historical_map_index\\s*\\(([^)]+)\\)\\s*VALUES",
            seed, re.IGNORECASE | re.DOTALL,
        )
        self.assertIsNotNone(insertion)
        cols = {c.strip() for c in insertion.group(1).split(",")}
        self.assertFalse(cols - defined, "Seed references columns absent from schema: " + str(cols - defined))
        self.assertIn("mapped_flood_year", cols)
        self.assertIn("mapping_reliability", cols)

    def test_repeated_seed_does_not_duplicate_null_year_100yr_design_map(self):
        schema = SCHEMA.read_text(encoding="utf-8")
        self.assertRegex(schema,
                         r"(?is)CREATE UNIQUE INDEX IF NOT EXISTS "
                         r"\\w+\\s+ON tsm_flood_history\\.historical_map_index"
                         r"\\s*\\([^;]+\\) NULLS NOT DISTINCT;")

if __name__ == "__main__":
    unittest.main()
