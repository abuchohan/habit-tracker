import webpush from 'web-push';
import prisma from '../prisma/client';
import { habitSchema } from '../../shared/domain';
import { dueReminder } from '../../shared/reminders';

export function pushConfigured() { return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT); }
export async function sendReminders(now = new Date()) {
  const subscriptions = await prisma.pushSubscription.findMany();
  const userIds = [...new Set(subscriptions.map(s => s.userId))];
  if (!userIds.length) return;
  const records = await prisma.habitRecord.findMany({ where: { userId: { in: userIds }, AND: [
    { data: { path: ['kind'], equals: 'habit' } },
    { data: { path: ['reminderPush'], equals: true } },
  ] } });
  for (const row of records) {
    const parsed = habitSchema.safeParse(row.data);
    if (!parsed.success) continue;
    const habit = parsed.data, date = dueReminder(habit, now);
    if (!date) continue;
    for (const subscription of subscriptions.filter(s => s.userId === row.userId)) {
      // Atomic claim also prevents duplicate sends when multiple servers run.
      const claim = await prisma.pushDelivery.createMany({ data: [{ subscriptionId: subscription.id, habitId: habit.id, date }], skipDuplicates: true });
      if (!claim.count) continue;
      try {
        await webpush.sendNotification(subscription.data as unknown as webpush.PushSubscription, JSON.stringify({ title: habit.name, body: habit.question || 'Time for your habit.', tag: `habit:${habit.id}:${date}` }), { TTL: 300, timeout: 10000 });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        else {
          await prisma.pushDelivery.deleteMany({ where: { subscriptionId: subscription.id, habitId: habit.id, date } });
          console.error('Push reminder failed', status ?? 'network error');
        }
      }
    }
  }
  await prisma.pushDelivery.deleteMany({ where: { createdAt: { lt: new Date(+now - 35 * 86400000) } } });
}
export function startReminders() {
  if (!pushConfigured()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sendReminders(); } catch { console.error('Reminder scheduler failed'); } finally { running = false; }
  };
  void tick();
  return setInterval(() => void tick(), 15000).unref();
}
