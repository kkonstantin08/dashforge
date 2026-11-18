import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', timezoneId: 'UTC' });

test('keeps time zones and formats independent across two clocks', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-19T02:05:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Clock/ })
    .click();
  const clocks = page.locator('[data-widget-type="clock"]');
  await expect(clocks).toHaveCount(2);
  await expect(clocks.first().locator('.clock-time')).toHaveText('02:05');
  await clocks.last().getByRole('button', { name: 'Clock settings' }).click();
  const panel = page.getByRole('dialog', { name: 'Clock settings' });
  await panel.getByLabel('Time zone', { exact: true }).fill('Not/AZone');
  await panel.getByRole('button', { name: 'Save clock settings' }).click();
  await expect(panel.getByRole('alert').filter({ hasText: 'Enter a valid' })).toBeVisible();
  await panel.getByLabel('Time zone', { exact: true }).fill('America/Los_Angeles');
  await panel.getByLabel('Time format').selectOption('12');
  await panel.getByRole('button', { name: 'Save clock settings' }).click();
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(clocks.last().locator('.clock-time')).toHaveText('06:05 PM');
  await expect(clocks.first().locator('.clock-time')).toHaveText('02:05');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(clocks.last().locator('.clock-time')).toHaveText('06:05 PM');
  await expect(clocks.first().locator('.clock-time')).toHaveText('02:05');
});
