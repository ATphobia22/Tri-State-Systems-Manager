/**
 * Live NGS NCAT (Coordinate Conversion and Transformation Tool) client.
 * Calls the official NOAA NGS web service only. Fail-closed on network/parse errors.
 * Does not invent datums, CRS, or geoid heights.
 * API docs: https://geodesy.noaa.gov/web_services/ncat/index.shtml
 */

export const NCAT_BASE_URL = "https://geodesy.noaa.gov/api/ncat";

export interface NcatLlhRequest {
  lat: number;
  lon: number;
  inDatum: string;
  outDatum: string;
  /** Ellipsoid height (meters) when known */
  eht?: number;
  inVertDatum?: string;
  outVertDatum?: string;
  orthoHt?: number;
}

export interface NcatLlhResponse {
  srcDatum: string;
  destDatum: string;
  srcLat: string;
  destLat: string;
  srcLon: string;
  destLon: string;
  srcEht?: string;
  destEht?: string;
  srcOrthoht?: string;
  destOrthoht?: string;
  spcZone?: string;
  spcNorthing_m?: string;
  spcEasting_m?: string;
  utmZone?: string;
  raw: Record<string, unknown>;
}

function assertFinite(n: number, label: string): void {
  if (!Number.isFinite(n)) throw new Error(`NCAT_${label}_NOT_FINITE`);
}

/**
 * Transform lat/lon (optional height) via official NGS NCAT LLH service.
 * Throws on non-2xx, invalid JSON, or missing required fields.
 */
export async function ncatLlh(
  req: NcatLlhRequest,
  fetchImpl: typeof fetch = fetch
): Promise<NcatLlhResponse> {
  assertFinite(req.lat, "LAT");
  assertFinite(req.lon, "LON");
  if (req.lat < -90 || req.lat > 90) throw new Error("NCAT_LAT_OUT_OF_RANGE");
  if (req.lon < -180 || req.lon > 180) throw new Error("NCAT_LON_OUT_OF_RANGE");

  const params = new URLSearchParams({
    lat: String(req.lat),
    lon: String(req.lon),
    inDatum: req.inDatum,
    outDatum: req.outDatum,
  });
  if (req.eht !== undefined) {
    assertFinite(req.eht, "EHT");
    params.set("eht", String(req.eht));
  }
  if (req.inVertDatum) params.set("inVertDatum", req.inVertDatum);
  if (req.outVertDatum) params.set("outVertDatum", req.outVertDatum);
  if (req.orthoHt !== undefined) {
    assertFinite(req.orthoHt, "ORTHO_HT");
    params.set("orthoHt", String(req.orthoHt));
  }

  const url = `${NCAT_BASE_URL}/llh?${params.toString()}`;
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`NCAT_HTTP_${res.status}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  if (typeof raw.srcDatum !== "string" || typeof raw.destDatum !== "string") {
    throw new Error("NCAT_RESPONSE_MISSING_DATUM");
  }
  if (typeof raw.srcLat !== "string" || typeof raw.destLat !== "string") {
    throw new Error("NCAT_RESPONSE_MISSING_LAT");
  }
  if (typeof raw.srcLon !== "string" || typeof raw.destLon !== "string") {
    throw new Error("NCAT_RESPONSE_MISSING_LON");
  }

  return {
    srcDatum: raw.srcDatum,
    destDatum: raw.destDatum,
    srcLat: raw.srcLat,
    destLat: raw.destLat,
    srcLon: raw.srcLon,
    destLon: raw.destLon,
    srcEht: typeof raw.srcEht === "string" ? raw.srcEht : undefined,
    destEht: typeof raw.destEht === "string" ? raw.destEht : undefined,
    srcOrthoht: typeof raw.srcOrthoht === "string" ? raw.srcOrthoht : undefined,
    destOrthoht: typeof raw.destOrthoht === "string" ? raw.destOrthoht : undefined,
    spcZone: typeof raw.spcZone === "string" ? raw.spcZone : undefined,
    spcNorthing_m: typeof raw.spcNorthing_m === "string" ? raw.spcNorthing_m : undefined,
    spcEasting_m: typeof raw.spcEasting_m === "string" ? raw.spcEasting_m : undefined,
    utmZone: typeof raw.utmZone === "string" ? raw.utmZone : undefined,
    raw,
  };
}

/** Posey Co / Bonebank site anchor (scientific reference only; not regulatory). */
export const BONEBANK_LL = {
  lat: 37.84589,
  lon: -88.0051,
  inDatum: "nad83(2011)",
  outDatum: "nad83(2011)",
} as const;
