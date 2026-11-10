import { expect, Page, test } from '@playwright/test';
import { defaultPreferences, SavedPreferences } from '../../shared/domain';

test.use({ serviceWorkers: 'block' });

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}
async function closeDialog(page: Page) {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}
async function openAccount(page: Page) {
  const account = page.getByRole('button', { name: 'Account and sync status', exact: true });
  if (await account.isVisible()) { await account.click(); return; }
  await openSettings(page);
  await page.getByRole('dialog').getByRole('button', { name: /^(Connect a sync account|.*@example\.com)$/ }).click();
}
async function connectAccount(page: Page, email = 'settings@example.com') {
  await openAccount(page);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Connect account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toHaveCount(0);
}
async function syncNow(page: Page) {
  await openAccount(page);
  const sync = page.getByRole('button', { name: 'Sync now', exact: true });
  await expect(sync).toBeEnabled();
  await sync.click();
  await expect(page.getByRole('dialog').getByText('Synced', { exact: true })).toBeVisible();
  await closeDialog(page);
}

test('legacy local settings migrate and subsequent changes survive reloads', async ({ page }) => {
  await page.goto('/');
  await openSettings(page);
  await closeDialog(page);
  await page.evaluate(async preferences => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('habits-local', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('data', 'readwrite');
      tx.objectStore('data').delete('preferences:guest');
      tx.objectStore('data').put(JSON.stringify(preferences), 'preferences');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { ...defaultPreferences, reverse: true, skip: true });
  await page.reload();
  await openSettings(page);
  await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
  await page.reload();
  await openSettings(page);
  await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
});

test('account settings follow devices, survive offline edits and stay separate from guest and other accounts', async ({ browser, page, context }) => {
  // A shared sync service lets separate browser contexts behave like separate devices.
  // The real API's validation, isolation and version handling are covered by server.test.ts.
  const remote = new Map<string, SavedPreferences>();
  let offline = false;
  async function attachService(device: typeof context, canGoOffline = false) {
    let email = '';
    await device.route('**/api/**', async route => {
      if (canGoOffline && offline) return route.abort('internetdisconnected');
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/login')) email = route.request().postDataJSON().email;
      if (path.endsWith('/auth/logout')) email = '';
      if (path.endsWith('/sync')) {
        const incoming: SavedPreferences = route.request().postDataJSON().preferences;
        const saved = remote.get(email);
        if (!saved || incoming.version > saved.version) remote.set(email, incoming);
        return route.fulfill({ json: { records: [], preferences: remote.get(email) } });
      }
      return route.fulfill({ json: { user: { id: email, email } } });
    });
  }
  await attachService(context, true);
  const second = await browser.newContext({ serviceWorkers: 'block', baseURL: 'http://localhost:5000' });
  try {
    await attachService(second);
    const other = await second.newPage();
    await page.goto('/');
    await openSettings(page);
    await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
    await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
    await closeDialog(page);
    await connectAccount(page);
    await openSettings(page);
    await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
    await expect.poll(() => remote.get('settings@example.com')?.values.reverse).toBe(true);
    await closeDialog(page);
    await other.goto('/');
    await connectAccount(other);
    await openSettings(other);
    await expect(other.getByRole('checkbox', { name: 'Reverse date order', exact: true })).toBeChecked();
    await expect(other.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
    await closeDialog(other);

    offline = true;
    await openSettings(page);
    await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
    await page.reload();
    await openSettings(page);
    await expect(page.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
    await closeDialog(page);
    offline = false;
    await syncNow(page);
    await syncNow(other);
    await openSettings(other);
    await expect(other.getByRole('checkbox', { name: 'Reverse date order', exact: true })).not.toBeChecked();
    await closeDialog(other);

    // Change an account-only setting, then return to the untouched guest settings.
    await openSettings(page);
    await page.getByRole('checkbox', { name: 'Enable skip days', exact: true }).click();
    await expect.poll(() => remote.get('settings@example.com')?.values.skip).toBe(false);
    await closeDialog(page);
    await openAccount(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await openSettings(page);
    await expect(page.getByRole('checkbox', { name: 'Enable skip days', exact: true })).toBeChecked();
    await closeDialog(page);
    await connectAccount(page, 'different@example.com');
    await openSettings(page);
    await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
    await expect.poll(() => remote.get('different@example.com')?.values.reverse).toBe(true);
    expect(remote.get('settings@example.com')?.values.reverse).toBe(false);
  } finally { await second.close(); }
});
