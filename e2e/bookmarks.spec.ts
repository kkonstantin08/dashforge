import { expect, test, type Locator } from '@playwright/test';

async function addLink(widget: Locator, title: string, group: string) {
  await widget.getByRole('button', { name: 'Add link' }).click();
  await widget.getByLabel('Title', { exact: true }).fill(title);
  await widget.getByLabel('URL', { exact: true }).fill('https://dashforge-test.invalid/docs');
  await widget.getByLabel('Group', { exact: true }).fill(group);
  await widget.getByRole('button', { name: 'Save link' }).click();
}

test('creates, edits and deletes grouped bookmarks without fetching favicons', async ({
  page,
  context,
}, testInfo) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url());
  });
  await context.route('https://dashforge-test.invalid/**', (route) =>
    route.fulfill({ body: 'example' }),
  );
  await page.goto('/');
  const widget = page.locator('[data-widget-type="bookmarks"]');
  await addLink(widget, 'Docs', 'Work');
  await addLink(widget, 'Reading', 'Personal');
  await expect(widget.getByRole('heading', { name: 'Work' })).toBeVisible();
  await expect(widget.getByRole('heading', { name: 'Personal' })).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    await widget.locator('.content').evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(widget.getByRole('link', { name: 'Docs' })).toBeInViewport({ ratio: 1 });
  }
  const link = widget.getByRole('link', { name: 'Docs', exact: true });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(external).toEqual([]);
  const popup = context.waitForEvent('page');
  await link.click();
  const opened = await popup;
  await opened.waitForLoadState();
  expect(opened.url()).toBe('https://dashforge-test.invalid/docs');
  await opened.close();
  await widget.getByRole('button', { name: 'Edit Docs' }).click();
  await widget.getByLabel('Title', { exact: true }).fill('Angular docs');
  await widget.getByRole('button', { name: 'Save link' }).click();
  await expect(widget.getByRole('link', { name: 'Angular docs' })).toBeVisible();
  await widget.getByRole('button', { name: 'Delete Reading' }).click();
  await expect(widget.getByRole('link', { name: 'Reading' })).toHaveCount(0);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(widget.getByRole('link', { name: 'Angular docs' })).toBeVisible();
  await expect(widget.getByRole('link', { name: 'Reading' })).toHaveCount(0);
});

test('shows an error beside an unsafe bookmark URL', async ({ page }) => {
  await page.goto('/');
  const widget = page.locator('[data-widget-type="bookmarks"]');
  await widget.getByRole('button', { name: 'Add link' }).click();
  await widget.getByLabel('Title', { exact: true }).fill('Test');
  await widget.getByLabel('URL', { exact: true }).fill('javascript:alert(1)');
  await widget.getByRole('button', { name: 'Save link' }).click();
  await expect(widget.getByRole('alert')).toContainText('http:// or https://');
  await expect(widget.getByRole('link')).toHaveCount(0);
});
