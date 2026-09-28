import { expect, test } from '@playwright/test';
import { choose, logSet, openPreview } from './helpers';

test('a varied session keeps order, counts only confirmed sets, and survives reload', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Start rest' }).click();
  await expect(page.getByRole('heading', { name: 'Choose exercise' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText(/^1:(29|30)$/);

  await choose(page, 'Bench press');
  await expect(page.locator('.last-time')).toHaveText('First time');
  await expect(page.getByRole('listitem', { name: 'Suggested set, not logged' })).toHaveCount(2);
  await logSet(page, '135', '10');
  await expect(page.getByLabel(/^Weight in/)).toHaveValue('135');
  await logSet(page, '145', '8');
  await logSet(page, '150', '6');
  await expect(page.getByRole('listitem', { name: 'Suggested set, not logged' })).toHaveCount(0);
  await logSet(page, '155', '4');
  // Correct the second set and remove the fourth.
  await page.getByRole('button', { name: 'Edit set 2: 8 reps' }).click();
  await logSet(page, '145', '9');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Remove set 4' }).click();
  await expect(page.getByRole('button', { name: /^Edit set \d: \d+ reps$/ })).toHaveText(['10', '9', '6']);

  // Invalid input is explained, not saved.
  await logSet(page, '-5', '8');
  await expect(page.getByRole('alert')).toContainText('cannot be negative');
  await logSet(page, '100', '2.5');
  await expect(page.getByRole('alert')).toContainText('whole number');
  await page.getByRole('button', { name: 'Dismiss' }).click();

  // A new angle starts a separate entry for the same exercise.
  await page.getByRole('button', { name: 'Switch exercise' }).click();
  await choose(page, 'Incline bench press');
  await logSet(page, '95', '10');
  await page.getByText('Angle and notes').click();
  await page.getByLabel('Angle (°)').fill('45');
  await page.getByLabel('Note', { exact: true }).fill('Shoulder felt fine');
  await logSet(page, '85', '10');

  await page.getByRole('button', { name: '+ Rowing' }).click();
  await page.getByLabel(/^Time/).fill('8:00');
  await page.getByLabel(/^Distance/).fill('2000');
  await expect(page.getByText('2000 m in 8:00 at 2:00 /500 m')).toBeVisible();
  await page.getByRole('button', { name: 'Save row' }).click();

  const timeline = page.getByRole('region', { name: 'This session, in order' });
  await expect(timeline.locator('.timeline-item')).toHaveText([/Bench press3 sets/, /Incline bench press1 set · 30°/, /Incline bench press1 set · 45°/, /Rowing2000 m · 8:00 · 2:00/]);
  await expect(page.getByRole('group', { name: 'Session summary' })).toContainText('5Sets');

  await page.getByLabel('Stretched').check();
  await page.getByLabel('Session note').fill('Solid day');
  await page.reload();
  await expect(timeline.locator('.timeline-item')).toHaveCount(4);
  await expect(page.getByLabel('Session note')).toHaveValue('Solid day');
  await expect(page.getByLabel('Stretched')).toBeChecked();

  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByText('Workout saved')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('1:30');

  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('1 total')).toBeVisible();
  await page.locator('.session-row').first().click();
  const detail = page.locator('.session-detail');
  await expect(detail.getByRole('heading')).toHaveText(['Bench press', 'Incline bench press · 30°', 'Incline bench press · 45°', 'Rowing']);
  await expect(detail).toContainText('Set 2: 145 lb × 9');
  await expect(detail).toContainText('Shoulder felt fine');
  await expect(detail).toContainText('Stretched');
  await expect(detail).toContainText('Solid day');
});

test('renaming or archiving a library exercise keeps history and last-time context intact', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Start a workout' }).click();
  await choose(page, 'Squat');
  await logSet(page, '185', '5');
  await page.getByRole('button', { name: 'Finish workout' }).click();

  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByRole('button', { name: /^Squat/ }).click();
  await page.getByLabel('Name').fill('Back squat');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: /^Back squat/ })).toBeVisible();

  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Start a workout' }).click();
  await choose(page, 'Back squat');
  await expect(page.locator('.last-time')).toContainText('Last time · Today');
  await expect(page.locator('.last-time')).toContainText('185 lb × 5');
  await expect(page.getByLabel(/^Weight in/)).toHaveValue('185');

  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.locator('.session-row').first().click();
  await expect(page.locator('.session-detail h3')).toHaveText(['Squat']);

  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await page.getByRole('button', { name: 'Archive Back squat' }).click();
  await page.getByText('Archived (1)').click();
  await page.getByRole('button', { name: 'Restore Back squat' }).click();
  await expect(page.getByRole('button', { name: 'Archive Back squat' })).toBeVisible();
});
