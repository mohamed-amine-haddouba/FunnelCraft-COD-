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
  Lock,
  Loader2,
  Terminal,
  Activity,
  KeyRound,
  Mail,
  Server,
  Play,
} from 'lucide-react';
import { SANDBOX_TOKEN_STORAGE_KEY } from './SandboxLoginPage';

/* ============================================================================
 * VPS LEAST-PRIVILEGE (NON-ROOT USER) DEPLOYMENT GUIDE FOR PM2:
 * ----------------------------------------------------------------------------
 * For maximum security on your production VPS, NEVER run Node.js / PM2 as root.
 * Run the application under a dedicated unprivileged system user (`funnelcraft`):
 *
 *   sudo groupadd --system funnelcraft
 *   sudo useradd --system --gid funnelcraft --create-home \
 *     --home-dir /home/funnelcraft --shell /usr/sbin/nologin funnelcraft
 *   sudo chown -R funnelcraft:funnelcraft /var/www/funnelcraft
 *   pm2 start npm --name "funnelcraft-api" --cwd /var/www/funnelcraft \
 *     --uid funnelcraft --gid funnelcraft -- start
 *   pm2 save
 * ============================================================================
 */

interface AllowedCommandOption {
  id: 'PM2_STATUS' | 'PM2_LOGS' | 'DISK_SPACE' | 'GIT_LOG' | 'RESTART_APP';
  label: string;
  preview: string;
}

