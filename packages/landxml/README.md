# LandXML import

Use `backend/survey/landxml_import.py`: read-only LandXML 1.2 TIN/parcel/CgPoint coordinate parsing. Preserve source coordinate order, original CRS declaration and SHA-256 evidence. A missing EPSG reference must not be guessed from place names or treated as WGS84.
