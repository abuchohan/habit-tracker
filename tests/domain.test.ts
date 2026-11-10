import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHabit, version, HabitRecord, Entry, entryId, mergeRecords, computeHistory, addDays, streaks, csv, dateSchema, recordSchema, day, defaultPreferences, seedPreferences, mergePreferences } from '../shared/domain';
function habit(fields = {}) { return { ...newHabit(), id: 'habit-1', name: 'Read', created: '2026-01-01', ...fields }; }
function entry(date: string, state: Entry['state'] = 'yes', value: number | null = null): Entry {
  return { id: entryId('habit-1', date), kind: 'entry', habitId: 'habit-1', date, state, value, notes: '', version: version(), deleted: false };
}
test('daily strength reaches 50% after thirteen successful days, using Loop’s formula', () => {
  const entries = Array.from({ length: 13 }, (_, i) => entry(addDays('2026-01-01', i)));
  const history = computeHistory(habit(), entries, '2026-01-13');
  assert.ok(Math.abs(history.at(-1)!.score - 0.5) < 1e-10);
  assert.deepEqual(streaks(history), [{ start: '2026-01-01', end: '2026-01-13', length: 13 }]);
});
test('skip preserves strength and streak; missed days reduce strength and break the streak', () => {
  const history = computeHistory(habit(), [entry('2026-01-01'), entry('2026-01-02', 'skip'), entry('2026-01-03', 'no')], '2026-01-03');
  assert.equal(history[0].score, history[1].score); assert.ok(history[2].score < history[1].score);
  assert.equal(streaks(history)[0].length, 2);
});
test('flexible schedule automatically covers its interval and smooths its strength', () => {
  const history = computeHistory(habit({ numerator: 1, denominator: 3 }), [entry('2026-01-01')], '2026-01-04');
  assert.deepEqual(history.map(e => e.state), ['yes', 'auto', 'auto', 'unknown']);
  assert.equal(streaks(history)[0].length, 3);
});
test('numerical weekly targets use totals and skipped days reduce the target', () => {
  const h = habit({ type: 'number' as const, numerator: 1, denominator: 7, target: 70 });
  const history = computeHistory(h, [entry('2026-01-05', 'yes', 60), entry('2026-01-06', 'skip')], '2026-01-11', 1);
  assert.equal(history.length, 7); assert.ok(history.every(e => e.completed));
});
test('at-most zero target distinguishes zero from exceeding the target', () => {
  const h = habit({ type: 'number' as const, target: 0, targetType: 'atMost' as const });
  const history = computeHistory(h, [entry('2026-01-01', 'yes', 0), entry('2026-01-02', 'yes', 1)], '2026-01-02');
  assert.equal(history[0].completed, true); assert.equal(history[1].completed, false); assert.ok(history[1].score < 1);
});
test('record merge converges, preserves disjoint edits and retains deletion tombstones', () => {
  const a = entry('2026-01-01'), b = entry('2026-01-02'); const newer = { ...a, notes: 'Edited on the other device', version: version(a.version) };
  const initial = habit(); const removed = { ...initial, deleted: true, version: version(initial.version) };
  const left: HabitRecord[] = [initial, a], right: HabitRecord[] = [removed, newer, b];
  const merged = mergeRecords(left, right);
  assert.deepEqual(merged, mergeRecords(right, left)); assert.equal(merged.length, 3);
  assert.equal(merged.find(r => r.id === a.id)?.version, newer.version); assert.equal(merged.find(r => r.id === removed.id)?.deleted, true);
  assert.deepEqual(mergeRecords(merged, merged), merged);
});

test('settings accept the account seed, keep newer offline edits and accept newer remote edits', () => {
  const local = seedPreferences(defaultPreferences);
  const remote = seedPreferences({ ...defaultPreferences, reverse: true });
  assert.deepEqual(mergePreferences(local, remote).values, remote.values);
  const edited = { version: version(remote.version), values: { ...remote.values, theme: 'dark' as const } };
  assert.deepEqual(mergePreferences(edited, remote), edited);
  assert.deepEqual(mergePreferences(remote, edited), edited);
  assert.deepEqual(mergePreferences(edited, null), edited);
});
test('versions are monotonic and dates remain valid over daylight saving and leap boundaries', () => {
  assert.ok(version() < version()); assert.equal(addDays('2026-03-28', 2), '2026-03-30'); assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(dateSchema.safeParse('2026-02-30').success, false);
  assert.equal(day(new Date(2026, 0, 2, 1), 3), '2026-01-01');
});
test('validation rejects corrupt record ids, invalid schedules and nonfinite values', () => {
  assert.equal(recordSchema.safeParse({ ...entry('2026-01-01'), id: 'wrong' }).success, false);
  assert.equal(recordSchema.safeParse(habit({ numerator: 8, denominator: 7 })).success, false);
  assert.equal(recordSchema.safeParse({ ...entry('2026-01-01'), value: Infinity }).success, false);
});
test('CSV quotes commas, embedded quotes and multiline notes', () => {
  const output = csv([habit(), { ...entry('2026-01-01'), notes: 'Read "Dune",\nfinished' }]);
  assert.ok(output.includes('"Read ""Dune"",\nfinished"'));
});
