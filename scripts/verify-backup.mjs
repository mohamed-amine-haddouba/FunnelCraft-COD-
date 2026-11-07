// Read-only verifier for decrypted CodWorth data archives.
// Never extracts into a live data directory or prints personal record contents.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const archive = process.argv[2];
if (!archive || !fs.existsSync(archive)) {
  console.error('Usage: node scripts/verify-backup.mjs /private/path/codworth-data.tar.gz');
  process.exit(2);
}

const listing = spawnSync('tar', ['-tzf', archive], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
if (listing.status !== 0) throw new Error('Backup archive listing failed.');
const names = listing.stdout.split('\n').filter(Boolean);
if (!names.length) throw new Error('Archive is empty.');

for (const name of names) {
  const normalized = name.replace(/\/$/, '');
  const segments = normalized.split('/');
  if (normalized !== 'data' && !normalized.startsWith('data/')) {
    throw new Error('Backup contains a path outside data/.');
  }
  if (path.posix.isAbsolute(normalized) || segments.includes('..') || normalized.includes('\\')) {
    throw new Error('Backup contains an unsafe path.');
  }
}

// Only regular files and directories are permitted; links/devices can escape the
// destination directory or change what gets restored.
const verbose = spawnSync('tar', ['-tvzf', archive], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
if (verbose.status !== 0) throw new Error('Backup member inspection failed.');
for (const line of verbose.stdout.split('\n').filter(Boolean)) {
  const type = line[0];
  if (type !== '-' && type !== 'd') {
    throw new Error('Backup contains a link or unsupported filesystem entry.');
  }
}

let validated = 0;
const counts = {};
for (const name of names.filter((entry) => entry.endsWith('.json'))) {
  const content = spawnSync('tar', ['-xOzf', archive, name], {
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
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
if (validated === 0) throw new Error('Backup contains no verifiable JSON data files.');
console.log(JSON.stringify({ valid: true, jsonFilesValidated: validated, coreRecordCounts: counts }));
console.log('Verification did not restore or modify production data. Test actual recovery on a separate server.');
