# SF-424 Field Guide — Application for Federal Assistance

**What this is:** a field-by-field guide to the federal SF-424 form (version 4.0),
extracted from the official XFA form on file (`~/workspace/tsm-forms/grants/`,
extracted 2026-10-06). For each field: what it needs, and where TSM already holds
that data vs. what only the applicant can supply.

> The SF-424 is the cover form for most federal grant applications. Program
> applications (OCRA CDBG, USDA, etc.) use their own systems, but the same data
> elements recur everywhere.

## The 21 fields

| # | Field | What it needs | TSM holds it? |
|---|-------|---------------|---------------|
| 1 | Type of Submission | Preapplication / Application / Changed-Corrected | Applicant decides |
| 2 | Type of Application | New / Continuation / Revision (+ revision letter A–E, AC/AD/BC/BD) | Applicant decides |
| 3 | Date Received | Filled by agency (mm/dd/yyyy) | — |
| 4 | Applicant Identifier | Applicant's own tracking number | Applicant supplies |
| 5a | Federal Entity Identifier | Federal tracking number, if any | Applicant supplies |
| 6 | Date Received by State | For state review, if applicable | — |
| 7 | State Application Identifier | State tracking number, if any | — |
| 8a | Legal Name | Applicant's exact legal name | Applicant supplies |
| 8b | EIN/TIN | IRS Employer/Taxpayer ID (**required**) | Applicant supplies |
| 8c | UEI | Unique Entity Identifier (**required**; replaces DUNS) | Applicant supplies |
| 8d | Address | Street, city, state, ZIP, country (**required**) | Applicant supplies |
| 8e | Organizational Unit | Department / Division | Applicant supplies |
| 8f | Contact Person | Name, title, phone (**required**), email (**required**), org affiliation | Applicant supplies |
| 9 | Type of Applicant | Select from list (government, nonprofit, etc.) | Applicant selects |
| 10 | Name of Federal Agency | e.g. USDA, FEMA, EPA | Per program |
| 11 | Assistance Listing Number | The CFDA/Assistance Listing number for the program | Per program (in NOFO) |
| 12 | Funding Opportunity Number | From the grant announcement | Per program (in NOFO) |
| 13 | Competition ID | If applicable | Per program |
| 14 | Areas Affected | Cities, counties, states, etc. covered by the project | **TSM: Posey County IN; project footprint maps** |
| 15 | Descriptive Title | One-line project title | Drafted per application |
| 16a/b | Congressional Districts | Of applicant and of project | **TSM: Indiana's 8th congressional district (verify at application time)** |
| 17 | Proposed Project Dates | Start and end (mm/dd/yyyy) | Per application |
| 18 | Estimated Funding | Federal + applicant + state + local + other + program income = total | Per application budget |
| 19 | EO 12372 Review | Is the application subject to state intergovernmental review? (a/b/c) | Per program/state |
| 20 | Certifications | Applicant certifies to the listed assurances | Applicant signs |
| 21 | Authorized Representative | Signature (**required**), name, title, phone, email, date | Applicant signs |

## What TSM contributes

TSM's value in an SF-424 is concentrated in a few fields:

- **Field 14 (Areas Affected):** TSM holds the authoritative project footprint —
  Posey County, the 8-county region, parcel and watershed boundaries with
  provenance. Export a map + boundary description per application.
- **Field 16 (Congressional Districts):** TSM records the district; verify
  against the House clerk's current listing before filing (boundaries change).
- **Field 15/18 support:** TSM's evidence packages (flood data, structure
  counts, cost estimates with provenance) feed the project description and
  budget justification — but the numbers on the form are the applicant's.

## What TSM never supplies

EIN/TIN, UEI, legal name, signatures, certifications, financial figures, and the
application itself. Those belong to the applying government or organization.
TSM informs; human authority signs.

## Validation rules baked into the form (from the XFA template)

- EIN/TIN is required; UEI is required; applicant street/city/state/ZIP required.
- Contact telephone and email required; authorized representative signature required.
- Dates must be mm/dd/yyyy. Missing required items block submission.
