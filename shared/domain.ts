// Habit score and interval algorithms adapted from Loop Habit Tracker.
// Copyright (C) 2016-2025 Alinson Santos Xavier. GPL-3.0-or-later.
import { z } from 'zod';

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time (HH:mm).');
export type TimeFormat = '24h' | '12h';
export function formatTime(time: string, format: TimeFormat = '24h') {
  if (format === '24h') return time;
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:${time.slice(3)} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function parseTime(input: string, format: TimeFormat = '24h', period: 'AM' | 'PM' = 'AM'): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (format === '24h' ? hour > 23 : hour < 1 || hour > 12)) return null;
  if (format === '12h') hour = hour % 12 + (period === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2200-12-31';
}, 'Invalid calendar date');
const base = {
  id: z.string().min(1).max(160),
  version: z.string().regex(/^\d{13}:[a-zA-Z0-9-]{1,80}$/),
  deleted: z.boolean().default(false),
};
export const habitSchema = z.object({
  ...base, kind: z.literal('habit'), name: z.string().trim().min(1).max(120),
  question: z.string().max(500), description: z.string().max(4000), category: z.string().max(100).default(''),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/), type: z.enum(['boolean', 'number', 'time']),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
  numerator: z.number().int().min(1).max(365), denominator: z.number().int().min(1).max(365),
  target: z.number().finite().min(0).max(1e9), targetType: z.enum(['atLeast', 'atMost']),
  unit: z.string().max(40), created: dateSchema, archived: z.boolean(), order: z.number().finite(),
  reminder: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  reminderDays: z.array(z.number().int().min(0).max(6)).max(7),
  timezone: z.string().max(100).refine(v => { try { new Intl.DateTimeFormat('en', { timeZone: v }); return true; } catch { return false; } }),
}).refine(h => h.numerator <= h.denominator, 'Repetitions cannot exceed the interval');
export const entrySchema = z.object({
  ...base, kind: z.literal('entry'), habitId: z.string().min(1).max(160), date: dateSchema,
  value: z.number().finite().min(0).max(1e9).nullable(), state: z.enum(['yes', 'no', 'skip', 'unknown']),
  notes: z.string().max(4000),
  time: timeSchema.nullable().optional(),
}).refine(e => e.id === `entry:${e.habitId}:${e.date}`, 'Invalid entry identifier');
export const recordSchema = z.union([habitSchema, entrySchema]);
export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark', 'black']).default('system'),
  skip: z.boolean().default(false), unknown: z.boolean().default(false),
  reverse: z.boolean().default(true), firstWeekday: z.number().int().min(0).max(6).default(1),
  dayOffset: z.number().int().min(0).max(6).default(0), tapToToggle: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
});
export const savedPreferencesSchema = z.object({
  version: base.version,
  values: preferencesSchema,
});
export type SavedPreferences = z.infer<typeof savedPreferencesSchema>;
// Existing device preferences seed an account without overriding settings already synced elsewhere.
export function seedPreferences(values: Preferences): SavedPreferences {
  return { version: '0000000000000:legacy', values };
}
export function mergePreferences(local: SavedPreferences, remote: SavedPreferences | null) {
  // Equal seed versions use the server's canonical copy on a device's first sync.
  return remote && remote.version >= local.version ? remote : local;
}
export const backupSchema = z.object({
  format: z.literal('loop-web'), version: z.literal(1),
  records: z.array(recordSchema).max(200000), preferences: preferencesSchema.optional(),
});
export type Habit = z.infer<typeof habitSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type HabitRecord = Habit | Entry;
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = preferencesSchema.parse({});
export const palette = ['#1976d2', '#e91e63', '#ff8700', '#673ab7', '#00897b', '#43a047', '#d32f2f', '#795548', '#607d8b', '#00acc1'];
export function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
let lastStamp = 0;
export function version(after = '') {
  lastStamp = Math.max(Date.now(), lastStamp + 1, Number(after.slice(0, 13)) + 1 || 0);
  return `${lastStamp}:${uid()}`;
}
export function day(date = new Date(), offset = 0): string {
  const d = new Date(date); d.setHours(d.getHours() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, amount: number) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) { return Math.round((+new Date(b + 'T12:00:00Z') - +new Date(a + 'T12:00:00Z')) / 86400000); }
