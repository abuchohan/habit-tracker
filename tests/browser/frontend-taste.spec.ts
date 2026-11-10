import { expect, Page, test } from '@playwright/test';

async function addHabit(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add habit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${name}`, exact: true })).toBeVisible();
}

test('workspace collections and search show real habits and preserve history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The desktop workspace rail requires a mouse or trackpad.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await addHabit(page, 'Read');
  await addHabit(page, 'Walk');
  await page.getByRole('textbox', { name: 'Search habits', exact: true }).fill('Read');
  await expect(page.getByRole('button', { name: 'View Walk', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search habits', exact: true }).fill('');
  await page.getByRole('button', { name: /^Read, .*unknown$/ }).last().click();
  await expect(page.getByText('1 habit remaining today.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View Read', exact: true }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Archived habits', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Read, .*yes$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Habit log', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Walk', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Read', exact: true })).toHaveCount(0);
});

test('small phones, tablet and short landscape retain recording space', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await addHabit(page, 'Read a chapter before bed');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.getByTestId('habit-list').evaluate(el => el.clientHeight)).toBeGreaterThan(70);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Add habit', exact: true })).toBeVisible();
    const compact = size.width < 700 || testInfo.project.name === 'phone-webkit';
    if (compact) {
      const banner = page.getByRole('banner');
      await expect(banner.getByRole('button', { name: 'Add habit', exact: true })).toBeVisible();
      await expect(banner.getByRole('button', { name: 'Filter and sort habits', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Account and sync status', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0);
      const grid = await page.getByTestId('date-grid').boundingBox(), bar = await banner.boundingBox();
      expect(grid!.y - (bar!.y + bar!.height)).toBeLessThanOrEqual(16);
      await page.getByRole('button', { name: 'Filter and sort habits', exact: true }).click();
      const before = await page.locator('[data-testid^="date-header-"]').first().getAttribute('data-testid');
      await page.getByRole('button', { name: 'Show earlier dates', exact: true }).click();
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.getByRole('radio', { name: 'Archived', exact: true }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(banner.getByText('Archived habits', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Filter and sort habits', exact: true }).click();
      await page.getByRole('radio', { name: 'Active', exact: true }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.locator('[data-testid^="date-header-"]').first()).toHaveAttribute('data-testid', before!);
      await page.screenshot({ path: `artifacts/${testInfo.project.name}-compact-${size.width}.png` });
    }
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  }
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Host Grotesk"'))).toBe(true);
});

test('keyboard creation, inline errors and theme controls remain accessible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Hardware keyboard tested on desktop.');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to habit log' })).toBeFocused();
  await page.getByRole('button', { name: 'Add habit', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Keyboard habit');
  await page.getByRole('button', { name: 'Save habit', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'View Keyboard habit', exact: true })).toBeVisible();
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await settings.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio', { name: 'Dark', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close dialog', exact: true })).toHaveCount(0);
  await expect(settings).toBeFocused();
});
