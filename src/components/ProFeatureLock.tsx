import React from 'react';
import { Crown, Lock, Sparkles, ArrowLeft } from 'lucide-react';

interface Props {
  isLocked: boolean;
  title?: string;
  description?: string;
  badgeText?: string;
  buttonText?: string;
  onUpgradeClick: () => void;
  children: React.ReactNode;
  blurIntensity?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProFeatureLock: React.FC<Props> = ({
  isLocked,
  title = 'ميزة حصرية لمشتركي باقة Pro 👑',
  description = 'قم بترقية حسابك للوصول غير المحدود إلى هذه الميزة المتقدمة ومضاعفة مبيعات متجرك.',
  badgeText = 'Pro Feature 👑',
  buttonText = 'افتح الميزة - ترقية إلى Pro',
  onUpgradeClick,
  children,
  blurIntensity = 'md',
  className = '',
}) => {
  if (!isLocked) {
    return <>{children}</>;
  }

  const blurClass =
    blurIntensity === 'sm'
      ? 'blur-[2px]'
      : blurIntensity === 'lg'
      ? 'blur-[6px]'
      : 'blur-[4px]';

  return (
    <div className={`relative overflow-hidden group ${className}`} dir="rtl">
      {/* Blurred & Interactivity Disabled Content */}
      <div className={`pointer-events-none select-none opacity-40 transition-all ${blurClass}`}>
        {children}
      </div>

      {/* Modern Glassmorphic Pro Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-20 bg-slate-950/60 backdrop-blur-[2px] transition-all">
        <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 text-center shadow-2xl shadow-amber-500/10 backdrop-blur-md relative overflow-hidden transform hover:scale-[1.01] transition-all">
          {/* Subtle Background Glow */}
          <div className="absolute -top-12 -start-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -end-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-black uppercase tracking-wider mb-3">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>{badgeText}</span>
          </div>

          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Lock className="w-6 h-6 text-amber-300" />
          </div>

          <h3 className="text-base font-black text-white mb-1.5 flex items-center justify-center gap-1.5">
            <span>{title}</span>
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            {description}
          </p>

          <button
            type="button"
            onClick={onUpgradeClick}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-98"
          >
            <Crown className="w-4 h-4 text-slate-950" />
            <span>{buttonText}</span>
            <ArrowLeft className="w-4 h-4 text-slate-950 ms-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