export function weekday(date: string) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
export function monthLength(date: string) { const d = new Date(date + 'T12:00:00Z'); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); }
export function entryId(habitId: string, date: string) { return `entry:${habitId}:${date}`; }
export function newHabit(order = 0): Habit {
  return { id: uid(), kind: 'habit', version: version(), deleted: false, name: '', question: '', description: '', category: '',
    color: palette[0], type: 'boolean', timeFormat: '24h', numerator: 1, denominator: 1, target: 1, targetType: 'atLeast', unit: '',
    created: day(), archived: false, order, reminder: null, reminderDays: [0, 1, 2, 3, 4, 5, 6],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
// Merge per record: separate dates never overwrite each other. Tombstones prevent resurrection.
export function mergeRecords(local: HabitRecord[], remote: HabitRecord[]) {
  const records = new Map(local.map(r => [r.id, r]));
  for (const r of remote) { const prev = records.get(r.id); if (!prev || r.version > prev.version) records.set(r.id, r); }
  return [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function entriesFor(records: HabitRecord[], habitId: string) {
  return records.filter((r): r is Entry => r.kind === 'entry' && r.habitId === habitId && !r.deleted);
}
// Reorder the visible slots; filtered-out and archived habits retain their places.
export function reorderHabitRecords(records: HabitRecord[], habitId: string, targetId: string, visibleIds: string[]): Habit[] {
  const all = records.filter((r): r is Habit => r.kind === 'habit' && !r.deleted)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const visible = new Set(visibleIds);
  const slots = all.filter(h => visible.has(h.id));
  const from = slots.findIndex(h => h.id === habitId), to = slots.findIndex(h => h.id === targetId);
  if (from < 0 || to < 0 || from === to) return [];
  slots.splice(to, 0, slots.splice(from, 1)[0]);
  let index = 0;
  const reordered = all.map(h => visible.has(h.id) ? slots[index++] : h);
  const after = all.reduce((latest, h) => h.version > latest ? h.version : latest, '');
  return reordered.flatMap((h, order) => h.order === order ? [] : [{ ...h, order, version: version(after) }]);
}
export function schedule(h: Habit) { return h.denominator === 1 ? 'Every day' : h.numerator === 1 ? `Every ${h.denominator} days` : `${h.numerator} times in ${h.denominator} days`; }
export type ComputedDay = { date: string; state: Entry['state'] | 'auto'; value: number | null; time: string | null; notes: string; completed: boolean; score: number };
export function computeHistory(h: Habit, entries: Entry[], today = day(), firstWeekday = 1): ComputedDay[] {
  const known = entries.filter(e => !e.deleted && e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  if (!known.length) return [];
  const byDate = new Map(known.map(e => [e.date, e]));
  let from = known[known.length - 1].date;
  const auto = new Set<string>();
  if (h.type !== 'number') {
    const yes = known.filter(e => e.state === 'yes');
    const intervals: { begin: string; center: string; end: string }[] = [];
    for (let i = h.numerator - 1; i < yes.length; i++) {
      const begin = yes[i].date, center = yes[i - h.numerator + 1].date;
      let size = h.denominator;
      if (size === 30 || size === 31) size = monthLength(Number(begin.slice(8)) === monthLength(begin) ? addDays(begin, 1) : begin);
      if (daysBetween(begin, center) < size) intervals.push({ begin, center, end: addDays(begin, size - 1) });
    }
    for (let i = 1; i < intervals.length; i++) {
      const curr = intervals[i], next = intervals[i - 1];
      const gap = daysBetween(next.begin, curr.end);
      if (gap >= 0) { const shift = Math.min(daysBetween(curr.center, curr.end), gap + 1); curr.begin = addDays(curr.begin, -shift); curr.end = addDays(curr.end, -shift); }
    }
    for (const iv of intervals) {
      if (iv.begin < from) from = iv.begin;
      for (let d = iv.begin; d <= iv.end && d <= today; d = addDays(d, 1)) auto.add(d);
    }
  }
  const history: ComputedDay[] = [];
  const frequency = h.numerator / h.denominator, multiplier = Math.pow(0.5, Math.sqrt(frequency) / 13);
  const denominator = h.type !== 'number' && frequency < 1 ? h.denominator * 2 : h.denominator;
  const numerator = h.type !== 'number' && frequency < 1 ? h.numerator * 2 : h.numerator;
  let score = h.type === 'number' && h.targetType === 'atMost' ? 1 : 0;
  let sum = 0;
  const window: number[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const e = byDate.get(d);
    const state = e?.state === 'yes' || e?.state === 'skip' ? e.state : auto.has(d) ? 'auto' : e?.state ?? 'unknown';
    const value = e?.value ?? null;
    if (state !== 'skip') {
      const v = h.type === 'number' ? value ?? 0 : state === 'yes' ? 1 : 0;
      window.push(v); sum += v; if (window.length > denominator) sum -= window.shift()!;
      const completion = h.type !== 'number' ? Math.min(1, sum / numerator)
        : h.targetType === 'atLeast' ? h.target > 0 ? Math.min(1, sum / h.target) : 1
        : h.target > 0 ? Math.max(0, Math.min(1, 2 - sum / h.target)) : sum > 0 ? 0 : 1;
      score = score * multiplier + completion * (1 - multiplier);
    }
    history.push({ date: d, state, value, time: state === 'yes' ? e?.time ?? null : null, notes: e?.notes ?? '', completed: ['yes', 'auto', 'skip'].includes(state), score });
  }
  if (h.type === 'number') {
    const periods = new Map<string, ComputedDay[]>();
    for (const item of history) {
      const start = h.denominator <= 1 ? item.date : h.denominator <= 7 ? addDays(item.date, -((weekday(item.date) - firstWeekday + 7) % 7)) : item.date.slice(0, 7) + '-01';
      const group = periods.get(start) ?? []; group.push(item); periods.set(start, group);
    }
    for (const group of periods.values()) {
      const length = h.denominator <= 1 ? 1 : h.denominator <= 7 ? 7 : 30;
      const target = Math.max(0, h.target / h.denominator * (length - group.filter(e => e.state === 'skip').length));
      const total = group.reduce((a, e) => a + (e.state === 'skip' ? 0 : e.value ?? 0), 0);
      const completed = h.targetType === 'atLeast' ? total >= target : total <= target;
      group.forEach(e => { e.completed = completed; });
    }
  }
  return history;
}
export function streaks(history: ComputedDay[]) {
  const result: { start: string; end: string; length: number }[] = [];
  for (const e of history) {
    if (!e.completed) continue;
    const prev = result[result.length - 1];
    if (prev && addDays(prev.end, 1) === e.date) { prev.end = e.date; prev.length++; }
    else result.push({ start: e.date, end: e.date, length: 1 });
  }
  return result;
}
export function csv(records: HabitRecord[]) {
  const escape = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const habits = new Map(records.filter((r): r is Habit => r.kind === 'habit' && !r.deleted).map(h => [h.id, h]));
  return [['Habit', 'Date', 'State', 'Value', 'Unit', 'Time (24h)', 'Notes'].map(escape).join(','), ...records.filter((r): r is Entry => r.kind === 'entry' && !r.deleted && habits.has(r.habitId)).sort((a,b) => a.date.localeCompare(b.date)).map(e => [habits.get(e.habitId)!.name, e.date, e.state, e.value, habits.get(e.habitId)!.unit, e.state === 'yes' ? e.time : '', e.notes].map(escape).join(','))].join('\r\n');
}
