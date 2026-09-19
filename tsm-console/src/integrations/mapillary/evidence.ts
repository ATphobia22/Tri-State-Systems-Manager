/** Mapillary street-imagery evidence boundary.
 *
 * Mapillary imagery is observational evidence. It is never promoted to
 * authoritative geometry by this module. The access token is supplied at
 * runtime and must never be committed to the repository.
 */
export interface MapillaryEvidenceRecord {
  readonly imageId: string;
  readonly capturedAt?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly sourceUrl: string;
  readonly authority: "observational_reference";
  readonly humanReviewRequired: true;
}

export interface MapillaryViewerAdapter {
  loadImage(imageId: string): Promise<MapillaryEvidenceRecord>;
  destroy(): void;
}

export function createMapillaryEvidenceRecord(
  imageId: string,
  sourceUrl: string,
  capturedAt?: string,
): MapillaryEvidenceRecord {
  if (!/^[A-Za-z0-9_-]+$/.test(imageId)) throw new Error("invalid Mapillary image id");
  if (!sourceUrl.startsWith("https://")) throw new Error("sourceUrl must use HTTPS");
  return {
    imageId,
    sourceUrl,
    capturedAt,
    authority: "observational_reference",
    humanReviewRequired: true,
  };
}
