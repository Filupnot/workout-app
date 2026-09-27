import { expect, test } from '@playwright/test';
import { choose, logSet, openPreview } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-02T18:00:00') });
  // Count soft cues without producing sound.
  await page.addInitScript(() => {
    (window as unknown as { cues: number }).cues = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor() { super(); Object.defineProperty(this, 'state', { get: () => 'running' }); }
      createOscillator() { const o = super.createOscillator(); o.start = () => { (window as unknown as { cues: number }).cues++; }; o.stop = () => {}; return o; }
    } as typeof AudioContext;
  });
});
const cues = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { cues: number }).cues);

test('deadline-based rest keeps running through logging, navigation, reload, and overtime', async ({ page }) => {
  await openPreview(page);
  const timer = page.getByRole('timer');
  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Bench press');
  await page.clock.runFor(20000);
  await logSet(page, '100', '8');
  await expect(timer).toHaveText('1:10');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.clock.runFor(10000);
  await expect(timer).toHaveText('1:00');
  await page.reload();
  await expect(timer).toHaveText('1:00');
  await page.getByRole('button', { name: 'Add 15 seconds' }).click();
  await expect(timer).toHaveText('1:15');
  await page.getByRole('button', { name: 'Remove 15 seconds' }).click();
  await page.clock.runFor(85000);
  await expect(timer).toHaveText('-0:25');
  await expect(page.getByText('Overtime')).toBeVisible();
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(timer).toHaveText('1:30');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'Start rest' })).toBeVisible();

  await page.getByRole('button', { name: 'Start rest' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByRole('button', { name: 'Start rest' })).toBeVisible();
  await page.reload();
  await expect(timer).toHaveText('1:30');
});

test('the optional cue plays once in the foreground and never catches up after hidden expiry', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel(/Default rest/).fill('30');
  await page.getByLabel(/Default rest/).blur();
  await expect(page.getByLabel(/Soft sound/)).not.toBeChecked();
  await page.getByRole('button', { name: 'Done' }).click();

  // Silent preference: expiry changes only the display.
  await page.getByRole('button', { name: 'Start rest' }).click();
  await page.clock.runFor(32000);
  await expect(page.getByText('Overtime')).toBeVisible();
  expect(await cues(page)).toBe(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel(/Soft sound/).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.clock.runFor(31000);
  expect(await cues(page)).toBe(1);
  await page.clock.runFor(30000);
  expect(await cues(page)).toBe(1);

  // Hidden at expiry (phone locked): overtime shows on return without a delayed cue.
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(45000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(2000);
  await expect(page.getByRole('timer')).toHaveText('-0:17');
  expect(await cues(page)).toBe(1);

  // Reload after expiry does not replay the cue (the counter restarts with the page).
  await page.reload();
  await page.clock.runFor(2000);
  expect(await cues(page)).toBe(0);
  expect(await page.evaluate(() => 'Notification' in window ? Notification.permission : 'unsupported')).not.toBe('granted');
});
