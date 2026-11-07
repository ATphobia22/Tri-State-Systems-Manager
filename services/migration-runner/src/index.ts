import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (applied.rowCount && applied.rowCount > 0) { console.log(`skip ${file}`); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  await client.end();
  console.log('migrations complete');
}
main().catch((err) => { console.error(err); process.exit(1); });
