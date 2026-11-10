import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { backupSchema, computeHistory, csv, entryId, formatTime, habitSchema, newHabit, parseTime, recordSchema, streaks, version, type Entry } from '../shared/domain';
import { readLoop, writeLoop } from '../shared/loop-database';

test('clock formats preserve midnight, noon and minute precision without timezone conversion', () => {
  for (const [clock, display, period] of [['00:00', '12:00', 'AM'], ['00:07', '12:07', 'AM'], ['12:00', '12:00', 'PM'], ['23:59', '11:59', 'PM'], ['09:30', '9:30', 'AM']] as const) {
    assert.equal(formatTime(clock, '12h'), `${display} ${period}`);
    assert.equal(parseTime(display, '12h', period), clock);
    assert.equal(parseTime(clock, '24h'), clock);
    assert.equal(formatTime(clock, '24h'), clock);
  }
  for (const invalid of ['', '24:00', '-1:00', '12:60', '09:3', '9', '09:30 AM']) assert.equal(parseTime(invalid), null);
  for (const invalid of ['00:30', '13:00', '12:60']) assert.equal(parseTime(invalid, '12h', 'AM'), null);
  assert.equal(parseTime(' 9:30 ', '24h'), '09:30');
});

test('time habits score completion and skips like yes/no habits, rather than treating a clock as a quantity', () => {
  const h = { ...newHabit(), name: 'Daily injection', type: 'time' as const };
  const entries: Entry[] = ['yes', 'yes', 'skip', 'no'].map((state, i) => {
    const date = `2026-11-0${i + 1}`;
    return { id: entryId(h.id, date), kind: 'entry', habitId: h.id, version: version(), deleted: false, date, state: state as Entry['state'], value: null, time: i === 0 ? '00:00' : i === 1 ? '23:59' : null, notes: '' };
  });
  const timed = computeHistory(h, entries, '2026-11-04');
  const plain = computeHistory({ ...h, type: 'boolean' }, entries, '2026-11-04');
  assert.deepEqual(timed.map(e => e.score), plain.map(e => e.score));
  assert.deepEqual(timed.map(e => e.completed), [true, true, true, false]);
  assert.deepEqual(timed.map(e => e.time), ['00:00', '23:59', null, null]);
  assert.equal(streaks(timed)[0].length, 3);
  assert.deepEqual(computeHistory({ ...h, denominator: 3 }, entries, '2026-11-04'), computeHistory({ ...h, type: 'boolean', denominator: 3 }, entries, '2026-11-04'));
});

test('old habits remain valid; time validation, JSON, CSV and SQLite backups retain the recorded clock', async () => {
  const { timeFormat: _, ...legacy } = { ...newHabit(), name: 'Legacy habit' };
  assert.equal(habitSchema.parse(legacy).timeFormat, '24h');
  const h = { ...newHabit(), name: 'Daily injection', type: 'time' as const, timeFormat: '12h' as const };
  const entry: Entry = { id: entryId(h.id, '2026-11-01'), kind: 'entry', habitId: h.id, date: '2026-11-01', version: version(), deleted: false, state: 'yes', value: null, time: '00:00', notes: 'Left side' };
  assert.equal(recordSchema.safeParse({ ...entry, time: '24:00' }).success, false);
  const records = [h, entry];
  assert.deepEqual(backupSchema.parse(JSON.parse(JSON.stringify({ format: 'loop-web', version: 1, records }))).records, records);
  assert.ok(csv(records).includes('"Time (24h)"'));
  assert.ok(csv(records).includes('"00:00","Left side"'));
  const SQL = await initSqlJs(), bytes = writeLoop(SQL, records);
  assert.deepEqual(readLoop(SQL, bytes), records);
  const db = new SQL.Database(bytes);
  assert.equal(db.exec('SELECT notes FROM Repetitions')[0].values[0][0], 'Time: 00:00\nLeft side');
  db.close();
});
