import { expect, test } from '@playwright/test';
import { choose, logSet, noHorizontalScroll, openPreview } from './helpers';

test('375-pixel layouts fit, controls are large and labeled, and the timer stays pinned', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Bench press');
  for (const [w, r] of [['100', '10'], ['105', '8'], ['110', '6'], ['115', '5']]) await logSet(page, w, r);
  await page.getByRole('button', { name: '+ Rowing' }).click();

  for (const view of ['Today', 'History', 'Exercises']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await noHorizontalScroll(page);
    const small = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea, summary')]
      .filter(el => (el as HTMLElement).offsetParent !== null && !(el as HTMLInputElement).type?.match(/checkbox/))
      .map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent?.trim() || el.getAttribute('aria-label'), w: r.width, h: r.height }; })
      .filter(r => r.h < 44 || r.w < 44));
    expect(small, `${view} targets under 44px`).toEqual([]);
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
      .filter(el => !(el as HTMLInputElement).labels?.length && !el.getAttribute('aria-label')).map(el => el.outerHTML));
    expect(unlabeled).toEqual([]);
  }

  await page.getByRole('button', { name: 'Today', exact: true }).click();
  const reps = page.getByLabel('Reps', { exact: true });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await reps.focus();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  // The focused field lands below the fixed bar rather than underneath it.
  const bar = (await page.locator('.top-bar').boundingBox())!;
  const field = (await reps.boundingBox())!;
  expect(field.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  expect(field.y + field.height).toBeLessThanOrEqual(667);
  // Scrolling a long workout while typing keeps the timer on screen.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const timer = (await page.getByRole('timer').boundingBox())!;
  expect(timer.y >= 0 && timer.y + timer.height <= 667).toBe(true);
  await reps.blur();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('appearance choice persists across reloads', async ({ page }) => {
  await openPreview(page);
  for (const theme of ['light', 'dark', 'system'] as const) {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Appearance').selectOption(theme);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Appearance').selectOption('light');
  const colors = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color }));
  expect(colors.bg).toBe('rgb(244, 243, 236)');
});

test('sign-out from preview clears device data', async ({ page }) => {
  await openPreview(page);
  await page.getByRole('button', { name: 'Start a workout' }).click();
  await choose(page, 'Squat');
  await logSet(page, '100', '5');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Open local preview' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open local preview' }).click();
  await expect(page.getByRole('button', { name: 'Start a workout' })).toBeVisible();
});
