import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', timezoneId: 'UTC' });

test('opens months and restores local events after reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-19T12:30:00Z'));
  await page.goto('/');
  const widget = page.locator('[data-widget-type="calendar"]');
  await widget.getByRole('button', { name: 'Next month' }).click();
  await expect(widget.getByText('December 2026', { exact: true })).toBeVisible();
  await widget.getByRole('button', { name: 'Previous month' }).click();
  await widget.getByRole('button', { name: '2026-11-19' }).click();
  await widget.getByRole('button', { name: 'Add event' }).click();
  await widget.getByLabel('Title', { exact: true }).fill('Design review');
  await widget.getByLabel('Time', { exact: true }).fill('14:00');
  await widget.getByRole('button', { name: 'Save event' }).click();
  await widget.getByRole('button', { name: 'Edit Design review' }).click();
  await widget.getByLabel('Title', { exact: true }).fill('Review DashForge');
  await widget.getByRole('button', { name: 'Save event' }).click();
  await expect(widget.getByRole('button', { name: 'Edit Review DashForge' })).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(widget.getByRole('button', { name: 'Edit Review DashForge' })).toBeVisible();
  await widget.getByRole('button', { name: 'Delete Review DashForge' }).click();
  await expect(widget.getByText('Review DashForge', { exact: true })).toHaveCount(0);
});

test('expires a timed event with no Clock widget on the page', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-19T12:30:00Z') });
  await page.goto('/');
  const clock = page.locator('[data-widget-type="clock"]');
  await clock.getByRole('button', { name: 'Clock settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove widget' }).click();
  await expect(clock).toHaveCount(0);
  const widget = page.locator('[data-widget-type="calendar"]');
  await widget.getByRole('button', { name: 'Add event' }).click();
  await widget.getByLabel('Title', { exact: true }).fill('This minute');
  await widget.getByLabel('Time', { exact: true }).fill('12:30');
  await widget.getByRole('button', { name: 'Save event' }).click();
  const upcoming = widget.getByRole('region', { name: 'Upcoming events', exact: true });
  await expect(upcoming.getByText('This minute', { exact: true })).toBeVisible();
  await page.clock.fastForward(65_000);
  await expect(upcoming.getByText('This minute', { exact: true })).toHaveCount(0);
  await expect(widget.getByRole('button', { name: 'Edit This minute' })).toBeVisible();
});
