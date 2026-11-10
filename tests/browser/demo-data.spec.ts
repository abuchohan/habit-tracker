import { expect, test } from '@playwright/test';
import { createDemoBackup } from '../../shared/demo-data';

test.use({ serviceWorkers: 'block' });

test('the demo backup imports, persists and exports without an account or API', async ({ page }) => {
  const backup = createDemoBackup();
  let apiRequests = 0;
  await page.route('**/api/**', route => { apiRequests++; return route.abort(); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import backup / Loop database', exact: true }).click();
  await (await chooser).setFiles({ name: 'demo-habits.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByRole('heading', { name: 'Import this backup?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Backup imported.', { exact: true })).toBeVisible();
  // A second import must merge by identifier rather than duplicating the habits.
  const again = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import backup / Loop database', exact: true }).click();
  await (await again).setFiles({ name: 'demo-habits.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText('Backup imported.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('Local only · no account required', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export full backup', exact: true }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  // Import intentionally refreshes versions; all user-visible data stays identical.
  const normalize = (records: typeof backup.records) => records.map(({ version, ...record }) => record).sort((a, b) => a.id.localeCompare(b.id));
  expect(normalize(exported.records)).toEqual(normalize(backup.records));
  expect(exported.preferences).toEqual(backup.preferences);
  expect(apiRequests).toBe(0);
});
