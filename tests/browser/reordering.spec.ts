import { expect, Page, test } from '@playwright/test';
import { HabitRecord, mergeRecords, newHabit } from '../../shared/domain';

test.use({ serviceWorkers: 'block' });
const names = (page: Page) => page.getByRole('button', { name: /^View / }).allTextContents();
async function connect(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Connect a sync account', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('order@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Connect account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Read', exact: true })).toBeVisible();
}

test('dragging manual order persists offline, syncs and appears on another device', async ({ page, browser, context }, info) => {
  let remote: HabitRecord[] = ['Read', 'Walk', 'Sleep'].map((name, order) => ({ ...newHabit(order), name }));
  let offline = false;
  async function service(device: typeof context, first = false) {
    await device.route('**/api/**', async route => {
      if (first && offline) return route.abort('internetdisconnected');
      if (new URL(route.request().url()).pathname.endsWith('/sync')) {
        remote = mergeRecords(remote, route.request().postDataJSON().records);
        return route.fulfill({ json: { records: remote } });
      }
      return route.fulfill({ json: { user: { id: 'order-account', email: 'order@example.com' } } });
    });
  }
  await service(context, true);
  await page.goto('/');
  await connect(page);
  await expect(page.getByRole('button', { name: 'Reorder habits', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('habit-drag-indicator')).toHaveCount(0);
  offline = true;
  const handle = page.getByRole('button', { name: 'View Read', exact: true });
  const source = (await handle.boundingBox())!;
  const target = (await page.getByRole('button', { name: 'View Sleep', exact: true }).boundingBox())!;
  const x = source.x + source.width / 2, y = source.y + source.height / 2;
  const destination = target.y + target.height / 2;
  if (info.project.name.includes('phone')) {
    // WebKit does not expose a constructible Touch. Dispatch DOM touch events
    // with the same touch lists consumed by React Native's responder system.
    const send = async (type: string, cy: number) => handle.evaluate((element, { type, cy, x }) => {
      const touch = { identifier: 1, target: element, clientX: x, clientY: cy, pageX: x, pageY: cy, screenX: x, screenY: cy };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], targetTouches: type === 'touchend' ? [] : [touch] });
      element.dispatchEvent(event);
    }, { type, cy, x });
    await send('touchstart', y);
    await expect(page.getByTestId('habit-drag-indicator')).toBeVisible();
    for (let i = 1; i <= 12; i++) await send('touchmove', y + (destination - y) * i / 12);
    await send('touchend', destination);
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(page.getByTestId('habit-drag-indicator')).toBeVisible();
    await page.mouse.move(x, destination, { steps: 12 });
    await page.mouse.up();
  }
  await expect.poll(() => names(page)).toEqual(['WalkEvery day', 'SleepEvery day', 'ReadEvery day'].map(s => info.project.name.includes('phone') ? s.replace('Every day', '') : s));
  await expect(page.getByTestId('habit-drag-indicator')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'View Walk', exact: true })).toBeVisible();
  const expected = await names(page);
  expect(expected[0]).toContain('Walk');
  offline = false;
  // Reload clears retry backoff and performs a fresh account sync.
  await page.reload();
  await expect.poll(() => remote.filter(r => r.kind === 'habit').sort((a: any, b: any) => a.order - b.order).map((h: any) => h.name)).toEqual(['Walk', 'Sleep', 'Read']);
  const other = await browser.newContext({ serviceWorkers: 'block', viewport: page.viewportSize()! });
  try {
    await service(other);
    const second = await other.newPage();
    await second.goto('http://localhost:5000');
    await connect(second);
    await expect.poll(() => names(second)).toEqual(expected);
    await second.reload();
    await expect.poll(() => names(second)).toEqual(expected);
    const read = second.getByRole('button', { name: 'View Read', exact: true });
    await read.focus();
    await read.press('Alt+ArrowUp');
    await expect.poll(async () => (await names(second)).map(s => s.replace('Every day', ''))).toEqual(['Walk', 'Read', 'Sleep']);
  } finally { await other.close(); }
});

test('holding reveals the indicator, Escape cancels, and dragging scrolls a long list', async ({ page }) => {
  const records = ['Read', ...Array.from({ length: 19 }, (_, i) => `Habit ${i + 1}`)].map((name, order) => ({ ...newHabit(order), name }));
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/sync')
    ? { records } : { user: { id: 'order-account', email: 'order@example.com' } } }));
  await page.goto('/');
  await connect(page);
  const read = page.getByRole('button', { name: 'View Read', exact: true });
  const source = (await read.boundingBox())!;
  await page.mouse.move(source.x + 40, source.y + source.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('habit-drag-indicator')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('habit-drag-indicator')).toHaveCount(0);
  expect((await names(page))[0]).toContain('Read');

  await page.mouse.down();
  await expect(page.getByTestId('habit-drag-indicator')).toBeVisible();
  const list = (await page.getByTestId('habit-list').boundingBox())!;
  await page.mouse.move(source.x + 40, list.y + list.height - 20, { steps: 15 });
  await expect.poll(() => page.getByTestId('habit-list').evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await page.screenshot({ path: 'artifacts/habit-drag-active.png' });
  await page.mouse.up();
  await expect(page.getByTestId('habit-drag-indicator')).toHaveCount(0);
  await expect.poll(async () => (await names(page)).findIndex(s => s.startsWith('Read'))).toBeGreaterThan(2);
});
