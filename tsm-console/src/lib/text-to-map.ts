/**
 * Text-to-map geocoding for the TSM console (Ask TSM tab).
 *
 * Local-first: no network calls. A curated tri-state gazetteer
 * (Ohio–Wabash River Valley: Posey/Gibson/Warrick/Vanderburgh IN,
 * White/Gallatin IL, Henderson/Union KY) with fuzzy matching and
 * location-intent detection, so users can type things like
 * "Show me flooding near Bonebank Road" and get a map target.
 *
 * All coordinates verified via geocoding lookup 2026-10-18.
 * WGS-84 (EPSG:4326) decimal degrees.
 */

export type PlaceType = 'town' | 'road' | 'landmark' | 'county';

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  type: PlaceType;
  /** 0..1 — 1.0 is an exact alias match, lower is fuzzier. */
  confidence: number;
}

export type LocationAction = 'show' | 'zoom' | 'flood' | 'gauge' | null;

export interface LocationIntent {
  action: LocationAction;
  locations: GeocodeResult[];
  rawText: string;
}

interface GazetteerEntry {
  name: string;
  lat: number;
  lon: number;
  type: PlaceType;
  /** Alternate spellings / abbreviations users may type. */
  aliases: string[];
}

const GAZETTEER: readonly GazetteerEntry[] = [
  // --- TSM anchor site ---
  {
    name: 'Bonebank Road',
    lat: 37.845887,
    lon: -88.005075,
    type: 'road',
    aliases: ['bonebank', 'bonebank rd', 'bone bank road', '13101 bonebank'],
  },

  // --- Indiana towns ---
  {
    name: 'Mount Vernon, IN',
    lat: 37.9361,
    lon: -87.8987,
    type: 'town',
    aliases: ['mt vernon', 'mt. vernon', 'mount vernon', 'mt vernon in'],
  },
  {
    name: 'New Harmony, IN',
    lat: 38.1289,
    lon: -87.9361,
    type: 'town',
    aliases: ['new harmony', 'new harmony in'],
  },
  {
    name: 'Evansville, IN',
    lat: 37.9717,
    lon: -87.5711,
    type: 'town',
    aliases: ['evansville', 'evansville in'],
  },
  {
    name: 'Poseyville, IN',
    lat: 38.1698,
    lon: -87.78446,
    type: 'town',
    aliases: ['poseyville', 'poseyville in'],
  },
  {
    name: 'Griffin, IN',
    lat: 38.20449,
    lon: -87.91466,
    type: 'town',
    aliases: ['griffin', 'griffin in'],
  },
  {
    name: 'Wadesville, IN',
    lat: 38.10984,
    lon: -87.78929,
    type: 'town',
    aliases: ['wadesville', 'wadesville in'],
  },
  {
    name: 'Cynthiana, IN',
    lat: 38.18746,
    lon: -87.7099,
    type: 'town',
    aliases: ['cynthiana', 'cynthiana in', 'cynthiana indiana'],
  },
  {
    name: 'Princeton, IN',
    lat: 38.35522,
    lon: -87.56564,
    type: 'town',
    aliases: ['princeton', 'princeton in'],
  },
  {
    name: 'Boonville, IN',
    lat: 38.05001,
    lon: -87.27491,
    type: 'town',
    aliases: ['boonville', 'boonville in'],
  },
  {
    name: 'Newburgh, IN',
    lat: 37.94465,
    lon: -87.4062,
    type: 'town',
    aliases: ['newburgh', 'newburgh in'],
  },
  {
    name: 'Fort Branch, IN',
    lat: 38.24974,
    lon: -87.57832,
    type: 'town',
    aliases: ['fort branch', 'fort branch in'],
  },
  {
    name: 'Haubstadt, IN',
    lat: 38.20131,
    lon: -87.57753,
    type: 'town',
    aliases: ['haubstadt', 'haubstadt in'],
  },
  {
    name: 'Owensville, IN',
    lat: 38.27237,
    lon: -87.68827,
    type: 'town',
    aliases: ['owensville', 'owensville in'],
  },

  // --- Illinois towns ---
  {
    name: 'Old Shawneetown, IL',
    lat: 37.6936,
    lon: -88.1369,
    type: 'town',
    aliases: ['old shawneetown', 'old shawneetown il'],
  },
  {
    name: 'Shawneetown, IL',
    lat: 37.71288,
    lon: -88.18581,
    type: 'town',
    aliases: ['shawneetown', 'shawneetown il'],
  },
  {
    name: 'Carmi, IL',
    lat: 38.08772,
    lon: -88.16679,
    type: 'town',
    aliases: ['carmi', 'carmi il'],
  },
  {
    name: 'Grayville, IL',
    lat: 38.26088,
    lon: -87.99628,
    type: 'town',
    aliases: ['grayville', 'grayville il'],
  },
  {
    name: 'Equality, IL',
    lat: 37.73727,
    lon: -88.3498,
    type: 'town',
    aliases: ['equality', 'equality il'],
  },
  {
    name: 'Mount Carmel, IL',
    lat: 38.41619,
    lon: -87.76333,
    type: 'town',
    aliases: ['mt carmel', 'mt. carmel', 'mount carmel', 'mount carmel il'],
  },

  // --- Kentucky towns ---
  {
    name: 'Henderson, KY',
    lat: 37.83011,
    lon: -87.59683,
    type: 'town',
    aliases: ['henderson', 'henderson ky'],
  },
  {
    name: 'Morganfield, KY',
    lat: 37.68341,
    lon: -87.9162,
    type: 'town',
    aliases: ['morganfield', 'morganfield ky'],
  },
  {
    name: 'Sturgis, KY',
    lat: 37.54602,
    lon: -87.98387,
    type: 'town',
    aliases: ['sturgis', 'sturgis ky'],
  },
  {
    name: 'Corydon, KY',
    lat: 37.74298,
    lon: -87.70458,
    type: 'town',
    aliases: ['corydon', 'corydon ky'],
  },

  // --- Landmarks ---
  {
    name: 'Harmonie State Park',
    lat: 38.06589,
    lon: -87.95363,
    type: 'landmark',
    aliases: ['harmonie park', 'harmonie state park in', 'harmonie'],
  },
  {
    name: 'Hovey Lake',
    lat: 37.81901,
    lon: -87.96586,
    type: 'landmark',
    aliases: ['hovey lake', 'hovey lake fish and wildlife'],
  },
  {
    name: 'Ohio River',
    lat: 37.8,
    lon: -88.02,
    type: 'landmark',
    aliases: ['ohio river', 'the ohio', 'ohio'],
  },
  {
    name: 'Wabash River',
    lat: 38.05,
    lon: -87.9,
    type: 'landmark',
    aliases: ['wabash river', 'the wabash', 'wabash'],
  },

  // --- Counties (centered on county seat) ---
  {
    name: 'Posey County, IN',
    lat: 37.9361,
    lon: -87.8987,
    type: 'county',
    aliases: ['posey county', 'posey co', 'posey'],
  },
  {
    name: 'Gibson County, IN',
    lat: 38.35522,
    lon: -87.56564,
    type: 'county',
    aliases: ['gibson county', 'gibson co', 'gibson'],
  },
  {
    name: 'Warrick County, IN',
    lat: 38.05001,
    lon: -87.27491,
    type: 'county',
    aliases: ['warrick county', 'warrick co', 'warrick'],
  },
  {
    name: 'Vanderburgh County, IN',
    lat: 37.9717,
    lon: -87.5711,
    type: 'county',
    aliases: ['vanderburgh county', 'vanderburgh co', 'vanderburgh'],
  },
  {
    name: 'White County, IL',
    lat: 38.08772,
    lon: -88.16679,
    type: 'county',
    aliases: ['white county', 'white co il', 'white county il'],
  },
  {
    name: 'Gallatin County, IL',
    lat: 37.71288,
    lon: -88.18581,
    type: 'county',
    aliases: ['gallatin county', 'gallatin co', 'gallatin', 'gallatin county il'],
  },
  {
    name: 'Henderson County, KY',
    lat: 37.83011,
    lon: -87.59683,
    type: 'county',
    aliases: ['henderson county', 'henderson co ky', 'henderson county ky'],
  },
  {
    name: 'Union County, KY',
    lat: 37.68341,
    lon: -87.9162,
    type: 'county',
    aliases: ['union county', 'union co ky', 'union county ky'],
  },
];

