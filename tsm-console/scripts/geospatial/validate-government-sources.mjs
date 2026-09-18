import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../../../artifacts/tsm-government-source-verification-v1.json', import.meta.url), 'utf8'),
);

const required = ['id', 'authority', 'sourceUrl', 'verification'];
for (const source of manifest.sources) {
  for (const field of required) {
    if (!source[field]) {
      throw new Error(`Government source ${source.id ?? '<unknown>'} is missing ${field}`);
    }
  }

  const url = new URL(source.sourceUrl);
  if (url.protocol !== 'https:') {
    throw new Error(`Government source ${source.id} must use HTTPS`);
  }

  if (source.id === 'fema-nfhl' && source.authority !== 'FEMA') {
    throw new Error('FEMA NFHL authority boundary was altered.');
  }

  if (
    source.id === 'indiana-bafm' &&
    source.id === 'fema-nfhl'
  ) {
    throw new Error('FEMA and Indiana BAFM sources must remain distinct.');
  }

  if (
    source.id === 'usgs-03378500' &&
    source.verticalDatum !== 'NAVD88_FOR_GAGE_SITE_ALTITUDE_METADATA'
  ) {
    throw new Error('USGS gage datum metadata contract changed unexpectedly.');
  }
}

console.log(`validated ${manifest.sources.length} government source contracts`);
