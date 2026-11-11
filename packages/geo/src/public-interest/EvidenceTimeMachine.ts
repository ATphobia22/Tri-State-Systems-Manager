/**
 * Evidence Time Machine — inspect how underlying evidence for a place changed over time.
 * PRESENTATION / OBSERVATION timeline; does not invent missing agency products.
 */

export type EvidenceRevision = {
  at: string;
  sourceId: string;
  changeType: "source_revision" | "terrain_update" | "datum_correction" | "new_observation" | "map_effective_date";
  summary: string;
  authority: "REGULATORY" | "OBSERVATION" | "DERIVED";
  artifactRef?: string;
};

export type PlaceEvidenceTimeline = {
  placeId: string;
  label: string;
  revisions: EvidenceRevision[];
};

/** Example seed timeline for Posey / MTVI3 context (illustrative structure). */
export function seedMtvi3Timeline(): PlaceEvidenceTimeline {
  return {
    placeId: "gage:MTVI3",
    label: "Ohio River at Mount Vernon (MTVI3)",
    revisions: [
      {
        at: "2026-11-10",
        sourceId: "noaa-nwps-mtvi3",
        changeType: "datum_correction",
        summary: "Product vertical datum table recorded: gage zero 318.59 ft NAVD88",
        authority: "OBSERVATION",
      },
      {
        at: "1937-02-01",
        sourceId: "noaa-nwps-mtvi3",
        changeType: "new_observation",
        summary: "Historic crest stage 59.21 ft (above gage zero) in NWPS historic crests",
        authority: "OBSERVATION",
      },
    ],
  };
}

export function listRevisionTypes(timeline: PlaceEvidenceTimeline): string[] {
  return [...new Set(timeline.revisions.map((r) => r.changeType))];
}