/** Normalize free text for matching: lowercase, expand abbreviations, strip punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bmt\.\s*/g, 'mount ')
    .replace(/\bst\.\s*/g, 'saint ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalizeText(text);
  return n.length === 0 ? [] : n.split(' ');
}

/** Simple Levenshtein edit distance. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

/**
 * Score one alias against the normalized query.
 * Returns 0..1 (0 = no match).
 */
function scoreAlias(alias: string, queryNorm: string, queryTokens: string[]): number {
  const aliasNorm = normalizeText(alias);
  if (aliasNorm.length === 0) return 0;

  // Exact match on the whole query.
  if (queryNorm === aliasNorm) return 1.0;

  // Alias appears as a whole-word phrase inside the query.
  const padded = ` ${queryNorm} `;
  if (padded.includes(` ${aliasNorm} `)) return 0.95;

  const aliasTokens = aliasNorm.split(' ');
  // Every alias token present somewhere in the query tokens (any order).
  if (aliasTokens.every((t) => queryTokens.includes(t))) return 0.85;

  // Substring match on a reasonably long alias (e.g. "bonebank" in "bonebank road area").
  if (aliasNorm.length >= 4 && queryNorm.includes(aliasNorm)) return 0.7;
  if (queryNorm.length >= 4 && aliasNorm.length > queryNorm.length && aliasNorm.includes(queryNorm))
    return 0.6;

  // Single-token typo tolerance (edit distance <= 2, token length >= 5).
  if (aliasTokens.length === 1 && aliasNorm.length >= 5 && queryTokens.length === 1) {
    if (editDistance(aliasNorm, queryTokens[0]) <= 2) return 0.55;
  }

  return 0;
}

