/**
 * Apple Maps presentation/reference boundary.
 *
 * TSM does not ingest, persist, scrape, derive, cache, or train on Apple Map Data.
 * This module contains provider-neutral capability and handoff contracts only.
 * A native MapKit host may implement these contracts without changing the TSM
 * evidence or analysis planes.
 */
export type AppleMapsSurface =
  | "map" | "realistic_3d" | "look_around" | "search" | "geocoding"
  | "directions" | "places" | "overlays" | "camera";

export type AppleMapsDataDisposition =
  | "ephemeral_presentation_only"
  | "ephemeral_user_initiated_lookup";

export interface AppleMapsContextRequest {
  readonly latitude: number;
  readonly longitude: number;
  readonly surface: AppleMapsSurface;
  readonly disposition: AppleMapsDataDisposition;
}

export interface TsmViewportHandoff {
  readonly latitude: number;
  readonly longitude: number;
  readonly headingDegrees: number;
  readonly pitchDegrees: number;
  readonly distanceMeters: number;
  readonly source: "tsm";
}

export interface AppleMapsContextPolicy {
  readonly provider: "apple_maps";
  readonly authoritativeForTsmEvidence: false;
  readonly observationalForTsmEngineering: false;
  readonly persistentStorageAllowed: false;
  readonly bulkDownloadAllowed: false;
  readonly scrapingAllowed: false;
  readonly derivativeDatabaseAllowed: false;
  readonly modelTrainingAllowed: false;
  readonly mappingServiceImprovementUseAllowed: false;
  readonly presentationOnly: true;
}

export const APPLE_MAPS_CONTEXT_POLICY: AppleMapsContextPolicy = Object.freeze({
  provider: "apple_maps",
  authoritativeForTsmEvidence: false,
  observationalForTsmEngineering: false,
  persistentStorageAllowed: false,
  bulkDownloadAllowed: false,
  scrapingAllowed: false,
  derivativeDatabaseAllowed: false,
  modelTrainingAllowed: false,
  mappingServiceImprovementUseAllowed: false,
  presentationOnly: true,
});

const finite = (value: number): boolean => Number.isFinite(value);

export function validateAppleMapsContextRequest(request: AppleMapsContextRequest): void {
  if (!finite(request.latitude) || request.latitude < -90 || request.latitude > 90) {
    throw new Error("Apple Maps latitude must be finite and within [-90, 90]");
  }
  if (!finite(request.longitude) || request.longitude < -180 || request.longitude > 180) {
    throw new Error("Apple Maps longitude must be finite and within [-180, 180]");
  }
  if (!request.surface) throw new Error("Apple Maps surface is required");
  if (!request.disposition) throw new Error("Apple Maps data disposition is required");
}

export function validateTsmViewportHandoff(handoff: TsmViewportHandoff): void {
  if (!finite(handoff.latitude) || !finite(handoff.longitude)) {
    throw new Error("TSM viewport coordinates must be finite");
  }
  if (!finite(handoff.headingDegrees) || handoff.headingDegrees < 0 || handoff.headingDegrees >= 360) {
    throw new Error("TSM heading must be in [0, 360)");
  }
  if (!finite(handoff.pitchDegrees) || handoff.pitchDegrees < 0 || handoff.pitchDegrees > 90) {
    throw new Error("TSM pitch must be in [0, 90]");
  }
  if (!finite(handoff.distanceMeters) || handoff.distanceMeters <= 0) {
    throw new Error("TSM camera distance must be positive");
  }
  if (handoff.source !== "tsm") throw new Error("Viewport handoff source must be TSM");
}

export function buildAppleMapsPresentationRequest(
  request: AppleMapsContextRequest,
): AppleMapsContextRequest {
  validateAppleMapsContextRequest(request);
  return Object.freeze({ ...request });
}
