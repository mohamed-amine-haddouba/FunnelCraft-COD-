import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, Language } from '../i18n/translations';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  RefreshCw,
  Smartphone,
  Check,
  KeyRound,
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

type AuthViewMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

interface GoogleGsiAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme: string;
      size: string;
      shape: string;
      width: number;
      text: string;
    }
  ) => void;
}

interface GoogleGsiWindow extends Window {
  google?: {
    accounts?: {
      id?: GoogleGsiAccountsId;
    };
  };
}

let isGsiInitialized = false;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇲🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onSuccess }) => {
  const {
    login,
    register,
    loginWithGoogle,
    sendOtp,
    verifyOtp,
    twoFactorData,
    clearTwoFactorState,
  } = useAuth();

  const { t, language, setLanguage, dir, isRtl } = useLanguage();

  const [mode, setMode] = useState<AuthViewMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [simulate2fa, setSimulate2fa] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('+212 6');

  // Forgot & Reset Password State
  const [resetToken, setResetToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // 2FA OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email'>('email');
  const [resendTimer, setResendTimer] = useState<number>(60);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Detect URL parameters (?token=...&email=...) on mount for Reset Password view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const emailParam = params.get('email');

    if (tokenParam && emailParam) {
      setResetToken(tokenParam.trim());
      setResetEmail(emailParam.trim());
      setEmail(emailParam.trim());
      setMode('reset-password');
      setErrorMessage(null);
    }
  }, []);

  // Outside click for language dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync 2FA state when triggered
  useEffect(() => {
    if (twoFactorData?.isRequired) {
      setSelectedChannel('email');
      setResendTimer(60);
    }
  }, [twoFactorData]);

  // Resend Countdown Timer
  useEffect(() => {
    if (twoFactorData?.isRequired && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [twoFactorData?.isRequired, resendTimer]);

  // Google Identity Services (Official OAuth 2.0 JWT Flow)
  useEffect(() => {
    if (
      !GOOGLE_CLIENT_ID ||
      twoFactorData?.isRequired ||
      mode === 'forgot-password' ||
      mode === 'reset-password'
    ) {
      return;
    }

    const gsiWindow = window as unknown as GoogleGsiWindow;
    const scriptId = 'google-identity-client-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGoogleGsi = () => {
      const gsiId = gsiWindow.google?.accounts?.id;
      if (gsiId && googleBtnContainerRef.current) {
        try {
          if (!isGsiInitialized) {
            gsiId.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: async (response: { credential?: string }) => {
                if (response.credential) {
                  setIsLoading(true);
                  setErrorMessage(null);
                  const res = await loginWithGoogle(response.credential);
                  setIsLoading(false);
                  if (res.success) {
                    if (res.requires2FA) {
                      showToast(t.tfaCodeSentToast);
                    } else {
                      onSuccess?.();
                    }
                  } else {
                    setErrorMessage(res.error || 'فشل تسجيل الدخول عبر Google');
                  }
                }
              },
            });
            isGsiInitialized = true;
          }

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = '';
            gsiId.renderButton(googleBtnContainerRef.current, {
              theme: 'filled_black',
              size: 'large',
              shape: 'pill',
              width: 320,
              text: 'continue_with',
            });
          }
        } catch (err) {
          console.warn('Google GSI initialization notice:', err);
        }
      }
    };

    if (gsiWindow.google?.accounts?.id) {
      initGoogleGsi();
    } else if (script) {
      script.onload = initGoogleGsi;
    }
  }, [twoFactorData?.isRequired, mode, loginWithGoogle, onSuccess]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Password Strength Calculation (0 to 4)
  const passwordStrength = React.useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8 && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 1:
        return { label: t.authPasswordWeak, color: 'text-rose-400', bg: 'bg-rose-500' };
      case 2:
        return { label: t.authPasswordFair, color: 'text-amber-400', bg: 'bg-amber-500' };
      case 3:
        return { label: t.authPasswordGood, color: 'text-blue-400', bg: 'bg-blue-500' };
      case 4:
        return { label: t.authPasswordStrong, color: 'text-emerald-400', bg: 'bg-emerald-500' };
      default:
        return { label: '', color: 'text-slate-500', bg: 'bg-slate-700' };
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage(t.authRequiredFieldsError);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await login(email.trim(), password, {
      simulate2fa,
      trustDevice: rememberMe,
    });

    setIsLoading(false);

    if (res.success) {
      if (res.requires2FA) {
        showToast(t.tfaCodeSentToast);
      } else {
        onSuccess?.();
      }
    } else {
      setErrorMessage(res.error || 'Authentication failed');
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !fullName.trim()) {
      setErrorMessage(t.authRequiredFieldsError);
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t.authPasswordMinLengthError);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await register({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      storeName: storeName.trim() || undefined,
      phone: phone.trim() || undefined,
      twoFactorEnabled: false,
    });

    setIsLoading(false);

    if (res.success) {
      if (res.requires2FA) {
        showToast(t.tfaCodeSentToast);
      } else {
        onSuccess?.();
      }
    } else {
      setErrorMessage(res.error || 'Registration failed');
    }
  };

  // Submit Forgot Password
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني الخاص بك.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً.');
      } else {
        setForgotPasswordSubmitted(true);
      }
    } catch {
      setErrorMessage('تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين. يرجى التأكد من تطابقهما.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail || email.trim(),
          token: resetToken,
          newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(
          data.error || 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.'
        );
      } else {
        setResetPasswordSuccess(true);
        showToast('تم تغيير كلمة المرور بنجاح!');

        // Clean URL query parameters
        const cleanPath =
          window.location.pathname === '/reset-password' ? '/' : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);

        setTimeout(() => {
          setResetPasswordSuccess(false);
          setNewPassword('');
          setConfirmNewPassword('');
          setPassword('');
          setMode('login');
        }, 3000);
      }
    } catch {
      setErrorMessage('تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2FA OTP Digits Handling (auto-advance & paste support)
  const handleOtpDigitChange = (index: number, value: string) => {
    const char = value.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      handleVerifyOtpSubmit(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const newDigits = pasteData.split('');
      setOtpDigits(newDigits);
      otpInputsRef.current[5]?.focus();
      handleVerifyOtpSubmit(pasteData);
    }
  };

  // Verify OTP submission
  const handleVerifyOtpSubmit = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage(t.tfaInvalidCode);
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    const res = await verifyOtp(code, rememberMe);
    setIsVerifyingOtp(false);

    if (res.success) {
      showToast(t.tfaVerifiedToast);
      onSuccess?.();
    } else {
      setErrorMessage(res.error || t.tfaInvalidCode);
    }
  };

  // Resend OTP via Email
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    const res = await sendOtp(selectedChannel);
    setIsLoading(false);

    if (res.success) {
      setResendTimer(60);
      showToast(res.message || t.tfaCodeSentToast);
    } else {
      setErrorMessage(res.error || 'Failed to resend code');
    }
  };

  const currentLangObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden" dir={dir}>
      {/* Top Bar: Brand & Language Switcher */}
      <header className="h-14 px-4 sm:px-8 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/20">
            ⚡
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight text-white">{t.funnelCraft || 'CodWorth'}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t.codBadge}
            </span>
          </div>
        </div>

        {/* Language Switcher Dropdown */}
        <div className="relative" ref={langDropdownRef}>
          <button
            type="button"
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
          >
            <span>{currentLangObj.flag}</span>
            <span className="text-xs uppercase font-mono">{currentLangObj.code}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showLangDropdown && (
            <div className={`absolute ${isRtl ? 'start-0' : 'end-0'} top-10 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1 z-50 text-xs`}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    language === lang.code
                      ? 'bg-slate-800 text-emerald-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </div>
                  {language === lang.code && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed top-16 end-5 z-50 bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Split Portal Area */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch">
        {/* LEFT / FORM PANEL */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
          <div className="w-full max-w-md space-y-5">
            {/* 2FA OTP VERIFICATION VIEW */}
            {twoFactorData?.isRequired ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
                {/* 2FA Header */}
                <div className="text-center space-y-1">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-white pt-1">{t.tfaTitle}</h2>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">{t.tfaSub}</p>
                </div>

                {/* Device & Verification Fingerprint Badge */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{t.tfaDeviceVerified}</span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {twoFactorData.device?.browser || 'Chrome'} • {twoFactorData.device?.os || 'Windows/Mac'}
                  </span>
                </div>

                {/* Delivery Channel Selector: WhatsApp vs Email */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t.tfaSelectChannel}</span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      {t.tfaTtlBadge}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedChannel !== 'whatsapp') {
                          setSelectedChannel('whatsapp');
                          if (resendTimer === 0) sendOtp('whatsapp');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selectedChannel === 'whatsapp'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold shadow-xs'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" dir="ltr">
                        {twoFactorData.maskedPhone || '+212 6•• ••9201'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedChannel !== 'email') {
                          setSelectedChannel('email');
                          if (resendTimer === 0) sendOtp('email');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selectedChannel === 'email'
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-semibold shadow-xs'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                        <Mail className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Email</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" dir="ltr">
                        {twoFactorData.maskedEmail || twoFactorData.email || 'user@example.com'}
                      </div>
                    </button>
                  </div>
                </div>

                {/* 6 Individual Auto-Advancing Digit Inputs */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300 text-center">
                    {t.tfaOtpPlaceholder}
                  </label>
                  <div className="flex items-center justify-center gap-2" dir="ltr">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputsRef.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={idx === 0 ? handleOtpPaste : undefined}
                        className={`w-11 h-12 text-center text-lg font-bold font-mono rounded-xl bg-slate-950 border transition focus:outline-none ${
                          digit
                            ? 'border-emerald-500 text-white shadow-xs'
                            : 'border-slate-800 text-slate-400 focus:border-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Verify Submit Button */}
                <button
                  type="button"
                  onClick={() => handleVerifyOtpSubmit()}
                  disabled={isVerifyingOtp || otpDigits.includes('')}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t.tfaVerifyBtn}</span>
                    </>
                  )}
                </button>

                {/* Resend & Back Actions */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className="hover:text-emerald-400 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {resendTimer > 0
                        ? `${t.tfaResendIn} (${resendTimer}s)`
                        : t.tfaResendCode}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={clearTwoFactorState}
                    className="hover:text-slate-200 transition cursor-pointer"
                  >
                    {t.tfaBackToLogin}
                  </button>
                </div>
              </div>
            ) : mode === 'forgot-password' ? (
              /* FORGOT PASSWORD VIEW */
              <div
                dir="rtl"
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-sm space-y-5 text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-white">نسيت كلمة المرور؟</h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
                    </p>
                  </div>
                </div>

                {forgotPasswordSubmitted ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-emerald-200 mb-1">تم استلام طلبك بنجاح</p>
                        <p>إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordSubmitted(false);
                        setErrorMessage(null);
                        setMode('login');
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
                    >
                      العودة إلى تسجيل الدخول
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        البريد الإلكتروني المسجل *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="merchant@example.com"
                        dir="ltr"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>

                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <>
                          <span>إرسال رابط إعادة التعيين</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setMode('login');
                        }}
                        className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        العودة إلى تسجيل الدخول
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : mode === 'reset-password' ? (
              /* RESET PASSWORD VIEW */
              <div
                dir="rtl"
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-sm space-y-5 text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold text-white">تعيين كلمة مرور جديدة</h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      أدخل كلمة المرور الجديدة لحسابك ({resetEmail || email})
                    </p>
                  </div>
                </div>

                {resetPasswordSuccess ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-emerald-200 mb-1">
                          تم إعادة تعيين كلمة المرور بنجاح!
                        </p>
                        <p>سيتم تحويلك تلقائياً إلى صفحة تسجيل الدخول خلال 3 ثوانٍ...</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResetPasswordSuccess(false);
                        setMode('login');
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
                    >
                      الانتقال لتسجيل الدخول الآن
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        كلمة المرور الجديدة (8 أحرف على الأقل) *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          dir="ltr"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pe-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        تأكيد كلمة المرور الجديدة *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          dir="ltr"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pe-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <>
                          <span>حفظ كلمة المرور الجديدة</span>
                          <Check className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage(null);
                          setMode('login');
                        }}
                        className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        إلغاء والعودة لتسجيل الدخول
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* STANDARD LOGIN & REGISTRATION VIEW */
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-sm space-y-4">
                {/* Mode Segmented Tab Switcher */}
                <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMessage(null);
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      mode === 'login'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.authLoginTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMessage(null);
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      mode === 'register'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.authRegisterTab}
                  </button>
                </div>

                {/* Title & Description */}
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">
                    {mode === 'login' ? t.authTitleLogin : t.authTitleRegister}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mode === 'login' ? t.authSubLogin : t.authSubRegister}
                  </p>
                </div>

                {/* Form Body */}
                <form
                  onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit}
                  className="space-y-3"
                >
                  {/* Register extra fields */}
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          {t.authFullNameLabel} *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="محمد أمين"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            {t.authStoreNameLabel}
                          </label>
                          <input
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="متجر أطلس"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            {t.authPhoneLabel}
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+212 661-000000"
                            dir="ltr"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono transition"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {t.authEmailLabel} *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="merchant@example.com"
                        dir="ltr"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-300">
                        {t.authPasswordLabel} *
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage(null);
                            setForgotPasswordSubmitted(false);
                            setMode('forgot-password');
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        dir="ltr"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pe-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator for Register */}
                    {mode === 'register' && password && (
                      <div className="mt-1.5 space-y-1">
                        <div className="grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`h-1 rounded-full transition-all ${
                                step <= passwordStrength
                                  ? getStrengthLabel().bg
                                  : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">{t.authPasswordStrengthLabel}</span>
                          <span className={getStrengthLabel().color}>{getStrengthLabel().label}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remember Me & 2FA toggle options on login */}
                  {mode === 'login' && (
                    <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span>{t.authRememberMe}</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[11px] text-amber-400/90 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simulate2fa}
                          onChange={(e) => setSimulate2fa(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span>{t.twoFactorTitle}</span>
                      </label>
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <span>{mode === 'login' ? t.authSignInBtn : t.authSignUpBtn}</span>
                        <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative bg-slate-900 px-3 text-[11px] text-slate-500">
                    {t.authOrContinueWith}
                  </span>
                </div>

                {/* Official Google Sign-In Button (GSI) */}
                <div className="space-y-2">
                  {GOOGLE_CLIENT_ID ? (
                    <div
                      ref={googleBtnContainerRef}
                      id="google-signin-container"
                      className="flex justify-center w-full min-h-[42px]"
                    />
                  ) : (
                    <div className="w-full py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-500 text-[11px] text-center">
                      تسجيل الدخول عبر Google يتطلب ضبط <code className="font-mono text-slate-400">VITE_GOOGLE_CLIENT_ID</code>
                    </div>
                  )}
                </div>

                {/* Terms Notice */}
                <p className="text-[10px] text-slate-500 text-center leading-relaxed pt-1">
                  {t.authTermsNotice}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT / MOROCCAN COD PLATFORM SHOWCASE PANEL */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 border-s border-slate-800/80 p-12 flex-col justify-between relative overflow-hidden">
          {/* Subtle Background Glows */}
          <div className="absolute top-1/4 start-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 end-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Badge */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.authShowcaseBadge}</span>
            </div>
          </div>

          {/* Center Showcase Content */}
          <div className="max-w-md space-y-6">
            <h2 className="text-2xl font-black text-white leading-tight">
              {t.authShowcaseTitle}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t.authShowcaseDesc}
            </p>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-sm">
                <div className="text-lg font-bold text-emerald-400">
                  {t.authShowcaseStat1Title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t.authShowcaseStat1Sub}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-sm">
                <div className="text-lg font-bold text-teal-400">
                  {t.authShowcaseStat2Title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {t.authShowcaseStat2Sub}
                </div>
              </div>
            </div>

            {/* Top Moroccan Cities Badges */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t.authTopMoroccanCities}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {['الدار البيضاء', 'الرباط', 'مراكش', 'طنجة', 'فاس', 'أكادير', 'تطوان'].map((city) => (
                  <span
                    key={city}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 text-[11px] font-medium"
                  >
                    📍 {city}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Trust Footer */}
          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-4">
            <span>© {new Date().getFullYear()} CodWorth Platform</span>
            <span>Casablanca • Morocco</span>
          </div>
        </div>
      </main>
    </div>
  );
};
