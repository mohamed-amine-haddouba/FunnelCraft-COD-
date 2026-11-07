import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { executeRecaptcha, preloadRecaptchaScript } from '../utils/recaptcha';
import { useLanguage } from '../i18n/translations';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dir } = useLanguage();

  const searchParams = new URLSearchParams(location.search);
  const initialEmail =
    searchParams.get('email') ||
    (location.state as { email?: string } | null)?.email ||
    '';

  const [email, setEmail] = useState<string>(initialEmail.trim());
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState<boolean>(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileLoadError, setTurnstileLoadError] = useState<boolean>(false);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const isAdminBypass = import.meta.env.VITE_BYPASS_CAPTCHA === 'true';
  const shouldRequireTurnstileForResend =
    Boolean(TURNSTILE_SITE_KEY) && !isAdminBypass && !turnstileLoadError;

  useEffect(() => {
    void preloadRecaptchaScript();
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setErrorMsg(null);

    if (clean && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    const combined = next.join('');
    if (combined.length === 6 && !next.includes('')) {
      void submitVerificationCode(combined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setErrorMsg(null);
    const focusIndex = Math.min(pasted.length, 5);
    inputsRef.current[focusIndex]?.focus();
    if (pasted.length === 6) {
      void submitVerificationCode(pasted);
    }
  };

  const submitVerificationCode = async (overrideCode?: string) => {
    const code = (overrideCode ?? digits.join('')).trim();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أولاً.');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('يرجى إدخال رمز التحقق المكون من 6 أرقام.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          code,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifiedSuccess(true);
        setSuccessMsg(
          data.message_ar || 'تم تأكيد بريدك الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.'
        );
        setTimeout(() => {
          navigate(`/login?verified=1&email=${encodeURIComponent(normalizedEmail)}`, {
            replace: true,
          });
        }, 1500);
      } else {
        setErrorMsg(
          data.message_ar ||
            data.error ||
            'رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى المحاولة مرة أخرى.'
        );
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أولاً.');
      return;
    }
    if (cooldown > 0 || isResending) return;

    if (shouldRequireTurnstileForResend && !turnstileToken) {
      setErrorMsg('يرجى إتمام التحقق الأمني (CAPTCHA) لإعادة إرسال الرمز.');
      return;
    }

    setIsResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const recaptchaToken = isAdminBypass
        ? undefined
        : await executeRecaptcha('resend_verification');

      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          recaptchaToken,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();
      setTurnstileToken(null);
      turnstileRef.current?.reset();

      if (res.ok && data.success) {
        setCooldown(60);
        setDigits(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
        setSuccessMsg(
          data.message_ar ||
            'إذا كان البريد مسجلاً وغير مؤكد، فقد تم إرسال رمز جديد'
        );
      } else {
        setErrorMsg(
          data.message_ar || data.error || 'تعذر إعادة إرسال الرمز حالياً. يرجى المحاولة لاحقاً.'
        );
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم أثناء إعادة إرسال الرمز.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      dir={dir || 'rtl'}
      className="min-h-screen w-screen bg-[#0D131E] text-[#F8FAFC] flex flex-col justify-between font-sans select-none overflow-x-hidden"
    >
      {/* Header */}
      <header className="h-14 px-4 sm:px-8 border-b border-[#1E293B]/80 bg-[#0D131E]/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E25B26] to-[#F16F3C] text-[#F8FAFC] flex items-center justify-center font-black text-sm shadow-md shadow-[#E25B26]/20">
            ⚡
          </div>
          <span className="font-bold text-sm tracking-tight text-white">CodWorth</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-xs font-semibold text-[#CBD5E1] hover:text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <span>العودة لتسجيل الدخول</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-[#131B2A]/90 border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-right" dir="rtl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#E25B26] flex items-center justify-center mx-auto shadow-inner">
              <Mail className="w-7 h-7" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              تأكيد البريد الإلكتروني
            </h1>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              أرسلنا رمز تحقق مكون من 6 أرقام إلى{' '}
              <span className="font-mono font-bold text-[#E25B26]" dir="ltr">
                {email || 'بريدك الإلكتروني'}
              </span>
            </p>
          </div>

          {!initialEmail && (
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                البريد الإلكتروني المسجل
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                dir="ltr"
                className="w-full bg-[#0D131E] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E25B26] transition text-left"
              />
            </div>
          )}

          {/* 6-Digit Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#CBD5E1] text-center">
              أدخل الرمز المكون من 6 أرقام (صالح لمدة 15 دقيقة)
            </label>
            <div className="flex items-center justify-center gap-2" dir="ltr">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  disabled={isSubmitting || verifiedSuccess}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  aria-label={`Digit ${idx + 1}`}
                  className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black font-mono rounded-xl bg-[#0D131E] border transition focus:outline-none ${
                    digit
                      ? 'border-[#E25B26] text-[#E25B26] shadow-sm shadow-[#E25B26]/10'
                      : 'border-[#1E293B] text-white focus:border-[#E25B26]'
                  }`}
                />
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#E25B26] text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#E25B26] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Verify Button */}
          <button
            type="button"
            onClick={() => void submitVerificationCode()}
            disabled={isSubmitting || verifiedSuccess || digits.join('').length !== 6}
            className="w-full py-3 rounded-xl text-xs font-black bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] shadow-lg shadow-[#E25B26]/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>تأكيد البريد الإلكتروني (Verify)</span>
              </>
            )}
          </button>

          {/* Turnstile Widget for Resend if Cooldown Expired */}
          {cooldown === 0 && TURNSTILE_SITE_KEY && !isAdminBypass && (
            <div className="flex justify-center pt-1" dir="ltr">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setTurnstileLoadError(false);
                }}
                onExpire={() => setTurnstileToken(null)}
                onError={() => {
                  setTurnstileToken(null);
                  setTurnstileLoadError(true);
                }}
                options={{ theme: 'dark', size: 'normal' }}
              />
            </div>
          )}

          {/* Resend & Back Footer */}
          <div className="pt-2 border-t border-[#1E293B]/80 flex items-center justify-between text-xs text-[#CBD5E1]">
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={cooldown > 0 || isResending || verifiedSuccess}
              className="hover:text-[#E25B26] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>
                {cooldown > 0
                  ? `إعادة إرسال الرمز (${cooldown}ث)`
                  : 'إعادة إرسال الرمز'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-white transition cursor-pointer"
            >
              تسجيل الدخول بحساب آخر
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VerifyEmailPage;
