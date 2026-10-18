import { describe, expect, it } from 'vitest';
import { normalizeTilesetUrl } from '../src/lib/tileset-url';

describe('normalizeTilesetUrl', () => {
  it('accepts HTTP(S) URLs and supported local paths', () => {
    expect(normalizeTilesetUrl('https://example.com/tileset.json')).toBe('https://example.com/tileset.json');
    expect(normalizeTilesetUrl('buildings')).toBe('buildings/tileset.json');
    expect(normalizeTilesetUrl('/3d-tiles/tileset.json')).toBe('/3d-tiles/tileset.json');
    expect(normalizeTilesetUrl('./tileset.json')).toBe('./tileset.json');
  });

  it('rejects unsupported schemes and ambiguous URL forms', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:application/json,{}',
      'file:///etc/passwd',
      'ftp://example.com/tileset.json',
      'blob:https://example.com/id',
      '//example.com/tileset.json',
      'https://user:secret@example.com/tileset.json',
      'https://',
      'https://example.com\\@evil.test/tileset.json',
      'tileset.json?next=https://evil.test',
      'tileset.json#fragment',
      '',
      '   ',
    ]) {
      expect(normalizeTilesetUrl(value), value).toBeNull();
    }
  });
});
