import { test } from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { readLoop, writeLoop } from '../shared/loop-database';
import { newHabit, entryId, version, HabitRecord } from '../shared/domain';
test('SQLite backup preserves habits, entries, notes, colours and tombstones exactly', async () => {
  const SQL = await initSqlJs(); const h = { ...newHabit(), name: 'Read', color: '#1976d2' };
  const records: HabitRecord[] = [h, { id: entryId(h.id, '2026-01-01'), kind: 'entry', habitId: h.id, version: version(), deleted: false, date: '2026-01-01', state: 'yes', value: null, notes: 'A good day' }, { ...newHabit(), name: 'Deleted', deleted: true }];
  const bytes = writeLoop(SQL, records); assert.deepEqual(readLoop(SQL, bytes), records);
  const db = new SQL.Database(bytes); assert.equal(db.exec('PRAGMA user_version')[0].values[0][0], 26);
  assert.equal(db.exec('SELECT COUNT(*) FROM Habits')[0].values[0][0], 1); db.close();
});
test('imports an external Loop database, including numerical scaling and skip days', async () => {
  const SQL = await initSqlJs(), db = new SQL.Database();
  db.run(`CREATE TABLE Habits(id, name, position, type, freq_num, freq_den, target_value, target_type, unit, color, uuid); CREATE TABLE Repetitions(habit,timestamp,value,notes);
    INSERT INTO Habits VALUES(1,'Run',0,1,1,1,5,0,'km',5,'run-habit');
    INSERT INTO Repetitions VALUES(1,1767225600000,4500,'Morning run');
    INSERT INTO Repetitions VALUES(1,1767312000000,3,'Rest');`);
  const records = readLoop(SQL, db.export()); db.close();
  assert.equal(records.length, 3); const entries = records.filter(r => r.kind === 'entry');
  assert.equal(entries[0].value, 4.5); assert.equal(entries[0].notes, 'Morning run'); assert.equal(entries[1].state, 'skip');
});
