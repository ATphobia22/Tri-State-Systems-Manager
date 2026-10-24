/**
 * IDTA Asset Administration Shell (AAS) Submodel Template registry.
 *
 * Verified 2026-10-24 against IDTA's official submodel hub
 * (https://industrialdigitaltwin.org/en/content-hub/submodels).
 * AAS itself is standardized as IEC 63278-1:2023 (IEC TC 65/WG 24 owns the
 * standard; IDTA stewards the submodel-template ecosystem — IDTA is not
 * the owner of IEC 63278).
 *
 * This is a TYPES-ONLY registry: template numbers, titles, versions, and
 * publication status. It is not an AAS implementation, and no template
 * content is reproduced here.
 *
 * Corrections to the pasted table (do not use the pasted values):
 * - 02015 = Control Component Type; 02016 = Control Component Instance.
 *   02017 is Asset Interfaces Description, NOT a control component.
 * - 02011 exists only as 02011-1, "Hierarchical Structures enabling Bills
 *   of Material — Extension based on IEC 81346".
 * - 02045's full title is "Data Model for Asset Location".
 * - 02053's full title is "Control configuration and parametrization for
 *   NC/CNC machines".
 * - 02002 Contact Information is LEGACY: cited in IDTA's own 02005
 *   document but absent from the current hub listing. Re-confirm before
 *   use; do not build on it as a current template.
 */

export type IdtaTemplateStatus = 'published' | 'legacy-unconfirmed';

export interface IdtaSubmodelTemplate {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly status: IdtaTemplateStatus;
  readonly cluster: string;
}

export const IDTA_SUBMODEL_TEMPLATES: readonly IdtaSubmodelTemplate[] = [
  { id: '02002', title: 'Contact Information', version: '1.0', status: 'legacy-unconfirmed', cluster: 'Digital Product Passport' },
  { id: '02003', title: 'Generic Frame for Technical Data for Industrial Equipment in Manufacturing', version: '2.0', status: 'published', cluster: 'Digital Product Passport' },
  { id: '02004', title: 'Handover Documentation', version: '2.0', status: 'published', cluster: 'Digital Product Passport' },
  { id: '02006', title: 'Digital Nameplate for Industrial Equipment', version: '3.0.1', status: 'published', cluster: 'Digital Product Passport' },
  { id: '02011-1', title: 'Hierarchical Structures enabling Bills of Material — Extension based on IEC 81346', version: '1.0', status: 'published', cluster: 'Digital Product Passport' },
  { id: '02013', title: 'Reliability', version: '1.0', status: 'published', cluster: 'Engineering' },
  { id: '02014', title: 'Functional Safety', version: '1.0', status: 'published', cluster: 'Engineering' },
  { id: '02015', title: 'Control Component Type', version: '2.0', status: 'published', cluster: 'Engineering' },
  { id: '02016', title: 'Control Component Instance', version: '2.0', status: 'published', cluster: 'Engineering' },
  { id: '02017', title: 'Asset Interfaces Description', version: '1.2', status: 'published', cluster: 'Asset Services' },
  { id: '02021', title: 'Sizing of power drive trains', version: '1.1', status: 'published', cluster: 'Engineering' },
  { id: '02022', title: 'Wireless Communication', version: '1.0', status: 'published', cluster: 'Asset Services' },
  { id: '02023', title: 'Carbon Footprint', version: '1.0', status: 'published', cluster: 'Digital Product Passport' },
  { id: '02026', title: 'Provision of 3D Models', version: '1.0', status: 'published', cluster: 'Engineering' },
  { id: '02027', title: 'Asset Interfaces Mapping Configuration', version: '1.0', status: 'published', cluster: 'Asset Services' },
  { id: '02045', title: 'Data Model for Asset Location', version: '1.0', status: 'published', cluster: 'Engineering' },
  { id: '02053', title: 'Control configuration and parametrization for NC/CNC machines', version: '1.0', status: 'published', cluster: 'Engineering' },
  { id: '02058', title: 'Artificial Intelligence Dataset', version: '1.0', status: 'published', cluster: 'Artificial Intelligence' },
  { id: '02059', title: 'Artificial Intelligence Deployment', version: '1.0', status: 'published', cluster: 'Artificial Intelligence' },
  { id: '02060', title: 'Artificial Intelligence Model Nameplate', version: '1.0', status: 'published', cluster: 'Artificial Intelligence' },
];

export function findIdtaTemplate(id: string): IdtaSubmodelTemplate | undefined {
  return IDTA_SUBMODEL_TEMPLATES.find((t) => t.id === id);
}

/** True only for templates confirmed published on IDTA's hub. Legacy entries fail. */
export function isPublishedIdtaTemplate(id: string): boolean {
  return findIdtaTemplate(id)?.status === 'published';
}
