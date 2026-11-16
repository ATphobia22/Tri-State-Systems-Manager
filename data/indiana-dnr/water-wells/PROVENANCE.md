# Posey County subsurface reference context

The Indiana DNR [Water Well Record Database](https://www.in.gov/dnr/water/ground-water-wells/water-well-record-database/)
and its [location-method documentation](https://www.in.gov/dnr/water/ground-water-wells/water-well-record-database/database-search-help/)
describe field-verified UTM locations and estimated PLSS-based placements. A field-located label records the agency's location method. It does not establish survey accuracy or current conditions.

The [ArcGIS layer](https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer/0) supplies
county-reported well headers, source record numbers, coordinates and location method. The acquisition tool queries all
records attributed to Posey by default and checks the ordered page results against the service count. It omits owner names
and addresses. A separate download of the agency lithology records is needed to join layer intervals to the well record
number. Raw depth and elevation fields in the snapshot retain their source names and values.

```bash
node tools/acquisition/indiana/fetch-idnr-wells.mjs --out /tmp/posey-wells.geojson
python -m pip install -r tools/geospatial_exchange/requirements.txt
python tools/geospatial_exchange/posey_subsurface_context.py \
  --parcels data/posey-county/parcels/posey-parcels-2025.geojson \
  --wells /tmp/posey-wells.geojson --out /tmp/posey-context.json
```

The export uses one row per parcel geometry OBJECTID because a state parcel identifier can describe multiple geometries.
It retains a well reference only if the field-located point is inside exactly one geometry. Boundary points, ambiguous
overlaps and estimated points are counted separately. The public project parcel snapshot and the county [WTH GIS
portal](https://poseyin.wthgis.com/) supply cadastral context. The join does not establish a surveyed legal boundary.

- For USDA-NRCS [SSURGO](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo),
  pass a CRS84 polygon export with `--soils` and retain the `mukey`. The [Indiana GIO map-unit service](https://gisdata.in.gov/server/rest/services/Hosted/Soil_Map_Units_SSURGO/FeatureServer/4) provides those polygons. Component and horizon properties have a different row grain. Map-unit overlap does not assign Ksat, USCS, or a foundation parameter to the entire parcel.
- For [IDEM institutional controls](https://www.in.gov/idem/cleanups/investigation-and-cleanup-programs/institutional-controls/),
  pass a CRS84 polygon export with `--controls` and identify its ID field with `--control-id-field`. An overlap is a record to review against the underlying registry and instrument. A missing source or absent overlap cannot establish clearance.
- The DNR [Posey bedrock aquifer map](https://www.in.gov/dnr/water/files/posey_bedrock.pdf) is regional context. The
  [Oil and Gas Well Records Viewer](https://secure.in.gov/dnr/oil-and-gas/permits-and-forms/permits/well-records-search)
  is a separate source for wells and logs. Link an individual log only after matching its source identifier, method, depth
  units and vertical reference. Neither source is automatically substituted for a site boring.

The output records input SHA-256 values and distinguishes a missing polygon source from an acquired snapshot with no
overlap. Invalid source geometry is excluded and its bounding envelope flags potentially incomplete parcel results. It contains no inferred parcel-wide stratigraphy, groundwater surface or engineering design values.
