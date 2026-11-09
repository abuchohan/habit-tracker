import { expect, Locator, Page, test } from '@playwright/test';

async function addHabit(page: Page, name = 'Read books') {
  await page.getByRole('button', { name: 'Add habit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  await expect(page.getByRole('button', { name: `View ${name}`, exact: true })).toHaveCount(1);
}
function headers(page: Page) { return page.locator('[data-testid^="date-header-"]'); }
async function headerDates(page: Page) { return headers(page).evaluateAll(elements => elements.map(e => e.getAttribute('data-testid')!.slice('date-header-'.length))); }
async function drag(page: Page, target: Locator, dx: number, dy = 0) {
  const box = await target.boundingBox(); if (!box) throw new Error('Missing drag target');
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
}
async function swipe(target: Locator, dx: number, dy = 0) {
  const box = await target.boundingBox(); if (!box) throw new Error('Missing swipe target');
  const element = await target.elementHandle(); if (!element) throw new Error('Missing swipe element');
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const touch = (progress: number) => ({ identifier: 1, clientX: x + dx * progress, clientY: y + dy * progress, pageX: x + dx * progress, pageY: y + dy * progress, screenX: x + dx * progress, screenY: y + dy * progress });
  await element.dispatchEvent('touchstart', { touches: [touch(0)], changedTouches: [touch(0)], targetTouches: [touch(0)] });
  for (let step = 1; step <= 12; step++) await element.dispatchEvent('touchmove', { touches: [touch(step / 12)], changedTouches: [touch(step / 12)], targetTouches: [touch(step / 12)] });
  await element.dispatchEvent('touchend', { touches: [], changedTouches: [touch(1)], targetTouches: [] });
  await element.dispose();
}

test('today is highlighted across the column in light, dark and reversed layouts', async ({ page }, testInfo) => {
  await page.goto('/'); await addHabit(page);
  const today = (await headerDates(page))[0];
  const header = page.getByTestId(`date-header-${today}`), cell = page.getByRole('button', { name: `Read books, ${today}, unknown`, exact: true });
  async function checkHighlight() {
    const color = await header.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    await expect(cell).toHaveCSS('background-color', color);
    await expect(cell).toHaveCSS('border-left-width', '1px');
    const other = await headers(page).evaluateAll((elements, id) => {
      const el = elements.find(e => e.getAttribute('data-testid') !== id)!; return getComputedStyle(el).backgroundColor;
    }, `date-header-${today}`);
    expect(other).not.toBe(color);
  }
  await checkHighlight();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-today-light.png` });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect((await headerDates(page)).at(-1)).toBe(today);
  await checkHighlight();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-today-dark-reversed.png` });
});

test('mouse drag changes dates both ways, respects today, and leaves entries untouched', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Mouse interaction is tested in the desktop browser.');
  await page.goto('/'); await addHabit(page);
  const today = (await headerDates(page))[0];
  const cell = page.getByRole('button', { name: `Read books, ${today}, unknown`, exact: true });
  await drag(page, cell, -150);
  await expect.poll(async () => (await headerDates(page))[0]).not.toBe(today);
  expect((await headerDates(page))[0] < today).toBe(true);
  await expect(page.getByRole('button', { name: /^Read books, .*yes$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to habits', exact: true })).toHaveCount(0);
  // The press target changes as the dates move; capture/release must still finish the drag.
  await drag(page, headers(page).first(), 300);
  await expect.poll(async () => (await headerDates(page))[0]).toBe(today);
  await expect(page.getByRole('button', { name: 'Show later dates', exact: true })).toBeDisabled();
  await drag(page, headers(page).first(), 150);
  expect((await headerDates(page))[0]).toBe(today);
  await cell.click();
  await expect(page.getByRole('button', { name: `Read books, ${today}, yes`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await drag(page, headers(page).last(), 150);
  await expect.poll(async () => (await headerDates(page)).at(-1)).not.toBe(today);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  expect((await headerDates(page)).at(-1)).toBe(today);
});

test('touch swipes navigate dates without recording habits or swallowing later taps', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-webkit', 'Touch interaction is tested in the iPhone Safari engine.');
  await page.goto('/'); await addHabit(page);
  const today = (await headerDates(page))[0];
  await swipe(page.getByRole('button', { name: `Read books, ${today}, unknown`, exact: true }), -132);
  await expect.poll(async () => (await headerDates(page))[0]).not.toBe(today);
  expect((await headerDates(page))[0] < today).toBe(true);
  await expect(page.getByRole('button', { name: /^Read books, .*yes$/ })).toHaveCount(0);
  await swipe(headers(page).first(), 180);
  await expect.poll(async () => (await headerDates(page))[0]).toBe(today);
  await swipe(headers(page).first(), 0, 120);
  expect((await headerDates(page))[0]).toBe(today);
  await page.getByRole('button', { name: `Read books, ${today}, unknown`, exact: true }).tap();
  await expect(page.getByRole('button', { name: `Read books, ${today}, yes`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Reverse date order', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await swipe(headers(page).last(), 132);
  await expect.poll(async () => (await headerDates(page)).at(-1)).not.toBe(today);
  await page.getByRole('button', { name: 'Today', exact: true }).tap();
  expect((await headerDates(page)).at(-1)).toBe(today);
});

test('vertical list scrolling leaves the dates and habit entries unchanged', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  for (let i = 1; i <= 8; i++) await addHabit(page, `Habit ${i}`);
  const dates = await headerDates(page), list = page.getByTestId('habit-list');
  if (testInfo.project.name === 'phone-webkit') {
    // Mobile WebKit exposes no wheel API; let its layout engine scroll the last row into view.
    await page.getByRole('button', { name: 'View Habit 8', exact: true }).scrollIntoViewIfNeeded();
  } else {
    await list.hover(); await page.mouse.wheel(0, 250);
  }
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await headerDates(page)).toEqual(dates);
  await expect(page.getByRole('button', { name: /^Habit \d+, .*yes$/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
