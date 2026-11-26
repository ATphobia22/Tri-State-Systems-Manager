# PDAL LAZ · IFC→CityGML

## LAZ
writers.las compression:true (LazPerf ≥2.4); .laz extension; 5:1–8:1 typical
Explicit scale for EPSG:26916; avoid auto max precision

## IFC→CityGML
Preferred: tum-gis/ifc-to-citygml3 (Python, CityGML 3.0, IfcOpenShell)
Alt: FME, IfcConvert→CityJSON, archived tudelft3d/ifc2citygml
Mapping: Building, BuildingRoom, Door/Window, BuildingConstructiveElement
TSM: IFC→LoD3 only when licensed; publicAllowsIndoor=false
