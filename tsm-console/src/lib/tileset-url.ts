/**
 * Tileset URL normalization shared by the 3D Tiles renderer and its tests.
 *
 * Only HTTP(S), same-origin absolute paths, explicit relative paths, and
 * simple application-relative asset paths are accepted. Unsupported schemes
 * and ambiguous URL forms fail closed instead of being handed to a loader.
 */
export function normalizeTilesetUrl(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!url.hostname || url.username || url.password) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  // Disallow protocol-relative URLs, backslash-based host confusion, and
  // all non-HTTP schemes (file:, ftp:, blob:, javascript:, data:, etc.).
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return null;

  if (value.startsWith('/')) return value;
  if (value.startsWith('./') || value.startsWith('../')) return value;

  // Bare paths are resolved against the application base path. Restrict the
  // character set so a bare path cannot smuggle query, fragment or URL syntax.
  if (/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*(?:\.json)?$/i.test(value)) {
    return value.endsWith('.json') ? value : value + '/tileset.json';
  }

  return null;
}
