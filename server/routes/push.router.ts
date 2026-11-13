import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { verifySession } from '../middleware/verifySession.middleware';
import { pushConfigured } from '../services/reminders';

// Restrict delivery URLs to known browser push services; never fetch arbitrary URLs.
export const endpointSchema = z.string().url().max(2048).refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
    ['push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
});
const subscriptionSchema = z.object({ endpoint: endpointSchema, keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]+$/).min(80).max(100), auth: z.string().regex(/^[A-Za-z0-9_-]+$/).min(20).max(30) }) });
export const pushRouter = Router();
pushRouter.use(verifySession);
pushRouter.get('/config', (_req, res) => res.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null }));
pushRouter.post('/subscribe', async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid push subscription.' });
  if (!pushConfigured()) return res.status(503).json({ error: 'Push reminders are not configured on the server yet.' });
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: parsed.data.endpoint } });
  if (!existing && await prisma.pushSubscription.count({ where: { userId: req.user!.id } }) >= 20) return res.status(400).json({ error: 'Too many notification devices. Remove an existing device first.' });
  await prisma.pushSubscription.upsert({ where: { endpoint: parsed.data.endpoint }, create: { userId: req.user!.id, endpoint: parsed.data.endpoint, data: parsed.data }, update: { userId: req.user!.id, data: parsed.data } });
  res.json({ ok: true });
});
pushRouter.post('/unsubscribe', async (req, res) => {
  const parsed = z.object({ endpoint: z.string().max(2048) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid subscription.' });
  await prisma.pushSubscription.deleteMany({ where: { userId: req.user!.id, endpoint: parsed.data.endpoint } });
  res.json({ ok: true });
});
