import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User as UserIcon, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { executeRecaptcha, preloadRecaptchaScript } from '../utils/recaptcha';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signup',
}) => {
  const { login, register, loginWithGoogle } = useAuth();
  
  // Normalize initial mode between signin/login and signup/register
  const normalizedInitialMode = initialMode === 'login' || initialMode === 'signin' ? 'signin' : 'signup';
  const [mode, setMode] = useState<'signin' | 'signup'>(normalizedInitialMode);
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  // Sync mode whenever initialMode changes while opened
  useEffect(() => {
    if (isOpen) {
      void preloadRecaptchaScript();
      setMode(initialMode === 'login' || initialMode === 'signin' ? 'signin' : 'signup');
      setLocalError(null);
      setSuccessNotice(null);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  }, [mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessNotice(null);

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setLocalError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 6) {
      setLocalError('كلمة المرور يجب أن تتكون من 6 أحرف على الأقل');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setLocalError('يرجى إدخال الاسم الكامل لإنشاء الحساب');
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setLocalError('يرجى إتمام التحقق الأمني (CAPTCHA) للمتابعة');
      return;
    }

    setIsSubmitting(true);

    try {
      const recaptchaToken = await executeRecaptcha(mode === 'signup' ? 'register' : 'login');

      if (mode === 'signup') {
        const res = await register(
          email.trim(),
          password,
          fullName.trim(),
          turnstileToken || undefined,
          recaptchaToken
        );
        if (res && res.success) {
          onClose();
        } else {
          setLocalError(res?.error || 'تعذر إنشاء الحساب، قد يكون البريد الإلكتروني مستخدماً بالفعل');
        }
      } else {
        const res = await login(email.trim(), password, {
          recaptchaToken,
          turnstileToken: turnstileToken || undefined,
        });
        if (res && res.success) {
          onClose();
        } else {
          setLocalError(res?.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }
      }
    } catch (err: any) {
      // Smart fallback to prevent raw 'Failed to fetch' error popups
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setLocalError('تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة');
      } else {
        setLocalError(msg || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى');
      }
    } finally {
      setIsSubmitting(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-right" 
        dir="rtl"
      >
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-5 left-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-7 md:p-8">
          {/* أيقونة وعنوان المودال */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'signup' ? 'إنشاء حساب مجاني جديد' : 'تسجيل الدخول'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {mode === 'signup' 
                ? 'احصل فوراً على صفحتين مجاناً لتصميم صفحات هبوط احترافية ومربحة' 
                : 'أهلاً بك مجدداً في منصة CodWorth! أدخل بياناتك للمتابعة'}
            </p>
          </div>

          {/* التبديل بين تسجيل الدخول وإنشاء حساب */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => { 
                setMode('signin'); 
                setLocalError(null); 
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer text-center ${
                mode === 'signin' 
                  ? 'bg-white text-slate-900 shadow-sm font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => { 
                setMode('signup'); 
                setLocalError(null); 
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer text-center ${
                mode === 'signup' 
                  ? 'bg-white text-emerald-700 shadow-sm font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              حساب جديد (2 صفحات مجاناً)
            </button>
          </div>

          {/* رسالة الخطأ في حال وجوده */}
          {localError && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="flex-1">{localError}</span>
            </div>
          )}

          {/* رسالة النجاح */}
          {successNotice && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="flex-1">{successNotice}</span>
            </div>
          )}

          {/* الاستمارة */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
            {mode === 'signup' && (
              <div>
                <label className="block text-slate-700 mb-1.5 font-bold">الاسم الكامل</label>
                <div className="relative">
                  <UserIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="محمد أمين"
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 text-xs transition placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 text-xs transition placeholder:text-slate-400 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-bold text-slate-700">كلمة المرور</label>
                {mode === 'signin' && (
                  <span className="text-[11px] text-slate-400">
                    (6 أحرف على الأقل)
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900 text-xs transition placeholder:text-slate-400 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center pt-1" dir="ltr">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                  options={{ theme: 'light', size: 'normal' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-3"
            >
              <span>
                {isSubmitting
                  ? 'جاري المعالجة...'
                  : mode === 'signup'
                  ? 'إنشاء حساب مجاني (صفحتين مجاناً)'
                  : 'تسجيل الدخول إلى حسابك'}
              </span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">أو المتابعة عبر</span>
              <div className="flex justify-center w-full" dir="ltr">
                <GoogleLogin
                  onSuccess={async (credentialResponse: CredentialResponse) => {
                    if (!credentialResponse.credential) return;
                    setIsSubmitting(true);
                    setLocalError(null);
                    const res = await loginWithGoogle(credentialResponse.credential);
                    setIsSubmitting(false);
                    if (res.success) {
                      onClose();
                    } else {
                      setLocalError(res.error || 'فشل تسجيل الدخول عبر Google');
                    }
                  }}
                  onError={() => {
                    setLocalError('تعذر تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.');
                  }}
                  theme="outline"
                  size="large"
                  shape="pill"
                  width="300"
                  text="continue_with"
                />
              </div>
            </div>
          )}

          {/* شارة الثقة والأمان */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>بياناتك محمية ومشفرة 100% • لا حاجة لبطاقة بنكية للبدء</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AuthModal;
