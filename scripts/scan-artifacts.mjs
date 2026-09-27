// Scans a build directory for credentials and personal data before publication.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { findings } from './privacy-check.mjs';

const root = process.argv[2] || 'build';
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path); else yield path;
  }
}
const problems = [];
for await (const file of walk(root)) {
  if (/\.(png|ico|woff2?)$/.test(file)) continue;
  for (const issue of findings(relative(root, file), await readFile(file, 'utf8'))) problems.push(`${relative(root, file)}: ${issue}`);
}
if (problems.length) { console.error('Artifact scan failed:\n' + problems.join('\n')); process.exitCode = 1; }
else console.log(`Scanned ${root}: no credentials or personal data patterns found.`);
