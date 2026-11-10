import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { assertLocalSeedDatabase, demoBackupPath, writeDemoBackup } from '../../scripts/demo-backup';
import { backupSchema, seedPreferences } from '../../shared/domain';
import { createDemoBackup } from '../../shared/demo-data';

const prisma = new PrismaClient();
const email = 'demo@habits.local';
const password = 'demo-habits-local-2026';

async function main() {
  assertLocalSeedDatabase(process.env.DATABASE_URL);
  const backup = createDemoBackup(process.env.SEED_DATE || undefined);
  const hashedPassword = await bcrypt.hash(password, 10);
  const snapshot = await prisma.$transaction(async tx => {
    const user = await tx.user.upsert({
      where: { email }, update: {},
      create: { email, password: hashedPassword, name: 'Alex Morgan' },
    });
    // Repeat runs add missing sample records without overwriting edits or other users.
    for (let i = 0; i < backup.records.length; i += 500) {
      await tx.habitRecord.createMany({
        data: backup.records.slice(i, i + 500).map(record => ({ userId: user.id, recordId: record.id, version: record.version, data: record })),
        skipDuplicates: true,
      });
    }
    const preferences = seedPreferences(backup.preferences!);
    const saved = await tx.userPreferences.upsert({
      where: { userId: user.id }, update: {},
      create: { userId: user.id, version: preferences.version, data: preferences.values },
    });
    const rows = await tx.habitRecord.findMany({ where: { userId: user.id }, orderBy: { recordId: 'asc' } });
    return backupSchema.parse({ ...backup, records: rows.map(row => row.data), preferences: saved.data });
  }, { timeout: 30000 });
  // Export the actual account snapshot, including preserved edits from earlier runs.
  await writeDemoBackup(snapshot);
  const habits = snapshot.records.filter(record => record.kind === 'habit' && !record.deleted).length;
  console.log(`Local demo account: ${email}\nInitial password: ${password}`);
  console.log(`Seeded ${habits} habits with history. Account-free copy: ${demoBackupPath}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
