import { expect, test, type Locator, type Page } from '@playwright/test';

const clock = (page: Page) => page.locator('[data-widget-type="clock"]').first();

async function dragBy(page: Page, handle: Locator, dx: number, dy: number) {
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
}

async function columnStep(page: Page) {
  const grid = (await page.locator('.board').boundingBox())!;
  return (grid.width + 12) / 12;
}

test('moves and resizes a desktop widget with a live preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  const card = clock(page);
  await dragBy(page, card.getByRole('button', { name: 'Move Clock' }), 0, 8 * 60);
  await expect(page.locator('.placement-preview')).toBeVisible();
  await expect(card).toHaveCSS('grid-row-start', '1');
  await page.mouse.up();
  await expect(card).toHaveCSS('grid-row-start', '9');
  await dragBy(
    page,
    card.getByRole('button', { name: 'Resize Clock' }),
    await columnStep(page),
    60,
  );
  await page.mouse.up();
  await expect(card).toHaveCSS('grid-column-end', 'span 5');
  await expect(card).toHaveCSS('grid-row-end', 'span 3');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(card).toHaveCSS('grid-row-start', '9');
  await expect(card).toHaveCSS('grid-column-end', 'span 5');
});

test('rejects collisions and cancels a drag while a button is down', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  const card = clock(page);
  await dragBy(page, card.getByRole('button', { name: 'Move Clock' }), 0, 120);
  await expect(page.locator('.placement-preview')).toContainText('Overlaps another widget');
  await page.mouse.up();
  await expect(card).toHaveCSS('grid-row-start', '1');
  await dragBy(page, card.getByRole('button', { name: 'Resize Clock' }), 0, 60);
  await expect(page.locator('.placement-preview')).toContainText('Overlaps another widget');
  await page.mouse.up();
  await expect(card).toHaveCSS('grid-row-end', 'span 2');
  await dragBy(page, card.getByRole('button', { name: 'Move Clock' }), 0, 480);
  await page.keyboard.press('Escape');
  await expect(page.locator('.placement-preview')).toBeHidden();
  await page.mouse.up();
  await expect(card).toHaveCSS('grid-row-start', '1');
});

test('uses the inspector with the keyboard and keeps the mobile layout separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = clock(page).getByRole('button', { name: 'Clock settings' });
  await button.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Clock settings' });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('aria-modal', 'true');
  await panel.getByLabel('Width', { exact: true }).fill('1');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(panel.getByRole('alert').filter({ hasText: 'Minimum' })).toBeVisible();
  await panel.getByLabel('Width', { exact: true }).fill('2');
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(clock(page)).toHaveCSS('grid-column-end', 'span 2');
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(button).toBeFocused();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(clock(page)).toHaveCSS('grid-column-end', 'span 4');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(clock(page)).toHaveCSS('grid-column-end', 'span 2');
});

test('has no horizontal overflow at supported widths', async ({ page }) => {
  await page.goto('/');
  await expect(clock(page)).toBeVisible();
  for (const width of [320, 390, 760, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }
});

test('cancels a gesture when the viewport changes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  await dragBy(page, clock(page).getByRole('button', { name: 'Move Clock' }), 0, 480);
  await expect(page.locator('.placement-preview')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.placement-preview')).toBeHidden();
  await page.mouse.up();
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(clock(page)).toHaveCSS('grid-row-start', '1');
});

test('removes only the configured widget through the inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Widget' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Notes/ })
    .click();
  const notes = page.locator('[data-widget-type="notes"]');
  await expect(notes).toHaveCount(2);
  await notes.last().getByRole('button', { name: 'Notes settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove widget' }).click();
  await expect(notes).toHaveCount(1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(notes).toHaveCount(1);
});

test('keeps a widget settings draft while dragging on the visible desktop canvas', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Layout' }).click();
  const card = clock(page);
  await card.getByRole('button', { name: 'Clock settings' }).click();
  const panel = page.getByRole('dialog', { name: 'Clock settings' });
  const zone = panel.getByLabel('Time zone', { exact: true });
  await zone.fill('UTC');
  await dragBy(page, card.getByRole('button', { name: 'Move Clock' }), 0, 480);
  await page.mouse.up();
  await expect(panel.getByLabel('Row', { exact: true })).toHaveValue('9');
  await expect(zone).toHaveValue('UTC');
});
