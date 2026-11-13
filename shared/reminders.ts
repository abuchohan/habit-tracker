import { Habit } from './domain';

// Wall-clock schedules stay in the habit's timezone, including across DST changes.
export function dueReminder(habit: Habit, now: Date): string | null {
  if (habit.deleted || habit.archived || !habit.reminder || !habit.reminderPush) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: habit.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  if (`${part('hour')}:${part('minute')}` !== habit.reminder || !habit.reminderDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) return null;
  // Once per local day, even when the clock repeats an hour in autumn.
  return date;
}
