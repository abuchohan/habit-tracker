import { Router } from 'express';
import { z } from 'zod';
import { recordSchema, savedPreferencesSchema } from '../../shared/domain';
import { verifySession } from '../middleware/verifySession.middleware';
import prisma from '../prisma/client';
import { refreshSession } from '../services/session';
export const syncRouter = Router();
syncRouter.use(verifySession);
syncRouter.post('/', async (req, res) => {
  const parsed = z.object({ accountId: z.string().optional(), records: z.array(recordSchema).max(500), preferences: savedPreferencesSchema.optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid habit data' });
  const userId = req.user!.id;
  // Check before writing: a different browser tab may have changed the session cookie.
  if (parsed.data.accountId !== undefined && parsed.data.accountId !== userId) {
    return res.status(401).json({ error: 'Sign in again to sync this account.' });
  }
  try {
    const writes = parsed.data.records.map(record => prisma.$executeRaw`
      INSERT INTO habit_records ("userId", "recordId", version, data)
      VALUES (${userId}, ${record.id}, ${record.version}, ${JSON.stringify(record)}::jsonb)
      ON CONFLICT ("userId", "recordId") DO UPDATE
      SET version = EXCLUDED.version, data = EXCLUDED.data
      WHERE habit_records.version < EXCLUDED.version
    `);
    const preferences = parsed.data.preferences;
    if (preferences) writes.push(prisma.$executeRaw`
      INSERT INTO user_preferences ("userId", version, data)
      VALUES (${userId}, ${preferences.version}, ${JSON.stringify(preferences.values)}::jsonb)
      ON CONFLICT ("userId") DO UPDATE
      SET version = EXCLUDED.version, data = EXCLUDED.data
      WHERE user_preferences.version < EXCLUDED.version
    `);
    await prisma.$transaction(writes);
    const rows = await prisma.habitRecord.findMany({ where: { userId }, select: { data: true } });
    const saved = await prisma.userPreferences.findUnique({ where: { userId } });
    await refreshSession(req, res);
    res.json({ records: rows.map(row => row.data), preferences: saved ? { version: saved.version, values: saved.data } : null });
  } catch (err) {
    console.error('Sync failed', err instanceof Error ? err.message : 'Unknown error');
    res.status(500).json({ error: 'Sync failed. Changes remain saved on your device.' });
  }
});
