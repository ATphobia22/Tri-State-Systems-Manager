/**
 * Live NOAA VDatum Full API client (vertical datum conversion).
 * Official endpoint only. Fail-closed on network/parse errors.
 * Does not invent separation values; returns API uncertainty when present.
 * Docs: https://vdatum.noaa.gov/docs/services.html
 *
 * Integration methods for TSM:
 * 1) Online API (this module) — batch/low-volume, human-gated engineering use.
 * 2) Desktop VDatum + grids — offline Java tool from vdatum.noaa.gov.
 * 3) vyperdatum + PROJ grids — local high-volume / raster (Python/GDAL).
 * 4) NCAT — horizontal + limited vertical; prefer VDatum for tidal/orthometric.
 */

export const VDATUM_CONVERT_URL = "https://vdatum.noaa.gov/vdatumweb/api/convert";

export interface VDatumConvertRequest {
  /** Longitude (geo) or easting */
  s_x: number;
  /** Latitude (geo) or northing */
  s_y: number;
  /** Height (default 0) */
  s_z?: number;
  s_h_frame?: string;
  s_v_frame?: string;
  t_h_frame?: string;
  t_v_frame?: string;
  s_v_geoid?: string;
  t_v_geoid?: string;
  s_coor?: string;
  t_coor?: string;
  region?: string;
}

export interface VDatumConvertResponse {
  region: string;
  s_h_frame: string;
  s_v_frame: string;
  t_h_frame: string;
  t_v_frame: string;
  s_x: string;
  s_y: string;
  s_z: string;
  t_x: string;
  t_y: string;
  t_z: string;
  uncertainty: string;
  s_v_geoid?: string;
  t_v_geoid?: string;
  raw: Record<string, unknown>;
}

function assertFinite(n: number, label: string): void {
  if (!Number.isFinite(n)) throw new Error(`VDATUM_${label}_NOT_FINITE`);
}

/**
 * Convert a single point via official VDatum Full API.
 * Throws on non-2xx, invalid JSON, or sentinel error values.
 */
export async function vdatumConvert(
  req: VDatumConvertRequest,
  fetchImpl: typeof fetch = fetch
): Promise<VDatumConvertResponse> {
  assertFinite(req.s_x, "S_X");
  assertFinite(req.s_y, "S_Y");
  const z = req.s_z ?? 0;
  assertFinite(z, "S_Z");

  const params = new URLSearchParams({
    s_x: String(req.s_x),
    s_y: String(req.s_y),
    s_z: String(z),
    s_h_frame: req.s_h_frame ?? "NAD83_2011",
    s_v_frame: req.s_v_frame ?? "NAVD88",
    t_h_frame: req.t_h_frame ?? req.s_h_frame ?? "NAD83_2011",
    t_v_frame: req.t_v_frame ?? "NAVD88",
    s_coor: req.s_coor ?? "geo",
    t_coor: req.t_coor ?? "geo",
    s_v_geoid: req.s_v_geoid ?? "geoid18",
    t_v_geoid: req.t_v_geoid ?? "geoid18",
  });
  if (req.region) params.set("region", req.region);

  const url = `${VDATUM_CONVERT_URL}?${params.toString()}`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`VDATUM_HTTP_${res.status}`);

  const raw = (await res.json()) as Record<string, unknown>;
  const t_z = raw.t_z;
  if (t_z === undefined || t_z === null) throw new Error("VDATUM_RESPONSE_MISSING_T_Z");
  if (String(t_z).includes("-999999")) throw new Error("VDATUM_OUT_OF_COVERAGE_OR_ERROR");

  const str = (k: string): string =>
    typeof raw[k] === "string" || typeof raw[k] === "number" ? String(raw[k]) : "";

  return {
    region: str("region"),
    s_h_frame: str("s_h_frame"),
    s_v_frame: str("s_v_frame"),
    t_h_frame: str("t_h_frame"),
    t_v_frame: str("t_v_frame"),
    s_x: str("s_x"),
    s_y: str("s_y"),
    s_z: str("s_z"),
    t_x: str("t_x"),
    t_y: str("t_y"),
    t_z: str("t_z"),
    uncertainty: str("uncertainty"),
    s_v_geoid: str("s_v_geoid") || undefined,
    t_v_geoid: str("t_v_geoid") || undefined,
    raw,
  };
}

/** Bonebank / Posey scientific anchor (not regulatory). */
export const BONEBANK_VDATUM = {
  s_x: -88.0051,
  s_y: 37.84589,
  s_z: 0,
  s_h_frame: "NAD83_2011",
  s_v_frame: "NAVD88",
  t_v_frame: "NAVD88",
  s_v_geoid: "geoid18",
  t_v_geoid: "geoid18",
} as const;
