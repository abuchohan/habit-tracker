import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoBackup } from '../shared/demo-data';
import { addDays, backupSchema, computeHistory, entriesFor, Habit, mergeRecords, streaks } from '../shared/domain';
import { assertLocalSeedDatabase } from '../scripts/demo-backup';

test('demo snapshot covers realistic history and round-trips through guest backup validation', () => {
  const today = '2026-11-10';
  const backup = createDemoBackup(today);
  assert.deepEqual(backupSchema.parse(JSON.parse(JSON.stringify(backup))), backup);
  const habits = backup.records.filter((record): record is Habit => record.kind === 'habit');
  const entries = backup.records.filter(record => record.kind === 'entry');
  assert.equal(habits.length, 28);
  assert.equal(habits.filter(habit => habit.archived).length, 4);
  assert.ok(new Set(habits.map(habit => habit.category)).size >= 7);
  assert.ok(entries.length > 2500);
  assert.equal(new Set(backup.records.map(record => record.id)).size, backup.records.length);
  assert.deepEqual(new Set(entries.map(entry => entry.state)), new Set(['yes', 'no', 'skip', 'unknown']));
  assert.ok(entries.some(entry => entry.value === 0));
  assert.ok(entries.some(entry => entry.value !== null && !Number.isInteger(entry.value)));
  assert.ok(entries.some(entry => entry.notes.includes('holiday')));
  assert.ok(habits.some(habit => habit.targetType === 'atMost'));
  assert.ok(habits.some(habit => habit.type === 'number' && habit.denominator === 7));
  const byId = new Map(habits.map(habit => [habit.id, habit]));
  for (const entry of entries) {
    const habit = byId.get(entry.habitId)!;
    assert.ok(habit, 'each entry belongs to a habit');
    assert.ok(entry.date >= habit.created && entry.date <= today);
    if (habit.archived) assert.ok(entry.date <= addDays(today, -60));
    if (habit.type === 'boolean' || ['skip', 'unknown'].includes(entry.state)) assert.equal(entry.value, null);
    else assert.equal(typeof entry.value, 'number');
  }
  assert.ok(entries.filter(entry => entry.date === today).length < 24, 'today is only partly logged');
  const floss = byId.get('demo:floss')!;
  assert.ok(streaks(computeHistory(floss, entriesFor(backup.records, floss.id), today)).some(streak => streak.length >= 21));
  assert.ok(backup.preferences?.skip && backup.preferences.unknown);
});

test('fixed-date seeds are repeatable and stable identifiers prevent duplicates', () => {
  const first = createDemoBackup('2026-11-10');
  assert.deepEqual(createDemoBackup('2026-11-10'), first);
  assert.deepEqual(mergeRecords(first.records, first.records), mergeRecords([], first.records));
  const later = createDemoBackup('2026-11-11');
  assert.deepEqual(later.records.filter(record => record.kind === 'habit').map(habit => habit.id), first.records.filter(record => record.kind === 'habit').map(habit => habit.id));
  for (const date of ['2026-01-01', '2024-02-29', '2026-03-29', '2026-10-25']) {
    assert.doesNotThrow(() => createDemoBackup(date));
  }
  assert.throws(() => createDemoBackup('2026-02-30'));
});

test('database seed permits local databases and refuses remote or production targets', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.doesNotThrow(() => assertLocalSeedDatabase(`postgresql://habits:habits@${host}:54329/habits`, 'development'));
  }
  assert.throws(() => assertLocalSeedDatabase(undefined, 'development'));
  assert.throws(() => assertLocalSeedDatabase('postgresql://user:password@remote.example/habits', 'development'));
  assert.throws(() => assertLocalSeedDatabase('postgresql://user:password@localhost/habits', 'production'));
});
