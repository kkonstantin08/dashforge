import { expect, test, type CDPSession, type Locator } from '@playwright/test';

async function touchGesture(cdp: CDPSession, handle: Locator, dx: number, cancel = false) {
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + Math.round((dx * i) / 6), y }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: cancel ? 'touchCancel' : 'touchEnd',
    touchPoints: [],
  });
}

test('can move, resize and cancel with touch', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto(testInfo.project.use.baseURL!);
    const card = page.locator('[data-widget-type="clock"]');
    await card.getByRole('button', { name: 'Clock settings' }).tap();
    const panel = page.getByRole('dialog', { name: 'Clock settings' });
    await panel.getByLabel('Width', { exact: true }).fill('2');
    await panel.getByLabel('Row', { exact: true }).fill('21');
    await panel.getByRole('button', { name: 'Apply' }).tap();
    await panel.getByRole('button', { name: 'Close' }).tap();
    await page.getByRole('button', { name: 'Edit Layout' }).tap();
    const step = ((await page.locator('.board').boundingBox())!.width + 12) / 4;
    const resize = card.getByRole('button', { name: 'Resize Clock' });
    await touchGesture(cdp, resize, step, true);
    await expect(card).toHaveCSS('grid-column-end', 'span 2');
    await touchGesture(cdp, resize, step);
    await expect(card).toHaveCSS('grid-column-end', 'span 3');
    await touchGesture(cdp, card.getByRole('button', { name: 'Move Clock' }), step);
    await expect(card).toHaveCSS('grid-column-start', '2');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.reload();
    await expect(card).toHaveCSS('grid-column-start', '2');
    await expect(card).toHaveCSS('grid-column-end', 'span 3');
  } finally {
    await context.close();
  }
});
