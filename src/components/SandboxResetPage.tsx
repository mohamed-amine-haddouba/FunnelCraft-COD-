import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { SANDBOX_TOKEN_STORAGE_KEY } from './SandboxLoginPage';

export function SandboxResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verifyTokenAndFetchCsrf() {
      if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        if (mounted) {
          setTokenValid(false);
          setVerifying(false);
        }
        return;
      }

      try {
        const [verifyRes, csrfRes] = await Promise.all([
          fetch(`/api/sandbox/recovery/verify?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch('/api/sandbox/csrf', {
            method: 'GET',
            credentials: 'include',
          }),
        ]);

        const verifyData = await verifyRes.json();
        const csrfData = await csrfRes.json();

        if (!mounted) return;

        if (verifyRes.ok && verifyData.ok) {
          setTokenValid(true);
          if (csrfData.ok && csrfData.csrfToken) {
            setCsrfToken(csrfData.csrfToken);
          }
        } else {
          setTokenValid(false);
        }
      } catch {
        if (mounted) {
          setTokenValid(false);
        }
      } finally {
        if (mounted) {
          setVerifying(false);
        }
      }
    }

    verifyTokenAndFetchCsrf();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/sandbox/recovery/reset', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.message || 'Password reset failed.');
        if (res.status === 400) {
          setTokenValid(false);
        }
        return;
      }

      sessionStorage.removeItem(SANDBOX_TOKEN_STORAGE_KEY);
      localStorage.removeItem('funnelcraft_auth_token');
      setResetComplete(true);
    } catch {
      setErrorMessage('Unable to reach password reset service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div
        dir="ltr"
        className="min-h-screen w-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3 font-sans"
      >
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        <p className="text-xs font-mono text-slate-400">
          VERIFYING RECOVERY TOKEN SERVER-SIDE...
        </p>
      </div>
    );
  }

  // Server-side verification rejected the token: NEVER render the password reset form
  if (!tokenValid && !resetComplete) {
    return (
      <div
        dir="ltr"
        className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-sans"
      >
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4 text-rose-400">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <h1 className="text-base font-bold text-white">
              Invalid or Expired Recovery Link
            </h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            This password recovery token is invalid, has expired (20-minute limit), or has already
            been used. Single-use tokens are invalidated immediately upon use.
          </p>
          <button
            type="button"
            onClick={() => navigate('/sandbox/login', { replace: true })}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Return to Sandbox Login
          </button>
        </div>
      </div>
    );
  }

  if (resetComplete) {
    return (
      <div
        dir="ltr"
        className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-sans"
      >
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4 text-emerald-400">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <h1 className="text-base font-bold text-white">
              Owner Password Updated
            </h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Your owner password has been updated and all active sessions across the platform have
            been invalidated.
          </p>
          <button
            type="button"
            onClick={() => navigate('/sandbox/login', { replace: true })}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign In with New Password</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="ltr"
      className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-sans"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg p-8">
        <h1 className="text-base font-bold text-white mb-1">
          Reset Owner Sandbox Password
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Token verified. Setting a new password will immediately invalidate all active sessions.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-md bg-rose-950/60 border border-rose-800 text-rose-200 text-xs"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleResetSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label
              htmlFor="reset-new-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              New Password (minimum 8 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newPassword || !confirmPassword}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Update Password & Invalidate Sessions</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
