import { expect, test } from '@playwright/test';

test('previews independent palettes, restores on cancel, and saves density and radius', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const appearance = page.getByRole('button', { name: 'Appearance', exact: true });
  await appearance.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(panel).toBeVisible();
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(243, 238, 229)');
  await panel.getByRole('button', { name: 'Olive', exact: true }).click();
  await expect(body).toHaveCSS('background-color', 'rgb(232, 234, 223)');
  const background = panel.getByLabel('Background HEX');
  await background.fill('wrong');
  await expect(background).toHaveAttribute('aria-invalid', 'true');
  await expect(body).toHaveCSS('background-color', 'rgb(232, 234, 223)');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(appearance).toBeFocused();
  await expect(body).toHaveCSS('background-color', 'rgb(243, 238, 229)');

  await appearance.click();
  await background.fill('#112233');
  await panel.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(body).toHaveCSS('background-color', 'rgb(27, 23, 21)');
  await panel.getByRole('button', { name: 'Ink', exact: true }).click();
  await panel.getByRole('button', { name: 'Compact', exact: true }).click();
  await panel.getByLabel('Corner radius').press('End');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const card = page.locator('[data-widget-type="clock"]').first();
  await page.reload();
  await expect(body).toHaveCSS('background-color', 'rgb(25, 29, 38)');
  await expect(card).toHaveCSS('border-radius', '24px');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

  await appearance.click();
  await panel.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(body).toHaveCSS('background-color', 'rgb(17, 34, 51)');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(appearance).toBeFocused();
  await expect(body).toHaveCSS('background-color', 'rgb(25, 29, 38)');
});

test('validates, restores, and removes a font selected for both roles', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url());
  });
  await page.goto('/');
  const appearance = page.getByRole('button', { name: 'Appearance', exact: true });
  await appearance.click();
  const panel = page.getByRole('dialog', { name: 'Appearance', exact: true });
  const upload = panel.locator('input[type="file"]');
  const headings = panel.getByLabel('Headings');
  const body = panel.getByLabel('Body', { exact: true });
  await upload.setInputFiles({
    name: 'broken.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('x'),
  });
  await expect(panel.getByRole('alert')).toContainText('damaged');
  await upload.setInputFiles({
    name: 'large.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.alloc(5 * 1024 ** 2 + 1),
  });
  await expect(panel.getByRole('alert')).toContainText('5 MiB');
  await upload.setInputFiles('src/assets/lora-latin.woff2');
  await expect(headings.getByRole('option', { name: 'lora-latin.woff2' })).toHaveCount(1);
  const asset = await headings.selectOption({ label: 'lora-latin.woff2' });
  await body.selectOption(asset);
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  const fontLoaded = () =>
    page.evaluate(() =>
      [...document.fonts].some(
        (font) => font.family.startsWith('DashForgeLocal-') && font.status === 'loaded',
      ),
    );
  await expect.poll(fontLoaded).toBe(true);

  await appearance.click();
  await expect(headings).toHaveValue(asset[0]);
  await expect(body).toHaveValue(asset[0]);
  await panel.getByRole('button', { name: 'Reset appearance' }).click();
  await expect(headings.getByRole('option', { name: 'lora-latin.woff2' })).toHaveCount(1);
  await headings.selectOption(asset);
  await body.selectOption(asset);
  await panel.getByRole('button', { name: 'Remove lora-latin.woff2' }).click();
  await expect(headings).toHaveValue('lora');
  await expect(body).toHaveValue('system');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(fontLoaded).toBe(false);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await appearance.click();
  await expect(panel).toBeVisible();
  await expect(headings.getByRole('option', { name: 'lora-latin.woff2' })).toHaveCount(0);
  await expect.poll(fontLoaded).toBe(false);
  expect(external).toEqual([]);
});

test('fits the appearance dialog across supported widths and discards a cancelled import', async ({
  page,
}) => {
  await page.goto('/');
  const appearance = page.getByRole('button', { name: 'Appearance', exact: true });
  await appearance.click();
  const panel = page.getByRole('dialog', { name: 'Appearance', exact: true });
  await expect(panel).toBeVisible();
  await panel.locator('input[type="file"]').setInputFiles('src/assets/lora-latin.woff2');
  const headings = panel.getByLabel('Headings', { exact: true });
  await expect(headings.getByRole('option', { name: 'lora-latin.woff2' })).toHaveCount(1);
  await headings.selectOption({ label: 'lora-latin.woff2' });
  for (const width of [320, 390, 760, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const size = await panel.boundingBox();
    expect(size).not.toBeNull();
    expect(size!.x).toBeGreaterThanOrEqual(0);
    expect(size!.x + size!.width).toBeLessThanOrEqual(width);
    expect(await panel.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(size!.width);
  }
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await appearance.click();
  await expect(headings).toHaveValue('lora');
  await expect(headings.getByRole('option', { name: 'lora-latin.woff2' })).toHaveCount(0);
});
