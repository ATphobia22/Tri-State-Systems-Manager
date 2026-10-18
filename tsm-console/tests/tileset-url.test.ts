import { describe, expect, it } from 'vitest';
import { normalizeTilesetUrl } from '../src/lib/tileset-url';

describe('normalizeTilesetUrl', () => {
  it('accepts absolute HTTP(S) URLs without embedded credentials', () => {
    expect(normalizeTilesetUrl('https://example.com/tileset.json')).toBe('https://example.com/tileset.json');
    expect(normalizeTilesetUrl('http://localhost:8080/tileset.json')).toBe('http://localhost:8080/tileset.json');
    expect(normalizeTilesetUrl('https://user:secret@example.com/tileset.json')).toBeNull();
  });

  it('resolves supported local asset paths', () => {
    expect(normalizeTilesetUrl('buildings')).toBe('buildings/tileset.json');
    expect(normalizeTilesetUrl('buildings/tileset.json')).toBe('buildings/tileset.json');
    expect(normalizeTilesetUrl('/3d-tiles/tileset.json')).toBe('/3d-tiles/tileset.json');
    expect(normalizeTilesetUrl('./tileset.json')).toBe('./tileset.json');
    expect(normalizeTilesetUrl('../tileset.json')).toBe('../tileset.json');
  });

  it('rejects unsupported protocols and ambiguous URL forms', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:application/json,{}',
      'file:///etc/passwd',
      'ftp://example.com/tileset.json',
      'blob:https://example.com/id',
      '//example.com/tileset.json',
      'https://',
      'https://example.com\\@evil.test/tileset.json',
      '',
      '   ',
      'tileset.json?next=https://evil.test',
      'tileset.json#fragment',
    ]) {
      expect(normalizeTilesetUrl(value), value).toBeNull();
    }
  });
});
