import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { AssetAdapter, IngestionManifest, ValidationResult } from '../types.js';
import { IngestionWorker } from '../worker.js';

export function runOgr2Ogr(path: string, tableName: string, pgConn: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = spawn(
      'ogr2ogr',
      ['-f', 'PostgreSQL', pgConn, path, '-nln', tableName, '-overwrite', '-lco', 'GEOMETRY_NAME=geom'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    cmd.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    cmd.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ogr2ogr failed code=${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

export class GeoPackageImportAdapter implements AssetAdapter {
  readonly type = 'geopackage';
  constructor(private readonly pgConn: string) {}
  canProcess(path: string): boolean {
    return /\.gpkg$/i.test(path);
  }
  async buildManifest(path: string): Promise<IngestionManifest> {
    const sha256 = await IngestionWorker.sha256File(path);
    return {
      assetType: 'geopackage',
      assetName: basename(path),
      sourcePath: path,
      sha256,
      authorityClass: 'DERIVED',
      engineeringUse: false,
      regulatoryUse: false,
    };
  }
  async validate(manifest: IngestionManifest): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!manifest.sha256 || manifest.sha256.length !== 64) errors.push('sha256 required');
    return { valid: errors.length === 0, errors };
  }
  async ingest(manifest: IngestionManifest): Promise<{ assetId: string; runId: string }> {
    const table = `import_${manifest.sha256.slice(0, 12)}`;
    await runOgr2Ogr(manifest.sourcePath, table, this.pgConn);
    return { assetId: 'pending-db', runId: 'pending-db' };
  }
}

export class ShapefileImportAdapter implements AssetAdapter {
  readonly type = 'shapefile';
  constructor(private readonly pgConn: string) {}
  canProcess(path: string): boolean {
    return /\.shp$/i.test(path);
  }
  buildManifest(path: string): Promise<IngestionManifest> {
    return new GeoPackageImportAdapter(this.pgConn).buildManifest(path).then((m) => ({
      ...m,
      assetType: 'shapefile',
    }));
  }
  validate(m: IngestionManifest): Promise<ValidationResult> {
    return new GeoPackageImportAdapter(this.pgConn).validate(m);
  }
  ingest(m: IngestionManifest): Promise<{ assetId: string; runId: string }> {
    return new GeoPackageImportAdapter(this.pgConn).ingest({ ...m, assetType: 'shapefile' });
  }
}

export class GeoJsonImportAdapter implements AssetAdapter {
  readonly type = 'geojson';
  constructor(private readonly pgConn: string) {}
  canProcess(path: string): boolean {
    return /\.geojson$/i.test(path) || /\.json$/i.test(path);
  }
  buildManifest(path: string): Promise<IngestionManifest> {
    return new GeoPackageImportAdapter(this.pgConn).buildManifest(path).then((m) => ({
      ...m,
      assetType: 'geojson',
    }));
  }
  validate(m: IngestionManifest): Promise<ValidationResult> {
    return new GeoPackageImportAdapter(this.pgConn).validate(m);
  }
  ingest(m: IngestionManifest): Promise<{ assetId: string; runId: string }> {
    return new GeoPackageImportAdapter(this.pgConn).ingest({ ...m, assetType: 'geojson' });
  }
}

export class DatumValidator {
  validate(manifest: IngestionManifest): void {
    if (!manifest.horizontalDatum && manifest.epsg == null) {
      throw new Error('Missing horizontal datum / EPSG — refuse promote');
    }
  }
}
