# Open-source LAZ + IFC→CityGML

## LAZ stack
| Repo | Role |
|------|------|
| https://github.com/LASzip/LASzip | Classic LASzip (Apache-2.0); LAZ 1.4; LAS 1.5 in 3.5.0 |
| https://github.com/hobuinc/laz-perf | LazPerf — PDAL ≥2.4 default compressor |
| https://github.com/LAStools/LAStools | laszip CLI + LASlib |
| PDAL writers.las | compression:true → LazPerf |

## IFC→CityGML
| Repo | Role |
|------|------|
| https://github.com/tum-gis/ifc-to-citygml3 | **Preferred** Python CityGML 3.0; Docker ghcr.io/tum-gis/ifc-to-citygml3 |
| https://github.com/tum-gis/ifc-to-citygml3-fme | FME workspace (superseded by Python) |
| IfcOpenShell | Geometry engine |

TSM: `pdal_3dep_buildings.json` uses compression:true; `pipeline/ifc_to_citygml.sh` wraps tum-gis image.
