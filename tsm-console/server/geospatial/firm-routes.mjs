import { getFirmPanelLayers, getFirmPanelManifest } from './firm-panel.mjs';

export function handleFirmRoute(req, res, url, json) {
  if (req.method !== 'GET') return false;

  const match = url.pathname.match(/^\/api\/geospatial\/firm\/panels\/([^/]+)(?:\/(layers))?$/);
  if (!match) return false;

  const panelId = decodeURIComponent(match[1]);
  const payload = match[2] === 'layers'
    ? getFirmPanelLayers(panelId)
    : getFirmPanelManifest(panelId);

  if (!payload) {
    json(res, 404, { error: 'FIRM panel not found' });
    return true;
  }

  json(res, 200, payload);
  return true;
}
