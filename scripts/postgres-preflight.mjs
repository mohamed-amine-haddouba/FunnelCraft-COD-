#!/usr/bin/env node
/**
 * JSON->PostgreSQL migration *preflight*, not a migration.
 * Use on a consistent, isolated restoration of a backup; no data is changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preflightLegacyData } from '../server/migrationPreflight.ts';

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));
const errors = [];
const collections = {};
for (const key of ['users', 'pages', 'orders', 'payments']) {
  const file = path.join(dataDirectory, key + '.json');
  if (!fs.existsSync(file)) {
    collections[key] = [];
    continue;
  }
  try {
    collections[key] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Never print file contents or raw JSON parsing errors from production.
    errors.push(key + '_UNREADABLE_JSON');
    collections[key] = null;
  }
}
const audit = preflightLegacyData(collections);
const result = {
  ...audit,
  unreadableCollections: errors,
  hasBlockers: audit.hasBlockers || errors.length > 0,
  disclaimer: 'Read-only preflight; actual database migration, transactional cutover and off-host restore NOT performed.',
};
console.log(JSON.stringify(result, null, 2));
if (result.hasBlockers || result.needsManualReview) process.exitCode = 2;
