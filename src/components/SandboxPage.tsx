import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Maximize2,
  X,
  Copy,
  ClipboardPaste,
  CreditCard,
  Tag,
  Plus,
  Trash2,
  Save,
  Search,
  Globe,
  Monitor,
  Users,
} from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
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

interface SecurityLoginAuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  ipAddress: string;
  location?: string;
  userAgent: string;
  deviceInfo?: string;
  authMethod: 'password' | 'google_oauth' | 'sandbox_owner';
  status: 'SUCCESS' | 'FAILED';
  failureReason?: string;
}

interface SandboxMerchantIpSummary {
  id: string;
  email: string;
  fullName: string;
  storeName: string;
  role: string;
  planId: string;
  status: string;
  lastLoginIp: string | null;
  lastLoginAt: string | null;
  lastLoginLocation: string | null;
  lastLoginUserAgent: string | null;
}

interface SandboxPlanConfig {
  id: 'starter' | 'pro' | 'enterprise';
  name: string;
  priceMAD: number;
  features: string[];
}

interface SandboxCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number;
  currentUses: number;
  expiresAt: string;
  isActive: boolean;
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

  // Zero-Trust Server Control Console state (Step-Up Auth + Email 2FA OTP + Strict Command Whitelist)
  const [selectedCommandId, setSelectedCommandId] = useState<string>('PM2_STATUS');
  const [stepUpPassword, setStepUpPassword] = useState<string>('');
  const [isRequesting2fa, setIsRequesting2fa] = useState<boolean>(false);
  const [isAwaitingOtp, setIsAwaitingOtp] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState<number>(0);
  const [otpFeedback, setOtpFeedback] = useState<{
    type: 'info' | 'error';
    code: string;
    message: string;
  } | null>(null);
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

  // Interactive Root Web Terminal (node-pty + ws + xterm) state
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState<boolean>(false);
  const [terminalStep, setTerminalStep] = useState<'password' | 'otp' | 'connected'>('password');
  const [terminalPassword, setTerminalPassword] = useState<string>('');
  const [terminalOtpCode, setTerminalOtpCode] = useState<string>('');
  const [terminalOtpSecondsLeft, setTerminalOtpSecondsLeft] = useState<number>(0);
  const [isRequestingTerminalOtp, setIsRequestingTerminalOtp] = useState<boolean>(false);
  const [isConnectingTerminal, setIsConnectingTerminal] = useState<boolean>(false);
  const [terminalFeedback, setTerminalFeedback] = useState<{
    type: 'info' | 'error';
    message: string;
  } | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const xtermInstanceRef = useRef<XTerm | null>(null);
  const fitAddonInstanceRef = useRef<FitAddon | null>(null);
  const terminalWsRef = useRef<WebSocket | null>(null);
  const terminalPasteCleanupRef = useRef<(() => void) | null>(null);
  const [terminalContextMenu, setTerminalContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    hasSelection: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    hasSelection: false,
  });

  // SaaS Management State (Dynamic Subscription Plans & Discount Coupons)
  const [saasActiveTab, setSaasActiveTab] = useState<'plans' | 'coupons'>('plans');
  const [editablePlans, setEditablePlans] = useState<
    Array<{
      id: 'starter' | 'pro' | 'enterprise';
      name: string;
      priceMAD: number;
      featuresText: string;
    }>
  >([]);
  const [isSavingPlans, setIsSavingPlans] = useState<boolean>(false);
  const [plansFeedback, setPlansFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [couponsList, setCouponsList] = useState<SandboxCoupon[]>([]);
  const [newCouponCode, setNewCouponCode] = useState<string>('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCouponValue, setNewCouponValue] = useState<string>('20');
  const [newCouponMaxUses, setNewCouponMaxUses] = useState<string>('100');
  const [newCouponExpiresAt, setNewCouponExpiresAt] = useState<string>('2026-12-31');
  const [isCreatingCoupon, setIsCreatingCoupon] = useState<boolean>(false);
  const [deletingCouponCode, setDeletingCouponCode] = useState<string | null>(null);
  const [couponsFeedback, setCouponsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Forensic Security & Login Audit State (Task 3: Owner-Only Global Login Log + Merchant IP Visibility)
  const [securityLoginLogs, setSecurityLoginLogs] = useState<SecurityLoginAuditEntry[]>([]);
  const [merchantIpSummaries, setMerchantIpSummaries] = useState<SandboxMerchantIpSummary[]>([]);
  const [securityLogSearch, setSecurityLogSearch] = useState<string>('');
  const [securityLogStatusFilter, setSecurityLogStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [securitySubTab, setSecuritySubTab] = useState<'login_audit' | 'merchant_ips'>('login_audit');

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

      // Load Dynamic Subscription Plans, Coupons & Forensic Security Login Logs in parallel
      const [plansRes, couponsRes, securityLogsRes] = await Promise.all([
        fetch('/api/sandbox/plans', {
          method: 'GET',
          credentials: 'include',
          headers: getSandboxAuthHeaders(),
        }),
        fetch('/api/sandbox/coupons', {
          method: 'GET',
          credentials: 'include',
          headers: getSandboxAuthHeaders(),
        }),
        fetch('/api/sandbox/security-logs', {
          method: 'GET',
          credentials: 'include',
          headers: getSandboxAuthHeaders(),
        }),
      ]);

      const plansJson = await plansRes.json().catch(() => ({ ok: false }));
      if (plansRes.ok && plansJson.ok && Array.isArray(plansJson.plans)) {
        setEditablePlans(
          (plansJson.plans as SandboxPlanConfig[]).map((p) => ({
            id: p.id,
            name: p.name,
            priceMAD: p.priceMAD,
            featuresText: Array.isArray(p.features) ? p.features.join('\n') : '',
          }))
        );
      }

      const couponsJson = await couponsRes.json().catch(() => ({ ok: false }));
      if (couponsRes.ok && couponsJson.ok && Array.isArray(couponsJson.coupons)) {
        setCouponsList(couponsJson.coupons as SandboxCoupon[]);
      }

      const securityLogsJson = await securityLogsRes.json().catch(() => ({ ok: false }));
      if (securityLogsRes.ok && securityLogsJson.ok) {
        if (Array.isArray(securityLogsJson.logs)) {
          setSecurityLoginLogs(securityLogsJson.logs as SecurityLoginAuditEntry[]);
        }
        if (Array.isArray(securityLogsJson.merchants)) {
          setMerchantIpSummaries(securityLogsJson.merchants as SandboxMerchantIpSummary[]);
        }
      }

      setIsVerifyingSession(false);
    } catch {
      sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
      navigate('/sandbox/login', { replace: true });
    }
  }, [navigate]);

  const handleSavePlans = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPlans) return;
    setIsSavingPlans(true);
    setPlansFeedback(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const payloadPlans: SandboxPlanConfig[] = editablePlans.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        priceMAD: Number(p.priceMAD),
        features: p.featuresText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }));

      const res = await fetch('/api/sandbox/plans', {
        method: 'PUT',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({ plans: payloadPlans }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setPlansFeedback({
          type: 'error',
          message: data.message || 'Failed to update subscription plans.',
        });
      } else {
        if (Array.isArray(data.plans)) {
          setEditablePlans(
            (data.plans as SandboxPlanConfig[]).map((p) => ({
              id: p.id,
              name: p.name,
              priceMAD: p.priceMAD,
              featuresText: Array.isArray(p.features) ? p.features.join('\n') : '',
            }))
          );
        }
        setPlansFeedback({
          type: 'success',
          message: data.message || 'Subscription plans updated and persisted to data/plans.json.',
        });
      }
      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setPlansFeedback({
        type: 'error',
        message: 'Network error while saving subscription plans.',
      });
    } finally {
      setIsSavingPlans(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingCoupon) return;
    const cleanCode = newCouponCode.trim().toUpperCase();
    if (!cleanCode) {
      setCouponsFeedback({
        type: 'error',
        message: 'Please enter a coupon code (e.g., WELCOME20).',
      });
      return;
    }

    setIsCreatingCoupon(true);
    setCouponsFeedback(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const expiresIso = newCouponExpiresAt.includes('T')
        ? new Date(newCouponExpiresAt).toISOString()
        : new Date(`${newCouponExpiresAt}T23:59:59Z`).toISOString();

      const res = await fetch('/api/sandbox/coupons', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          code: cleanCode,
          discountType: newCouponType,
          discountValue: Number(newCouponValue),
          maxUses: Number(newCouponMaxUses),
          expiresAt: expiresIso,
          isActive: true,
        }),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setCouponsFeedback({
          type: 'error',
          message: data.message || 'Failed to create coupon.',
        });
      } else {
        setNewCouponCode('');
        if (Array.isArray(data.coupons)) {
          setCouponsList(data.coupons as SandboxCoupon[]);
        }
        setCouponsFeedback({
          type: 'success',
          message: data.message || `Coupon ${cleanCode} created successfully.`,
        });
      }
      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setCouponsFeedback({
        type: 'error',
        message: 'Network error while creating coupon.',
      });
    } finally {
      setIsCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!code || deletingCouponCode) return;
    setDeletingCouponCode(code);
    setCouponsFeedback(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch(`/api/sandbox/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
      });

      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setCouponsFeedback({
          type: 'error',
          message: data.message || `Failed to delete coupon ${code}.`,
        });
      } else {
        if (Array.isArray(data.coupons)) {
          setCouponsList(data.coupons as SandboxCoupon[]);
        }
        setCouponsFeedback({
          type: 'success',
          message: data.message || `Coupon ${code} deleted.`,
        });
      }
      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setCouponsFeedback({
        type: 'error',
        message: `Network error while deleting coupon ${code}.`,
      });
    } finally {
      setDeletingCouponCode(null);
    }
  };

  useEffect(() => {
    fetchCsrfToken();
    loadSandboxData();
  }, [fetchCsrfToken, loadSandboxData]);

  // Countdown tick for 30-minute session TTL, 5-minute deploy cooldown, and 5-minute 2FA OTP TTL
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
      setOtpSecondsRemaining((prev) => {
        if (prev <= 0) return 0;
        if (prev === 1) {
          setIsAwaitingOtp(false);
          setOtpCode('');
          setStepUpPassword('');
          setOtpFeedback({
            type: 'error',
            code: 'OTP_EXPIRED',
            message: 'The 6-digit 2FA OTP code expired after 5 minutes. Please request a new code.',
          });
          return 0;
        }
        return prev - 1;
      });
      setTerminalOtpSecondsLeft((prev) => {
        if (prev <= 0) return 0;
        if (prev === 1) {
          setTerminalStep('password');
          setTerminalOtpCode('');
          setTerminalPassword('');
          setTerminalFeedback({
            type: 'error',
            message: 'The 6-digit 2FA OTP code expired after 5 minutes. Please request a new code.',
          });
          return 0;
        }
        return prev - 1;
      });
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

  const resetCommand2faState = useCallback(() => {
    setIsAwaitingOtp(false);
    setOtpCode('');
    setOtpSecondsRemaining(0);
    setOtpFeedback(null);
    setStepUpPassword('');
  }, []);

  // Step 1: Verify Owner Password & Request 6-Digit Email 2FA Code (/api/sandbox/server/request-2fa)
  const handleRequestCommand2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommandId || !stepUpPassword.trim() || isRequesting2fa || isExecutingCommand) {
      return;
    }

    setIsRequesting2fa(true);
    setOtpFeedback(null);
    setCommandResult(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/server/request-2fa', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          commandId: selectedCommandId,
          password: stepUpPassword,
        }),
      });

      const data = await res.json().catch(() => ({
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Received an unexpected response from /api/sandbox/server/request-2fa.',
      }));

      if (!res.ok || !data.ok) {
        setIsAwaitingOtp(false);
        setOtpCode('');
        setStepUpPassword('');
        setOtpFeedback({
          type: 'error',
          code: data.code || '2FA_REQUEST_FAILED',
          message: data.message || 'Failed to request 2FA OTP code.',
        });
        setCommandResult({
          ok: false,
          code: data.code || '2FA_REQUEST_FAILED',
          message: data.message || 'Failed to request 2FA OTP code.',
          commandId: selectedCommandId,
          stdout: '',
          stderr: `[${data.code || '2FA_REQUEST_FAILED'}] ${
            data.message || 'Step-up authentication or 2FA email delivery failed.'
          }`,
        });
      } else {
        setIsAwaitingOtp(true);
        setOtpCode('');
        setOtpSecondsRemaining(typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : 300);
        setOtpFeedback({
          type: 'info',
          code: data.code || 'OTP_SENT',
          message:
            data.message ||
            '6-digit 2FA verification code sent to OWNER_EMAIL. Valid for 5 minutes (single-use).',
        });
      }

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setIsAwaitingOtp(false);
      setOtpFeedback({
        type: 'error',
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with /api/sandbox/server/request-2fa.',
      });
    } finally {
      setIsRequesting2fa(false);
    }
  };

  // Step 2: Confirm 6-Digit OTP & Execute Whitelisted Command (/api/sandbox/server/command)
  const handleConfirmAndExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (
      !selectedCommandId ||
      !stepUpPassword.trim() ||
      !/^\d{6}$/.test(cleanOtp) ||
      isExecutingCommand ||
      isRequesting2fa
    ) {
      setOtpFeedback({
        type: 'error',
        code: 'INVALID_OTP_FORMAT',
        message: 'Please enter a valid 6-digit numeric OTP code.',
      });
      return;
    }

    setIsExecutingCommand(true);
    setOtpFeedback(null);
    setCommandResult(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/server/command', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          commandId: selectedCommandId,
          password: stepUpPassword,
          otpCode: cleanOtp,
        }),
      });

      const data = await res.json().catch(() => ({
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Received an unexpected response from the server.',
      }));

      if (!res.ok || !data.ok) {
        const isExpiredOrMissing =
          data.code === 'INVALID_OTP' &&
          typeof data.message === 'string' &&
          data.message.toLowerCase().includes('expired');

        if (isExpiredOrMissing) {
          setIsAwaitingOtp(false);
          setOtpSecondsRemaining(0);
          setStepUpPassword('');
        }
        setOtpCode('');
        setOtpFeedback({
          type: 'error',
          code: data.code || 'COMMAND_FAILED',
          message: data.message || 'OTP verification or command execution failed.',
        });
        setCommandResult({
          ok: false,
          code: data.code || 'COMMAND_FAILED',
          message: data.message || 'Command execution failed.',
          commandId: data.commandId || selectedCommandId,
          commandLabel: data.commandLabel,
          exitCode: data.exitCode,
          executionTimeMs: data.executionTimeMs,
          stdout: data.stdout || '',
          stderr: data.stderr || `[${data.code || 'ERROR'}] ${data.message || ''}`,
        });
      } else {
        // Single-use OTP consumed: reset all 2FA and password state on successful execution
        resetCommand2faState();
        setCommandResult({
          ok: true,
          code: data.code || 'COMMAND_EXECUTED',
          message: data.message || 'Command executed successfully.',
          commandId: data.commandId || selectedCommandId,
          commandLabel: data.commandLabel,
          exitCode: data.exitCode,
          executionTimeMs: data.executionTimeMs,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          remainingCommandsInMinute: data.remainingCommandsInMinute,
        });
      }

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setOtpFeedback({
        type: 'error',
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with /api/sandbox/server/command.',
      });
      setCommandResult({
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Failed to communicate with /api/sandbox/server/command.',
        commandId: selectedCommandId,
        stdout: '',
        stderr:
          '[NETWORK_ERROR] Connection interrupted or server restarted during command execution.',
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  // Cleanup XTerm & WebSocket resources
  const disposeInteractiveTerminal = useCallback(() => {
    if (terminalPasteCleanupRef.current) {
      try {
        terminalPasteCleanupRef.current();
      } catch {
        // ignore cleanup error
      }
      terminalPasteCleanupRef.current = null;
    }
    if (terminalWsRef.current) {
      try {
        terminalWsRef.current.close();
      } catch {
        // ignore close error
      }
      terminalWsRef.current = null;
    }
    if (xtermInstanceRef.current) {
      try {
        xtermInstanceRef.current.dispose();
      } catch {
        // ignore dispose error
      }
      xtermInstanceRef.current = null;
    }
    fitAddonInstanceRef.current = null;
    setTerminalContextMenu({ visible: false, x: 0, y: 0, hasSelection: false });
  }, []);

  useEffect(() => {
    return () => {
      disposeInteractiveTerminal();
    };
  }, [disposeInteractiveTerminal]);

  // Dismiss custom terminal right-click context menu when clicking anywhere or pressing Escape
  useEffect(() => {
    if (!terminalContextMenu.visible) return;

    const handleGlobalClick = () => {
      setTerminalContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTerminalContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [terminalContextMenu.visible]);

  // Handle window resize for active XTerm FitAddon
  useEffect(() => {
    if (!isTerminalModalOpen || terminalStep !== 'connected') return;

    const handleWindowResize = () => {
      if (fitAddonInstanceRef.current && xtermInstanceRef.current) {
        try {
          fitAddonInstanceRef.current.fit();
          const ws = terminalWsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'resize',
                cols: xtermInstanceRef.current.cols,
                rows: xtermInstanceRef.current.rows,
              })
            );
          }
        } catch {
          // ignore resize error
        }
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isTerminalModalOpen, terminalStep]);

  const handleOpenTerminalModal = () => {
    disposeInteractiveTerminal();
    setTerminalStep('password');
    setTerminalPassword('');
    setTerminalOtpCode('');
    setTerminalOtpSecondsLeft(0);
    setTerminalFeedback(null);
    setIsTerminalModalOpen(true);
  };

  const handleCloseTerminalModal = async () => {
    disposeInteractiveTerminal();
    setIsTerminalModalOpen(false);
    setTerminalStep('password');
    setTerminalPassword('');
    setTerminalOtpCode('');
    setTerminalOtpSecondsLeft(0);
    setTerminalFeedback(null);
    await loadSandboxData();
  };

  // Terminal Modal Step 1: Verify Owner Password & Request 6-Digit Email 2FA Code
  const handleRequestTerminal2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalPassword.trim() || isRequestingTerminalOtp) return;

    setIsRequestingTerminalOtp(true);
    setTerminalFeedback(null);

    try {
      const activeCsrf = csrfToken || (await fetchCsrfToken());
      const res = await fetch('/api/sandbox/server/request-2fa', {
        method: 'POST',
        credentials: 'include',
        headers: getSandboxAuthHeaders(activeCsrf),
        body: JSON.stringify({
          commandId: 'INTERACTIVE_TERMINAL',
          password: terminalPassword,
        }),
      });

      const data = await res.json().catch(() => ({
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Unexpected response from 2FA endpoint.',
      }));

      if (!res.ok || !data.ok) {
        setTerminalPassword('');
        setTerminalFeedback({
          type: 'error',
          message: data.message || 'Password verification or 2FA email delivery failed.',
        });
      } else {
        setTerminalStep('otp');
        setTerminalOtpCode('');
        setTerminalOtpSecondsLeft(
          typeof data.expiresInSeconds === 'number' ? data.expiresInSeconds : 300
        );
        setTerminalFeedback({
          type: 'info',
          message:
            '6-digit 2FA OTP sent to your OWNER_EMAIL. Enter the code below to open the interactive root shell.',
        });
      }

      await fetchCsrfToken();
      await loadSandboxData();
    } catch {
      setTerminalFeedback({
        type: 'error',
        message: 'Failed to communicate with /api/sandbox/server/request-2fa.',
      });
    } finally {
      setIsRequestingTerminalOtp(false);
    }
  };

  // Terminal Modal Step 2: Connect WebSocket (/api/sandbox/terminal), Authenticate, & Mount XTerm
  const handleConnectInteractiveTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = terminalOtpCode.trim();
    if (!terminalPassword.trim() || !/^\d{6}$/.test(cleanOtp) || isConnectingTerminal) {
      setTerminalFeedback({
        type: 'error',
        message: 'Please enter a valid 6-digit numeric OTP code.',
      });
      return;
    }

    setIsConnectingTerminal(true);
    setTerminalFeedback(null);
    disposeInteractiveTerminal();

    const passwordToAuth = terminalPassword;
    const otpToAuth = cleanOtp;

    // Transition to connected view so terminalContainerRef is mounted in DOM
    setTerminalStep('connected');

    setTimeout(() => {
      const container = terminalContainerRef.current;
      if (!container) {
        setIsConnectingTerminal(false);
        setTerminalStep('otp');
        setTerminalFeedback({
          type: 'error',
          message: 'Terminal container failed to mount.',
        });
        return;
      }

      const term = new XTerm({
        cursorBlink: true,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.25,
        theme: {
          background: '#000000',
          foreground: '#e2e8f0',
          cursor: '#10b981',
          selectionBackground: '#10b98140',
        },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      try {
        fitAddon.fit();
      } catch {
        // ignore initial fit error
      }

      xtermInstanceRef.current = term;
      fitAddonInstanceRef.current = fitAddon;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const storedToken = sessionStorage.getItem(SANDBOX_TOKEN_STORAGE_KEY) || '';
      const tokenQuery = storedToken ? `?token=${encodeURIComponent(storedToken)}` : '';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/sandbox/terminal${tokenQuery}`;

      const ws = new WebSocket(wsUrl);
      terminalWsRef.current = ws;

      // Task 1: Keyboard Shortcuts (Ctrl+Insert / Cmd+Insert or Ctrl+C with selection to Copy; Shift+Insert / Cmd+V / Ctrl+Shift+V to Paste; Ctrl+C without selection sends SIGINT)
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== 'keydown') {
          return true;
        }

        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        // 1. Copy: Ctrl+Insert (or Cmd+Insert on Mac) OR Ctrl+C / Cmd+C when terminal has a text selection
        const isCopyInsert = isCtrlOrCmd && !event.shiftKey && event.key === 'Insert';
        const isCopyCtrlC = isCtrlOrCmd && !event.shiftKey && key === 'c' && term.hasSelection();

        if (isCopyInsert || isCopyCtrlC) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
            term.clearSelection();
          }
          event.preventDefault();
          event.stopPropagation();
          return false;
        }

        // Plain Ctrl+C without selection -> allow to pass through to WebSocket as SIGINT (\x03)
        if (event.ctrlKey && !event.shiftKey && key === 'c' && !term.hasSelection()) {
          return true;
        }

        // 2. Paste: Shift+Insert OR Cmd+V (on Mac) OR Ctrl+Shift+V
        const isShiftInsert = event.shiftKey && !event.ctrlKey && !event.metaKey && event.key === 'Insert';
        const isCmdV = event.metaKey && !event.ctrlKey && !event.shiftKey && key === 'v';
        const isCtrlShiftV = isCtrlOrCmd && event.shiftKey && key === 'v';

        if (isShiftInsert || isCmdV || isCtrlShiftV) {
          event.preventDefault();
          event.stopPropagation();
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text && ws.readyState === WebSocket.OPEN) {
                ws.send(text);
              }
            })
            .catch(() => {});
          return false;
        }

        // 3. Plain Ctrl+V: return false so XTerm does not send \x16 (SYN), while letting the browser fire the native 'paste' event handled below
        if (event.ctrlKey && !event.shiftKey && key === 'v') {
          return false;
        }

        return true;
      });

      // Task 2: Native Paste Event on terminalContainerRef (handles Ctrl+V and browser context menu Paste)
      const handleNativePaste = (pasteEvent: ClipboardEvent) => {
        pasteEvent.preventDefault();
        pasteEvent.stopPropagation();
        const pastedText = pasteEvent.clipboardData?.getData('text');
        if (pastedText && ws.readyState === WebSocket.OPEN) {
          ws.send(pastedText);
        }
      };

      container.addEventListener('paste', handleNativePaste, true);
      terminalPasteCleanupRef.current = () => {
        container.removeEventListener('paste', handleNativePaste, true);
      };

      ws.onopen = () => {
        setIsConnectingTerminal(false);
        // Clear sensitive credentials from React state immediately after sending auth payload
        setTerminalPassword('');
        setTerminalOtpCode('');
        setTerminalOtpSecondsLeft(0);

        ws.send(
          JSON.stringify({
            type: 'auth',
            password: passwordToAuth,
            otpCode: otpToAuth,
            cols: term.cols || 120,
            rows: term.rows || 32,
          })
        );
        term.focus();
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buf) => term.write(new Uint8Array(buf)));
        }
      };

      ws.onclose = (event) => {
        setIsConnectingTerminal(false);
        if (event.code === 4001) {
          disposeInteractiveTerminal();
          setTerminalStep('password');
          setTerminalPassword('');
          setTerminalOtpCode('');
          setTerminalFeedback({
            type: 'error',
            message:
              event.reason ||
              'Unauthorized (4001): Invalid password, expired/invalid 2FA OTP code, or expired session.',
          });
        } else {
          term.writeln(
            `\r\n\x1b[33m[WebSocket Disconnected — Code ${event.code}${
              event.reason ? `: ${event.reason}` : ''
            }]\x1b[0m`
          );
        }
        loadSandboxData();
      };

      ws.onerror = () => {
        setIsConnectingTerminal(false);
        term.writeln('\r\n\x1b[31m[WebSocket Connection Error]\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }, 50);
  };

  // Task 3: Custom Right-Click Context Menu Handlers for Terminal Copy / Paste
  const handleTerminalContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const menuWidth = 168;
    const menuHeight = 84;
    const clampedX = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const clampedY = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    const hasSelection = Boolean(xtermInstanceRef.current?.hasSelection());

    setTerminalContextMenu({
      visible: true,
      x: Math.max(8, clampedX),
      y: Math.max(8, clampedY),
      hasSelection,
    });
  };

  const handleContextMenuCopy = async () => {
    setTerminalContextMenu((prev) => ({ ...prev, visible: false }));
    const term = xtermInstanceRef.current;
    if (!term) return;
    const selectedText = term.getSelection();
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText);
        term.clearSelection();
      } catch {
        // ignore clipboard write error
      }
    }
    term.focus();
  };

  const handleContextMenuPaste = async () => {
    setTerminalContextMenu((prev) => ({ ...prev, visible: false }));
    const term = xtermInstanceRef.current;
    const ws = terminalWsRef.current;
    try {
      const text = await navigator.clipboard.readText();
      if (text && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(text);
      }
    } catch {
      // ignore clipboard read error
    }
    term?.focus();
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
              <span>AUTH: STEP-UP PASSWORD + EMAIL 2FA OTP</span>
            </div>
          </div>

          {/* Step 1 Form: Command Selection + Step-Up Owner Password -> Request 2FA OTP */}
          <form
            onSubmit={handleRequestCommand2fa}
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
                onChange={(e) => {
                  setSelectedCommandId(e.target.value);
                  if (isAwaitingOtp) {
                    resetCommand2faState();
                  }
                }}
                disabled={isRequesting2fa || isExecutingCommand}
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
                disabled={isRequesting2fa || isExecutingCommand || isAwaitingOtp}
                autoComplete="off"
                placeholder="Enter owner password to authorize"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
            </div>

            {/* Execute Command (Request 2FA Code) Button */}
            <div className="lg:col-span-3">
              <button
                type="submit"
                disabled={
                  isRequesting2fa ||
                  isExecutingCommand ||
                  isAwaitingOtp ||
                  !selectedCommandId ||
                  !stepUpPassword.trim()
                }
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRequesting2fa ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending 2FA Code...</span>
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

          {/* 2FA Status / Error Banner */}
          {otpFeedback && (
            <div
              className={`mt-4 p-3 rounded-md border text-xs font-mono flex items-center justify-between gap-3 ${
                otpFeedback.type === 'info'
                  ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800 text-rose-200'
              }`}
            >
              <div>
                <span className="font-bold mr-2">[{otpFeedback.code}]</span>
                <span>{otpFeedback.message}</span>
              </div>
              {isAwaitingOtp && otpSecondsRemaining > 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-emerald-700/60 text-emerald-300 shrink-0">
                  TTL: {Math.floor(otpSecondsRemaining / 60)}:
                  {String(otpSecondsRemaining % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          )}

          {/* Step 2 Form: 6-Digit Email 2FA OTP Verification & Final Execution */}
          {isAwaitingOtp && (
            <form
              onSubmit={handleConfirmAndExecuteCommand}
              className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950/90 border border-emerald-700/60 rounded-md p-4 items-end"
            >
              <div className="lg:col-span-6">
                <label
                  htmlFor="server-command-otp"
                  className="block text-xs font-medium text-emerald-300 mb-1.5"
                >
                  6-Digit Email 2FA OTP Code (Sent to{' '}
                  <code className="font-mono text-white">{statusData.owner.email}</code> — Single-Use)
                </label>
                <input
                  id="server-command-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isExecutingCommand}
                  autoFocus
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit OTP code (e.g. 482910)"
                  className="w-full px-3 py-2 bg-slate-900 border border-emerald-600/60 rounded-md text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="lg:col-span-4">
                <button
                  type="submit"
                  disabled={isExecutingCommand || otpCode.trim().length !== 6}
                  className="w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isExecutingCommand ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirming & Executing (10s max)...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Execute</span>
                    </>
                  )}
                </button>
              </div>

              <div className="lg:col-span-2">
                <button
                  type="button"
                  onClick={resetCommand2faState}
                  disabled={isExecutingCommand}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium text-xs rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

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

        {/* Interactive Root Web Terminal (No PuTTY Required) */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>Root Web Terminal (No PuTTY Required)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Spawns a direct local <code className="text-emerald-400 font-mono">/bin/bash</code>{' '}
                PTY session in <code className="text-slate-300 font-mono">/var/www/funnelcraft</code>{' '}
                over WebSocket (<code className="text-emerald-400 font-mono">node-pty</code> +{' '}
                <code className="text-emerald-400 font-mono">xterm.js</code>). Protected by active
                Sandbox session binding, Step-Up Owner Password, and Single-Use Email 2FA OTP.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenTerminalModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Launch Secure Terminal</span>
            </button>
          </div>
        </section>

        {/* SaaS Management: Dynamic Subscription Plans & Discount Coupons */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>SaaS Management (Dynamic Subscription Plans & Discount Coupons)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage live plan prices and feature lists (<code className="text-emerald-400 font-mono">data/plans.json</code>) and create or revoke promotional discount coupons (<code className="text-emerald-400 font-mono">data/coupons.json</code>). Protected by <code className="text-slate-300 font-mono">requireOwner</code> + <code className="text-slate-300 font-mono">requireCsrf</code>.
              </p>
            </div>

            {/* Tabs: Plans vs Coupons */}
            <div className="inline-flex rounded-md bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setSaasActiveTab('plans')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  saasActiveTab === 'plans'
                    ? 'bg-emerald-600 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Plans ({editablePlans.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSaasActiveTab('coupons')}
                className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  saasActiveTab === 'coupons'
                    ? 'bg-emerald-600 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Coupons ({couponsList.length})</span>
              </button>
            </div>
          </div>

          {saasActiveTab === 'plans' ? (
            <form onSubmit={handleSavePlans} className="space-y-5">
              {plansFeedback && (
                <div
                  className={`p-3 rounded-md border text-xs font-mono ${
                    plansFeedback.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  {plansFeedback.message}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {editablePlans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className="p-4 rounded-md bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono uppercase">
                          ID: {plan.id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Yearly: {Math.round(Number(plan.priceMAD || 0) * 0.8) * 12} MAD
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Plan Display Name
                        </label>
                        <input
                          type="text"
                          value={plan.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditablePlans((prev) =>
                              prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                            );
                          }}
                          required
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Monthly Price (MAD)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step="1"
                          value={plan.priceMAD}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setEditablePlans((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, priceMAD: val } : item
                              )
                            );
                          }}
                          required
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Features (One per line)
                        </label>
                        <textarea
                          rows={5}
                          value={plan.featuresText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditablePlans((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, featuresText: val } : item
                              )
                            );
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingPlans || editablePlans.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-md transition flex items-center gap-2 cursor-pointer"
                >
                  {isSavingPlans ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Plans...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save All Plans (PUT /api/sandbox/plans)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {couponsFeedback && (
                <div
                  className={`p-3 rounded-md border text-xs font-mono ${
                    couponsFeedback.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  {couponsFeedback.message}
                </div>
              )}

              {/* Create Coupon Form */}
              <form
                onSubmit={handleCreateCoupon}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 bg-slate-950 border border-slate-800 rounded-md p-4 items-end"
              >
                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={newCouponCode}
                    onChange={(e) =>
                      setNewCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                    }
                    placeholder="e.g. WELCOME20"
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={newCouponType}
                    onChange={(e) =>
                      setNewCouponType(e.target.value === 'fixed' ? 'fixed' : 'percentage')
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (MAD)</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Value ({newCouponType === 'percentage' ? '%' : 'MAD'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={newCouponType === 'percentage' ? 99 : 10000}
                    value={newCouponValue}
                    onChange={(e) => setNewCouponValue(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newCouponMaxUses}
                    onChange={(e) => setNewCouponMaxUses(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newCouponExpiresAt}
                    onChange={(e) => setNewCouponExpiresAt(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="lg:col-span-1">
                  <button
                    type="submit"
                    disabled={isCreatingCoupon || !newCouponCode.trim()}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded transition flex items-center justify-center gap-1 cursor-pointer"
                    title="Create Coupon"
                  >
                    {isCreatingCoupon ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Existing Coupons Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-md">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">CODE</th>
                      <th className="py-2.5 px-3">DISCOUNT</th>
                      <th className="py-2.5 px-3">USAGE (CURRENT / MAX)</th>
                      <th className="py-2.5 px-3">EXPIRES AT</th>
                      <th className="py-2.5 px-3">STATUS</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {couponsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No discount coupons configured.
                        </td>
                      </tr>
                    ) : (
                      couponsList.map((coupon) => {
                        const isExpired = new Date(coupon.expiresAt).getTime() <= Date.now();
                        const isExhausted = coupon.currentUses >= coupon.maxUses;
                        const isEffectiveActive = coupon.isActive && !isExpired && !isExhausted;

                        return (
                          <tr key={coupon.code} className="hover:bg-slate-950/60">
                            <td className="py-2.5 px-3 font-bold text-emerald-400">
                              {coupon.code}
                            </td>
                            <td className="py-2.5 px-3 text-white">
                              {coupon.discountType === 'percentage'
                                ? `${coupon.discountValue}% OFF`
                                : `${coupon.discountValue} MAD OFF`}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {coupon.currentUses} / {coupon.maxUses}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {new Date(coupon.expiresAt).toISOString().slice(0, 10)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isEffectiveActive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {isEffectiveActive
                                  ? 'ACTIVE'
                                  : isExpired
                                  ? 'EXPIRED'
                                  : isExhausted
                                  ? 'MAXED OUT'
                                  : 'DISABLED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteCoupon(coupon.code)}
                                disabled={deletingCouponCode === coupon.code}
                                className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Task 3: Security & Login Audit (Forensic Global Login Log + Merchant IP Visibility) */}
        <section
          className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5"
          data-testid="security-login-audit-section"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span>Security &amp; Login Audit</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ZERO-TRUST FORENSICS (MAX 5,000 ENTRIES)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time authentication forensics across Password, Google OAuth, and Sandbox Owner logins (`data/security_login_audit.json`), plus Merchant Public IP visibility.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSecuritySubTab('login_audit')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  securitySubTab === 'login_audit'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Global Login Log ({securityLoginLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSecuritySubTab('merchant_ips')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  securitySubTab === 'merchant_ips'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Merchant IP Visibility ({merchantIpSummaries.length})</span>
              </button>
            </div>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-md p-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={securityLogSearch}
                onChange={(e) => setSecurityLogSearch(e.target.value)}
                placeholder="Filter by User Email or Public IP Address (e.g. naadianajah2020@gmail.com or 196.200...)"
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {securitySubTab === 'login_audit' && (
              <div className="flex items-center gap-1.5">
                {(['ALL', 'SUCCESS', 'FAILED'] as const).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => setSecurityLogStatusFilter(statusOption)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                      securityLogStatusFilter === statusOption
                        ? statusOption === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : statusOption === 'FAILED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-800 text-white border border-slate-700'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {statusOption}
                  </button>
                ))}
              </div>
            )}
          </div>

          {securitySubTab === 'login_audit' ? (
            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">TIMESTAMP</th>
                    <th className="py-2.5 px-3">USER EMAIL</th>
                    <th className="py-2.5 px-3">PUBLIC IP</th>
                    <th className="py-2.5 px-3">DEVICE (USER-AGENT)</th>
                    <th className="py-2.5 px-3">AUTH METHOD</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(() => {
                    const q = securityLogSearch.trim().toLowerCase();
                    const filteredLogs = securityLoginLogs.filter((item) => {
                      if (
                        securityLogStatusFilter !== 'ALL' &&
                        item.status !== securityLogStatusFilter
                      ) {
                        return false;
                      }
                      if (!q) return true;
                      return (
                        String(item.userEmail || '').toLowerCase().includes(q) ||
                        String(item.ipAddress || '').toLowerCase().includes(q) ||
                        String(item.failureReason || '').toLowerCase().includes(q)
                      );
                    });

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            No forensic login audit entries match the current filter.
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.slice(0, 250).map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-950/60">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {entry.timestamp}
                        </td>
                        <td className="py-2.5 px-3 text-white font-semibold">
                          {entry.userEmail}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-300 whitespace-nowrap">
                          <span>{entry.ipAddress}</span>
                          {entry.location && (
                            <span className="ml-1.5 text-[10px] text-slate-400">
                              ({entry.location})
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-300 max-w-xs truncate"
                          title={entry.userAgent}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Monitor className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{entry.deviceInfo || entry.userAgent}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px] uppercase">
                            {entry.authMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.status === 'SUCCESS'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {entry.failureReason || (entry.status === 'SUCCESS' ? 'authenticated' : '—')}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">MERCHANT EMAIL</th>
                    <th className="py-2.5 px-3">STORE &amp; PLAN</th>
                    <th className="py-2.5 px-3">LAST LOGIN IP</th>
                    <th className="py-2.5 px-3">LAST LOGIN TIME</th>
                    <th className="py-2.5 px-3">DEVICE / USER-AGENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(() => {
                    const q = securityLogSearch.trim().toLowerCase();
                    const filteredMerchants = merchantIpSummaries.filter((m) => {
                      if (!q) return true;
                      return (
                        String(m.email || '').toLowerCase().includes(q) ||
                        String(m.lastLoginIp || '').toLowerCase().includes(q) ||
                        String(m.storeName || '').toLowerCase().includes(q)
                      );
                    });

                    if (filteredMerchants.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500">
                            No merchants match the current Email / IP filter.
                          </td>
                        </tr>
                      );
                    }

                    return filteredMerchants.map((merchant) => (
                      <tr key={merchant.id} className="hover:bg-slate-950/60">
                        <td className="py-2.5 px-3 text-white font-semibold">
                          <div>{merchant.email}</div>
                          <div className="text-[10px] text-slate-400">{merchant.fullName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <span>{merchant.storeName || '—'}</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px] uppercase">
                            {merchant.planId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">
                          {merchant.lastLoginIp ? (
                            <>
                              <span>{merchant.lastLoginIp}</span>
                              {merchant.lastLoginLocation && (
                                <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                                  ({merchant.lastLoginLocation})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-500 font-normal">No recorded IP yet</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                          {merchant.lastLoginAt || '—'}
                        </td>
                        <td
                          className="py-2.5 px-3 text-slate-400 max-w-xs truncate"
                          title={merchant.lastLoginUserAgent || ''}
                        >
                          {merchant.lastLoginUserAgent || '—'}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
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
                Records login attempts, lockouts, password recovery, pre-deploy check failures,
                local VPS deployments, and interactive terminal sessions.
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

      {/* Full-Screen Interactive Root Web Terminal Modal */}
      {isTerminalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col">
          {/* Modal Top Bar */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Interactive Root Web Terminal (/bin/bash)</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {terminalStep === 'connected' ? 'CONNECTED (PTY)' : 'STEP-UP + 2FA REQUIRED'}
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  OWNER: {statusData.owner.email} · CWD: /var/www/funnelcraft · ENDPOINT:
                  /api/sandbox/terminal
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseTerminalModal}
              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-200 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>{terminalStep === 'connected' ? 'Disconnect & Close' : 'Close'}</span>
            </button>
          </div>

          {/* Modal Body */}
          {terminalStep !== 'connected' ? (
            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Root Terminal Authorization Gate
                    </h4>
                    <p className="text-xs text-slate-400">
                      Verify your Owner Password and 6-digit Email 2FA code to spawn{' '}
                      <code className="text-emerald-400 font-mono">/bin/bash</code>.
                    </p>
                  </div>
                </div>

                {terminalFeedback && (
                  <div
                    className={`p-3 rounded-md border text-xs font-mono ${
                      terminalFeedback.type === 'info'
                        ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-800 text-rose-200'
                    }`}
                  >
                    {terminalFeedback.message}
                  </div>
                )}

                {terminalStep === 'password' ? (
                  <form onSubmit={handleRequestTerminal2fa} className="space-y-4">
                    <div>
                      <label
                        htmlFor="terminal-stepup-password"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Step 1: Owner Password
                      </label>
                      <input
                        id="terminal-stepup-password"
                        type="password"
                        value={terminalPassword}
                        onChange={(e) => setTerminalPassword(e.target.value)}
                        disabled={isRequestingTerminalOtp}
                        autoFocus
                        autoComplete="off"
                        placeholder="Enter current owner password"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isRequestingTerminalOtp || !terminalPassword.trim()}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isRequestingTerminalOtp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending 2FA Code to {statusData.owner.email}...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Request 2FA Code</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleConnectInteractiveTerminal} className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-300 bg-slate-950 px-3 py-2 rounded border border-slate-800">
                      <span>2FA OTP TARGET: {statusData.owner.email}</span>
                      <span>
                        TTL: {Math.floor(terminalOtpSecondsLeft / 60)}:
                        {String(terminalOtpSecondsLeft % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <div>
                      <label
                        htmlFor="terminal-otp-input"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Step 2: 6-Digit Email 2FA OTP Code (Single-Use)
                      </label>
                      <input
                        id="terminal-otp-input"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        value={terminalOtpCode}
                        onChange={(e) =>
                          setTerminalOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        disabled={isConnectingTerminal}
                        autoFocus
                        autoComplete="one-time-code"
                        placeholder="Enter 6-digit OTP code"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-emerald-600/60 rounded-md text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTerminalStep('password');
                          setTerminalOtpCode('');
                          setTerminalFeedback(null);
                        }}
                        className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md cursor-pointer"
                      >
                        Back
                      </button>

                      <button
                        type="submit"
                        disabled={isConnectingTerminal || terminalOtpCode.trim().length !== 6}
                        className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isConnectingTerminal ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connecting WebSocket PTY...</span>
                          </>
                        ) : (
                          <>
                            <Terminal className="w-4 h-4" />
                            <span>Connect & Spawn /bin/bash</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div
              onContextMenu={handleTerminalContextMenu}
              className="flex-1 p-3 bg-black overflow-hidden flex flex-col relative"
            >
              <div
                ref={terminalContainerRef}
                className="flex-1 w-full h-full rounded border border-slate-800 bg-black p-2 overflow-hidden"
              />

              {/* Custom Right-Click Context Menu for Copy / Paste */}
              {terminalContextMenu.visible && (
                <div
                  style={{ top: terminalContextMenu.y, left: terminalContextMenu.x }}
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-50 w-44 rounded-md bg-slate-900 border border-slate-700 shadow-2xl py-1 text-xs font-mono text-slate-200"
                >
                  <button
                    type="button"
                    onClick={handleContextMenuCopy}
                    disabled={!terminalContextMenu.hasSelection}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copy</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Ctrl+Insert</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleContextMenuPaste}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Paste</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Shift+Insert</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
