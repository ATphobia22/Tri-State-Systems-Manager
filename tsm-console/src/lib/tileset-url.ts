/**
 * Tileset URL normalization shared by the optional MapScene adapter and tests.
 * Supports HTTP(S), same-origin absolute paths, explicit relative paths, and
 * simple application-relative asset paths. Unsupported schemes fail closed.
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

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return null;
  if (value.startsWith('/')) return value;
  if (value.startsWith('./') || value.startsWith('../')) return value;

  if (/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*(?:\.json)?$/i.test(value)) {
    return value.endsWith('.json') ? value : value + '/tileset.json';
  }
  return null;
}
