import { test } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { newHabit, entryId, version, defaultPreferences, seedPreferences } from '../shared/domain';
dotenv.config({ path: 'server/.env', quiet: true });
test('session accounts isolate sync data, retain newest edits and reject expired sessions', { skip: !process.env.DATABASE_URL }, async () => {
  const { app } = await import('../server/app'); const { default: prisma } = await import('../server/prisma/client');
  const listener = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => listener.once('listening', resolve));
  const address = listener.address(); if (!address || typeof address === 'string') throw new Error('No test server');
  const base = `http://127.0.0.1:${address.port}/api`;
  const accounts: string[] = [];
  async function request(path: string, body?: unknown, cookie?: string, origin?: string) {
    return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function account() {
    const email = `test-${Date.now()}-${Math.random()}@example.com`; accounts.push(email);
    assert.equal((await request('/auth/register', { email, password: 'correct-test-password' })).status, 201);
    const login = await request('/auth/login', { email, password: 'correct-test-password' });
    assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie')!.split(';')[0]; assert.ok(cookie.startsWith('session_id=')); return cookie;
  }
  try {
    const first = await account(), second = await account();
    assert.equal((await request('/sync', { records: [] })).status, 401);
    assert.equal((await request('/sync', { records: [] }, first, 'https://untrusted.example')).status, 403);
    const h = { ...newHabit(), name: 'Private habit' };
    const firstSync = await request('/sync', { records: [h] }, first); assert.equal(firstSync.status, 200);
    assert.equal((await firstSync.json()).records.length, 1);
    assert.equal((await (await request('/sync', { records: [] }, second)).json()).records.length, 0);
    const newer = { ...h, name: 'New name', version: version(h.version) };
    await request('/sync', { records: [newer] }, first);
    const old = await (await request('/sync', { records: [h] }, first)).json(); assert.equal(old.records[0].name, 'New name');
    const deleted = { ...newer, deleted: true, version: version(newer.version) }; await request('/sync', { records: [deleted] }, first);
    const retry = await (await request('/sync', { records: [newer] }, first)).json(); assert.equal(retry.records[0].deleted, true);
    assert.equal((await request('/sync', { records: [{ ...h, denominator: 0 }] }, first)).status, 400);
    const preferences = { version: version(), values: { ...defaultPreferences, reverse: true, theme: 'dark' } };
    const settingsSync = await request('/sync', { records: [], preferences }, first);
    assert.equal(settingsSync.status, 200);
    assert.deepEqual((await settingsSync.json()).preferences, preferences);
    // A fresh device's defaults and older clients must not reset account settings.
    const freshDevice = await (await request('/sync', { records: [], preferences: seedPreferences(defaultPreferences) }, first)).json();
    assert.deepEqual(freshDevice.preferences, preferences);
    assert.deepEqual((await (await request('/sync', { records: [] }, first)).json()).preferences, preferences);
    assert.equal((await (await request('/sync', { records: [] }, second)).json()).preferences, null);
    const changed = { version: version(preferences.version), values: { ...preferences.values, reverse: false } };
    await request('/sync', { records: [], preferences: changed }, first);
    assert.deepEqual((await (await request('/sync', { records: [], preferences }, first)).json()).preferences, changed);
    assert.equal((await request('/sync', { records: [], preferences: { ...changed, values: { reverse: 'yes' } } }, first)).status, 400);
    const timed = { ...newHabit(), name: 'Daily injection', type: 'time', timeFormat: '12h' };
    const timedEntry = { id: entryId(timed.id, '2026-11-01'), kind: 'entry', habitId: timed.id, date: '2026-11-01', state: 'yes', value: null, time: '23:59', notes: 'Left side', version: version(), deleted: false };
    assert.equal((await request('/sync', { records: [timed, timedEntry] }, first)).status, 200);
    const syncedTimes = (await (await request('/sync', { records: [] }, first)).json()).records;
    assert.deepEqual(syncedTimes.find((r: { id: string }) => r.id === timed.id), timed);
    assert.deepEqual(syncedTimes.find((r: { id: string }) => r.id === timedEntry.id), timedEntry);
    assert.equal((await request('/sync', { records: [{ ...timedEntry, time: '25:00' }] }, first)).status, 400);
    const me = await request('/auth/me', undefined, first); assert.equal(me.status, 200); assert.ok(me.headers.get('set-cookie')?.includes('HttpOnly'));
    assert.equal('password' in (await me.json()).user, false);
    await prisma.session.update({ where: { id: first.split('=')[1] }, data: { expiresAt: new Date(0) } });
    assert.equal((await request('/sync', { records: [] }, first)).status, 401);
    assert.equal((await request('/auth/logout', {}, second)).status, 200);
    assert.equal((await request('/auth/me', undefined, second)).status, 401);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: accounts } } }); await prisma.$disconnect(); await new Promise<void>((resolve,reject) => listener.close(err => err ? reject(err) : resolve()));
  }
});
