import { expect, test } from '@playwright/test';
import { choose, logSet, openPreview } from './helpers';

test('removing an entry asks first, keeps the rest in order, and updates counts', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Start a workout' }).click();
  for (const [name, sets] of [['Bench press', 2], ['Squat', 3], ['Lat pulldown', 1]] as const) {
    await page.getByRole('button', { name: '+ Exercise' }).click();
    await choose(page, name);
    for (let i = 0; i < sets; i++) await logSet(page, '100', '5');
  }
  const items = page.locator('.timeline-item');
  const sets = page.getByRole('group', { name: 'Session summary' });
  await expect(sets).toContainText('6Sets');

  page.once('dialog', d => { expect(d.message()).toBe('Remove Squat and its 3 sets from this workout?'); void d.dismiss(); });
  await page.getByRole('button', { name: 'Remove Squat (2)' }).click();
  await expect(items).toHaveCount(3);

  page.once('dialog', d => void d.accept());
  await page.getByRole('button', { name: 'Remove Squat (2)' }).click();
  await expect(items).toHaveText([/^01 ?Bench press2 sets/, /^02 ?Lat pulldown1 set/]);
  await expect(sets).toContainText('3Sets');
  await expect(sets).toContainText('2Exercises');

  // Removing the exercise being logged clears the logger.
  await expect(page.locator('#active-name')).toHaveText('Lat pulldown');
  page.once('dialog', d => void d.accept());
  await page.getByRole('button', { name: 'Remove Lat pulldown (2)' }).click();
  await expect(page.locator('#active-name')).toHaveCount(0);
  await page.reload();
  await expect(items).toHaveText([/^01 ?Bench press2 sets/]);

  // The library exercise itself stays available.
  await page.getByRole('button', { name: '+ Exercise' }).click();
  await expect(page.getByRole('button', { name: /^Squat/ })).toBeVisible();
});

test('deleting workouts removes them from Today, History, last time, and metrics', async ({ page }) => {
  await openPreview(page);
  // A real session, then a mock one.
  for (const weight of ['135', '999']) {
    await page.getByRole('button', { name: 'Start a workout' }).click();
    await choose(page, 'Bench press');
    await logSet(page, weight, '8');
    await page.getByRole('button', { name: 'Finish workout' }).click();
  }
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText(/^2 total/)).toBeVisible();
  await page.locator('.session-row').first().click();
  await expect(page.locator('.session-detail')).toContainText('999 lb × 8');
  page.once('dialog', d => { expect(d.message()).toMatch(/^Delete the workout from .+\? This can't be undone\.$/); void d.accept(); });
  await page.getByRole('button', { name: 'Delete workout' }).click();
  await expect(page.getByText(/^1 total/)).toBeVisible();
  await expect(page.locator('table.data')).not.toContainText('999');
  await expect(page.locator('.session-row')).toHaveCount(1);

  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Bench press');
  await expect(page.locator('.last-time')).toContainText('135 lb × 8');
  await expect(page.locator('.last-time')).not.toContainText('999');

  // Discarding the workout in progress stops the timer.
  page.once('dialog', d => void d.dismiss());
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  page.once('dialog', d => void d.accept());
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await expect(page.getByRole('button', { name: 'Start a workout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start rest' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start a workout' })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.session-row')).toHaveCount(1);
});
