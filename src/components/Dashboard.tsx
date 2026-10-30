import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Globe,
  Clock,
  Monitor,
  MapPin,
  RefreshCw,
  Copy,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface SecurityContextPayload {
  ok?: boolean;
  success?: boolean;
  currentIp: string;
  currentLocation: string;
  currentUserAgent: string;
  currentDevice: string;
  currentBrowser?: string;
  currentOs?: string;
  securityNotice: string;
  lastLogin: {
    ip?: string;
    ipAddress?: string;
    timestamp: string | null;
    location: string;
    userAgent?: string;
    device: string;
  } | null;
}

interface UserIpTransparencyWidgetProps {
  compact?: boolean;
}

export const UserIpTransparencyWidget: React.FC<UserIpTransparencyWidgetProps> = ({
  compact = false,
}) => {
  const { user } = useAuth();
  const [contextData, setContextData] = useState<SecurityContextPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedIp, setCopiedIp] = useState<boolean>(false);

  const fetchSecurityContext = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('funnelcraft_auth_token');
      const res = await fetch('/api/auth/security-context', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = (await res.json()) as SecurityContextPayload;
        if (data && (data.ok || data.success)) {
          setContextData(data);
        }
      }
    } catch {
      // Fallback to user profile metadata if offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSecurityContext();
  }, [fetchSecurityContext, user?.id]);

  const currentIp = contextData?.currentIp || user?.lastLoginIp || 'Detecting...';
  const currentLocation =
    contextData?.currentLocation || user?.lastLoginLocation || 'Resolved via Edge Proxy';
  const currentDevice =
    contextData?.currentDevice || user?.lastLoginUserAgent || navigator.userAgent;

  const lastLoginIp =
    contextData?.lastLogin?.ip ||
    contextData?.lastLogin?.ipAddress ||
    user?.lastLoginIp ||
    currentIp;
  const lastLoginTimeRaw = contextData?.lastLogin?.timestamp || user?.lastLoginAt || null;
  const lastLoginTimeFormatted = lastLoginTimeRaw
    ? new Date(lastLoginTimeRaw).toLocaleString()
    : 'Current active session';
  const lastLoginLocation =
    contextData?.lastLogin?.location || user?.lastLoginLocation || currentLocation;
  const lastLoginDevice =
    contextData?.lastLogin?.device ||
    contextData?.lastLogin?.userAgent ||
    user?.lastLoginUserAgent ||
    currentDevice;

  const handleCopyCurrentIp = () => {
    if (!currentIp || currentIp === 'Detecting...') return;
    navigator.clipboard?.writeText(currentIp).catch(() => {});
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div
      dir="ltr"
      className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 md:p-5 text-left space-y-4 shadow-sm"
      data-testid="user-ip-transparency-widget"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs md:text-sm font-bold text-white tracking-tight">
                Zero-Trust Account Security & IP Transparency
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ACTIVE SESSION MONITORED
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This IP is recorded for security purposes to protect your account from unauthorized access.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchSecurityContext()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-mono transition cursor-pointer disabled:opacity-50"
          title="Refresh Real Public IP & Session Telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh IP</span>
        </button>
      </div>

      {/* Prominent Current Public IP Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs md:text-sm font-mono font-bold text-white">
            Your Current IP Address:{' '}
            <span className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-4">
              {currentIp}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
            <MapPin className="w-3 h-3 text-teal-400" />
            <span>{currentLocation}</span>
          </span>
          <button
            type="button"
            onClick={handleCopyCurrentIp}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono transition cursor-pointer"
          >
            {copiedIp ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy IP</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Login Forensic Details (Time, IP, Location, Device) */}
      {!compact && (
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Last Login Forensic Record</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3 space-y-1">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Last Login Time</span>
              </div>
              <div className="font-mono text-slate-100 font-semibold truncate">
                {lastLoginTimeFormatted}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3 space-y-1">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Last Login IP & Location</span>
              </div>
              <div className="font-mono text-emerald-300 font-semibold truncate">
                {lastLoginIp}{' '}
                <span className="text-slate-400 font-normal">({lastLoginLocation})</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3 space-y-1">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-amber-400" />
                <span>Last Login Device (User-Agent)</span>
              </div>
              <div
                className="font-mono text-slate-200 truncate text-[11px]"
                title={lastLoginDevice}
              >
                {lastLoginDevice}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <UserIpTransparencyWidget />
    </div>
  );
};

export default Dashboard;
