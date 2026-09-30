"""Fail-closed HEC-RAS 6.x result adapter for TSM."""

from .hdf5_reader import Hdf5ResultReader
from .runtime import ExecutionError, execute_hec_ras

__all__ = ["ExecutionError", "Hdf5ResultReader", "execute_hec_ras"]
