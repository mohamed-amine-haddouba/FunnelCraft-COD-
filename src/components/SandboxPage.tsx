import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  LogOut,
  ExternalLink,
  Lock,
  Loader2,
  Terminal,
  Activity,
} from 'lucide-react';
import { SANDBOX_TOKEN_STORAGE_KEY } from './SandboxLoginPage';

interface PreDeployCheckItem {
  name: 'typecheck' | 'tests' | 'build' | 'branch';
  command: string;
  passed: boolean;
  durationMs: number;
  summary: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  ip: string;
  userAgent: string;
  action: string;
  result: 'success' | 'failure' | 'blocked';
  metadata: Record<string, unknown>;
}

interface SandboxStatusPayload {
  owner: {
    email: string;
    fullName: string;
    role: string;
  };
  session: {
    createdAt: number;
    expiresAt: number;
    lastVerifiedAt: number;
    remainingSeconds: number;
    requiresReverifySoon: boolean;
  };
  deployment: {
    inProgress: boolean;
    cooldownRemainingSeconds: number;
    lastDeployAt: string | null;
  };
  environment: {
    mode: string;
    githubConfigured: boolean;
    ownerEmailConfigured: boolean;
  };
}

function getSandboxAuthHeaders(csrfToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const storedToken = sessionStorage.getItem(SANDBOX_TOKEN_STORAGE_KEY);
  if (storedToken) {
    headers['x-sandbox-token'] = storedToken;
  }
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  return headers;
}

