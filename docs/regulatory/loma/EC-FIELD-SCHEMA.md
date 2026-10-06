# Elevation Certificate — Field Schema Reference (TSM)

**Source:** FEMA Application Form MT-EZ (DHS/FEMA, extracted 2026-10-06 from
`~/workspace/tsm-forms/flood/FEMA-MT-EZ-Application-Form.doc`).
**Status:** EMPTY SCHEMA ONLY — no values filled. All elevation fields await a
licensed land surveyor, registered professional engineer, or architect.

> **Extraction note (updated 2026-10-06):** the real EC PDF
> (FF-206-FY-22-152, 7.0 MB, from fema.gov) is now on file in
> `~/workspace/tsm-forms/flood/`, but its content is XFA-sealed (only a
> "Please wait…" page extracts as text). The EC's internal section layout
> (Sections A–H) is standard public form structure; the elevation-data
> requirements below are taken verbatim from the MT-EZ
> application text, which states them explicitly. No field names were invented.
> application text, which is the form that *requires* the EC. Do not present
> this as the EC's section structure until the real EC PDF is re-acquired.

## What the MT-EZ requires the EC to establish

Per the extracted MT-EZ application text:

1. **For a structure on natural grade (LOMA):**
   - *Lowest Adjacent Grade to the structure* — defined on the form as
     "the elevation of the lowest ground touching the structure"
2. **For a legally recorded parcel of land, or portion thereof (LOMA):**
   - *Elevation of the lowest ground on the parcel or within the portion of
     land to be removed from the SFHA*
3. The MT-EZ text references "an Elevation Certificate has been completed for
   the [structure]" as part of the determination basis.

## MT-EZ data items the EC supports (verbatim from the form)

| Item | Form wording (extracted) |
|------|--------------------------|
| Determination requested | "Are you requesting that a flood zone determination be completed for: A structure on your property? … A portion of your legal [property]?" |
| Construction date | "What is the date of construction? (MM/YYYY)" |
| Fill disqualifier | "Has fill been placed on your property to raise ground that was previously below the BFE? If Yes, STOP!! You must complete the MT-1 application forms" |
| Structure address | "Street Address (including Apt. Unit, Suite, and/or Bldg. No.)" |
| Construction type | checkbox: crawl space / slab on grade / basement/enclosure / other (explain) |
| Coordinates | "Latitude and Longitude of the most upstream edge of the structure (in decimal degrees to nearest fifth decimal place)"; datum checkbox: WGS84 / NAD83 / NAD27 |
| Property description | "Legal description of Property (Lot, Block, Subdivision or abbreviated description from the Deed)"; "Property Description (Lot and Block Number, Tax Parcel Number, or Abbreviated Description from the Deed)" |
| Plat | "Copy of the Subdivision Plat Map (with recordation data and stamp of the Recorder['s Office])" |
| Deed | "Copy of the Property Deed (with recordation data and stamp of the Recorder['s Office]), accompanied by a tax assessor's map or other certified map showing the surveyed location of the property relative to local streets" |
| Map standards | "Please include a map scale and North arrow on all maps submitted." |
| Sealing | "is to be signed and sealed by a licensed land surveyor, registered professional engineer, or architect" |
| Applicant certification | "All documents submitted in support of this request are correct to the best of my knowledge. I understand [false statements punishable] under Title 18 of the United States Code, Section 1001." (applicant name, email, mailing address, phone, fax, signature, date) |

## TSM data-entry posture

- These fields define the **empty slots** a future licensed surveyor's EC would
  fill. TSM records them as `UNAVAILABLE` until that happens — never zero,
  never inferred.
- The MT-EZ copy on file expired February 28, 2014; the 2021 MT-EZ
  instructions PDF did not download correctly. Re-acquire current forms from
  fema.gov before any reliance.
- No filing is authorized by this document. Human authority remains final.
