# Independent checkpoint positional accuracy computation

The offline Python module scripts/geospatial/independent_checkpoint_accuracy.py performs numerical comparisons of **supplied independent checkpoints** against a product. It does **not** create survey measurements, collect field data, establish CRS compatibility, generate a certificate or waive professional review.

## Standards and mathematics

- FGDC-STD-007.3-1998 National Standard for Spatial Data Accuracy: https://www.fgdc.gov/standards/projects/accuracy/part3/chapter3
- USGS adoption of ASPRS 2024 Edition 2 Version 2: https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards
- ASPRS 2024 final horizontal RMSE_H = sqrt(RMSE_H1 squared + RMSE_H2 squared); final vertical RMSE_V = sqrt(RMSE_V1 squared + RMSE_V2 squared), where 1 represents product-to-checkpoint fit, and 2 represents independently reported checkpoint-survey uncertainty.
- The current ASPRS method requires at least **30** checkpoints for the standard minimum. It does not use the legacy NSSDA 95%-confidence reporting convention.
- The legacy FGDC NSSDA normally requires at least **20** checkpoints; its 95% approximation is calculated only when normality, independence and systematic-error review are explicitly declared. It is never promoted as current ASPRS accuracy.
- When either survey RMSE component is missing, the corresponding final corrected value remains **null**. If either axis lacks final evidence, 3D corrected RMSE remains null.

## Input files

CSV must contain checkpoint_id and, by mode:
- vertical: product_z_m, reference_z_m
- horizontal: product_x_m, reference_x_m, product_y_m, reference_y_m
- 3d: both pairs of x/y coordinates and z coordinates

All coordinates must already be in a verified **common projected metre-based frame**, with compatible vertical datum and epoch where applicable. Duplicate IDs, missing values, NaNs or infinities fail. An EPSG:2966 native coordinate is in US-survey feet, NOT metres: perform an independently reviewed coordinate conversion or projection and record it before using the metric column format. Never subtract longitude/latitude as planar metres.

Optional --provenance JSON must have schema tsm-independent-checkpoint-input-v1, checkpointCsvSha256, horizontalCrs (metre-based projected EPSG), coordinatesUnits = m, and verticalDatum for elevation. Additional sourceDatasetPath/sourceDatasetSha256 bind source data bytes; surveyReportPath/surveyReportSha256 bind the measured survey report; surveyRMSE_H2_m and surveyRMSE_V2_m are allowed only when the survey-report bytes are hash-checked. Set sameCoordinateFrameDeclared = true with coordinateOperationEvidence only after external CRS/epoch/unit review.

The script records the declarations separately from what code can establish. It can verify SHA-256 file identity, not the independence, calibration, spatial representativeness, field method or integrity of the measurements. Every result remains COMPUTED_UNCERTIFIED and requires a qualified human reviewer.

Example invocation (substitute existing authoritative files, do not invent checkpoint values):

    python scripts/geospatial/independent_checkpoint_accuracy.py --mode vertical --checkpoints /survey/independent-checkpoints.csv --provenance /survey/verification-manifest.json --output /audit/positional-accuracy.json

Regression suite, **synthetic fixtures only**:

    python -m unittest discover -s tests/geospatial -p test_independent_checkpoint_accuracy.py -v

Neither DEM-to-DEM disagreement nor NOAA GEOID18 model values are independent survey checkpoints. Passing source and geodetic metadata gates is separate from accepting actual field measurements. Missing evidence is left missing.
