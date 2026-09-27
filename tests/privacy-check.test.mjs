import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../scripts/privacy-check.mjs';

test('detects synthetic secrets without returning their contents', () => {
  const dummy = 'AK' + 'IA' + 'X'.repeat(16);
  assert.deepEqual(findings('config.txt', dummy), ['AWS credential']);
  assert.equal(findings('config.txt', dummy).join('').includes(dummy), false);
  assert.ok(findings('config.txt', 'gh' + 'p_' + 'x'.repeat(32)).length);
});
test('blocks private files, local state, and personal data', () => {
  assert.ok(findings('.env.local', '').includes('private file'));
  assert.ok(findings('work/dump.json', '').includes('local state'));
  assert.ok(findings('fixture.txt', ['someone', 'personal.invalid'].join('@')).includes('personal email'));
  assert.ok(findings('notes.txt', '/Us' + 'ers/synthetic/project/').includes('personal filesystem path'));
});
test('permits sanitized configuration and synthetic email examples', () => {
  assert.deepEqual(findings('.env.example', 'PUBLIC_API_URL=\n'), []);
  assert.deepEqual(findings('fixture.txt', ['sample', 'example.com'].join('@')), []);
});
