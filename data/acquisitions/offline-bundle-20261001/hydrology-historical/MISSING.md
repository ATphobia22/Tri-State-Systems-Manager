# MISSING — Historical USGS gauge observations

- **03293600 (Ohio River at McAlpine Dam — Headwater):** the station exists in the NWIS site file,
  but the NWIS web services return an empty time series for parameters 00060/00065 (verified 2026-10-01:
  both `nwis/dv` daily values and `nwis/iv` instantaneous values return zero series after 8 attempts each).
  Likely a USACE-operated dam gage with no public web-service telemetry for these parameters.
  Represented as missing, not zero.
- No sub-daily (unit values) archive was pulled — daily means only. Unit-values remain available
  on demand from USGS Water Services if a future storm analysis needs them.
- Peak-flow (annual maxima) series not yet pulled; the daily means above are sufficient for
  baseline hydrology but not for Bulletin 17C flood-frequency work.