const SERVER_CONSOLE_COMMANDS: readonly AllowedCommandOption[] = [
  {
    id: 'PM2_STATUS',
    label: 'PM2 Process Status (pm2 list)',
    preview: 'pm2 list --no-color',
  },
  {
    id: 'PM2_LOGS',
    label: 'PM2 Recent Logs (last 50 lines, nostream)',
    preview: 'pm2 logs funnelcraft-api --lines 50 --nostream --no-color',
  },
  {
    id: 'DISK_SPACE',
    label: 'Disk Space & Filesystem Usage (df -h)',
    preview: 'df -h',
  },
  {
    id: 'GIT_LOG',
    label: 'Recent Git Commits (git log -n 10 --oneline)',
    preview: 'git log -n 10 --oneline --decorate',
  },
  {
    id: 'RESTART_APP',
    label: 'Restart Application (pm2 restart funnelcraft-api)',
    preview: 'pm2 restart funnelcraft-api --update-env',
  },
];

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
    deployScriptConfigured?: boolean;
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [statusData, setStatusData] = useState<SandboxStatusPayload | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [csrfToken, setCsrfToken] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Forced initial password change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  // Local VPS Deploy state & Terminal console state
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string>('');
  const [deployResult, setDeployResult] = useState<{
    ok: boolean;
    code: string;
    message: string;
    commitSha?: string;
    branch?: string;
    checks?: PreDeployCheckItem[];
    stdout?: string;
    stderr?: string;
    logs?: string;
    exitCode?: number;
  } | null>(null);

  // Re-verification & SMTP Test state
  const [reverifyPassword, setReverifyPassword] = useState('');
  const [isReverifying, setIsReverifying] = useState(false);
  const [reverifyError, setReverifyError] = useState<string | null>(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestFeedback, setEmailTestFeedback] = useState<{
    ok: boolean;
    code: string;
    message: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
  } | null>(null);

  // Zero-Trust Server Control Console state (Step-Up Auth + Strict Command Whitelist)
  const [selectedCommandId, setSelectedCommandId] = useState<string>('PM2_STATUS');
  const [stepUpPassword, setStepUpPassword] = useState<string>('');
  const [isExecutingCommand, setIsExecutingCommand] = useState<boolean>(false);
  const [commandResult, setCommandResult] = useState<{
    ok: boolean;
    code: string;
    message: string;
    commandId: string;
    commandLabel?: string;
    exitCode?: number;
    executionTimeMs?: number;
    stdout?: string;
    stderr?: string;
    remainingCommandsInMinute?: number;
  } | null>(null);

  const fetchCsrfToken = useCallback(async () => {
    try {
      const res = await fetch('/api/sandbox/csrf', {
        method: 'GET',
        credentials: 'include',
        headers: getSandboxAuthHeaders(),
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

      const statusJson = await statusRes.json().catch(() => ({ ok: false, code: 'UNKNOWN' }));

      if (statusRes.status === 403 && statusJson?.code === 'PASSWORD_CHANGE_REQUIRED') {
        setMustChangePassword(true);
        setIsVerifyingSession(false);
        return;
      }

      if (statusRes.status === 401 || statusRes.status === 403 || !statusRes.ok || !statusJson.ok) {
        sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
        navigate('/sandbox/login', { replace: true });
        return;
      }

      const auditJson = await auditRes.json().catch(() => ({ ok: false }));

      setMustChangePassword(false);
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
    if (isVerifyingSession || mustChangePassword) return;
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
  }, [isVerifyingSession, mustChangePassword, navigate]);

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

  const handleInitialPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordInput || !newPasswordInput || isChangingPassword) return;
    setIsChangingPassword(true);
    setPasswordChangeError(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          currentPassword: currentPasswordInput,
          newPassword: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPasswordChangeError(data.message || 'Password rotation failed.');
        await fetchCsrfToken();
        return;
      }

      if (data.sessionToken) {
        sessionStorage.setItem(SANDBOX_TOKEN_STORAGE_KEY, data.sessionToken);
      }
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setMustChangePassword(false);
      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setPasswordChangeError('Unable to reach password change endpoint.');
    } finally {
      setIsChangingPassword(false);
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

  const handleTestEmailConfiguration = async () => {
    if (isTestingEmail) return;
    setIsTestingEmail(true);
    setEmailTestFeedback(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/auth/test-email', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({}),
      });

      const data = await res.json();
      setEmailTestFeedback({
        ok: Boolean(res.ok && data.ok),
        code: data.code || (res.ok ? 'SMTP_TEST_SENT' : 'SMTP_TEST_FAILED'),
        message:
          data.message ||
          data.error ||
          (res.ok ? 'Test email sent.' : 'Failed to send test email.'),
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpUser: data.smtpUser,
      });
      await fetchCsrfToken();
    } catch {
      setEmailTestFeedback({
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach /api/sandbox/auth/test-email endpoint.',
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const executeDeploy = async () => {
    if (confirmInput !== 'DEPLOY' || isDeploying) return;
    setIsDeploying(true);
    setDeployResult(null);
    setShowTerminal(true);
    setTerminalLogs(
      [
        '$ ./deploy.sh --verify-gates',
        '[sandbox] Running pre-deploy checks (tsc --noEmit, npm test, npm run build, git branch === "main")...',
        '[sandbox] Waiting for local VPS deployment execution (git pull -> npm install --legacy-peer-deps -> npm run build -> pm2 restart funnelcraft-api)...',
      ].join('\n')
    );

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/deploy', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({ confirm: confirmInput }),
      });

      const data = await res.json();
      const isOk = Boolean(res.ok && data.ok);
      const combinedLogs =
        data.logs ||
        [data.stdout, data.stderr].filter(Boolean).join('\n') ||
        data.message ||
        'Deployment finished.';

      setTerminalLogs(combinedLogs);
      setDeployResult({
        ok: isOk,
        code: data.code || 'UNKNOWN',
        message: data.message || 'Deployment request completed.',
        commitSha: data.commitSha,
        branch: data.branch,
        checks: data.checks,
        stdout: data.stdout,
        stderr: data.stderr,
        logs: combinedLogs,
        exitCode: data.exitCode,
      });

      if (isOk) {
        setConfirmInput('');
      }

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      const errLog =
        '[NETWORK_ERROR] Failed to communicate with the local VPS Sandbox deployment server.';
      setTerminalLogs(errLog);
      setDeployResult({
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with the local VPS Sandbox deployment server.',
        logs: errLog,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleExecuteServerCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommandId || !stepUpPassword.trim() || isExecutingCommand) return;

    // Capture password for this single request and clear input immediately (Step-Up Auth every time)
    const passwordForRequest = stepUpPassword;
    setStepUpPassword('');
    setIsExecutingCommand(true);
    setCommandResult(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/server/command', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          commandId: selectedCommandId,
          password: passwordForRequest,
        }),
      });

      const data = await res.json().catch(() => ({
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Received an unexpected response from the server.',
      }));

      setCommandResult({
        ok: Boolean(res.ok && data.ok),
        code: data.code || (res.ok ? 'COMMAND_EXECUTED' : 'COMMAND_FAILED'),
        message: data.message || 'Command execution finished.',
        commandId: data.commandId || selectedCommandId,
        commandLabel: data.commandLabel,
        exitCode: data.exitCode,
        executionTimeMs: data.executionTimeMs,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        remainingCommandsInMinute: data.remainingCommandsInMinute,
      });

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setCommandResult({
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with /api/sandbox/server/command.',
        commandId: selectedCommandId,
        stdout: '',
        stderr: '[NETWORK_ERROR] Connection interrupted or server restarted during command execution.',
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  if (isVerifyingSession) {
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

  // Forced Initial Password Rotation Screen
  if (mustChangePassword) {
    return (
      <div
        dir="ltr"
        className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans"
      >
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                Mandatory Owner Password Rotation
              </h1>
              <p className="text-xs text-slate-400">
                Bootstrap password detected. Rotate your password to unlock the Sandbox.
              </p>
            </div>
          </div>

          {passwordChangeError && (
            <div className="p-3 rounded-md bg-rose-950/50 border border-rose-800 text-xs text-rose-200">
              {passwordChangeError}
            </div>
          )}

          <form onSubmit={handleInitialPasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current (Bootstrap) Password
              </label>
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Permanent Password (min 12 chars)
              </label>
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                minLength={12}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md cursor-pointer"
              >
                Sign Out
              </button>
              <button
                type="submit"
                disabled={
                  isChangingPassword || !currentPasswordInput || newPasswordInput.length < 12
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-md cursor-pointer"
              >
                {isChangingPassword ? 'Rotating Password...' : 'Rotate Password & Unlock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!statusData) {
    return null;
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
                FunnelCraft-COD · Owner Sandbox & Local VPS Deployer
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>OWNER: {statusData.owner.email}</span>
                <span aria-hidden="true">·</span>
                <span>ROLE: {statusData.owner.role.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>TARGET: LOCAL VPS (PM2: funnelcraft-api)</span>
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
        {/* Session Re-Verification & SMTP Diagnostic Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Session Re-Verification & SMTP Recovery Diagnostics</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sandbox sessions strictly expire after 30 minutes. Re-confirm your owner password to
                renew the session or test your VPS SMTP email configuration.
              </p>
              {reverifyError && (
                <p className="text-xs text-rose-400 mt-1.5">{reverifyError}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <form onSubmit={handleReverify} className="flex items-center gap-2">
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

              <button
                type="button"
                onClick={handleTestEmailConfiguration}
                disabled={isTestingEmail}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isTestingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing SMTP...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Test Email Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SMTP Test Toast / Alert Banner */}
          {emailTestFeedback && (
            <div
              role="alert"
              className={`p-3.5 rounded-md border text-xs font-mono ${
                emailTestFeedback.ok
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    {emailTestFeedback.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>
                      [{emailTestFeedback.code}] {emailTestFeedback.message}
                    </span>
                  </div>
                  {(emailTestFeedback.smtpHost || emailTestFeedback.smtpUser) && (
                    <div className="text-[11px] text-slate-400">
                      SMTP_HOST: {emailTestFeedback.smtpHost || 'unset'}:
                      {emailTestFeedback.smtpPort || 587} · SMTP_USER:{' '}
                      {emailTestFeedback.smtpUser || 'unset'}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEmailTestFeedback(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Direct Local VPS Deployment Gate */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>Direct Local VPS Deployment Gate (./deploy.sh)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Runs server-side verification checks and executes{' '}
                <code className="text-emerald-400 font-mono">./deploy.sh</code> directly on the VPS
                (<code className="text-slate-300 font-mono">git pull</code> →{' '}
                <code className="text-slate-300 font-mono">npm install --legacy-peer-deps</code> →{' '}
                <code className="text-slate-300 font-mono">npm run build</code> →{' '}
                <code className="text-slate-300 font-mono">pm2 restart funnelcraft-api</code>).
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
                Type exact confirmation literal{' '}
                <code className="text-emerald-400 font-mono">DEPLOY</code> to unlock local VPS
                deployment
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
                  <span>Executing ./deploy.sh...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <span>Cooldown ({cooldownSeconds}s)</span>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Deploy Now (Local VPS)</span>
                </>
              )}
            </button>
          </div>

          {/* Status Banner */}
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
                      {typeof deployResult.exitCode === 'number'
                        ? ` · EXIT CODE: ${deployResult.exitCode}`
                        : ''}
                    </div>
                  )}
                </div>

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
          )}

          {/* Live Deployment Terminal Box (Black Box with White/Green/Red Console Output) */}
          {(showTerminal || isDeploying || deployResult) && (
            <div className="mt-5 rounded-md border border-slate-800 bg-black overflow-hidden shadow-inner">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>root@vps:~/FunnelCraft-COD# ./deploy.sh</span>
                </div>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    isDeploying
                      ? 'text-amber-400'
                      : deployResult?.ok
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {isDeploying
                    ? 'RUNNING...'
                    : deployResult?.ok
                    ? 'SUCCESS (EXIT 0)'
                    : 'FAILED'}
                </span>
              </div>

              <pre
                className={`p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap ${
                  isDeploying
                    ? 'text-slate-100'
                    : deployResult?.ok
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {terminalLogs || 'Waiting for deployment output...'}
              </pre>
            </div>
          )}
        </section>

        {/* Zero-Trust Server Control Console */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <span>Server Control Console (Zero-Trust Step-Up Execution)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Executes strictly whitelisted server commands via{' '}
                <code className="text-emerald-400 font-mono">execFile</code> (no shell interpolation)
                inside <code className="text-slate-300 font-mono">/var/www/funnelcraft</code> with
                secret-stripped env, 10s hard timeout, 1MB output cap, and instant owner email
                alerting.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <span>RATE LIMIT: 3 CMDS / MIN</span>
              <span aria-hidden="true">·</span>
              <span>TIMEOUT: 10S HARD CAP</span>
              <span aria-hidden="true">·</span>
              <span>AUTH: STEP-UP PASSWORD</span>
            </div>
          </div>

          <form
            onSubmit={handleExecuteServerCommand}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950 border border-slate-800 rounded-md p-4 items-end"
          >
            {/* Whitelisted Command Dropdown */}
            <div className="lg:col-span-5">
              <label
                htmlFor="server-command-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Whitelisted Server Command (<code className="text-emerald-400 font-mono">ALLOWED_COMMANDS</code>)
              </label>
              <select
                id="server-command-select"
                value={selectedCommandId}
                onChange={(e) => setSelectedCommandId(e.target.value)}
                disabled={isExecutingCommand}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              >
                {SERVER_CONSOLE_COMMANDS.map((cmd) => (
                  <option key={cmd.id} value={cmd.id}>
                    [{cmd.id}] {cmd.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Step-Up Authentication Password Input */}
            <div className="lg:col-span-4">
              <label
                htmlFor="server-command-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Step-Up Owner Password (Required Every Execution)
              </label>
              <input
                id="server-command-password"
                type="password"
                value={stepUpPassword}
                onChange={(e) => setStepUpPassword(e.target.value)}
                disabled={isExecutingCommand}
                autoComplete="off"
                placeholder="Enter owner password to authorize"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Execute Command Button */}
            <div className="lg:col-span-3">
              <button
                type="submit"
                disabled={isExecutingCommand || !selectedCommandId || !stepUpPassword.trim()}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExecutingCommand ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing (10s max)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Command</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Terminal Console Output (<pre>) */}
          <div className="mt-5 rounded-md border border-slate-800 bg-black overflow-hidden shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  funnelcraft@vps:/var/www/funnelcraft${' '}
                  {SERVER_CONSOLE_COMMANDS.find((c) => c.id === selectedCommandId)?.preview ||
                    selectedCommandId}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                {commandResult && typeof commandResult.executionTimeMs === 'number' && (
                  <span className="text-slate-400">
                    TIME: {commandResult.executionTimeMs}ms
                  </span>
                )}
                {commandResult && typeof commandResult.exitCode === 'number' && (
                  <span
                    className={
                      commandResult.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    EXIT: {commandResult.exitCode}
                  </span>
                )}
                <span
                  className={`font-semibold ${
                    isExecutingCommand
                      ? 'text-amber-400'
                      : !commandResult
                      ? 'text-slate-500'
                      : commandResult.ok
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {isExecutingCommand
                    ? 'RUNNING (10S TIMEOUT WINDOW)...'
                    : !commandResult
                    ? 'IDLE'
                    : commandResult.ok
                    ? `SUCCESS [${commandResult.code}]`
                    : `ERROR [${commandResult.code}]`}
                </span>
              </div>
            </div>

            {isExecutingCommand ? (
              <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-300 font-mono text-xs">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                <span>
                  Executing whitelisted command [{selectedCommandId}] with 10-second hard timeout...
                </span>
              </div>
            ) : commandResult ? (
              <div className="divide-y divide-slate-900">
                <div
                  className={`px-4 py-2 text-xs font-mono ${
                    commandResult.ok ? 'text-emerald-300 bg-emerald-950/20' : 'text-rose-300 bg-rose-950/20'
                  }`}
                >
                  [{commandResult.code}] {commandResult.message}
                </div>

                {commandResult.stdout && (
                  <pre className="p-4 text-xs font-mono leading-relaxed text-emerald-400 overflow-x-auto max-h-96 whitespace-pre-wrap">
                    {commandResult.stdout}
                  </pre>
                )}

                {commandResult.stderr && (
                  <pre className="p-4 text-xs font-mono leading-relaxed text-rose-400 overflow-x-auto max-h-96 whitespace-pre-wrap">
                    {commandResult.stderr}
                  </pre>
                )}

                {!commandResult.stdout && !commandResult.stderr && (
                  <pre
                    className={`p-4 text-xs font-mono leading-relaxed ${
                      commandResult.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {commandResult.ok
                      ? '(Command completed with exit code 0 and no console output)'
                      : commandResult.message}
                  </pre>
                )}
              </div>
            ) : (
              <pre className="p-4 text-xs font-mono text-slate-500">
                Select a whitelisted command above and enter your Owner password to execute.
              </pre>
            )}
          </div>
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
                local VPS deployments.
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
