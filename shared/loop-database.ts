// Compatibility with Loop's SQLite backup format (schema versions 9–26).
import type { Database, SqlJsStatic } from 'sql.js';
import { HabitRecord, Habit, Entry, newHabit, version, entryId, dateSchema, palette, backupSchema, recordSchema } from './domain';
const loopColors = ['#ef5350','#ec407a','#ab47bc','#7e57c2','#5c6bc0','#42a5f5','#29b6f6','#26c6da','#26a69a','#66bb6a','#9ccc65','#d4e157','#ffee58','#ffca28','#ffa726','#ff7043','#8d6e63','#bdbdbd','#78909c','#9e9e9e'];
function rows(db: Database, sql: string): Record<string, any>[] {
  const result = db.exec(sql)[0]; return result ? result.values.map(values => Object.fromEntries(result.columns.map((c, i) => [c, values[i]]))) : [];
}
export function readLoop(SQL: SqlJsStatic, bytes: Uint8Array): HabitRecord[] {
  const db = new SQL.Database(bytes);
  try {
    const own = rows(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='WebBackup'");
    if (own.length) {
      const backup = rows(db, 'SELECT data FROM WebBackup LIMIT 1')[0];
      if (backup) return backupSchema.parse(JSON.parse(backup.data)).records;
    }
    if (rows(db, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Habits','Repetitions')").length !== 2) throw new Error('This is not a Loop Habit Tracker database.');
    const result: HabitRecord[] = [], byId = new Map<number, Habit>();
    for (const row of rows(db, 'SELECT * FROM Habits ORDER BY position')) {
      const id = typeof row.uuid === 'string' && row.uuid ? row.uuid : `loop-${row.id}`;
      const habit = recordSchema.parse({ ...newHabit(), id, name: row.name || 'Unnamed habit', description: row.description || '', question: row.question || '',
        type: row.type === 1 ? 'number' : 'boolean', color: loopColors[row.color] || palette[0],
        numerator: row.freq_num || 1, denominator: row.freq_den || 1, order: row.position || 0,
        target: row.target_value ?? 1, targetType: row.target_type === 1 ? 'atMost' : 'atLeast', unit: row.unit || '',
        archived: !!row.archived, category: row.category || '', reminder: row.reminder_hour === null || row.reminder_hour === undefined ? null : `${String(row.reminder_hour).padStart(2, '0')}:${String(row.reminder_min || 0).padStart(2, '0')}`,
      }) as Habit;
      byId.set(row.id, habit); result.push(habit);
    }
    for (const row of rows(db, 'SELECT * FROM Repetitions ORDER BY timestamp')) {
      const habit = byId.get(row.habit); if (!habit || !Number.isFinite(row.timestamp)) continue;
      const date = new Date(row.timestamp).toISOString().slice(0, 10); if (!dateSchema.safeParse(date).success) continue;
      const value = row.value ?? 2;
      const state: Entry['state'] = value === 3 ? 'skip' : value < 0 ? 'unknown' : habit.type === 'number' ? 'yes' : value >= 2 ? 'yes' : 'no';
      result.push(recordSchema.parse({ id: entryId(habit.id, date), kind: 'entry', habitId: habit.id, date, version: version(), deleted: false,
        state, value: habit.type === 'number' && state === 'yes' ? value / 1000 : null, notes: row.notes || '' }));
      if (date < habit.created) habit.created = date;
    }
    return result;
  } finally { db.close(); }
}
export function writeLoop(SQL: SqlJsStatic, records: HabitRecord[]): Uint8Array {
  const db = new SQL.Database();
  try {
    db.run(`PRAGMA user_version=26;
      CREATE TABLE Habits (id INTEGER PRIMARY KEY, archived INTEGER, color INTEGER, description TEXT, freq_den INTEGER, freq_num INTEGER, highlight INTEGER, name TEXT, position INTEGER, reminder_hour INTEGER, reminder_min INTEGER, reminder_days INTEGER DEFAULT 127, type INTEGER, target_type INTEGER, target_value REAL, unit TEXT, question TEXT, uuid TEXT, category TEXT NOT NULL DEFAULT '');
      CREATE TABLE Repetitions (id INTEGER PRIMARY KEY, habit INTEGER NOT NULL REFERENCES Habits(id), timestamp INTEGER NOT NULL, value INTEGER NOT NULL, notes TEXT);
      CREATE UNIQUE INDEX idx_repetitions_habit_timestamp ON Repetitions(habit,timestamp);
      CREATE TABLE Events (id INTEGER PRIMARY KEY, timestamp INTEGER, message TEXT, server_id INTEGER);
      CREATE TABLE WebBackup (data TEXT NOT NULL);`);
    db.run('INSERT INTO WebBackup VALUES (?)', [JSON.stringify({ format: 'loop-web', version: 1, records })]);
    const habits = records.filter((r): r is Habit => r.kind === 'habit' && !r.deleted);
    habits.forEach((h, i) => {
      const color = loopColors.indexOf(h.color);
      db.run('INSERT INTO Habits VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [i + 1, Number(h.archived), color >= 0 ? color : 5, h.description, h.denominator, h.numerator, 0, h.name, h.order,
        h.reminder ? Number(h.reminder.slice(0, 2)) : null, h.reminder ? Number(h.reminder.slice(3)) : null, h.reminderDays.reduce((a,d) => a | (1 << d), 0), h.type === 'number' ? 1 : 0, h.targetType === 'atMost' ? 1 : 0, h.target, h.unit, h.question, h.id, h.category]);
      for (const e of records) if (e.kind === 'entry' && e.habitId === h.id && !e.deleted) db.run('INSERT INTO Repetitions (habit,timestamp,value,notes) VALUES (?,?,?,?)',
        [i + 1, +new Date(e.date + 'T00:00:00Z'), e.state === 'skip' ? 3 : e.state === 'unknown' ? -1 : h.type === 'number' ? Math.round((e.value ?? 0) * 1000) : e.state === 'yes' ? 2 : 0, h.type === 'time' && e.state === 'yes' && e.time ? `Time: ${e.time}${e.notes ? `\n${e.notes}` : ''}` : e.notes]);
    });
    return db.export();
  } finally { db.close(); }
}
