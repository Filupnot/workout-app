import { expect, test } from '@playwright/test';
import { choose, logSet, openPreview } from './helpers';

// Phrases that were removed as clutter must stay gone.
const removed = ['One set at a time', 'The work adds up', 'Your familiar moves', 'Show up. Start anywhere', 'A little care for tomorrow',
  'Logging never touches', 'Your training, at your pace', 'Make every', 'Progress starts with', 'Heaviest completed set', 'lower is faster',
  'Past workouts keep', 'Plays once, only while', 'IN PROGRESS', 'ENDURANCE', 'RECOVERY', 'Nice work'];
async function noClutter(page: import('@playwright/test').Page) {
  const text = await page.evaluate(() => document.body.innerText);
  for (const phrase of removed) expect(text.toLowerCase(), `"${phrase}" should be gone`).not.toContain(phrase.toLowerCase());
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea')]
    .filter(el => (el as HTMLElement).offsetParent !== null)
    .filter(el => !(el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.[0]?.textContent?.trim() || el.textContent?.trim()))
    .map(el => el.outerHTML.slice(0, 80)));
  expect(unnamed).toEqual([]);
}

test('views show labels, values, and brief instructions without taglines', async ({ page }) => {
  await page.goto('/');
  await noClutter(page);
  await openPreview(page);
  await expect(page.getByText('Or tap Start rest after your first set.')).toBeVisible();
  await noClutter(page);
  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Bench press');
  await logSet(page, '100', '5');
  await page.getByRole('button', { name: '+ Rowing' }).click();
  await expect(page.getByText('Enter any two.')).toBeVisible();
  for (const label of [/^Weight in/, 'Reps', /^Time/, /^Distance/, /^Split/, 'Session note', 'Stretched']) await expect(page.getByLabel(label).first()).toBeVisible();
  await noClutter(page);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  for (const view of ['History', 'Exercises']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await noClutter(page);
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await noClutter(page);
});

test('help opens on demand and leaves the workout and timer untouched', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-02T18:00:00') });
  await page.clock.pauseAt(new Date('2026-03-02T18:00:01'));
  await openPreview(page);
  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Squat');
  await page.getByLabel(/^Weight in/).fill('185');
  await page.clock.runFor(10000);
  await expect(page.getByRole('timer')).toHaveText('1:20');

  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await expect(help).toBeVisible();
  for (const heading of ['Logging', 'Rest timer and sound', 'Sync status', 'History']) await expect(help.getByRole('heading', { name: heading })).toBeVisible();
  await expect(help).toContainText('only while the app is open on screen');
  await expect(help).toContainText('Review a conflict');
  await expect(help).toContainText('heaviest set with exactly that many reps');
  await page.clock.runFor(5000);
  await help.getByRole('button', { name: 'Done' }).click();
  await expect(help).toBeHidden();
  await expect(page.getByRole('timer')).toHaveText('1:15');
  await expect(page.locator('#active-name')).toHaveText('Squat');
  await expect(page.getByLabel(/^Weight in/)).toHaveValue('185');
});
