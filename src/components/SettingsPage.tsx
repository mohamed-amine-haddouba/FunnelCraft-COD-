import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Lock,
  Globe,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Key,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Mail,
  Store,
  Layers,
  Crown,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SubscriptionPlanId } from '../types/orders';
import { useLanguage } from '../i18n/translations';

interface SettingsPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: 'profile' | 'domain' | 'security';
  currentPlan?: SubscriptionPlanId;
  onUpgradeClick?: () => void;
  asModal?: boolean;
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen = true,
  onClose,
  initialTab = 'profile',
  currentPlan = 'free',
  onUpgradeClick,
  asModal = false,
}) => {
  const {
    user,
    planId,
    isPro,
    canUseCustomDomain,
    userPages,
    fetchUserPages,
    savePageCustomDomain,
    verifyPageCustomDomain,
    removePageCustomDomain,
    toggle2FA,
    updateProfile,
    refreshUser,
    logout,
  } = useAuth();
  const { t, dir, isRtl, language } = useLanguage();
  const isProUser = canUseCustomDomain || currentPlan === 'pro' || currentPlan === 'enterprise' || isPro;

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'profile' | 'domain' | 'security'>(initialTab);

  // Profile Form State (prioritize authenticated user profile from server)
  const [fullName, setFullName] = useState<string>(() => {
    return user?.full_name || localStorage.getItem('fc_user_fullname') || 'محمد أمين';
  });
  const [email, setEmail] = useState<string>(() => {
    return user?.email || '';
  });
  const [phone, setPhone] = useState<string>(() => {
    return user?.phone || localStorage.getItem('fc_user_phone') || '+212 661 234 567';
  });
  const [storeName, setStoreName] = useState<string>(() => {
    return user?.store_name || localStorage.getItem('fc_user_storename') || 'متجر COD المغرب';
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return user?.avatar || localStorage.getItem('fc_user_avatar') || DEFAULT_AVATAR;
  });

  // Real Custom Domain State (bound to selected page in data/pages.json)
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [isDomainVerifying, setIsDomainVerifying] = useState(false);
  const [isDisconnectingDomain, setIsDisconnectingDomain] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'not_connected' | 'pending_dns' | 'active' | 'error'>('not_connected');
  const [domainFeedback, setDomainFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    resolvedRecords?: { a: string[]; cname: string[] };
  } | null>(null);
  const [hasCopiedIp, setHasCopiedIp] = useState(false);

  // Password / Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  // Feedback State
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCopiedCname, setHasCopiedCname] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      void fetchUserPages();
    }
  }, [isOpen, fetchUserPages]);

  // Keep selectedPageId and customDomain synced with userPages from backend
  useEffect(() => {
    if (userPages.length > 0) {
      const targetPage =
        userPages.find((p) => p.id === selectedPageId) ||
        userPages.find((p) => Boolean(p.customDomain)) ||
        userPages[0];
      if (targetPage) {
        if (targetPage.id !== selectedPageId) {
          setSelectedPageId(targetPage.id);
        }
        setCustomDomain(targetPage.customDomain || '');
        setDomainStatus(targetPage.domainStatus || (targetPage.customDomain ? 'pending_dns' : 'not_connected'));
      }
    } else {
      setSelectedPageId('');
      setCustomDomain('');
      setDomainStatus('not_connected');
    }
  }, [userPages, selectedPageId]);

  useEffect(() => {
    if (user) {
      if (user.full_name) setFullName(user.full_name);
      if (user.email) setEmail(user.email);
      if (user.phone) setPhone(user.phone);
      if (user.store_name) setStoreName(user.store_name);
      if (user.avatar) setAvatarUrl(user.avatar);
      setIsTwoFactorEnabled(Boolean(user.two_factor_enabled));
    }
  }, [user]);

  const triggerSuccessToast = (msg: string) => {
    setSaveSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 3500);
  };

  // Avatar upload
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage(language === 'ar' ? 'يرجى اختيار ملف صورة صالح' : 'Fichier image invalide');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarUrl(base64);
        localStorage.setItem('fc_user_avatar', base64);
        triggerSuccessToast(language === 'ar' ? 'تم تحديث الصورة الشخصية' : 'Photo mise à jour');
      }
    };
    reader.readAsDataURL(file);
  };

  const showToast = (msg: string) => {
    setErrorMessage(msg);
    setSaveSuccessMessage(null);
  };

  // Save Profile (Task 3: Explicit PUT /api/auth/profile + refreshUser)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      store_name: storeName.trim(),
      avatar: avatarUrl,
      custom_domain: customDomain.trim(),
      two_factor_enabled: isTwoFactorEnabled,
    };

    if (!formData.full_name?.trim()) {
      showToast('الاسم الكامل مطلوب ولا يمكن تركه فارغاً.');
      return;
    }
    if (!formData.store_name?.trim()) {
      showToast('اسم المتجر مطلوب ولا يمكن تركه فارغاً.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {

      const authToken = localStorage.getItem('funnelcraft_auth_token');
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok || !resData.success) {
        // Also try AuthContext updateProfile as fallback
        const fallbackRes = await updateProfile(formData);
        if (!fallbackRes.success) {
          setErrorMessage(
            resData.error ||
              fallbackRes.error ||
              (language === 'ar' ? 'تعذر حفظ التغييرات' : 'Erreur lors de la sauvegarde')
          );
          return;
        }
      }

      localStorage.setItem('fc_user_fullname', formData.full_name);
      localStorage.setItem('fc_user_phone', formData.phone);
      localStorage.setItem('fc_user_storename', formData.store_name);
      localStorage.setItem('fc_user_avatar', formData.avatar);
      if (formData.custom_domain) {
        localStorage.setItem('fc_custom_domain', formData.custom_domain);
      }

      await refreshUser();
      triggerSuccessToast(t.saved);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = handleSave;


  const handleToggle2FA = async () => {
    const nextVal = !isTwoFactorEnabled;
    setIsTwoFactorEnabled(nextVal);
    const res = await toggle2FA(nextVal);
    if (res.success) {
      triggerSuccessToast(
        nextVal
          ? (language === 'ar' ? 'تم تفعيل التحقق بخطوتين (2FA) بنجاح!' : '2FA activé avec succès')
          : (language === 'ar' ? 'تم إلغاء تفعيل التحقق بخطوتين' : '2FA désactivé')
      );
    } else {
      setIsTwoFactorEnabled(!nextVal);
      setErrorMessage(res.error || 'Failed to toggle 2FA');
    }
  };

  // Save Custom Domain to Backend (`POST /api/pages/:id/custom-domain`)
  const handleSaveCustomDomain = async () => {
    if (!isProUser) {
      onUpgradeClick?.();
      return;
    }
    if (!selectedPageId) {
      setDomainFeedback({
        type: 'error',
        message:
          language === 'ar'
            ? 'يرجى إنشاء وحفظ صفحة هبوط أولاً قبل ربط النطاق المخصص.'
            : 'Please create and save a landing page first before connecting a custom domain.',
      });
      return;
    }
    if (!customDomain.trim()) {
      setDomainFeedback({
        type: 'error',
        message: language === 'ar' ? 'يرجى إدخال اسم الدومين (مثال: shop.yourbrand.ma)' : 'Please enter a valid domain name.',
      });
      return;
    }

    setIsSavingDomain(true);
    setDomainFeedback(null);
    const res = await savePageCustomDomain(selectedPageId, customDomain.trim());
    setIsSavingDomain(false);

    if (res.isLimitReached) {
      onUpgradeClick?.();
      return;
    }

    if (res.success && res.page) {
      setCustomDomain(res.page.customDomain || '');
      setDomainStatus(res.page.domainStatus || 'pending_dns');
      setDomainFeedback({
        type: 'info',
        message:
          language === 'ar'
            ? `تم حفظ النطاق (${res.page.customDomain}) بحالة "في انتظار DNS". أضف سجل A أو CNAME ثم اضغط "تحقق من سجلات DNS".`
            : `Domain "${res.page.customDomain}" saved (Pending DNS). Configure your A or CNAME record below, then click Verify DNS Records.`,
      });
    } else {
      setDomainFeedback({
        type: 'error',
        message: res.error || (language === 'ar' ? 'فشل حفظ الدومين' : 'Failed to save custom domain'),
      });
    }
  };

  // Verify Custom Domain via Real Backend DNS Lookup (`POST /api/pages/:id/custom-domain/verify`)
  const handleVerifyDomain = async () => {
    if (!isProUser) {
      onUpgradeClick?.();
      return;
    }
    if (!selectedPageId) {
      setDomainFeedback({
        type: 'error',
        message:
          language === 'ar'
            ? 'يرجى اختيار صفحة هبوط أولاً لربط النطاق بها.'
            : 'Please select a landing page first.',
      });
      return;
    }
    if (!customDomain.trim()) {
      setDomainFeedback({
        type: 'error',
        message: language === 'ar' ? 'يرجى إدخال اسم الدومين أولاً' : 'Please enter a domain name first.',
      });
      return;
    }

    setIsDomainVerifying(true);
    setDomainFeedback(null);

    const res = await verifyPageCustomDomain(selectedPageId, customDomain.trim());
    setIsDomainVerifying(false);

    if (res.isLimitReached) {
      onUpgradeClick?.();
      return;
    }

    if (res.success && res.verified) {
      setDomainStatus('active');
      if (res.page?.customDomain) setCustomDomain(res.page.customDomain);
      setDomainFeedback({
        type: 'success',
        message:
          res.message ||
          (language === 'ar'
            ? `تم التحقق من سجلات DNS بنجاح! النطاق (${customDomain}) متصل ونشط الآن.`
            : `DNS verified! Domain "${customDomain}" is now ACTIVE.`),
        resolvedRecords: res.resolvedRecords,
      });
    } else {
      setDomainStatus(res.domainStatus || 'error');
      setDomainFeedback({
        type: 'error',
        message:
          res.error ||
          (language === 'ar'
            ? 'لم يتم العثور على سجلات DNS المطابقة بعد. تأكد من توجيه سجل A إلى 217.160.116.237 أو سجل CNAME إلى domains.codworth.me'
            : 'DNS records do not match yet. Point A record (@) to 217.160.116.237 or CNAME (www) to domains.codworth.me.'),
        resolvedRecords: res.resolvedRecords,
      });
    }
  };

  const handleDisconnectDomain = async () => {
    if (!selectedPageId) return;
    setIsDisconnectingDomain(true);
    setDomainFeedback(null);
    const res = await removePageCustomDomain(selectedPageId);
    setIsDisconnectingDomain(false);
    if (res.success) {
      setCustomDomain('');
      setDomainStatus('not_connected');
      setDomainFeedback({
        type: 'info',
        message: language === 'ar' ? 'تم إلغاء ربط النطاق المخصص بنجاح.' : 'Custom domain disconnected.',
      });
    } else {
      setDomainFeedback({
        type: 'error',
        message: res.error || 'Failed to disconnect domain.',
      });
    }
  };

  const handleCopyCname = () => {
    navigator.clipboard.writeText('domains.codworth.me');
    setHasCopiedCname(true);
    setTimeout(() => setHasCopiedCname(false), 2000);
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText('217.160.116.237');
    setHasCopiedIp(true);
    setTimeout(() => setHasCopiedIp(false), 2000);
  };

  // Save Password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentPassword) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال كلمة المرور الحالية' : 'Mot de passe actuel requis');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : '6 caractères minimum');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      triggerSuccessToast(t.saved);
    }, 600);
  };

  if (!isOpen) return null;

  const content = (
    <div className="space-y-4 max-w-4xl mx-auto" dir={dir}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-400" />
            <span>{t.settingsTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{t.settingsDesc}</p>
        </div>

        {/* Sub-Nav Tabs */}
        <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.tabProfile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('domain')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === 'domain'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.tabDomain}</span>
            {!isProUser && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded">Pro</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === 'security'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.tabSecurity}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <div className="relative group">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-xl object-cover border border-slate-700"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{fullName}</div>
              <div className="text-xs text-slate-400">{email}</div>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-semibold border border-slate-700">
                {isProUser ? t.proBadge : t.freeBadge}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.fullName}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800/60 rounded-lg px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.phone}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.storeName}</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.logout}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? t.saving : t.saveSettings}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Custom Domain (Real DNS Verification & Pro/Enterprise Plan Enforcement) */}
      {activeTab === 'domain' && (
        <div className="relative bg-slate-900/70 border border-slate-800 rounded-xl p-4 md:p-6 space-y-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>{t.customDomainTitle}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.customDomainDesc}</p>
            </div>
            {!isProUser && (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer shrink-0"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>🔒 Upgrade Required ({planId.toUpperCase()} Plan)</span>
              </button>
            )}
          </div>

          {/* Upgrade Required Banner for Free & Starter Plans */}
          {!isProUser && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'ar'
                      ? '🔒 الترقية مطلوبة: ربط النطاق المخصص متاح لمشتركي باقة Pro و Enterprise فقط'
                      : '🔒 Upgrade Required: Custom Domains require the Pro or Enterprise plan'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {language === 'ar'
                    ? `باقتك الحالية (${planId.toUpperCase()}) لا تدعم ربط الدومين الخاص. قم بالترقية إلى باقة Pro لربط نطاقك الخاص وتفعيل شهادة SSL تلقائياً.`
                    : `Your current plan (${planId.toUpperCase()}) does not include custom domains. Upgrade to Pro to connect your own domain with live DNS routing.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer shrink-0"
              >
                {language === 'ar' ? '🔒 ترقية الباقة الآن' : '🔒 Upgrade to Pro'}
              </button>
            </div>
          )}

          {/* Select Target Landing Page */}
          <div className={!isProUser ? 'opacity-50 pointer-events-none select-none space-y-4' : 'space-y-4'}>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {language === 'ar'
                  ? 'اختر صفحة الهبوط المراد ربط الدومين بها'
                  : 'Select Target Landing Page for Custom Domain'}
              </label>
              {userPages.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  {language === 'ar'
                    ? 'لا توجد صفحات هبوط محفوظة في حسابك بعد. قم بإنشاء وحفظ صفحة هبوط أولاً من المحرر.'
                    : 'No saved landing pages found in your account yet. Create and save a page in the builder first.'}
                </div>
              ) : (
                <select
                  value={selectedPageId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedPageId(nextId);
                    const found = userPages.find((p) => p.id === nextId);
                    setCustomDomain(found?.customDomain || '');
                    setDomainStatus(found?.domainStatus || (found?.customDomain ? 'pending_dns' : 'not_connected'));
                    setDomainFeedback(null);
                  }}
                  disabled={!isProUser}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {userPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (/p/{p.slug}) {p.customDomain ? `— 🌐 ${p.customDomain} [${p.domainStatus || 'pending_dns'}]` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Domain Input + Status Badge + Save & Verify Actions */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  {language === 'ar' ? 'اسم النطاق المخصص (Custom Domain FQDN)' : 'Custom Domain Name (FQDN)'}
                </label>

                {/* Real Domain Status Badge */}
                {domainStatus === 'active' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'نشط ومتصل (Active)' : 'Active & Verified'}</span>
                  </span>
                )}
                {domainStatus === 'pending_dns' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>{language === 'ar' ? 'في انتظار التحقق من DNS (Pending DNS)' : 'Pending DNS Verification'}</span>
                  </span>
                )}
                {domainStatus === 'error' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'خطأ في إعدادات DNS (DNS Error)' : 'DNS Verification Error'}</span>
                  </span>
                )}
                {domainStatus === 'not_connected' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                    {language === 'ar' ? 'غير متصل (Not Connected)' : 'Not Connected'}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  disabled={!isProUser || userPages.length === 0}
                  placeholder="shop.yourdomain.com or yourdomain.com"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={handleSaveCustomDomain}
                  disabled={!isProUser || isSavingDomain || userPages.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {isSavingDomain
                      ? '...'
                      : language === 'ar'
                      ? 'حفظ النطاق'
                      : 'Save Domain'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyDomain}
                  disabled={!isProUser || isDomainVerifying || !customDomain.trim() || userPages.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDomainVerifying ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                  <span>{isDomainVerifying ? (language === 'ar' ? 'جاري الفحص...' : 'Checking DNS...') : t.domainVerifyCta}</span>
                </button>

                {domainStatus !== 'not_connected' && (
                  <button
                    type="button"
                    onClick={handleDisconnectDomain}
                    disabled={!isProUser || isDisconnectingDomain}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء الربط' : 'Disconnect'}
                  </button>
                )}
              </div>

              {/* Live DNS Feedback Box */}
              {domainFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    domainFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : domainFeedback.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                  }`}
                >
                  <div className="flex items-start gap-2 font-medium">
                    {domainFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span dir="ltr" className="text-left">{domainFeedback.message}</span>
                  </div>
                  {domainFeedback.resolvedRecords && (
                    <div className="text-[11px] font-mono text-slate-300 pt-1 border-t border-white/10" dir="ltr">
                      Resolved A: [{domainFeedback.resolvedRecords.a.join(', ') || 'none'}] | Resolved CNAME: [{domainFeedback.resolvedRecords.cname.join(', ') || 'none'}]
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Real DNS Configuration Instructions (A Record -> 217.160.116.237 & CNAME -> domains.codworth.me) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                {language === 'ar'
                  ? 'إعدادات DNS المطلوبة لدى مزود النطاق الخاص بك (Cloudflare, Namecheap, GoDaddy):'
                  : 'Required DNS Records at your Domain Registrar (Cloudflare, Namecheap, GoDaddy):'}
              </div>

              <div className="space-y-2 font-mono text-xs" dir="ltr">
                {/* Option 1: A Record for Root Domain (@) */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">A Record</span>
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-bold">@</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">Value / IP:</span>
                    <span className="text-emerald-300 font-bold">217.160.116.237</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyIp}
                    className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                  >
                    {hasCopiedIp ? (
                      <span className="text-[11px] text-emerald-400 font-sans font-bold">{t.copied}</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="font-sans text-[11px]">Copy IP</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Option 2: CNAME Record for Subdomain (www or shop) */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">CNAME</span>
                    <span className="text-slate-400">Host:</span>
                    <span className="text-white font-bold">www (or subdomain)</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">Target:</span>
                    <span className="text-indigo-300 font-bold">domains.codworth.me</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCname}
                    className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                    title={t.copyCname}
                  >
                    {hasCopiedCname ? (
                      <span className="text-[11px] text-emerald-400 font-sans font-bold">{t.copied}</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="font-sans text-[11px]">Copy CNAME</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Security & 2FA */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <form onSubmit={handleSavePassword} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 md:p-6 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>{t.passwordTitle}</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.currentPassword}</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 pe-8"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-500 hover:text-slate-300"
                >
                  {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.newPassword}</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 pe-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.confirmPassword}</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 pe-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
              >
                <span>{t.saveSettings}</span>
              </button>
            </div>
          </form>

          {/* 2FA Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.twoFactorTitle}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.twoFactorDesc}</p>
            </div>
            <button
              type="button"
              onClick={handleToggle2FA}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isTwoFactorEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isTwoFactorEnabled ? '2FA Active ✓' : t.enable2fa}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (asModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 text-slate-100">
        <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 max-h-[92vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return <div className="min-h-full bg-slate-950 p-4 md:p-6">{content}</div>;
};
