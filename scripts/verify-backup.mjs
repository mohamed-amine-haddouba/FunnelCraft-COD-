// Read-only backup verifier: never extracts into the production data directory.
// Prints counts/validity only. Does not print email, phones, tokens, or order contents.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const archive = process.argv[2];
if (!archive || !fs.existsSync(archive)) {
  console.error('Usage: node scripts/verify-backup.mjs /private/path/codworth-data-*.tar.gz');
  process.exit(2);
}
const list = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (list.status !== 0) throw new Error('Backup archive listing failed.');
const names = list.stdout.split('\n').filter(Boolean);
if (!names.length) throw new Error('Archive is empty.');
for (const name of names) {
  const segments = name.split('/');
  if (!name.startsWith('data/') && name !== 'data' && name !== 'data/') throw new Error('Backup path outside data/.');
  if (name.startsWith('/') || segments.includes('..')) throw new Error('Unsafe path in archive.');
}
let validated = 0;
const counts = {};
for (const name of names.filter(n => n.endsWith('.json'))) {
  const content = spawnSync('tar', ['-xOzf', archive, name], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  if (content.status !== 0) throw new Error('Unable to read ' + path.basename(name));
  let parsed;
  try { parsed = JSON.parse(content.stdout); }
  catch { throw new Error('Corrupt JSON: ' + path.basename(name)); }
  const base = path.basename(name);
  if (['users.json', 'orders.json', 'pages.json', 'sessions.json', 'payments.json'].includes(base)) {
    counts[base] = Array.isArray(parsed) ? parsed.length : Object.keys(parsed || {}).length;
  }
  validated += 1;
}
console.log(JSON.stringify({ valid: true, jsonFilesValidated: validated, coreRecordCounts: counts }));
console.log('Verification did not restore or modify production data. Test actual recovery on a separate server.');
