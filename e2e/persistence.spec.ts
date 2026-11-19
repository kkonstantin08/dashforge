import { expect, test, type Page } from '@playwright/test';

async function useDarkTheme(page: Page) {
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await panel.getByRole('button', { name: 'Dark', exact: true }).click();
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel).toBeHidden();
}

test('opens a v1 workspace saved before appearance settings existed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-widget-id]')).toHaveCount(4);
  await page.evaluate(async () => {
    const id = '80adfd0e-c810-44de-8e29-0c34a756c035';
    const note = { id: '3ddb55d0-33ff-417d-93c1-1d9474614db7', text: 'Saved before Warm Studio' };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('dashforge', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('workspaces', 'readwrite');
        transaction.onabort = () => reject(transaction.error);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.objectStore('workspaces').put(
          {
            schemaVersion: 1,
            revision: 3,
            workspace: {
              theme: 'dark',
              widgets: [{ id, type: 'notes', data: { notes: [note], activeId: note.id } }],
              desktop: { [id]: { col: 3, row: 0, width: 4, height: 3 } },
            },
          },
          'workspace',
        );
      };
    });
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const note = page.getByRole('textbox', { name: 'Note text' });
  await expect(note).toHaveValue('Saved before Warm Studio');
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCSS('grid-column-end', 'span 4');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(panel.getByLabel('Background HEX')).toHaveValue('#1B1715');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(note).toHaveValue('Saved before Warm Studio');
});

test('restores the catalog and theme from IndexedDB after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Notes/ })
    .click();
  await expect(page.locator('[data-widget-type="notes"]')).toHaveCount(2);
  await useDarkTheme(page);
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
  await useDarkTheme(stale);
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
