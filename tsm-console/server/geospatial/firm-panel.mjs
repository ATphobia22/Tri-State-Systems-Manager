import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, '../../../data/fema/18129C0265C/manifest.json');

// The FIRM manifest is a static deployment artifact: read and parse it once,
// then serve every request from memory instead of hitting the filesystem per
// request. Lazy (first-use) so importing this module never fails when the
// manifest is absent; a missing manifest still fails closed on first access.
let manifestCache = null;

export function getFirmPanelManifest(panelId) {
  if (panelId !== '18129C0265C') return null;
  if (!manifestCache) manifestCache = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  return manifestCache;
}

export function getFirmPanelLayers(panelId) {
  const manifest = getFirmPanelManifest(panelId);
  if (!manifest) return null;

  const canPublishDerived = manifest.georeferencing.status === 'VALIDATED'
    && manifest.governance.publication_status === 'public-derived';

  return {
    panel_id: manifest.panel_number,
    source: {
      authority: manifest.source_authority,
      artifact: manifest.source_artifact,
      effective_date: manifest.effective_date,
    },
    validation_status: manifest.georeferencing.status,
    public_layers: canPublishDerived ? [] : [],
    blocked_reason: canPublishDerived
      ? null
      : 'No derived FIRM layer is publicly releasable until georeferencing is validated against authoritative FEMA metadata.',
  };
}
