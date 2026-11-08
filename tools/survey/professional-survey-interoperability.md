# Professional survey interoperability research

Researched 2026-11-08 using Search, Firecrawl, Exa and AWS Core documentation.
Implementation is offline preprocessing in `tools/survey`; commercial products
are exchange endpoints, not bundled software. No hardware driver, proprietary
license or cloud account connection is implied.

| Ecosystem | TSM exchange route | Boundary |
| --- | --- | --- |
| Trimble Access / Business Center | Explicit PNEZD/PENZD CSV, supported LandXML subset; original JobXML retained as evidence | No native `.job` or JXL observation reduction |
| Leica Captivate | Configured ASCII point list / supported DXF entities | No instrument control or native DBX/HeXML parser |
| MicroSurvey FieldGenius | Point CSV, LandXML points/TIN; raw files retained | LandXML chains retained where present, not full field-to-finish coding |
| Carlson SurvCE / Carlson Survey | Carlson RW5 SP coordinates plus verbatim records, CSV, LandXML | Other `.RAW` dialects require an explicit adapter; no angle-set reduction |
| Autodesk Civil 3D | LandXML points/TIN, CSV, DXF POINT/LINE | No native DWG engine; no claim of complete corridor/parcel/alignment interpretation |
| Global Mapper / QGIS / PDAL workflows | LAS/LAZ inventory and original files, LandXML/CSV/DXF where supported | No full terrain-processing or CAD replacement |
| State/county/professional records | Local evidence manifests for deeds, plats, benchmarks and source logs | Hash integrity is distinct from authenticity and legal acceptance |

## Technical corrections

LandXML is an open interchange schema with vendor/version-specific coverage;
it is not evidence that every application supports every collection. Civil 3D
documents N,E,Z ordering. Do not use a guessed X,Y,Z interpretation.

RW5 and `.RAW` are not universal synonyms. Carlson's RW5 contains settings,
setups and observations as well as stored coordinates; satellite carrier-phase
processing requires appropriate original GNSS data and processing software.
The intake preserves observations without pretending to solve them.

DXF/DWG geometry does not establish a coordinate reference system by itself.
Drawing units and georeferencing must be checked separately. LAS/LAZ point
classification is likewise source metadata, not a survey-quality certificate.

## Professional and administrative information

Indiana PLA publishes a 24-hour active biennial renewal requirement, including
six mandatory-topic and eighteen elective-topic hours, with first-renewal and
other detailed provisions. Consult the current official rule for eligibility,
course limits, carryover and renewal; this implementation does not decide
licensure or CE compliance. NCEES describes the typical FS/PS/state-specific
exam path and directs applicants to their jurisdiction's board. Indiana rules
must not be applied automatically to Illinois or Kentucky.

Recorded plats, deeds, control and observation records should have separate
evidence entries. FEMA MT-1 documentation governs the particular application
and certification requirements; a generic data import cannot establish LOMA
eligibility or replace the required review. TSM neither generates a seal nor
submits applications.

## Optional AWS archival boundary

No AWS resources are created and no survey records uploaded by these tools.
Offline originals and manifests remain the primary workflow. If an operator
later authorizes private S3 archiving, retain the local SHA-256 alongside the
bucket, key and returned VersionId; enable versioning deliberately and use
SDK-supported upload checksums. Multipart ETags are not substitutes for the
local SHA-256. Define access, retention and costs before transferring private
property records. S3 storage is not evidence authentication or an offline
runtime dependency.

## Primary sources

- Trimble export formats: https://help.fieldsystems.trimble.com/trimble-access/latest/en/job-export-file-formats.htm
- Trimble CSV ordering: https://help.fieldsystems.trimble.com/trimble-access/latest/en/data-files-points-lines.htm
- Leica training (ASCII and DXF import): https://leica-geosystems.com/products/total-stations/software/leica-captivate-training-videos
- FieldGenius LandXML points/chains: https://s3.microsurvey.com/fieldgenius/Help/Content/LandXML_Export.htm
- Carlson RW5 field definitions: https://update.carlsonsw.com/manuals/SurvCE/online/source/FileFormat.html
- Autodesk supported LandXML data: https://help.autodesk.com/cloudhelp/2022/ENU/Civil3D-UserGuide/files/GUID-4D10ABA5-5EA0-41A8-BB61-C3F446CE7C6B.htm
- Global Mapper formats: https://www.bluemarblegeo.com/knowledgebase/global-mapper/File_Formats.htm
- ezdxf units: https://ezdxf.readthedocs.io/en/stable/concepts/units.html
- laspy chunked reading: https://laspy.readthedocs.io/en/latest/basic.html
- Indiana PLA licensing and CE: https://www.in.gov/pla/professions/surveyors-home/surveyors-licensing-information/
- NCEES jurisdiction-specific licensure: https://ncees.org/licensure/
- FEMA MT-1 technical guidance: https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf
- AWS checksum/version attributes: https://aws.amazon.com/blogs/media/building-scalable-checksums/

## Validation status

Local synthetic fixture tests exercise both compressed LAZ and uncompressed
LAS, CSV round-trips, RW5 repeat handling, malformed data, DXF units/coverage,
traverse closure and record hashes. Existing numerical and LandXML tests are
run with them. Vendor-certified round-trips, instrument field trials, survey
acceptance and a Windows native executable require separate evidence.
