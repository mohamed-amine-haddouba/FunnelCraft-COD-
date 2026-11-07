#!/usr/bin/env node
/**
 * Isolated, production-mode deployment smoke test for CI.
 * This is NOT a VPS staging deployment or a provider E2E test.
 * Copies only source/built assets and synthetic fixtures to a temporary root.
 * It never reads the repository's customer JSON records or .env file.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import net from 'node:net';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'codworth-staging-smoke-'));
const origin = 'https://staging.codworth.example.test';
let proc;
let logTail = '';
const remember = chunk => { logTail = (logTail + String(chunk)).slice(-3500); };
async function randomPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address.port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function stopChild() {
  if (!proc || proc.exitCode !== null) return;
  proc.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => proc.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3500)),
  ]);
  if (proc.exitCode === null) proc.kill('SIGKILL');
}
try {
  for (const item of ['server.ts', 'server', 'src', 'dist', 'package.json', 'tsconfig.json']) {
    const from = join(repo, item);
    if (!existsSync(from)) throw new Error('Missing build artifact ' + item);
    cpSync(from, join(root, item), { recursive: true });
  }
  mkdirSync(join(root, 'data'), { recursive: true });
  cpSync(join(repo, 'data/disposable_email_domains.json'), join(root, 'data/disposable_email_domains.json'));
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'junction');

  const port = await randomPort();
  const env = {
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    TMPDIR: process.env.TMPDIR || '',
    NODE_ENV: 'production',
    PORT: String(port),
    APP_ORIGIN: origin,
    PAYPAL_ENVIRONMENT: 'sandbox',
    ENABLE_OWNER_COCKPIT: 'false',
    SANDBOX_REQUIRE_2FA: 'true',
    CORS_ALLOWED_ORIGINS: '',
    // No payment, mail, customer or owner credentials are copied to this process.
  };
  proc = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: root, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stdout.on('data', remember);
  proc.stderr.on('data', remember);
  const base = 'http://127.0.0.1:' + port;
  let up = false;
  for (let i = 0; i < 80; i++) {
    if (proc.exitCode !== null) throw new Error('Staging smoke server quit unexpectedly.');
    try {
      const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok && (await r.json()).status === 'ok') { up = true; break; }
    } catch { /* startup in progress */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(up, 'Production-mode health endpoint was not ready');

  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  const markup = await home.text();
  assert.match(markup, /<html|<!doctype/i);
  assert.match(markup, /assets\//, 'Production HTML must reference built assets');

  const untrusted = await fetch(base + '/api/health', {
    headers: { Origin: 'https://untrusted.example.test' }
  });
  assert.notEqual(untrusted.headers.get('access-control-allow-origin'), 'https://untrusted.example.test');

  const trusted = await fetch(base + '/api/health', { headers: { Origin: origin } });
  assert.equal(trusted.headers.get('access-control-allow-origin'), origin);

  const noBilledAccount = await fetch(base + '/api/billing/simulate-upgrade', { method: 'POST' });
  assert.equal(noBilledAccount.status, 410);

  console.log(JSON.stringify({
    mode: 'isolated GitHub Actions smoke',
    syntheticDataOnly: true,
    status: 'passed',
    checks: ['production process startup', 'health endpoint', 'built SPA assets', 'credentialed CORS allowlist', 'disabled simulated billing'],
    excluded: ['real VPS', 'DNS/TLS', 'real SMTP', 'Stripe/PayPal providers', 'real customer data'],
  }));
} catch (error) {
  console.error('[STAGING SMOKE FAILED]', error?.message || String(error));
  console.error('[ISOLATED SERVER LOG TAIL]', logTail);
  process.exitCode = 1;
} finally {
  await stopChild();
  rmSync(root, { recursive: true, force: true });
}
