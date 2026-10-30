import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/translations';
import { UserProfile, ManualPaymentRequest, StoredPage, MoroccanBankAccount } from '../types/user';
import { CustomerOrder } from '../types/orders';
import {
  ShieldAlert,
  Users,
  CreditCard,
  Globe,
  Eye,
  CheckCircle2,
  UserPlus,
  Trash2,
  Search,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  Clock,
  Sparkles,
  Landmark,
  Plus,
  Save,
} from 'lucide-react';

interface Props {
  onImpersonateSuccess?: () => void;
  onNavigateToStorefront?: () => void;
}

export const AdminOwnerDashboard: React.FC<Props> = ({ onImpersonateSuccess }) => {
  const {
    user,
    token,
    isAdmin,
    impersonateUser,
    fetchAdminUsers,
    updateAdminUserPlan,
    updateAdminUserStatus,
    deleteAdminUser,
    createAdminUserAccount,
    fetchAdminPayments,
    approveAdminPayment,
    rejectAdminPayment,
    fetchPlatformOverview,
    fetchAdminFunnels,
    fetchAdminOrders,
  } = useAuth();

  const { dir, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'banks' | 'overview'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [paymentsList, setPaymentsList] = useState<ManualPaymentRequest[]>([]);
  const [banksList, setBanksList] = useState<MoroccanBankAccount[]>([]);
  const [isSavingBanks, setIsSavingBanks] = useState<boolean>(false);
  const [savingBankId, setSavingBankId] = useState<string | null>(null);
  const [funnelsList, setFunnelsList] = useState<StoredPage[]>([]);
  const [ordersList, setOrdersList] = useState<CustomerOrder[]>([]);
  const [platformStats, setPlatformStats] = useState<{
    mrrMAD?: number;
    totalMerchants?: number;
    activeMerchants?: number;
    totalGMV?: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // New user form state
  const [newUserData, setNewUserData] = useState({
    fullName: '',
    email: '',
    storeName: '',
    phone: '+212 6',
    city: 'الدار البيضاء',
    role: 'merchant' as 'admin' | 'merchant',
    planId: 'free' as 'free' | 'starter' | 'pro' | 'enterprise',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAdminBanks = async (): Promise<MoroccanBankAccount[] | null> => {
    try {
      const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
      const res = await fetch('/api/admin/settings/banks', {
        headers: { Authorization: `Bearer ${activeAdminToken}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { banks?: MoroccanBankAccount[] };
      return Array.isArray(data.banks) ? data.banks : null;
    } catch {
      return null;
    }
  };

  const refetchBanksList = async () => {
    const freshBanks = await fetchAdminBanks();
    if (freshBanks !== null) {
      setBanksList(freshBanks);
    }
    return freshBanks;
  };

  const handleSaveSingleBank = async (bank: MoroccanBankAccount, isNew: boolean = false) => {
    setSavingBankId(bank.id);
    try {
      const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
      const endpoint = isNew
        ? '/api/admin/settings/banks'
        : `/api/admin/settings/banks/${encodeURIComponent(bank.id)}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify(bank),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        bank?: MoroccanBankAccount;
        message?: string;
        error?: string;
      };

      if (res.ok && (data.success || data.bank || (data as any).id)) {
        await refetchBanksList();
        showToast(data.message || 'تم حفظ الحساب البنكي في data/settings.json بنجاح!');
      } else {
        showToast(data.error || 'فشل حفظ الحساب البنكي');
      }
    } catch {
      showToast('حدث خطأ أثناء حفظ الحساب البنكي');
    } finally {
      setSavingBankId(null);
    }
  };

  const handleSaveAllBanks = async (updatedBanks: MoroccanBankAccount[]) => {
    setIsSavingBanks(true);
    try {
      const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
      const res = await fetch('/api/admin/settings/banks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({ banks: updatedBanks }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        banks?: MoroccanBankAccount[];
        message?: string;
        error?: string;
      };
      if (res.ok && data.success) {
        await refetchBanksList();
        showToast(data.message || 'تم حفظ إعدادات الأبناك المغربية في data/settings.json بنجاح!');
      } else {
        showToast(data.error || 'فشل حفظ إعدادات الأبناك');
      }
    } catch {
      showToast('حدث خطأ أثناء حفظ إعدادات الأبناك');
    } finally {
      setIsSavingBanks(false);
    }
  };

  const handleBankFieldChange = (
    bankId: string,
    field: keyof MoroccanBankAccount,
    value: string | boolean
  ) => {
    setBanksList((prev) =>
      prev.map((b) =>
        b.id === bankId
          ? {
              ...b,
              name: b.name || '',
              bankName: b.bankName || '',
              subtitle: b.subtitle || '',
              badge: b.badge || '',
              rib: b.rib || '',
              beneficiary: b.beneficiary || '',
              cin: b.cin || '',
              phone: b.phone || '',
              instructions: b.instructions || '',
              [field]: value,
            }
          : b
      )
    );
  };

  const handleAddNewBank = () => {
    const newBank: MoroccanBankAccount = {
      id: `bank-${Date.now().toString().slice(-6)}`,
      methodId: 'CIH',
      name: '',
      subtitle: '',
      badge: '',
      rib: '',
      beneficiary: '',
      bankName: '',
      cin: '',
      phone: '',
      instructions: '',
      isActive: true,
    };
    setBanksList((prev) => [...prev, newBank]);
  };

  const handleRemoveBank = async (bankId: string) => {
    try {
      const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
      const res = await fetch(`/api/admin/settings/banks/${encodeURIComponent(bankId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${activeAdminToken}`,
        },
      });
      if (res.ok) {
        await refetchBanksList();
        showToast('تم حذف الحساب البنكي بنجاح.');
      } else {
        // Might be an unsaved local bank card; remove locally and persist remaining
        const nextBanks = banksList.filter((b) => b.id !== bankId);
        await handleSaveAllBanks(nextBanks);
      }
    } catch {
      showToast('حدث خطأ أثناء حذف الحساب البنكي');
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [users, payments, stats, funnels, orders, banks] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminPayments(),
        fetchPlatformOverview(),
        fetchAdminFunnels(),
        fetchAdminOrders(),
        fetchAdminBanks(),
      ]);

      if (users) setUsersList(users);
      if (payments) setPaymentsList(payments);
      if (stats) setPlatformStats(stats);
      if (funnels) setFunnelsList(funnels);
      if (orders) setOrdersList(orders);
      if (banks !== null) setBanksList(banks);
    } catch (e) {
      console.warn('Admin load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllData();
    }
  }, [isAdmin]);

  // Handle 1-Click Live Account Impersonation
  const handleImpersonate = async (targetUser: UserProfile) => {
    if (targetUser.id === user?.id) {
      showToast('أنت بالفعل داخل حساب المالك الرئيسي!');
      return;
    }
    const res = await impersonateUser(targetUser);
    if (res.success) {
      showToast(`تم التبديل بنجاح! أنت الآن في حساب ${targetUser.full_name}`);
      onImpersonateSuccess?.();
    } else {
      showToast(res.error || 'فشل التبديل للحساب');
    }
  };

  // Handle plan change
  const handlePlanChange = async (userId: string, newPlan: 'free' | 'starter' | 'pro' | 'enterprise') => {
    const res = await updateAdminUserPlan(userId, newPlan);
    if (res.success) {
      showToast(res.message || 'تم تحديث الباقة بنجاح');
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan_id: newPlan } : u))
      );
    } else {
      showToast(res.error || 'فشل تحديث الباقة');
    }
  };

  // Task 3: Handle approving a pending user ("تفعيل الحساب") via PUT /api/admin/users/:id/status
  const handleApproveUser = async (targetUser: UserProfile) => {
    setApprovingUserId(targetUser.id);
    try {
      const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
      const response = await fetch(`/api/admin/users/${targetUser.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (response.ok && data.success) {
        showToast(data.message || `تم تفعيل حساب ${targetUser.full_name} بنجاح!`);
        setUsersList((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, status: 'active' } : u))
        );
      } else {
        const fallback = await updateAdminUserStatus(targetUser.id, 'active');
        if (fallback.success) {
          showToast(fallback.message || `تم تفعيل حساب ${targetUser.full_name} بنجاح!`);
          setUsersList((prev) =>
            prev.map((u) => (u.id === targetUser.id ? { ...u, status: 'active' } : u))
          );
        } else {
          showToast(data.error || fallback.error || 'فشل تفعيل الحساب');
        }
      }
    } catch {
      showToast('حدث خطأ في الاتصال أثناء تفعيل الحساب');
    } finally {
      setApprovingUserId(null);
    }
  };

  // Handle status toggle (active / suspended)
  const handleToggleStatus = async (targetUser: UserProfile) => {
    const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
    const res = await updateAdminUserStatus(targetUser.id, newStatus);
    if (res.success) {
      showToast(res.message || 'تم تحديث حالة الحساب');
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: newStatus } : u))
      );
    }
  };

  // Handle delete user
  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (targetUser.role === 'admin') {
      showToast('لا يمكن حذف حساب الأدمن المالك!');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف حساب ${targetUser.full_name}؟`)) {
      return;
    }
    const res = await deleteAdminUser(targetUser.id);
    if (res.success) {
      showToast('تم حذف الحساب بنجاح');
      setUsersList((prev) => prev.filter((u) => u.id !== targetUser.id));
    }
  };

  // Handle create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.fullName) {
      showToast('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }
    const res = await createAdminUserAccount(newUserData);
    if (res.success && res.user) {
      showToast(res.message || 'تم إنشاء الحساب بنجاح');
      setUsersList((prev) => [res.user!, ...prev]);
      setIsCreateUserModalOpen(false);
      setNewUserData({
        fullName: '',
        email: '',
        storeName: '',
        phone: '+212 6',
        city: 'الدار البيضاء',
        role: 'merchant',
        planId: 'free',
      });
    } else {
      showToast(res.error || 'فشل إنشاء الحساب');
    }
  };

  // Handle approve manual payment
  const handleApprovePayment = async (paymentId: string) => {
    const res = await approveAdminPayment(paymentId);
    if (res.success) {
      showToast(res.message || 'تم قبول وتفعيل الباقة فوراً!');
      setPaymentsList((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: 'approved' } : p))
      );
      loadAllData();
    } else {
      showToast('فشل قبول الطلب');
    }
  };

  // Handle reject manual payment
  const handleRejectPayment = async (paymentId: string) => {
    const res = await rejectAdminPayment(paymentId);
    if (res.success) {
      showToast('تم رفض طلب الترقية.');
      setPaymentsList((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: 'rejected' } : p))
      );
    }
  };

  const pendingUsersCount = usersList.filter((u) => u.status === 'pending').length;

  // Filtered users
  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.store_name && u.store_name.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));

    const matchesPlan = planFilter === 'all' || u.plan_id === planFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-300" dir={dir}>
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-bold text-white mb-1">صلاحيات غير كافية</h2>
        <p className="text-xs text-slate-400">لوحة تحكم المالك مخصصة فقط لحساب المشرف العام والمالك.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden" dir={dir}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Strip */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shadow-xs">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                {language === 'ar' ? 'مركز تحكم المالك والمنصة (Super Admin)' : language === 'fr' ? 'Centre de Contrôle Propriétaire (Super Admin)' : 'Platform Owner Control Center (Super Admin)'}
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Multi-Tenant Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {language === 'ar'
                ? 'إدارة حسابات التجار، تفعيل الحسابات الجديدة، انتحال الجلسات الحية (Impersonation)، والموافقة على التحويلات البنكية'
                : language === 'fr'
                ? 'Gestion des marchands, activation des comptes, usurpation de compte (Impersonation), et validation des virements'
                : 'Merchants management, account approvals, live account impersonation, and Moroccan bank transfer approvals'}
            </p>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{language === 'ar' ? 'إدارة التجار والحسابات' : language === 'fr' ? 'Marchands & Comptes' : 'Merchants & Accounts'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-200">
              {usersList.length}
            </span>
            {pendingUsersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] animate-pulse">
                {pendingUsersCount} قيد المراجعة
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer relative ${
              activeTab === 'payments'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'ar' ? 'التحويلات والترقيات' : language === 'fr' ? 'Virements & Upgrades' : 'Transfers & Upgrades'}</span>
            {paymentsList.filter((p) => p.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] animate-pulse">
                {paymentsList.filter((p) => p.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="admin-tab-banks"
            onClick={() => setActiveTab('banks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'banks'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'ar' ? 'إدارة الأبناك المغربية' : language === 'fr' ? 'Banques Marocaines' : 'Moroccan Banks'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-200">
              {banksList.filter((b) => b.isActive !== false).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span>{language === 'ar' ? 'نظرة عامة على المنصة' : language === 'fr' ? 'Vue d\'Ensemble Globale' : 'Platform Overview'}</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* ==================== TAB 1: USERS & MERCHANTS MANAGEMENT ==================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Top Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-3xl">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute top-2.5 right-3 text-slate-500 rtl:right-3 ltr:left-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'البحث بالاسم، البريد، المتجر، أو الهاتف...' : 'Recherche par nom, email, boutique...'}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-8 text-slate-200 placeholder-slate-500 focus:border-slate-700 outline-none"
                  />
                </div>

                {/* Status Filter (Task 3) */}
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | 'pending' | 'active' | 'suspended')
                  }
                  className="text-xs bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-300 focus:border-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">كل الحالات (All Statuses)</option>
                  <option value="pending">⏳ قيد المراجعة (Pending - {pendingUsersCount})</option>
                  <option value="active">✓ نشط (Active)</option>
                  <option value="suspended">✕ موقوف (Suspended)</option>
                </select>

                {/* Quick Pending Filter Pill */}
                {pendingUsersCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>بانتظار التفعيل ({pendingUsersCount})</span>
                  </button>
                )}

                {/* Plan Filter */}
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="text-xs bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-300 focus:border-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">كل الباقات (All Plans)</option>
                  <option value="free">باقة مجانية (Free)</option>
                  <option value="starter">باقة البداية (Starter)</option>
                  <option value="pro">باقة المحترفين (Pro)</option>
                  <option value="enterprise">باقة الشركات (Enterprise)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadAllData}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700"
                  title="تحديث البيانات"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-xs transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? '+ إضافة تاجر جديد' : '+ Nouveau Marchand'}</span>
                </button>
              </div>
            </div>

            {/* Merchants High-Density Table */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right rtl:text-right ltr:text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400">
                      <th className="py-2.5 px-3">التاجر والمتجر</th>
                      <th className="py-2.5 px-3">بيانات التواصل</th>
                      <th className="py-2.5 px-3">الباقة الحالية</th>
                      <th className="py-2.5 px-3 text-center">الصفحات</th>
                      <th className="py-2.5 px-3 text-center">الطلبيات</th>
                      <th className="py-2.5 px-3 text-center">الحالة والتفعيل</th>
                      <th className="py-2.5 px-3 text-center">تحكم المالك (Impersonation)</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                          لا يوجد تجار مطابقين للبحث.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === user?.id;
                        const plan = u.plan_id || 'free';
                        const isPending = u.status === 'pending';

                        return (
                          <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* Merchant & Store */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <img
                                  src={
                                    u.avatar ||
                                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                                  }
                                  alt={u.full_name}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-white">{u.full_name}</span>
                                    {u.role === 'admin' && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                                        👑 المالك
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <span>🏪 {u.store_name || 'بدون اسم متجر'}</span>
                                    {u.custom_domain && (
                                      <span className="text-teal-400 underline font-mono text-[10px]">
                                        ({u.custom_domain})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Contact info + Forensic Last Login IP & Timestamp (Task 3.3) */}
                            <td className="py-2.5 px-3">
                              <div className="text-[11px] text-slate-300 flex flex-col gap-0.5">
                                <span className="font-mono">{u.email}</span>
                                <span className="text-slate-400 font-mono text-[10px]">{u.phone || 'غير محدد'}</span>
                                <div className="mt-1 pt-1 border-t border-slate-800/80 flex flex-col gap-0.5 text-[10px] font-mono" dir="ltr">
                                  <span className="text-emerald-400">
                                    IP: {u.lastLoginIp || 'No IP recorded'}
                                    {u.lastLoginLocation ? ` (${u.lastLoginLocation})` : ''}
                                  </span>
                                  <span className="text-slate-400">
                                    Last Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Plan with Dropdown */}
                            <td className="py-2.5 px-3">
                              <select
                                value={plan}
                                onChange={(e) =>
                                  handlePlanChange(
                                    u.id,
                                    e.target.value as 'free' | 'starter' | 'pro' | 'enterprise'
                                  )
                                }
                                disabled={isSelf}
                                className={`text-[11px] font-semibold py-1 px-2 rounded-md border cursor-pointer outline-none transition ${
                                  plan === 'enterprise'
                                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                    : plan === 'pro'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : plan === 'starter'
                                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                <option value="free" className="bg-slate-900 text-slate-200">Free مجانية</option>
                                <option value="starter" className="bg-slate-900 text-slate-200">Starter باقة البداية</option>
                                <option value="pro" className="bg-slate-900 text-slate-200">Pro المحترفين ⭐</option>
                                <option value="enterprise" className="bg-slate-900 text-slate-200">Enterprise الشركات 🚀</option>
                              </select>
                            </td>

                            {/* Funnels count */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold text-[11px]">
                                {u.pages_created_count || 0}
                              </span>
                            </td>

                            {/* Orders count */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-[11px]">
                                {u.orders_count || 0}
                              </span>
                            </td>

                            {/* Account Status & Approval Button (Task 3) */}
                            <td className="py-2.5 px-3 text-center">
                              {isPending ? (
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    ⏳ قيد المراجعة (Pending)
                                  </span>
                                  <button
                                    type="button"
                                    disabled={approvingUserId === u.id}
                                    onClick={() => handleApproveUser(u)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      {approvingUserId === u.id ? 'جاري التفعيل...' : 'تفعيل الحساب'}
                                    </span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={isSelf}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition ${
                                    u.status === 'suspended'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  }`}
                                  title="اضغط لتبديل حالة الحساب"
                                >
                                  {u.status === 'suspended' ? 'موقوف Suspended' : 'نشط Active ✓'}
                                </button>
                              )}
                            </td>

                            {/* 1-Click Live Account Impersonation */}
                            <td className="py-2.5 px-3 text-center">
                              {isSelf ? (
                                <span className="text-[10px] text-slate-500 italic">حسابك الحالي</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleImpersonate(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[11px] shadow-xs transition transform active:scale-95 cursor-pointer"
                                  title="انتحال الجلسة والدخول لحساب التاجر والتحكم فيه بالكامل"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>👁️ الدخول للحساب والتحكم</span>
                                </button>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-center">
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="حذف الحساب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: BANK TRANSFERS & UPGRADE APPROVALS ==================== */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>طلبات الترقية وإثباتات التحويلات البنكية المحلية بالمغرب (CIH, Attijari, Cash Plus)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  تحقق من إثباتات الدفع المرسلة من التجار وقم بتفعيل باقات Pro و Enterprise فورياً بضغطة زر واحدة.
                </p>
              </div>

              <button
                type="button"
                onClick={loadAllData}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>تحديث الطلبات</span>
              </button>
            </div>

            {/* Payments List Table */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right rtl:text-right ltr:text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-semibold text-slate-400">
                      <th className="py-2.5 px-3">رقم الطلب / التاريخ</th>
                      <th className="py-2.5 px-3">التاجر الطالب</th>
                      <th className="py-2.5 px-3">طريقة الدفع</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                      <th className="py-2.5 px-3">رمز المعاملة / الوصل</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                      <th className="py-2.5 px-3 text-center">قرار المالك (Approval)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {paymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                          لا توجد طلبات ترقية مسجلة حالياً.
                        </td>
                      </tr>
                    ) : (
                      paymentsList.map((p) => {
                        return (
                          <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* ID & Date */}
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-semibold text-white text-[11px]">{p.id}</div>
                              <div className="text-[10px] text-slate-500">
                                {new Date(p.createdAt).toLocaleDateString('ar-MA', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>

                            {/* Merchant */}
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-200">{p.userName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{p.userEmail}</div>
                            </td>

                            {/* Method */}
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                                🏦 {p.method}
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-amber-300 font-mono">{p.amount} MAD</span>
                            </td>

                            {/* Transaction Reference & Proof Image */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                  {p.transactionReference}
                                </span>
                                {p.proofImageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReceiptUrl(p.proofImageUrl || null)}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                  >
                                    معاينة الوصل 📷
                                  </button>
                                )}
                              </div>
                              {p.notes && <div className="text-[10px] text-slate-400 mt-0.5">{p.notes}</div>}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  p.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : p.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                                }`}
                              >
                                {p.status === 'approved' ? 'مقبول وتم التفعيل ✓' : p.status === 'rejected' ? 'مرفوض ✕' : 'معلق قيد المراجعة ⏳'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-center">
                              {p.status === 'pending' ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleApprovePayment(p.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                                  >
                                    ✅ قبول وتفعيل فوراً
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectPayment(p.id)}
                                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 text-[11px] transition cursor-pointer"
                                  >
                                    ❌ رفض
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">تمت المعالجة</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2.5: DYNAMIC MOROCCAN BANK ACCOUNTS MANAGER ==================== */}
        {activeTab === 'banks' && (
          <div className="space-y-4" data-testid="admin-banks-manager">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-400" />
                  <span>إدارة الحسابات البنكية المغربية (CIH, Banque Populaire, Attijariwafa, Cash Plus)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  يتم حفظ جميع أرقام الحسابات (RIB) وبيانات المستفيد محلياً وبأمان في <code className="text-emerald-400 font-mono">data/settings.json</code> (مستبعد من GitHub) وتظهر تلقائياً للتجار في نافذة الترقية.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddNewBank}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ إضافة حساب بنكي</span>
                </button>
                <button
                  type="button"
                  data-testid="save-banks-btn"
                  disabled={isSavingBanks}
                  onClick={() => handleSaveAllBanks(banksList)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingBanks ? 'جاري الحفظ...' : 'حفظ التغييرات فوراً'}</span>
                </button>
              </div>
            </div>

            {banksList.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Landmark className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-xs font-bold text-slate-300">
                  لا توجد حسابات بنكية مسجلة حالياً في <code className="font-mono text-emerald-400">data/settings.json</code>
                </div>
                <p className="text-[11px] text-slate-500">
                  اضغط على زر &ldquo;+ إضافة حساب بنكي&rdquo; أعلاه لإضافة حسابك البنكي المغربي الأول.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {banksList.map((bank) => (
                  <div
                    key={bank.id}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      bank.isActive !== false
                        ? 'bg-slate-900/70 border-slate-800'
                        : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-xs text-white">
                          {bank.name || bank.bankName || 'حساب بنكي جديد'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {bank.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bank.isActive !== false}
                            onChange={(e) =>
                              handleBankFieldChange(bank.id, 'isActive', e.target.checked)
                            }
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span>{bank.isActive !== false ? 'مفعّل للتجار' : 'مخفي'}</span>
                        </label>
                        <button
                          type="button"
                          disabled={savingBankId === bank.id}
                          onClick={() => handleSaveSingleBank(bank)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                          title="حفظ هذا الحساب البنكي"
                        >
                          <Save className="w-3 h-3" />
                          <span>{savingBankId === bank.id ? 'يحفظ...' : 'حفظ'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBank(bank.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="حذف الحساب البنكي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">اسم العرض (Name)</label>
                        <input
                          type="text"
                          value={bank.name || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'name', e.target.value)}
                          placeholder="مثال: CIH Bank"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">اسم المؤسسة البنكية (Bank Name)</label>
                        <input
                          type="text"
                          value={bank.bankName || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'bankName', e.target.value)}
                          placeholder="مثال: بنك CIH المغرب"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">اسم المستفيد (Beneficiary / Titulaire)</label>
                        <input
                          type="text"
                          value={bank.beneficiary || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'beneficiary', e.target.value)}
                          placeholder="مثال: الاسم الكامل لصاحب الحساب"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">شارة الميزة (Badge)</label>
                        <input
                          type="text"
                          value={bank.badge || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'badge', e.target.value)}
                          placeholder="مثال: تحويل فوري مجاني"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-1">
                          رقم الـ RIB البنكي (24 رقماً — اتركه فارغاً لوكالات Cash Plus)
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={bank.rib || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'rib', e.target.value)}
                          placeholder="مثال: 230 780 00000000000000 00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-emerald-300 placeholder:text-slate-500 font-mono outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">رقم البطاقة الوطنية (CIN - اختياري)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={bank.cin || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'cin', e.target.value)}
                          placeholder="مثال: AB123456"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 font-mono outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">رقم الهاتف (Phone - اختياري)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={bank.phone || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'phone', e.target.value)}
                          placeholder="مثال: +212 600 000 000"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder:text-slate-500 font-mono outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-1">تعليمات التحويل للتاجر (Instructions)</label>
                        <input
                          type="text"
                          value={bank.instructions || ''}
                          onChange={(e) => handleBankFieldChange(bank.id, 'instructions', e.target.value)}
                          placeholder="مثال: قم بإجراء تحويل بنكي مباشر وأرفق وصل العملية"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: GLOBAL PLATFORM OVERVIEW ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Owner Platform KPIs Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* MRR */}
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>إجمالي أرباح الاشتراكات (MRR)</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {platformStats?.mrrMAD?.toLocaleString() || '14,850'} <span className="text-xs text-emerald-400">MAD/mo</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">تجديدات دورية نشطة شهرياً</div>
              </div>

              {/* Total Merchants */}
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>إجمالي التجار المسجلين</span>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {platformStats?.totalMerchants || Math.max(0, usersList.length - 1)}{' '}
                  <span className="text-xs text-slate-400">تاجر مغربي</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">
                  ✓ {platformStats?.activeMerchants || usersList.filter((u) => u.status === 'active').length} حساب نشط
                </div>
              </div>

              {/* Total GMV */}
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>إجمالي مبيعات التجار (GMV)</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {platformStats?.totalGMV?.toLocaleString() || '182,490'}{' '}
                  <span className="text-xs text-amber-400">MAD</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">عبر كافة صفحات الهبوط المنشورة</div>
              </div>

              {/* Pending Upgrades */}
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>طلبات الترقية المعلقة</span>
                  <Clock className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-black text-white font-mono">
                  {paymentsList.filter((p) => p.status === 'pending').length}{' '}
                  <span className="text-xs text-rose-400">تحويل بنكي</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">بحاجة لمراجعة إثبات التحويل</div>
              </div>
            </div>

            {/* Global Orders & Funnels Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* All Platform Funnels */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-400" />
                    <span>مراقبة صفحات الهبوط عبر المنصة ({funnelsList.length})</span>
                  </h3>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {funnelsList.map((f) => {
                    const owner = usersList.find((u) => u.id === f.userId);
                    return (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white truncate">{f.title}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>👤 {owner?.full_name || 'تاجر'}</span>
                            <span className="font-mono text-emerald-400">/p/{f.slug}</span>
                            {f.customDomain && <span className="text-teal-400 font-mono font-semibold">🌐 {f.customDomain}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-[11px]">
                          <span className="text-slate-400 font-mono">👁️ {f.viewsCount || 0}</span>
                          <span className="text-indigo-400 font-mono font-bold">📦 {f.ordersCount || 0}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              f.isPublished
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {f.isPublished ? 'منشورة' : 'مسودة'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All Platform COD Orders */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    <span>مراقبة طلبيات الدفع عند الاستلام ({ordersList.length})</span>
                  </h3>
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {ordersList.slice(0, 15).map((o) => (
                    <div
                      key={o.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white text-[11px]">{o.id}</span>
                          <span className="text-slate-300 font-medium truncate">— {o.customerName}</span>
                          <span className="text-[10px] text-slate-500">📍 {o.customerCity}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          <span>📦 {o.productName}</span>
                          {o.storeName && <span className="text-teal-400 font-semibold mr-2 rtl:mr-2 ltr:ml-2">({o.storeName})</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono font-bold text-amber-400 text-[11px]">{o.price} MAD</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            o.status === 'delivered'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : o.status === 'confirmed'
                              ? 'bg-indigo-500/10 text-indigo-400'
                              : o.status === 'shipped'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create New User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>إضافة تاجر جديد إلى المنصة</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                  placeholder="مثال: يوسف العلمي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="merchant@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم المتجر</label>
                  <input
                    type="text"
                    value={newUserData.storeName}
                    onChange={(e) => setNewUserData({ ...newUserData, storeName: e.target.value })}
                    placeholder="متجر أطلس"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">رقم الهاتف المغربي</label>
                  <input
                    type="text"
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                    placeholder="+212 6..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الباقة الابتدائية</label>
                  <select
                    value={newUserData.planId}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        planId: e.target.value as 'free' | 'starter' | 'pro' | 'enterprise',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700"
                  >
                    <option value="free">Free مجانية</option>
                    <option value="starter">Starter باقة البداية</option>
                    <option value="pro">Pro المحترفين ⭐</option>
                    <option value="enterprise">Enterprise الشركات 🚀</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الدور (Role)</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        role: e.target.value as 'merchant' | 'admin',
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-slate-700"
                  >
                    <option value="merchant">تاجر عادي (Merchant)</option>
                    <option value="admin">مشرف مالك (Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-xs"
                >
                  حفظ وإنشاء التاجر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof Receipt Modal */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">معاينة وصل التحويل البنكي</span>
              <button
                type="button"
                onClick={() => setSelectedReceiptUrl(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-[420px] flex items-center justify-center">
              <img src={selectedReceiptUrl} alt="Bank Proof" className="object-contain max-h-[400px] w-full" />
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setSelectedReceiptUrl(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
