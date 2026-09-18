import { Protocol } from 'pmtiles';

const PMTILES_SCHEME = 'pmtiles://';

export interface PmtilesSource {
  readonly id: string;
  readonly archiveUrl: string;
  readonly attribution: string;
  readonly enabled: boolean;
}

function validateArchiveUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('PMTiles archives must use HTTPS.');
  }
  return parsed.toString();
}

export function createPmtilesProtocol(): Protocol {
  return new Protocol();
}

export function toPmtilesSourceUrl(source: PmtilesSource): string {
  if (!source.enabled) {
    throw new Error(`PMTiles source is disabled: ${source.id}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(source.id)) {
    throw new Error(`Invalid PMTiles source id: ${source.id}`);
  }

  return `${PMTILES_SCHEME}${validateArchiveUrl(source.archiveUrl)}`;
}
