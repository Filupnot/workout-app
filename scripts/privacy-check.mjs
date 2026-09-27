import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Report locations and categories only: never echo a detected secret.
export function findings(path, content) {
  const issues = [];
  if (/(^|\/)(\.env(?:\..+)?|samconfig\.toml|credentials|.*\.(?:pem|key|p12|sqlite|db))$/i.test(path) && !path.endsWith('.env.example')) issues.push('private file');
  if (/(^|\/)(node_modules|\.aws-sam|\.svelte-kit|work|outputs|\.agents|\.claude|\.codex)\//.test(path)) issues.push('local state');
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(content)) issues.push('AWS credential');
  if (/\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/.test(content)) issues.push('GitHub credential');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) issues.push('private key');
  if (/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/.test(content)) issues.push('session token');
  if (/(?:client_secret|password|api_key|access_token|refresh_token)\s*[:=]\s*["'][^"'\s]{16,}["']/i.test(content)) issues.push('literal secret');
  const emails = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  if (emails.some(email => !/@(?:example\.(?:com|net|org)|users\.noreply\.github\.com)$/i.test(email))) issues.push('personal email');
  if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(content)) issues.push('personal filesystem path');
  return issues;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
export function scanRepository() {
  const candidates = new Map();
  const staged = git('ls-files', '--stage', '-z').split('\0').filter(Boolean);
  for (const line of staged) {
    const [meta, path] = line.split('\t');
    const [, sha] = meta.split(' ');
    candidates.set(`${sha}:${path}`, { sha, path });
  }
  let commits = [];
  try { commits = git('rev-list', '--all').trim().split('\n').filter(Boolean); } catch { /* initial repository */ }
  for (const commit of commits) {
    for (const line of git('ls-tree', '-r', '-z', commit).split('\0').filter(Boolean)) {
      const [meta, path] = line.split('\t');
      const [, type, sha] = meta.split(' ');
      if (type === 'blob') candidates.set(`${sha}:${path}`, { sha, path });
    }
  }
  const problems = [];
  for (const { sha, path } of candidates.values()) {
    const content = git('cat-file', 'blob', sha);
    for (const issue of findings(path, content)) problems.push(`${path}: ${issue}`);
  }
  return [...new Set(problems)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = scanRepository();
  if (problems.length) {
    console.error('Privacy review failed:\n' + problems.join('\n'));
    process.exitCode = 1;
  } else console.log('Staged files and Git history passed the automated privacy checks. Manual review is still required.');
}
