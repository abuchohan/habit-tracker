import { expect, test } from '@playwright/test';
import { addDays } from '../../shared/domain';

test('tap records target; hold edits without saving, and custom values persist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add habit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Push ups');
  await page.getByRole('radio', { name: 'Measurable', exact: true }).click();
  await page.getByRole('textbox', { name: 'Target', exact: true }).fill('30');
  await page.getByRole('textbox', { name: 'Unit', exact: true }).fill('reps');
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  const today = (await page.locator('[data-testid^="date-header-"]').last().getAttribute('data-testid'))!.slice('date-header-'.length);
  const cell = (date: string, value: string) => page.getByRole('button', { name: `Push ups, ${date}, ${value}`, exact: true });
  const value = page.getByRole('textbox', { name: 'Value (reps)', exact: true });

  await cell(today, 'unknown').click();
  await expect(cell(today, '30 reps')).toBeVisible();
  await expect(value).toHaveCount(0);
  await page.reload();
  await cell(today, '30 reps').click();
  await expect(value).toHaveValue('30');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const yesterday = addDays(today, -1);
  await cell(yesterday, 'unknown').click({ delay: 700 });
  await expect(value).toHaveValue('30');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cell(yesterday, 'unknown')).toBeVisible();
  await cell(yesterday, 'unknown').click({ delay: 700 });
  await value.fill('40');
  await page.getByRole('textbox', { name: 'Notes (optional)', exact: true }).fill('Extra ten');
  await page.getByRole('button', { name: 'Save entry', exact: true }).click();
  await page.reload();
  await cell(yesterday, '40 reps').click();
  await expect(value).toHaveValue('40');
  await expect(page.getByRole('textbox', { name: 'Notes (optional)', exact: true })).toHaveValue('Extra ten');
  await page.getByRole('textbox', { name: 'Date (YYYY-MM-DD)', exact: true }).fill(addDays(today, -2));
  await expect(value).toHaveValue('30');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Single tap to toggle', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await cell(addDays(today, -2), 'unknown').click();
  await expect(value).toHaveValue('30');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cell(addDays(today, -2), 'unknown')).toBeVisible();
});
