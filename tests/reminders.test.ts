import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitSchema, newHabit } from '../shared/domain';
import { dueReminder } from '../shared/reminders';

const habit = () => ({ ...newHabit(), name: 'Read', reminder: '09:00', reminderPush: true, timezone: 'Europe/London' });
test('reminders are opt in and legacy backups do not enable push or email', () => {
  const parsed = habitSchema.parse({ ...newHabit(), name: 'Legacy', reminder: '09:00' });
  assert.equal(parsed.reminderEmail, undefined);
  assert.equal(dueReminder(parsed, new Date('2026-11-13T09:00:00Z')), null);
});
test('reminders respect weekdays, minutes, disabled channels, archives and deletion', () => {
  const h = habit(), now = new Date('2026-11-13T09:00:30Z');
  assert.equal(dueReminder(h, now), '2026-11-13');
  assert.equal(dueReminder({ ...h, reminderDays: [1] }, now), null);
  assert.equal(dueReminder({ ...h, reminderDays: [] }, now), null);
  assert.equal(dueReminder({ ...h, reminder: null }, now), null);
  assert.equal(dueReminder({ ...h, reminderPush: false, reminderEmail: true }, now), null);
  assert.equal(dueReminder({ ...h, archived: true }, now), null);
  assert.equal(dueReminder({ ...h, deleted: true }, now), null);
  assert.equal(dueReminder(h, new Date('2026-11-13T09:01:00Z')), null);
});
test('timezone schedules follow British summer time and winter time', () => {
  assert.equal(dueReminder(habit(), new Date('2026-07-13T08:00:00Z')), '2026-07-13');
  assert.equal(dueReminder(habit(), new Date('2026-07-13T09:00:00Z')), null);
  assert.equal(dueReminder(habit(), new Date('2026-11-13T09:00:00Z')), '2026-11-13');
});
test('repeated DST hour uses the same daily delivery key', () => {
  const h = { ...habit(), reminder: '01:30' };
  assert.equal(dueReminder(h, new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(dueReminder(h, new Date('2026-10-25T01:30:00Z')), '2026-10-25');
});
