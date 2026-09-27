// Renders the SVG app icon to the PNG sizes iOS and the web manifest require.
// Run after editing static/icons/icon.svg: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../static/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size, file, padding = 0, round = true) => {
  await page.setViewportSize({ width: size, height: size });
  const body = padding ? `<div style="width:${size}px;height:${size}px;background:#121613;display:grid;place-items:center">${svg.replace('<svg', `<svg width="${size - padding * 2}" height="${size - padding * 2}"`)}</div>`
    : svg.replace('<svg', `<svg width="${size}" height="${size}"`).replace(round ? '' : 'rx="112"', round ? '' : 'rx="0"');
  await page.setContent(`<html><body style="margin:0;background:#121613">${body}</body></html>`);
  await page.screenshot({ path: new URL(`../static/icons/${file}`, import.meta.url).pathname, omitBackground: false });
};
await render(180, 'apple-touch-icon.png', 0, false);
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', 56);
await browser.close();
