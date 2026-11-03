// Tests exercise the real file-backed server. Give every run a disposable project root.
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'funnelcraft-test-'));
try {
  for (const item of ['server.ts', 'server', 'src', 'package.json', 'tsconfig.json'])
    cpSync(join(root, item), join(dir, item), { recursive: true });
  mkdirSync(join(dir, 'data'));
  cpSync(join(root, 'data/disposable_email_domains.json'), join(dir, 'data/disposable_email_domains.json'));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'junction');
  const tests = ['server', 'src/utils'].flatMap(folder => readdirSync(join(dir, folder)).filter(f => f.endsWith('.test.ts')).map(f => join(folder, f)));
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests], {
    cwd: dir, stdio: 'inherit', env: { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|SystemRoot|TMPDIR|TEMP|TMP|HOME|LANG|LD_LIBRARY_PATH|CODEX_NETWORK_ALLOW_LOCAL_BINDING|NO_PROXY)$/.test(name))), OWNER_EMAIL: 'naadianajah2020@gmail.com', NODE_ENV: 'test', NODE_TEST_NO_LISTEN: '1' }
  });
  if (result.error || result.signal) console.error('Test process stopped:', result.error || result.signal);
  process.exitCode = result.status ?? 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
