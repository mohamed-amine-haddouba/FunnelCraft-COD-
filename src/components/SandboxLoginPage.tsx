import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, KeyRound, AlertTriangle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

export const SANDBOX_TOKEN_STORAGE_KEY = 'fc_sandbox_owner_token';

export function SandboxLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const refreshCsrfToken = useCallback(async () => {
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
      // Handled on submit
    }
    return '';
  }, []);

  useEffect(() => {
    refreshCsrfToken();
  }, [refreshCsrfToken]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRecoveryNotice(null);
    setIsSubmitting(true);

    try {
      const activeCsrf = csrfToken || (await refreshCsrfToken());
      const res = await fetch('/api/sandbox/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': activeCsrf,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || 'Authentication failed.');
        await refreshCsrfToken();
        return;
      }

      if (data.sessionToken) {
        sessionStorage.setItem(SANDBOX_TOKEN_STORAGE_KEY, data.sessionToken);
      }

      navigate('/sandbox', { replace: true });
    } catch {
      setErrorMessage('Unable to reach authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRecoveryNotice(null);
    setIsSubmitting(true);

    try {
      const activeCsrf = csrfToken || (await refreshCsrfToken());
      const res = await fetch('/api/sandbox/recovery/request', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': activeCsrf,
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || 'Recovery request could not be processed.');
        await refreshCsrfToken();
        return;
      }

      setRecoveryNotice(
        data.message || 'If the email is authorized, a recovery link has been sent.'
      );
      await refreshCsrfToken();
    } catch {
      setErrorMessage('Unable to process password recovery request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="ltr"
      className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8 shadow-2xl">
        <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              FunnelCraft-COD Sandbox
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              OWNER CONTROL PLANE · RESTRICTED ACCESS
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-md bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {recoveryNotice && (
          <div
            role="status"
            className="mb-5 p-3.5 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{recoveryNotice}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label
                htmlFor="sandbox-owner-email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Owner Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="sandbox-owner-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@domain.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="sandbox-owner-password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('recovery');
                    setErrorMessage(null);
                    setRecoveryNotice(null);
                  }}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Recover owner password
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="sandbox-owner-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || !password}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Owner Credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Authenticate Sandbox Session (30m TTL)</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecoverySubmit} className="space-y-4" autoComplete="off">
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the owner email address. A single-use recovery link (valid for 20 minutes) will
              be dispatched via email.
            </p>
            <div>
              <label
                htmlFor="sandbox-recovery-email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Owner Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="sandbox-recovery-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@domain.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Request...</span>
                </>
              ) : (
                <span>Send Single-Use Recovery Link</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setRecoveryNotice(null);
              }}
              className="w-full py-2 px-4 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Owner Login</span>
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono flex items-center justify-between">
          <span>CSRF: PROTECTED</span>
          <span>·</span>
          <span>RATE LIMIT: 5/15M</span>
          <span>·</span>
          <span>AUDIT: ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
