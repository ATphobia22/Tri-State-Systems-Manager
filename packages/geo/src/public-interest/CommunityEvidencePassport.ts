/**
 * Community Evidence Passport — parcel-scoped informational export.
 * Supports informed conversations with professionals; not a survey, PE seal, or FEMA determination.
 */

export type PassportSection = {
  title: string;
  authority: "REGULATORY" | "OBSERVATION" | "DERIVED" | "UNKNOWN" | "INFORMATIONAL";
  bullets: string[];
  openQuestions?: string[];
};

export type CommunityEvidencePassport = {
  schema_version: "1.0.0";
  generated_at: string;
  parcelId: string;
  addressLabel?: string;
  disclaimer: string;
  sections: PassportSection[];
};

export function buildPassport(input: {
  parcelId: string;
  addressLabel?: string;
  firmPanel?: string;
  zone?: string;
  stageNote?: string;
  terrainNote?: string;
}): CommunityEvidencePassport {
  return {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    parcelId: input.parcelId,
    addressLabel: input.addressLabel,
    disclaimer:
      "Informational public-data package only. Not a land survey, elevation certificate, engineering certification, or FEMA LOMA/LOMR determination. Human authority remains final.",
    sections: [
      {
        title: "Flood map context",
        authority: "REGULATORY",
        bullets: [
          input.firmPanel ? `FIRM panel reference: ${input.firmPanel}` : "FIRM panel: not supplied in this export",
          input.zone ? `Zone context: ${input.zone}` : "Zone: verify on MSC/NFHL",
          "Confirm effective products at https://msc.fema.gov",
        ],
        openQuestions: ["Is the structure inside SFHA on the effective FIRM?"],
      },
      {
        title: "River observations",
        authority: "OBSERVATION",
        bullets: [
          input.stageNote ?? "Stage data: fetch from USGS/NWPS with station-specific datum rules",
          "Do not treat stage feet as NAVD88 without published gage zero",
        ],
      },
      {
        title: "Terrain",
        authority: "DERIVED",
        bullets: [
          input.terrainNote ?? "3DEP/Terrain-RGB screening only",
          "Missing heights must remain unknown — not invented",
        ],
        openQuestions: ["Is a licensed survey required for the decision at hand?"],
      },
    ],
  };
}

export function passportToMarkdown(p: CommunityEvidencePassport): string {
  const lines = [
    `# Community Evidence Passport`,
    ``,
    `Parcel: ${p.parcelId}`,
    p.addressLabel ? `Address: ${p.addressLabel}` : "",
    `Generated: ${p.generated_at}`,
    ``,
    `> ${p.disclaimer}`,
    ``,
  ];
  for (const s of p.sections) {
    lines.push(`## ${s.title} [${s.authority}]`);
    for (const b of s.bullets) lines.push(`- ${b}`);
    if (s.openQuestions?.length) {
      lines.push(`Open questions:`);
      for (const q of s.openQuestions) lines.push(`- ${q}`);
    }
    lines.push("");
  }
  return lines.filter((l) => l !== undefined).join("\n");
}
