import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDemoBackup } from '../shared/demo-data';

export const demoBackupPath = path.resolve(__dirname, '../.local/demo-habits.json');

export async function writeDemoBackup(backup = createDemoBackup(process.env.SEED_DATE || undefined)) {
  await mkdir(path.dirname(demoBackupPath), { recursive: true });
  await writeFile(demoBackupPath, JSON.stringify(backup, null, 2) + '\n');
  return backup;
}

export function assertLocalSeedDatabase(databaseUrl: string | undefined, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === 'production') throw new Error('Demo seeding is only available locally, not in production.');
  if (!databaseUrl || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
    throw new Error('Demo seeding requires DATABASE_URL to point to localhost (use the local Docker database).');
  }
}
