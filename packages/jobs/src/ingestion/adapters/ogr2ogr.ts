/**
 * ogr2ogr adapter: shells out to the `ogr2ogr` binary to load a geospatial
 * asset (GeoPackage / Shapefile / GeoJSON) into Postgres.
 *
 * The Postgres DSN comes from the required `TSM_POSTGRES_DSN` environment
 * variable (or an explicit `dsn` option, which takes precedence). A missing
 * DSN fails loudly at construction — a silent default DSN with a password
 * must never exist. The DSN is passed to ogr2ogr as a single argv element;
 * it is never logged, never embedded in a result, and never written to a file.
 *
 * Exact invocation (documented by the stub-binary tests, not by a live run —
 * `ogr2ogr` is not installed on this VM):
 *   ogr2ogr -f PostgreSQL <dsn> <temp-source-file> -nln <targetLayer> -append -update
 * The input bytes are staged in a temporary file (suffix by assetKind) and
 * removed afterwards. A missing `ogr2ogr` binary is UNAVAILABLE, a non-zero
 * exit is REJECTED with the exit code and stderr tail — never a throw.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  IngestionAssetKind,
  IngestionInput,
  IngestionResult,
} from '../../../../contracts/src/IngestionManifest.js';
import { manifestForIngestedInput } from './geojson.js';

export const OGR2OGR_DSN_ENV_VAR = 'TSM_POSTGRES_DSN';

const SOURCE_SUFFIX: Readonly<Record<IngestionAssetKind, string>> = {
  geojson: '.geojson',
  geopackage: '.gpkg',
  shapefile: '.zip',
  csv: '.csv',
  unknown: '.bin',
};

export interface Ogr2OgrAdapterOptions {
  /** Explicit DSN; overrides the env var. Never hardcode a real DSN here. */
  readonly dsn?: string;
  readonly targetLayer?: string;
  readonly timeoutMs?: number;
  /** Binary name / path for ogr2ogr; overridable for tests that stub it. */
  readonly binary?: string;
}

export function resolveOgr2OgrDsn(options: Ogr2OgrAdapterOptions = {}): string {
  const dsn = options.dsn ?? process.env[OGR2OGR_DSN_ENV_VAR] ?? '';
  if (dsn.trim() === '') {
    throw new Error(
      `Ogr2OgrAdapter requires a Postgres DSN: set the ${OGR2OGR_DSN_ENV_VAR} environment variable or pass an explicit dsn option. No default DSN exists.`,
    );
  }
  return dsn;
}

export class Ogr2OgrAdapter {
  readonly name = 'ogr2ogr';
  readonly supportedKinds = ['geojson', 'geopackage', 'shapefile'] as const;
  readonly #dsn: string;
  readonly #timeoutMs: number;
  readonly #binary: string;

  constructor(options: Ogr2OgrAdapterOptions = {}) {
    // Fail loudly at construction when the required config is absent.
    this.#dsn = resolveOgr2OgrDsn(options);
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#binary = options.binary ?? 'ogr2ogr';
  }

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    if (!this.supportedKinds.includes(input.assetKind as (typeof this.supportedKinds)[number])) {
      return {
        status: 'REJECTED',
        reason: `Ogr2OgrAdapter supports ${this.supportedKinds.join(', ')}, got '${input.assetKind}'`,
      };
    }
    const targetLayer = input.targetLayer;
    if (!targetLayer) {
      return { status: 'REJECTED', reason: 'Ogr2OgrAdapter requires a targetLayer (destination table name)' };
    }
    const dir = await mkdtemp(join(tmpdir(), 'tsm-ogr2ogr-'));
    const sourcePath = join(dir, `source${SOURCE_SUFFIX[input.assetKind]}`);
    try {
      await writeFile(sourcePath, input.bytes);
      const args = ['-f', 'PostgreSQL', this.#dsn, sourcePath, '-nln', targetLayer, '-append', '-update'];
      const outcome = await this.#runOgr2Ogr(args);
      if (outcome.status === 'ok') {
        return {
          status: 'INGESTED',
          manifest: manifestForIngestedInput(input, this.name, undefined),
        };
      }
      return { status: outcome.status, reason: outcome.reason };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  #runOgr2Ogr(args: readonly string[]): Promise<
    | { status: 'ok' }
    | { status: 'UNAVAILABLE' | 'REJECTED'; reason: string }
  > {
    return new Promise((resolve) => {
      const child = spawn(this.#binary, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        resolve({ status: 'UNAVAILABLE', reason: `ogr2ogr timed out after ${this.#timeoutMs}ms` });
      }, this.#timeoutMs);
      child.stdout.on('data', () => undefined);
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });
      child.on('error', (error: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error.code === 'ENOENT') {
          resolve({ status: 'UNAVAILABLE', reason: 'ogr2ogr executable not found on PATH; install GDAL to enable this adapter' });
        } else {
          resolve({ status: 'UNAVAILABLE', reason: `ogr2ogr failed to start: ${error.message}` });
        }
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) {
          resolve({ status: 'ok' });
        } else {
          const tail = stderr.trim().slice(-500);
          resolve({
            status: 'REJECTED',
            reason: `ogr2ogr exited with code ${code}${tail ? `: ${tail}` : ''}`,
          });
        }
      });
    });
  }
}
