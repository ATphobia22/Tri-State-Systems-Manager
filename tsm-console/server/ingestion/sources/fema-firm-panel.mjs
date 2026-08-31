import { getFirmPanelManifest } from '../../geospatial/firm-panel.mjs';

export function ingestFirmPanel(panelId) {
  const manifest = getFirmPanelManifest(panelId);
  if (!manifest) return { ok: false, status: 'NOT_FOUND', panel_id: panelId };

  return {
    ok: true,
    panel_id: manifest.panel_number,
    source_authority: manifest.source_authority,
    source_artifact: manifest.source_artifact,
    world_file_candidates: manifest.world_file_candidates,
    validation_status: manifest.georeferencing.status,
    publication_status: manifest.governance.publication_status,
    derived_assets_available: manifest.georeferencing.status === 'VALIDATED',
  };
}
