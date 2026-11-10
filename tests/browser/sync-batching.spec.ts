import { expect, Page, test } from '@playwright/test';
import { addDays, defaultPreferences, entryId, HabitRecord, mergeRecords, newHabit, SavedPreferences, seedPreferences, version } from '../../shared/domain';

test.use({ serviceWorkers: 'block' });

type Payload = { accountId: string; records: HabitRecord[]; preferences?: SavedPreferences };
async function setup(page: Page, records: HabitRecord[] = []) {
  const service = {
    requests: [] as Payload[], paths: [] as string[], records: [] as HabitRecord[],
    preferences: null as SavedPreferences | null, status: 200, hold: undefined as Promise<void> | undefined,
  };
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    service.paths.push(path);
    if (!path.endsWith('/sync')) return route.fulfill({ json: {} });
    const payload: Payload = route.request().postDataJSON();
    service.requests.push(payload);
    if (service.status !== 200) return route.fulfill({ status: service.status, headers: { 'Retry-After': '120' }, json: { error: 'Please wait' } });
    service.records = mergeRecords(service.records, payload.records);
    if (payload.preferences && (!service.preferences || payload.preferences.version > service.preferences.version)) service.preferences = payload.preferences;
    const response = { records: service.records, preferences: service.preferences };
    const hold = service.hold;
    service.hold = undefined;
    if (hold) await hold;
    await route.fulfill({ json: response });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add your first habit', exact: true })).toBeVisible();
  await page.evaluate(async ({ records, preferences }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('habits-local', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      const data = tx.objectStore('data');
      data.put(JSON.stringify({ id: 'batch-account', email: 'batch@example.com' }), 'account');
      data.put(JSON.stringify(records), 'records:batch-account');
      data.put(JSON.stringify(preferences), 'preferences:batch-account');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { records, preferences: seedPreferences(defaultPreferences) });
  await page.clock.pauseAt(new Date('2026-11-10T12:01:00Z'));
  await page.reload();
  await expect.poll(() => service.requests.length).toBe(Math.max(1, Math.ceil(records.length / 500)));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  return service;
}

test('rapid edits batch together and idle syncs do not reupload history or call auth/me', async ({ page }) => {
  const habit = { ...newHabit(), name: 'Read books' };
  const records: HabitRecord[] = [habit, ...Array.from({ length: 501 }, (_, i): HabitRecord => {
    const date = addDays('2026-11-10', -i);
    return { id: entryId(habit.id, date), kind: 'entry', habitId: habit.id, date, state: 'yes', value: null, notes: '', deleted: false, version: version() };
  })];
  const service = await setup(page, records);
  expect(service.requests.map(request => request.records.length)).toEqual([500, 2]);
  expect(service.requests.every(request => request.accountId === 'batch-account')).toBe(true);
  service.requests.length = 0;
  await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show question marks for missing data', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
  expect(service.requests).toHaveLength(0);
  await page.clock.runFor(2100);
  await expect.poll(() => service.requests.length).toBe(1);
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  expect(service.requests[0].records).toEqual([]);
  expect(service.requests[0].preferences?.values).toMatchObject({ skip: true, unknown: true, reverse: false });

  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: /^Read books, .*yes$/ }).first().click();
  await expect(page.getByRole('button', { name: /^Read books, .*skip$/ }).first()).toBeVisible();
  await page.clock.runFor(2100);
  await expect.poll(() => service.requests.length).toBe(2);
  expect(service.requests[1].records).toHaveLength(1);
  expect(service.requests[1].records[0]).toMatchObject({ kind: 'entry', state: 'skip' });
  expect(service.requests[1].preferences).toBeUndefined();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  await page.clock.runFor(30000);
  await expect.poll(() => service.requests.length).toBe(3);
  expect(service.requests[2].records).toEqual([]);
  expect(service.requests[2].preferences).toBeUndefined();
  expect(service.paths.some(path => path.endsWith('/auth/me'))).toBe(false);
});

test('edits made during an active sync are sent in one follow-up batch', async ({ page }) => {
  const service = await setup(page);
  service.requests.length = 0;
  let release!: () => void;
  service.hold = new Promise<void>(resolve => { release = resolve; });
  await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
  await page.clock.runFor(2100);
  await expect.poll(() => service.requests.length).toBe(1);
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show question marks for missing data', exact: true }).click();
  await page.clock.runFor(2100);
  expect(service.requests).toHaveLength(1);
  release();
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  await page.clock.runFor(2100);
  await expect.poll(() => service.requests.length).toBe(2);
  expect(service.requests[1].preferences?.values).toMatchObject({ skip: true, unknown: true, reverse: false });
});

test('rate-limited sync waits for Retry-After despite edits, focus events and polling', async ({ page }) => {
  const service = await setup(page);
  service.requests.length = 0;
  service.status = 429;
  await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
  await page.clock.runFor(2100);
  await expect(page.getByRole('dialog').getByText('Sync paused · changes saved on this device', { exact: true })).toBeVisible();
  expect(service.requests).toHaveLength(1);
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); });
  await page.clock.runFor(119000);
  expect(service.requests).toHaveLength(1);
  service.status = 200;
  await page.clock.runFor(1100);
  await expect.poll(() => service.requests.length).toBe(2);
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  expect(service.requests[1].preferences?.values).toMatchObject({ skip: true, reverse: false });
});

test('an expired session waits for sign-in while new edits remain saved locally', async ({ page }) => {
  const service = await setup(page);
  service.requests.length = 0;
  service.status = 401;
  await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
  await page.clock.runFor(2100);
  await expect(page.getByRole('dialog').getByText('Sign in again to sync', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.clock.runFor(120000);
  expect(service.requests).toHaveLength(1);
  const preferences = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('habits-local', 1); request.onsuccess = () => resolve(request.result); });
    const raw = await new Promise<string>(resolve => { const request = db.transaction('data').objectStore('data').get('preferences:batch-account'); request.onsuccess = () => resolve(request.result); });
    db.close();
    return JSON.parse(raw);
  });
  expect(preferences.values).toMatchObject({ skip: true, reverse: false });
});
