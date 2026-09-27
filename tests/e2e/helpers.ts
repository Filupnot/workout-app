import { expect, type Page } from '@playwright/test';

export async function openPreview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open local preview' }).click();
  await expect(page.getByRole('heading', { name: 'Today.' })).toBeVisible();
}
export async function logSet(page: Page, weight: string, reps: string) {
  await page.getByLabel(/^Weight in/).fill(weight);
  await page.getByLabel('Reps', { exact: true }).fill(reps);
  await page.getByRole('button', { name: /^(Log set|Save correction)$/ }).click();
}
export async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}\\b`) }).first().click();
  await expect(page.locator('#active-name')).toHaveText(name);
}
export async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
