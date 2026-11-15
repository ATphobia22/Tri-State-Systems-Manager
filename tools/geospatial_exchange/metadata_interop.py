#!/usr/bin/env python3
"""Offline, non-promoting FGDC / ISO 19139 / ArcGIS metadata interoperability.

Original implementation informed by USGS MetadataWizard and consbio's metadata
mapping design; no code from third-party packages is bundled.
No network, GDAL/PROJ, shell execution, XML DTDs, or claims of ISO conformance.
"""
import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_XML_BYTES = 2 * 1024 * 1024
GMD = "{http://www.isotc211.org/2005/gmd}"
GCO = "{http://www.isotc211.org/2005/gco}"
GMI = "{http://www.isotc211.org/2005/gmi}"


def name(tag):
    return tag.rsplit("}", 1)[-1]


def first(element, *paths):
    for path in paths:
        child = element.find(path)
        if child is not None and child.text and child.text.strip():
            return child.text.strip()
    return None


def bbox(element, paths):
    raw = [first(element, path) for path in paths]
    if any(value is None for value in raw):
        return None
    try:
        west, south, east, north = (float(v) for v in raw)
        if not (-180 <= west <= 180 and -180 <= east <= 180 and
                -90 <= south <= 90 and -90 <= north <= 90 and
                west < east and south < north):
            return None
    except ValueError:
        return None
    return [west, south, east, north]


def parse_bytes(contents):
    if len(contents) > MAX_XML_BYTES:
        raise ValueError("XML metadata exceeds 2 MiB")
    # ElementTree does not resolve external entities, and DTDs are disallowed
    # proactively to make the contract independent of parser configuration.
    if re.search(rb"<!\s*(?:DOCTYPE|ENTITY)\b", contents, re.I):
        raise ValueError("DTD/ENTITY declarations are prohibited")
    root = ET.fromstring(contents)
    kind = name(root.tag)
    if kind == "metadata" and root.find("idinfo") is not None:
        fmt = "FGDC_CSDGM"
        title = first(root, "idinfo/citation/citeinfo/title")
        abstract = first(root, "idinfo/descript/abstract")
        agency = first(root, "idinfo/citation/citeinfo/origin")
        publication = first(root, "idinfo/citation/citeinfo/pubdate")
        extent = bbox(root, ["idinfo/spdom/bounding/westbc",
                             "idinfo/spdom/bounding/southbc",
                             "idinfo/spdom/bounding/eastbc",
                             "idinfo/spdom/bounding/northbc"])
        keywords = [x.text.strip() for x in root.findall("idinfo/keywords/theme/themekey") if x.text and x.text.strip()]
    elif kind == "metadata" and root.find("dataIdInfo") is not None:
        fmt = "ARCGIS_METADATA"
        title = first(root, "dataIdInfo/idCitation/resTitle",
                      "dataIdInfo/resTitle", "idinfo/citation/citeinfo/title")
        abstract = first(root, "dataIdInfo/idAbs", "dataIdInfo/abstract")
        agency = first(root, "dataIdInfo/idCitation/citRespParty/rpOrgName")
        publication = first(root, "dataIdInfo/idCitation/date/pubDate")
        extent = bbox(root, ["dataIdInfo/geoBox/westBL",
                             "dataIdInfo/geoBox/southBL",
                             "dataIdInfo/geoBox/eastBL",
                             "dataIdInfo/geoBox/northBL"])
        keywords = [x.text.strip() for x in root.findall(".//searchKeys/keyword") if x.text and x.text.strip()]
    elif kind in ("MD_Metadata", "MI_Metadata") and root.tag.startswith((GMD, GMI)):
        fmt = "ISO_19139"
        base = GMD + "identificationInfo/" + GMD + "MD_DataIdentification/"
        cite = base + GMD + "citation/" + GMD + "CI_Citation/"
        title = first(root, cite + GMD + "title/" + GCO + "CharacterString")
        abstract = first(root, base + GMD + "abstract/" + GCO + "CharacterString")
        agency = first(root, GMD + "contact/" + GMD + "CI_ResponsibleParty/" +
                       GMD + "organisationName/" + GCO + "CharacterString")
        publication = first(root, cite + GMD + "date/" + GMD + "CI_Date/" +
                            GMD + "date/" + GCO + "Date")
        bb = (base + GMD + "extent/" + GMD + "EX_Extent/" +
              GMD + "geographicElement/" + GMD + "EX_GeographicBoundingBox/")
        extent = bbox(root, [bb + GMD + "westBoundLongitude/" + GCO + "Decimal",
                             bb + GMD + "southBoundLatitude/" + GCO + "Decimal",
                             bb + GMD + "eastBoundLongitude/" + GCO + "Decimal",
                             bb + GMD + "northBoundLatitude/" + GCO + "Decimal"])
        keywords = [x.text.strip() for x in root.findall(
            ".//" + GMD + "keyword/" + GCO + "CharacterString") if x.text and x.text.strip()]
    else:
        raise ValueError("Unsupported or ambiguous XML metadata family")
    if not title:
        raise ValueError("Metadata record title missing")
    return {
        "metadataFamily": fmt,
        "title": title,
        "abstract": abstract,
        "sourceReportedOrganization": agency,
        "publicationDateRaw": publication,
        "geographicExtentReported": extent,
        "geographicExtentStatus": "SOURCE_REPORTED_UNVERIFIED" if extent else "UNKNOWN",
        "themeKeywordsReported": sorted(set(keywords)),
        "horizontalCrs": None,
        "verticalDatum": None,
        "coordinateValidation": "NOT_PERFORMED",
        "engineeringAcceptance": "NOT_ESTABLISHED",
        "regulatoryAuthority": "NOT_ESTABLISHED",
    }


def catalog(paths):
    if not paths or len(set(map(str, paths))) != len(paths):
        raise ValueError("Supply one or more distinct metadata files")
    records = []
    for path in paths:
        source = Path(path)
        if source.is_symlink() or not source.is_file():
            raise ValueError("Input must be a regular non-symlink metadata file")
        if source.stat().st_size > MAX_XML_BYTES:
            raise ValueError("XML metadata exceeds 2 MiB")
        content = source.read_bytes()
        record = parse_bytes(content)
        record.update({
            "sourceFilename": source.name,
            "rawMetadataSha256": hashlib.sha256(content).hexdigest(),
            "rawMetadataBytes": len(content),
            "verificationStatus": "PARSED_UNVERIFIED",
        })
        records.append(record)
    return {
        "schema": "tsm-normalized-geospatial-metadata",
        "version": "1.0.0",
        "sourceRecordCount": len(records),
        "importPolicy": "DESCRIPTIVE_ONLY_NO_AUTHORITY_PROMOTION",
        "records": records,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        output = args.output.resolve()
        if output.exists() or output in {s.resolve() for s in args.sources}:
            raise ValueError("Output must be a new file, not an input")
        result = catalog(args.sources)
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(result, stream, indent=2, allow_nan=False)
            stream.write("\n")
    except (OSError, ValueError, TypeError, ET.ParseError) as error:
        print(json.dumps({"status": "FAILED", "error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps({"status": "PARSED_UNVERIFIED", "recordCount": result["sourceRecordCount"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