export function SandboxPage() {
  const navigate = useNavigate();

  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [statusData, setStatusData] = useState<SandboxStatusPayload | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Deploy state
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    ok: boolean;
    code: string;
    message: string;
    commitSha?: string;
    branch?: string;
    checks?: PreDeployCheckItem[];
    actionsUrl?: string;
  } | null>(null);

  // Re-verification modal state
  const [reverifyPassword, setReverifyPassword] = useState('');
  const [isReverifying, setIsReverifying] = useState(false);
  const [reverifyError, setReverifyError] = useState<string | null>(null);

  const fetchCsrfToken = useCallback(async () => {
    try {
      const res = await fetch('/api/sandbox/csrf', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken as string;
      }
    } catch {
      // handled on action
    }
    return '';
  }, []);

  const loadSandboxData = useCallback(async () => {
    try {
      const [statusRes, auditRes] = await Promise.all([
        fetch('/api/sandbox/status', {
          method: 'GET',
          credentials: 'include',
          headers: getSandboxAuthHeaders(),
        }),
        fetch('/api/sandbox/audit', {
          method: 'GET',
          credentials: 'include',
          headers: getSandboxAuthHeaders(),
        }),
      ]);

      if (statusRes.status === 401 || statusRes.status === 403) {
        sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
        navigate('/sandbox/login', { replace: true });
        return;
      }

      const statusJson = await statusRes.json();
      const auditJson = await auditRes.json();

      if (!statusRes.ok || !statusJson.ok) {
        sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
        navigate('/sandbox/login', { replace: true });
        return;
      }

      setStatusData(statusJson);
      setRemainingSeconds(statusJson.session?.remainingSeconds ?? 0);
      setCooldownSeconds(statusJson.deployment?.cooldownRemainingSeconds ?? 0);

      if (auditRes.ok && auditJson.ok && Array.isArray(auditJson.entries)) {
        setAuditEntries(auditJson.entries);
      }
      setIsVerifyingSession(false);
    } catch {
      sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
      navigate('/sandbox/login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    fetchCsrfToken();
    loadSandboxData();
  }, [fetchCsrfToken, loadSandboxData]);

  // Countdown tick for 30-minute session TTL and 5-minute deploy cooldown
  useEffect(() => {
    if (isVerifyingSession) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
          navigate('/sandbox/login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isVerifyingSession, navigate]);

  const handleLogout = async () => {
    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      await fetch('/api/sandbox/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
      });
    } finally {
      sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
      navigate('/sandbox/login', { replace: true });
    }
  };

  const handleReverify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverifyPassword) return;
    setIsReverifying(true);
    setReverifyError(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/auth/reverify', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({ password: reverifyPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setReverifyError(data.message || 'Re-verification failed.');
        await fetchCsrfToken();
        return;
      }

      setReverifyPassword('');
      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setReverifyError('Unable to reach re-verification endpoint.');
    } finally {
      setIsReverifying(false);
    }
  };

  const executeDeploy = async () => {
    if (confirmInput !== 'DEPLOY' || isDeploying) return;
    setIsDeploying(true);
    setDeployResult(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/deploy', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({ confirm: confirmInput }),
      });

      const data = await res.json();
      setDeployResult({
        ok: Boolean(res.ok && data.ok),
        code: data.code || 'UNKNOWN',
        message: data.message || 'Deployment request completed.',
        commitSha: data.commitSha,
        branch: data.branch,
        checks: data.checks,
        actionsUrl: data.actionsUrl,
      });

      if (res.ok && data.ok) {
        setConfirmInput('');
      }

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setDeployResult({
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with the Sandbox deployment server.',
        actionsUrl: 'https://github.com/actions',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Never render any Sandbox content until server-side session verification succeeds
  if (isVerifyingSession || !statusData) {
    return (
      <div
        dir="ltr"
        className="min-h-screen w-screen bg-slate-950 text-slate-300 flex flex-col items-center justify-center gap-3 font-sans"
      >
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        <span className="text-xs font-mono text-slate-400">
          VERIFYING OWNER SANDBOX SESSION...
        </span>
      </div>
    );
  }

  const minutesLeft = Math.floor(remainingSeconds / 60);
  const secondsLeft = remainingSeconds % 60;
  const isDeployButtonDisabled =
    isDeploying ||
    statusData.deployment.inProgress ||
    confirmInput !== 'DEPLOY' ||
    cooldownSeconds > 0;

  return (
    <div dir="ltr" className="min-h-screen w-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Security Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                FunnelCraft-COD · Owner Sandbox & CI/CD Gate
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>OWNER: {statusData.owner.email}</span>
                <span aria-hidden="true">·</span>
                <span>ROLE: {statusData.owner.role.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>ENV: SANDBOX ISOLATED</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>
                SESSION TTL: {String(minutesLeft).padStart(2, '0')}:
                {String(secondsLeft).padStart(2, '0')}
              </span>
            </div>

            <button
              type="button"
              onClick={loadSandboxData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Terminate Session</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Session Re-Verification Panel (30m Max TTL Renewal) */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Session Re-Verification (30-Minute Security Window)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sandbox sessions strictly expire after 30 minutes. Re-confirm your owner password at
                any time to renew the 30-minute window.
              </p>
              {reverifyError && (
                <p className="text-xs text-rose-400 mt-1.5">{reverifyError}</p>
              )}
            </div>

            <form onSubmit={handleReverify} className="flex items-center gap-2 shrink-0">
              <input
                type="password"
                value={reverifyPassword}
                onChange={(e) => setReverifyPassword(e.target.value)}
                placeholder="Confirm owner password"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isReverifying || !reverifyPassword}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                {isReverifying ? 'Verifying...' : 'Re-Verify 30m'}
              </button>
            </form>
          </div>
        </section>

        {/* Production Deployment Gate */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>Production CI/CD Deployment Gate</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Triggers GitHub Actions only after all 4 mandatory server-side verification checks
                pass with zero errors.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <span>RATE LIMIT: 1 DEPLOY / 5M</span>
              <span aria-hidden="true">·</span>
              <span>
                LOCK: {statusData.deployment.inProgress || isDeploying ? 'LOCKED' : 'READY'}
              </span>
            </div>
          </div>

          {/* Mandatory Server-Side Gate Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'TypeScript Compiler', cmd: 'npx tsc --noEmit' },
              { label: 'Automated Test Suite', cmd: 'npm test' },
              { label: 'Production Bundle', cmd: 'npm run build' },
              { label: 'Branch Enforcement', cmd: 'branch === "main"' },
            ].map((gate) => {
              const executedCheck = deployResult?.checks?.find(
                (c) =>
                  (gate.cmd.includes('tsc') && c.name === 'typecheck') ||
                  (gate.cmd.includes('test') && c.name === 'tests') ||
                  (gate.cmd.includes('build') && c.name === 'build') ||
                  (gate.cmd.includes('main') && c.name === 'branch')
              );

              return (
                <div
                  key={gate.cmd}
                  className="p-3.5 bg-slate-950 border border-slate-800 rounded-md flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-200">{gate.label}</span>
                    {executedCheck ? (
                      executedCheck.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )
                    ) : (
                      <span className="text-[11px] font-mono text-slate-500">GATE</span>
                    )}
                  </div>
                  <code className="text-[11px] font-mono text-emerald-400">{gate.cmd}</code>
                  {executedCheck && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 font-mono">
                      {executedCheck.summary} ({executedCheck.durationMs}ms)
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirmation Input + Deploy Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 bg-slate-950 border border-slate-800 rounded-md p-4">
            <div className="flex-1">
              <label
                htmlFor="deploy-confirm-literal"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Type exact confirmation literal <code className="text-emerald-400 font-mono">DEPLOY</code> to unlock
              </label>
              <input
                id="deploy-confirm-literal"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                disabled={isDeploying || statusData.deployment.inProgress}
                placeholder="Type DEPLOY"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={executeDeploy}
              disabled={isDeployButtonDisabled}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm rounded-md transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {isDeploying || statusData.deployment.inProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Checks & Deploying...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <span>Cooldown ({cooldownSeconds}s)</span>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Run Server Checks & Trigger Deploy</span>
                </>
              )}
            </button>
          </div>

          {/* Deploy Result & Failure Recovery Banner */}
          {deployResult && (
            <div
              role="status"
              className={`mt-5 p-4 rounded-md border ${
                deployResult.ok
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {deployResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>
                      [{deployResult.code}] {deployResult.message}
                    </span>
                  </div>
                  {(deployResult.commitSha || deployResult.branch) && (
                    <div className="text-xs font-mono text-slate-400">
                      BRANCH: {deployResult.branch || 'unknown'} · COMMIT:{' '}
                      {deployResult.commitSha || 'unknown'}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {deployResult.actionsUrl && (
                    <a
                      href={deployResult.actionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-medium rounded-md flex items-center gap-1.5"
                    >
                      <span>View GitHub Actions Log</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {!deployResult.ok && (
                    <button
                      type="button"
                      disabled={isDeploying || cooldownSeconds > 0}
                      onClick={() => {
                        setConfirmInput('DEPLOY');
                        executeDeploy();
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Deploy</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Security Audit Trail */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>Immutable Security Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Records login attempts, lockouts, password recovery, pre-deploy check failures, and
                GitHub dispatches.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              ENTRIES: {auditEntries.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3">TIMESTAMP</th>
                  <th className="py-2.5 px-3">ACTOR</th>
                  <th className="py-2.5 px-3">IP ADDRESS</th>
                  <th className="py-2.5 px-3">ACTION</th>
                  <th className="py-2.5 px-3">RESULT</th>
                  <th className="py-2.5 px-3">METADATA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No audit entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/60">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {entry.timestamp}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{entry.actorEmail}</td>
                      <td className="py-2.5 px-3 text-slate-400">{entry.ip}</td>
                      <td className="py-2.5 px-3 text-white font-semibold">{entry.action}</td>
                      <td
                        className={`py-2.5 px-3 font-semibold ${
                          entry.result === 'success'
                            ? 'text-emerald-400'
                            : entry.result === 'blocked'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {entry.result.toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                        {JSON.stringify(entry.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
