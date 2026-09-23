"""Contract tests for the TSM OpenMI transport boundary."""

from __future__ import annotations

import asyncio
import unittest

from backend.openmi_contract import ComponentInfo, QuantityValueSet, SpatialReference
from backend.openmi_service import ExchangeRouter, OpenMIService, _validate_value_set


def _value_set(**overrides: object) -> QuantityValueSet:
    payload = {
        "quantity_id": "SurfaceDischarge",
        "units": "m3/s",
        "values": [1.25, 2.5],
        "timestamp": "2026-09-23T04:00:00+00:00",
        "source_provenance_hash": "a" * 64,
        "source_component": "hec-ras",
        "target_component": "modflow6",
        "model_run_id": "run-001",
        "element_ids": ["cell-1", "cell-2"],
        "source_authority": "TSM_TEST_FIXTURE",
        "software_version": "test",
        "model_version": "test",
        "validation_status": "VALIDATED",
    }
    payload.update(overrides)
    return QuantityValueSet(
        **payload,
        spatial_reference=SpatialReference(
            horizontal_crs="EPSG:2966",
            vertical_datum="NAVD88",
            horizontal_units="m",
            vertical_units="m",
        ),
    )


class OpenMIContractTests(unittest.TestCase):
    def test_valid_exchange_item_is_accepted(self) -> None:
        _validate_value_set(_value_set())

    def test_invalid_provenance_hash_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            _validate_value_set(_value_set(source_provenance_hash="not-a-hash"))

    def test_element_alignment_is_required(self) -> None:
        with self.assertRaises(ValueError):
            _validate_value_set(_value_set(element_ids=["cell-1"]))

    def test_router_registers_components(self) -> None:
        async def run() -> None:
            router = ExchangeRouter()
            await router.register_component(
                ComponentInfo(
                    component_id="hec-ras",
                    component_type="HYDRAULIC_MODEL",
                    implementation="HEC-RAS",
                    input_quantities=["Rainfall"],
                    output_quantities=["SurfaceDischarge"],
                    software_version="operator-supplied",
                    model_version="operator-supplied",
                )
            )
            self.assertEqual(router.component_count, 1)

        asyncio.run(run())

    def test_service_has_router(self) -> None:
        service = OpenMIService()
        self.assertIsNotNone(service.router)


if __name__ == "__main__":
    unittest.main()
