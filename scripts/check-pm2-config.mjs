// Fail deployment if the JSON-backed app is configured for multi-process or watch mode.
import { spawnSync } from 'node:child_process';

const testFixture = process.env.NODE_ENV === 'test' ? process.env.CODWORTH_PM2_JLIST_JSON : '';
const raw = testFixture || (() => {
  const result = spawnSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error('Unable to inspect PM2 process configuration.');
  return result.stdout;
})();
let processes;
try { processes = JSON.parse(raw); }
catch { throw new Error('PM2 returned invalid process metadata.'); }
if (!Array.isArray(processes)) throw new Error('PM2 process list must be an array.');

const appName = process.env.CODWORTH_PM2_APP_NAME || 'funnelcraft-api';
const matches = processes.filter((process) => process?.name === appName);
if (matches.length !== 1) {
  throw new Error(`Expected exactly one PM2 process named ${appName}; found ${matches.length}.`);
}
const env = matches[0].pm2_env || {};
const watchEnabled = env.watch === true || (Array.isArray(env.watch) && env.watch.length > 0);
if (env.status !== 'online' || env.exec_mode !== 'fork_mode' ||
    Number(env.instances ?? 1) !== 1 || watchEnabled) {
  throw new Error('CodWorth requires one online PM2 fork with watch mode disabled (JSON storage is single-process only).');
}
console.log('PM2 preflight passed: one online fork, one instance, watch disabled.');
