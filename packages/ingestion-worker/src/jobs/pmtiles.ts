import { spawn } from 'node:child_process';

export class PmtilesJob {
  execute(mbtiles: string, pmtilesOut: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('pmtiles', ['convert', mbtiles, pmtilesOut], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      cmd.stderr?.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      cmd.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pmtiles convert failed: ${stderr.slice(0, 400)}`));
      });
    });
  }
}
