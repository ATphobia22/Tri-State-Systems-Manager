import { describe, expect, it } from 'vitest';
import {
  IDTA_SUBMODEL_TEMPLATES,
  findIdtaTemplate,
  isPublishedIdtaTemplate,
} from '../../packages/ontology/src/idta-submodel-templates.ts';

describe('IDTA submodel template registry (verified 2026-10-24)', () => {
  it('corrects the pasted control-component numbers', () => {
    expect(findIdtaTemplate('02015')?.title).toBe('Control Component Type');
    expect(findIdtaTemplate('02016')?.title).toBe('Control Component Instance');
    expect(findIdtaTemplate('02017')?.title).toBe('Asset Interfaces Description');
    expect(findIdtaTemplate('02017')?.title).not.toContain('Control Component');
  });

  it('uses the suffixed hierarchical-structures number', () => {
    expect(findIdtaTemplate('02011')).toBeUndefined();
    expect(findIdtaTemplate('02011-1')?.title).toContain('Bills of Material');
  });

  it('marks 02002 as legacy, not published', () => {
    expect(findIdtaTemplate('02002')?.status).toBe('legacy-unconfirmed');
    expect(isPublishedIdtaTemplate('02002')).toBe(false);
  });

  it('publishes the AI cluster templates', () => {
    for (const id of ['02058', '02059', '02060']) {
      expect(isPublishedIdtaTemplate(id)).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const ids = IDTA_SUBMODEL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
