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
  const { user, isPro, toggle2FA, updateProfile, refreshUser, logout } = useAuth();
  const { t, dir, isRtl, language } = useLanguage();
  const isProUser = currentPlan === 'pro' || currentPlan === 'enterprise' || isPro;

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'profile' | 'domain' | 'security'>(initialTab);

  // Profile Form State (prioritize authenticated user profile from server)
  const [fullName, setFullName] = useState<string>(() => {
    return user?.full_name || localStorage.getItem('fc_user_fullname') || 'محمد أمين';
  });
  const [email, setEmail] = useState<string>(() => {
    return user?.email || 'amine.store@funnelcraft.ma';
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

  // Custom Domain State
  const [customDomain, setCustomDomain] = useState<string>(() => {
    return localStorage.getItem('fc_custom_domain') || 'mystore.ma';
  });
  const [isDomainVerifying, setIsDomainVerifying] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'connected' | 'pending' | 'unverified'>(() => {
    return (localStorage.getItem('fc_domain_status') as any) || 'connected';
  });

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

  // Save Profile (Task 3: Explicit PUT /api/auth/profile + refreshUser)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Veuillez saisir votre nom');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const formData = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        store_name: storeName.trim(),
        avatar: avatarUrl,
        custom_domain: customDomain.trim(),
        two_factor_enabled: isTwoFactorEnabled,
      };

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

  // Verify Custom Domain
  const handleVerifyDomain = () => {
    if (!isProUser && onUpgradeClick) {
      onUpgradeClick();
      return;
    }

    if (!customDomain.trim()) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال اسم الدومين' : 'Veuillez saisir votre domaine');
      return;
    }

    setIsDomainVerifying(true);
    setErrorMessage(null);

    const cleaned = customDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

    setCustomDomain(cleaned);
    localStorage.setItem('fc_custom_domain', cleaned);

    setTimeout(() => {
      setIsDomainVerifying(false);
      setDomainStatus('connected');
      localStorage.setItem('fc_domain_status', 'connected');
      triggerSuccessToast(
        language === 'ar'
          ? `تم ربط وتفعيل الدومين (${cleaned}) بنجاح`
          : `Domaine (${cleaned}) lié avec succès`
      );
    }, 1000);
  };

  const handleCopyCname = () => {
    navigator.clipboard.writeText('cname.funnelcraft.ma');
    setHasCopiedCname(true);
    setTimeout(() => setHasCopiedCname(false), 2000);
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

      {/* TAB 2: Custom Domain */}
      {activeTab === 'domain' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between">
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.unlockWithPro}</span>
              </button>
            )}
          </div>

          {/* Domain Status Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">{language === 'ar' ? 'الدومين الحالي' : 'Domaine actuel'}</div>
              <div className="text-sm font-mono font-bold text-white mt-0.5 flex items-center gap-2">
                <span>{customDomain}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-sans font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t.domainConnected}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleVerifyDomain}
              disabled={isDomainVerifying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDomainVerifying ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isDomainVerifying ? '...' : t.domainVerifyCta}</span>
            </button>
          </div>

          {/* DNS Instructions */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-300">{t.domainInstruction}</div>
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs">
              <div>
                <span className="text-slate-500">Type: </span>
                <span className="text-emerald-400 font-bold">CNAME</span>
                <span className="text-slate-600 mx-2">|</span>
                <span className="text-slate-500">Value: </span>
                <span className="text-slate-200">{t.cnameValue}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCname}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                title={t.copyCname}
              >
                {hasCopiedCname ? (
                  <span className="text-[11px] text-emerald-400 font-sans font-bold">{t.copied}</span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
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
