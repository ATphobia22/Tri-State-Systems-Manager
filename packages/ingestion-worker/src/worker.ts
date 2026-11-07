import type { Pool } from 'pg';
import type { AssetAdapter, IngestionManifest } from './types.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class IngestionWorker {
  constructor(private readonly db: Pool) {}

  async run(adapter: AssetAdapter, filePath: string): Promise<{ assetId: string; runId: string }> {
    const manifest = await adapter.buildManifest(filePath);
    const validation = await adapter.validate(manifest);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }
    if (manifest.engineeringUse || manifest.regulatoryUse) {
      throw new Error(
        'engineeringUse/regulatoryUse require human approval path; worker rejects silent elevation',
      );
    }
    return adapter.ingest(manifest);
  }

  static async sha256File(path: string): Promise<string> {
    const buf = await readFile(path);
    return createHash('sha256').update(buf).digest('hex');
  }

  async recordAsset(manifest: IngestionManifest): Promise<string> {
    const res = await this.db.query(
      `INSERT INTO imported_assets (
         asset_type, asset_name, source_id, source_path, sha256,
         file_size_bytes, horizontal_datum, vertical_datum, epsg,
         status, authority_class, engineering_use, regulatory_use
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'QUARANTINED',$10,false,false)
       RETURNING asset_id`,
      [
        manifest.assetType,
        manifest.assetName,
        manifest.sourceId ?? null,
        manifest.sourcePath,
        manifest.sha256,
        manifest.fileSizeBytes ?? null,
        manifest.horizontalDatum ?? null,
        manifest.verticalDatum ?? null,
        manifest.epsg ?? null,
        manifest.authorityClass,
      ],
    );
    return res.rows[0].asset_id as string;
  }
}
