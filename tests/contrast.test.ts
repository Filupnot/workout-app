import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG 2 contrast for the theme tokens in app.css: body text pairs need 4.5:1.
const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
function tokens(block: string) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]));
}
const dark = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const lightStart = css.indexOf(":root[data-theme='light']");
const light = tokens(css.slice(lightStart, css.indexOf('}', lightStart)));
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

for (const [name, theme] of [['dark', dark], ['light', light]] as const) {
  test(`${name} theme text meets WCAG AA contrast`, () => {
    for (const [fg, bg] of [['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
      ['accent', 'bg'], ['accent', 'surface'], ['on-accent', 'accent'], ['warn', 'surface'], ['danger', 'surface'], ['danger', 'bg']]) {
      assert.ok(theme[fg] && theme[bg], `missing ${fg}/${bg}`);
      const value = ratio(theme[fg], theme[bg]);
      assert.ok(value >= 4.5, `${name} ${fg} on ${bg} is ${value.toFixed(2)}:1`);
    }
  });
}
