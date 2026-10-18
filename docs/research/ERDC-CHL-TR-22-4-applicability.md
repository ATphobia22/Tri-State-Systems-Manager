# ERDC/CHL TR-22-4: applicability to TSM

**Status:** reference-only engineering evidence; not an approved project model or a site-specific design basis.  
**Review date:** 2026-10-18  
**Source report:** Gary Bell, David Abraham, Nate Clifton, and Kenneth H. Lamkin, *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation*, ERDC/CHL TR-22-4 (February 2022). [Official ERDC publication notice](https://www.erdc.usace.army.mil/Media/Publication-Notices/Article/2952071/wabash-and-ohio-river-confluence-hydraulic-and-sediment-transport-model-investigation/) · [DOI](https://doi.org/10.21079/11681/43441).

## Source-grounded findings

The report investigates shoaling at the Wabash–Ohio River confluence following Wabash River channel avulsions in 2008 and 2010. ERDC developed a two-dimensional Adaptive Hydraulics (AdH) model for base conditions and alternatives involving river-training structures.

The report describes field evidence including multibeam bathymetry, bed-material samples, suspended-sediment samples, and discharge/velocity measurements. The Phase 2 model was checked against hydraulic flow splits and sediment observations. Its base-condition simulation covered 26 September 2015 through 26 September 2017.

The selected alternative consisted of three dikes on Wabash Island and four on the Illinois shore. The report states that modeled shoaling at and downstream of the Wabash mouth was reduced relative to the base condition. It also explicitly cautions that the effort does not address large-scale future morphologic events such as avulsions and their consequences.

## Appropriate use in Tri-State Systems Manager

This is a **domain-specific engineering reference** for sediment transport, confluence hydraulics, calibration/validation evidence, alternative comparison, and limitations reporting. It can inform the structure of TSM's evidence records and review checklists:

- Record the modeled reach, model/code/version, scenario, boundary conditions, simulation dates, bathymetry date, and provenance for every input.
- Separate calibration from validation and preserve the observed quantities used for comparison (e.g., flow split, water-surface slope, sediment concentration, bed-material gradation).
- Capture uncertainty, spatial/temporal coverage, and known failure modes alongside results.
- Treat an alternative's result as specific to the reported domain, inputs, and scenarios—not as a transferable design recommendation.

## Explicit limitations

- The report does **not** establish calibration or validation for an arbitrary Tri-State AOI, parcel, watershed, or flood scenario.
- The reported 2015–2017 simulation and historical field measurements are not current conditions data.
- A report citation alone is not an executable AdH model, mesh, boundary-condition file, verified source dataset, or reproducible run package.
- The dike alternative is a finding of the cited study, not a recommendation for another site.
- TSM should not launch or approve a hydraulic/sediment model from this report alone. Site-specific geometry, bathymetry/terrain, hydrology, boundary conditions, model files/version, calibration data, and engineering review must be independently verified.

## Related official technical documentation

ERDC's AdH site currently identifies **AdH 4.7.2** as released. Its [official documentation page](https://www.erdc.usace.army.mil/Locations/CHL/AdH/Documentation/) lists 2D shallow-water and sediment-transport manuals; it notes that the v4.7.2 manuals are identical to those published for v4.7.1. See also the [official AdH overview/downloads](https://www.erdc.usace.army.mil/Locations/CHL/AdH/). Use the version applicable to any future, explicitly authorized AdH implementation; do not assume this 2022 report identifies the software version used in another project.

## Provenance

This note summarizes the user-provided 60-page PDF and cross-checks its bibliographic identity against the official ERDC publication notice. Statements about the report's model, observations, dates, selected alternative, and caveats are source-derived. The TSM integration guidance above is an engineering applicability assessment, not a claim made by the report.
