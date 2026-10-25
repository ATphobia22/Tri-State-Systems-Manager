import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('earth-observation research integration contract', () => {
  it('validates research sources without overstating runtime integration', () => {
    const result = spawnSync(process.execPath, ['../scripts/ci/validate-earth-observation-research-integration.mjs'], {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(true);
    expect(report.sourceCount).toBe(2);
    expect(report.runtimeAdaptersImplemented).toBe(0);
    expect(report.liveAccessVerifiedByTSM).toBe(0);
  });
});