/**
 * Fuzzy-match free text against the tri-state gazetteer.
 * Returns matches sorted by confidence (highest first).
 */
export function geocodeText(query: string): GeocodeResult[] {
  const queryNorm = normalizeText(query);
  if (queryNorm.length === 0) return [];
  const queryTokens = tokenize(query);

  const results: GeocodeResult[] = [];
  for (const entry of GAZETTEER) {
    let best = 0;
    for (const alias of [entry.name, ...entry.aliases]) {
      const s = scoreAlias(alias, queryNorm, queryTokens);
      if (s > best) best = s;
    }
    if (best > 0) {
      results.push({
        name: entry.name,
        lat: entry.lat,
        lon: entry.lon,
        type: entry.type,
        confidence: Math.round(best * 100) / 100,
      });
    }
  }

  // Highest confidence first; ties broken by longer (more specific) name.
  results.sort((a, b) => b.confidence - a.confidence || b.name.length - a.name.length);
  return results;
}

const FLOOD_PATTERN =
  /flood(?:ing|ed|s)?\s+(?:near|at|around|in)|inundat|high\s+water|under\s+water|flood\s+map/i;
const GAUGE_PATTERN =
  /(?:water|river)\s+level|gage|gauge|\bstage\b|crest|river\s+(?:doing|at|near)|how\s+high/i;
const ZOOM_PATTERN = /zoom\s+(?:to|in|in\s+on)|go\s+to|take\s+me\s+to|fly\s+to|pan\s+to/i;
const SHOW_PATTERN = /show\s+me|display|where\s+is|locate|find|look\s+at/i;

/**
 * Detect what the user wants to do with a location mention.
 * Flood/gauge intents are checked before generic show/zoom so
 * "show me flooding near X" resolves to the flood action.
 */
export function extractLocationIntent(query: string): LocationIntent {
  let action: LocationAction = null;
  if (FLOOD_PATTERN.test(query)) action = 'flood';
  else if (GAUGE_PATTERN.test(query)) action = 'gauge';
  else if (ZOOM_PATTERN.test(query)) action = 'zoom';
  else if (SHOW_PATTERN.test(query)) action = 'show';

  return {
    action,
    locations: geocodeText(query),
    rawText: query,
  };
}

/** The full gazetteer (frozen copy) for debugging or UI listing. */
export function getGazetteer(): ReadonlyArray<{
  name: string;
  lat: number;
  lon: number;
  type: PlaceType;
}> {
  return GAZETTEER.map((e) => ({
    name: e.name,
    lat: e.lat,
    lon: e.lon,
    type: e.type,
  }));
}
