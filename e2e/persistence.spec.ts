import { expect, test } from '@playwright/test';

test('restores the catalog and theme from IndexedDB after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Notes/ })
    .click();
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCount(2);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a stale browser tab cannot replace a committed layout', async ({ page, context }) => {
  await page.goto('/');
  const stale = await context.newPage();
  await stale.goto('/');
  await expect(stale.locator('[data-widget-id]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Clock/ })
    .click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await stale.getByRole('button', { name: 'Dark theme' }).click();
  await expect(
    stale.getByText('A newer workspace was saved in another tab.', { exact: true }),
  ).toBeVisible();
  await expect(stale.locator('html')).toHaveAttribute('data-theme', 'dark');
  stale.once('dialog', (dialog) => dialog.dismiss());
  await stale.getByRole('button', { name: 'Load saved workspace' }).click();
  await expect(stale.locator('html')).toHaveAttribute('data-theme', 'dark');
  stale.once('dialog', (dialog) => dialog.accept());
  await stale.getByRole('button', { name: 'Load saved workspace' }).click();
  await expect(stale.locator('[data-widget-type="clock"]')).toHaveCount(2);
});
