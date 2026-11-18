import { expect, test } from '@playwright/test';

test('adds a duplicate from the catalog and resets without removing it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Widget' }).click();
  const catalog = page.getByRole('dialog', { name: 'Add a widget' });
  await catalog.getByRole('button', { name: /^Notes/ }).click();
  await expect(catalog).not.toBeVisible();
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Reset Layout' }).click();
  await expect(page.getByText('Layout reset.', { exact: true })).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset Layout' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Layout reset.');
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCount(2);
});
