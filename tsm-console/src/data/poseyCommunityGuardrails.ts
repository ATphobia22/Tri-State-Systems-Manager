export const POSEY_COMMUNITY_GUARDRAILS = Object.freeze({
  purpose: 'Maximize transparent, equitable public benefit across Posey County.',
  principles: [
    'Protect life and emergency access first.',
    'Preserve evidence provenance and reproducibility.',
    'Do not convert project assertions into regulatory facts.',
    'Require qualified human review for engineering and regulatory decisions.',
    'Minimize collection and exposure of personal information.',
    'Publish methods, uncertainty, and source dates with public-facing results.',
    'Prefer interventions with measurable countywide resilience and community benefit.',
  ],
  prohibitedAutomations: [
    'automated regulatory approval',
    'automated property eligibility determination',
    'automated permit issuance',
    'automated funding award decision',
    'automated professional engineering certification',
  ],
} as const);
