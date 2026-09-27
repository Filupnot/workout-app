import { expect, test } from '@playwright/test';
import { choose, logSet, openPreview } from './helpers';

test('the installed shell reopens offline with drafts and logging intact', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright routes service workers only in Chromium');
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')!.getAttribute('href')!;
    return (await fetch(href)).json();
  });
  expect(manifest).toMatchObject({ display: 'standalone', start_url: './', name: 'Workout' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await openPreview(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(async () => (await caches.keys()).every(k => k.startsWith('workout-shell-')))).toBe(true);

  await page.getByRole('button', { name: 'Start rest' }).click();
  await choose(page, 'Bench press');
  await logSet(page, '100', '8');
  await page.getByLabel(/^Weight in/).fill('105');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#active-name')).toHaveText('Bench press');
  await expect(page.getByLabel(/^Weight in/)).toHaveValue('105');
  await logSet(page, '105', '8');
  await expect(page.getByRole('button', { name: /^Edit set \d: \d+ reps$/ })).toHaveCount(2);
  await page.goto('/auth/callback/');
  await expect(page.getByRole('heading')).toBeVisible();
  await context.setOffline(false);
});
