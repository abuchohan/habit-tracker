import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Habit, HabitRecord, mergeRecords, newHabit, reorderHabitRecords, version } from '../shared/domain';

const ordered = (records: HabitRecord[]) => records.filter((r): r is Habit => r.kind === 'habit' && !r.deleted)
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map(h => h.id);
test('drag inserts across multiple habits and survives merging with an older device', () => {
  const records = ['a', 'b', 'c', 'd'].map((id, order) => ({ ...newHabit(order), id, name: id }));
  const changes = reorderHabitRecords(records, 'a', 'd', ordered(records));
  const saved = mergeRecords(records, changes);
  assert.deepEqual(ordered(saved), ['b', 'c', 'd', 'a']);
  assert.deepEqual(ordered(mergeRecords(saved, records)), ['b', 'c', 'd', 'a']);
  assert.deepEqual(ordered(mergeRecords(records, saved)), ['b', 'c', 'd', 'a']);
  assert.ok(changes.every(h => h.version > records.find(r => r.id === h.id)!.version));
  const next = mergeRecords(saved, reorderHabitRecords(saved, 'a', 'b', ordered(saved)));
  assert.deepEqual(ordered(next), ['a', 'b', 'c', 'd']);
});

test('filtered moves preserve hidden slots, entries, deleted records and habit details', () => {
  const habits = ['a', 'hidden', 'b', 'archived', 'c'].map((id, order) => ({ ...newHabit(order), id, name: id, archived: id === 'archived' }));
  const deleted = { ...newHabit(), id: 'deleted', name: 'Deleted', deleted: true };
  const entry: HabitRecord = { kind: 'entry', id: 'entry:a:2026-11-11', habitId: 'a', date: '2026-11-11', state: 'yes', value: null, notes: 'Keep me', version: version(), deleted: false };
  const records = [...habits, deleted, entry];
  const changes = reorderHabitRecords(records, 'c', 'a', ['a', 'b', 'c']);
  const saved = mergeRecords(records, changes);
  assert.deepEqual(ordered(saved), ['c', 'hidden', 'a', 'archived', 'b']);
  for (const unchanged of [habits[1], habits[3], deleted, entry]) assert.deepEqual(saved.find(r => r.id === unchanged.id), unchanged);
  for (const change of changes) {
    const original = habits.find(h => h.id === change.id)!;
    assert.deepEqual({ ...change, order: original.order, version: original.version }, original);
  }
  assert.deepEqual(reorderHabitRecords(records, 'a', 'a', ['a', 'b', 'c']), []);
  assert.deepEqual(reorderHabitRecords(records, 'deleted', 'a', ['deleted', 'a']), []);
});
