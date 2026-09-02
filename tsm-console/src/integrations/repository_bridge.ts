import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export interface SpatialValidationConfig {
  pipelinePath: string;
  outputDemPath: string;
  minimumSurfaceBenchmarkFt?: number;
}

export interface ElevationValidationResult {
  minimumElevation: number;
  maximumElevation: number;
  minimumSurfaceBenchmarkFt: number | null;
  meetsBenchmark: boolean | null;
}

export interface GeospatialToolStatus {
  pdal: boolean;
  gdalinfo: boolean;
}

function requireSuccessfulCommand(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Unable to execute ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

export class TriStateSystemBridge {
  public constructor(private readonly config: SpatialValidationConfig) {}

  public validatePipelineDefinition(): void {
    if (!existsSync(this.config.pipelinePath)) {
      throw new Error(`Pipeline definition not found: ${this.config.pipelinePath}`);
    }

    JSON.parse(readFileSync(this.config.pipelinePath, 'utf8'));
  }

  public runPdalIngestion(): void {
    this.validatePipelineDefinition();
    requireSuccessfulCommand('pdal', ['pipeline', this.config.pipelinePath]);
  }

  public inspectElevationSurface(): ElevationValidationResult {
    if (!existsSync(this.config.outputDemPath)) {
      throw new Error(`DEM artifact missing: ${this.config.outputDemPath}`);
    }

    const output = requireSuccessfulCommand('gdalinfo', ['-json', '-stats', this.config.outputDemPath]);
    const metadata = JSON.parse(output) as {
      bands?: Array<{ metadata?: { [key: string]: Record<string, string> } }>;
    };

    const bandMetadata = metadata.bands?.[0]?.metadata ?? {};
    const stats = Object.values(bandMetadata).find((entry) =>
      'STATISTICS_MINIMUM' in entry && 'STATISTICS_MAXIMUM' in entry,
    );

    if (!stats) {
      throw new Error('GDAL statistics did not contain minimum/maximum elevation values');
    }

    const minimumElevation = Number(stats.STATISTICS_MINIMUM);
    const maximumElevation = Number(stats.STATISTICS_MAXIMUM);
    if (!Number.isFinite(minimumElevation) || !Number.isFinite(maximumElevation)) {
      throw new Error('GDAL returned non-numeric elevation statistics');
    }

    const benchmark = this.config.minimumSurfaceBenchmarkFt ?? null;
    return {
      minimumElevation,
      maximumElevation,
      minimumSurfaceBenchmarkFt: benchmark,
      meetsBenchmark: benchmark === null ? null : minimumElevation >= benchmark,
    };
  }

  public detectToolchain(): GeospatialToolStatus {
    const available = (command: string): boolean => spawnSync(command, ['--version']).status === 0;
    return { pdal: available('pdal'), gdalinfo: available('gdalinfo') };
  }
}
