import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserProfile,
  AuthResponse,
  ManualPaymentRequest,
  MoroccanPaymentMethod,
  StoredPage,
} from '../types/user';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isPro: boolean;
  isAdmin: boolean;
  pagesCreatedCount: number;
  maxFreePages: number;
  isLimitReached: boolean;
  remainingFreePages: number;
  userPayments: ManualPaymentRequest[];
  hasPendingPayment: boolean;
  userPages: StoredPage[];
  fetchUserPages: () => Promise<StoredPage[]>;
  saveUserPageToCloud: (pageInput: {
    id?: string;
    title?: string;
    slug?: string;
    data: any;
  }) => Promise<{
    success: boolean;
    page?: StoredPage;
    error?: string;
    isLimitReached?: boolean;
    message?: string;
  }>;
  deleteUserPageFromCloud: (pageId: string) => Promise<{ success: boolean; error?: string }>;
  duplicateUserPageInCloud: (
    pageId: string
  ) => Promise<{ success: boolean; page?: StoredPage; error?: string; isLimitReached?: boolean }>;
  publishUserPageInCloud: (
    pageId: string,
    slug: string,
    customDomain?: string,
    compiledHtml?: string
  ) => Promise<{
    success: boolean;
    page?: StoredPage;
    liveUrl?: string;
    error?: string;
    isLimitReached?: boolean;
    code?: string;
  }>;
  unpublishUserPageInCloud: (
    pageId: string
  ) => Promise<{ success: boolean; page?: StoredPage; error?: string }>;
  checkSlugAvailability: (
    slug: string,
    excludeId?: string
  ) => Promise<{ available: boolean; slug: string }>;
  twoFactorData: TwoFactorState | null;
  login: (
    email: string,
    password: string,
    options?: {
      simulate2fa?: boolean;
      trustDevice?: boolean;
      recaptchaToken?: string;
      turnstileToken?: string;
      captchaToken?: string;
    }
  ) => Promise<{ success: boolean; requires2FA?: boolean; error?: string; devPreviewOtp?: string }>;
  register: (
    emailOrPayload:
      | string
      | {
          email: string;
          password: string;
          fullName: string;
          storeName?: string;
          phone?: string;
          twoFactorEnabled?: boolean;
          recaptchaToken?: string;
          turnstileToken?: string;
          captchaToken?: string;
        },
    password?: string,
    fullName?: string,
    turnstileToken?: string,
    recaptchaToken?: string
  ) => Promise<{ success: boolean; requires2FA?: boolean; error?: string; devPreviewOtp?: string }>;
  loginWithGoogle: (
    credential: string
  ) => Promise<{ success: boolean; requires2FA?: boolean; error?: string }>;
  sendOtp: (
    channel?: 'whatsapp' | 'email'
  ) => Promise<{ success: boolean; devPreviewOtp?: string; message?: string; error?: string }>;
  verifyOtp: (code: string, trustDevice?: boolean) => Promise<{ success: boolean; error?: string }>;
  clearTwoFactorState: () => void;
  toggle2FA: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  checkCanPerformAction: () => { allowed: boolean; reason?: string };
  recordPageAction: () => Promise<boolean>;
  upgradeToPro: () => Promise<{ success: boolean; url?: string; message?: string }>;
  submitManualPayment: (
    method: MoroccanPaymentMethod,
    reference: string,
    amount?: number,
    proofImageUrl?: string,
    notes?: string
  ) => Promise<{ success: boolean; payment?: ManualPaymentRequest; message?: string; error?: string }>;
  fetchAdminPayments: () => Promise<ManualPaymentRequest[]>;
  approveAdminPayment: (id: string) => Promise<{ success: boolean; message?: string }>;
  rejectAdminPayment: (id: string) => Promise<{ success: boolean; message?: string }>;
  isImpersonating: boolean;
  impersonatedUser: UserProfile | null;
  realAdminUser: UserProfile | null;
  impersonateUser: (targetUser: UserProfile) => Promise<{ success: boolean; error?: string }>;
  stopImpersonating: () => Promise<void>;
  fetchAdminUsers: () => Promise<UserProfile[]>;
  updateAdminUserPlan: (
    userId: string,
    planId: 'free' | 'starter' | 'pro' | 'enterprise'
  ) => Promise<{ success: boolean; user?: UserProfile; message?: string; error?: string }>;
  updateAdminUserStatus: (
    userId: string,
    status: 'active' | 'suspended'
  ) => Promise<{ success: boolean; user?: UserProfile; message?: string; error?: string }>;
  deleteAdminUser: (userId: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  createAdminUserAccount: (
    userData: any
  ) => Promise<{ success: boolean; user?: UserProfile; message?: string; error?: string }>;
  fetchPlatformOverview: () => Promise<any>;
  fetchAdminFunnels: () => Promise<StoredPage[]>;
  fetchAdminOrders: () => Promise<any[]>;
}

export interface TwoFactorState {
  isRequired: boolean;
  userId: string;
  email: string;
  phone: string;
  maskedPhone: string;
  maskedEmail: string;
  channel: 'whatsapp' | 'email';
  devPreviewOtp?: string;
  device?: { browser: string; os: string; ip: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'funnelcraft_auth_token';
const MAX_FREE_PAGES = 2;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('funnelcraft_impersonated_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [realAdminUser, setRealAdminUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('funnelcraft_real_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorState | null>(null);
  const [userPayments, setUserPayments] = useState<ManualPaymentRequest[]>([]);
  const [userPages, setUserPages] = useState<StoredPage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserPayments = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/billing/manual-payments', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.payments) {
          setUserPayments(data.payments);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user payments:', e);
    }
  }, []);

  const fetchUserPages = useCallback(async (authToken?: string): Promise<StoredPage[]> => {
    const activeToken = authToken || token;
    if (!activeToken) return [];
    try {
      const res = await fetch('/api/pages', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.pages)) {
          setUserPages(data.pages);
          return data.pages;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user pages:', e);
    }
    return [];
  }, [token]);

  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          fetchUserPayments(authToken);
          fetchUserPages(authToken);
          return;
        }
      }
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setUserPages([]);
    } catch (e) {
      console.warn('Failed to verify token:', e);
    }
  }, [fetchUserPayments, fetchUserPages]);

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token, fetchCurrentUser]);

  const login = async (
    email: string,
    password: string,
    options?: {
      simulate2fa?: boolean;
      trustDevice?: boolean;
      recaptchaToken?: string;
      turnstileToken?: string;
      captchaToken?: string;
    }
  ) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          simulate2fa: options?.simulate2fa,
          trustDevice: options?.trustDevice,
          recaptchaToken: options?.recaptchaToken,
          turnstileToken: options?.turnstileToken || options?.captchaToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.requires2FA) {
          const tfaState: TwoFactorState = {
            isRequired: true,
            userId: data.userId,
            email: data.email,
            phone: data.phone,
            maskedPhone: data.maskedPhone,
            maskedEmail: data.maskedEmail,
            channel: data.channel || 'whatsapp',
            devPreviewOtp: data.devPreviewOtp,
            device: data.device,
          };
          setTwoFactorData(tfaState);
          return { success: true, requires2FA: true, devPreviewOtp: data.devPreviewOtp };
        }

        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token);
          setToken(data.token);
          setUser(data.user);
          setTwoFactorData(null);
          fetchUserPayments(data.token);
          fetchUserPages(data.token);
          return { success: true };
        }
      }
      return { success: false, error: data.error || 'Login failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error.' };
    }
  };

  const register = async (
    emailOrPayload:
      | string
      | {
          email: string;
          password: string;
          fullName: string;
          storeName?: string;
          phone?: string;
          twoFactorEnabled?: boolean;
          recaptchaToken?: string;
          turnstileToken?: string;
          captchaToken?: string;
        },
    passwordParam?: string,
    fullNameParam?: string,
    turnstileTokenParam?: string,
    recaptchaTokenParam?: string
  ) => {
    const payload =
      typeof emailOrPayload === 'string'
        ? {
            email: emailOrPayload,
            password: passwordParam || '',
            fullName: fullNameParam || '',
            storeName: undefined,
            phone: undefined,
            twoFactorEnabled: false,
            recaptchaToken: recaptchaTokenParam,
            turnstileToken: turnstileTokenParam,
            captchaToken: undefined,
          }
        : emailOrPayload;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          full_name: payload.fullName,
          store_name: payload.storeName,
          phone: payload.phone,
          two_factor_enabled: payload.twoFactorEnabled,
          recaptchaToken: payload.recaptchaToken,
          turnstileToken: payload.turnstileToken || payload.captchaToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.requires2FA) {
          const tfaState: TwoFactorState = {
            isRequired: true,
            userId: data.userId,
            email: data.email,
            phone: data.phone,
            maskedPhone: data.maskedPhone,
            maskedEmail: data.maskedEmail,
            channel: data.channel || 'whatsapp',
            devPreviewOtp: data.devPreviewOtp,
            device: data.device,
          };
          setTwoFactorData(tfaState);
          return { success: true, requires2FA: true, devPreviewOtp: data.devPreviewOtp };
        }

        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token);
          setToken(data.token);
          setUser(data.user);
          setTwoFactorData(null);
          fetchUserPayments(data.token);
          fetchUserPages(data.token);
          return { success: true };
        }
      }
      return { success: false, error: data.error || 'Registration failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error.' };
    }
  };

  const loginWithGoogle = async (credential: string) => {
    if (!credential || typeof credential !== 'string') {
      return { success: false, error: 'Invalid Google credential.' };
    }

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.requires2FA) {
          setTwoFactorData({
            isRequired: true,
            userId: data.userId,
            email: data.email,
            phone: data.phone,
            maskedPhone: data.maskedPhone,
            maskedEmail: data.maskedEmail,
            channel: data.channel || 'email',
            devPreviewOtp: data.devPreviewOtp,
            device: data.device,
          });
          return { success: true, requires2FA: true };
        }

        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token);
          setToken(data.token);
          setUser(data.user);
          setTwoFactorData(null);
          fetchUserPayments(data.token);
          fetchUserPages(data.token);
          return { success: true };
        }
      }
      return { success: false, error: data.error || 'Google sign-in failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google sign-in network error.' };
    }
  };

  const sendOtp = async (channel?: 'whatsapp' | 'email') => {
    if (!twoFactorData) return { success: false, error: 'No active verification session.' };
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: twoFactorData.userId,
          email: twoFactorData.email,
          phone: twoFactorData.phone,
          channel: channel || twoFactorData.channel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTwoFactorData((prev) =>
          prev ? { ...prev, channel: data.channel, devPreviewOtp: data.devPreviewOtp } : null
        );
        return {
          success: true,
          devPreviewOtp: data.devPreviewOtp,
          message: data.message,
        };
      }
      return { success: false, error: data.error || 'Failed to send OTP.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const verifyOtp = async (code: string, trustDevice?: boolean) => {
    if (!twoFactorData) return { success: false, error: 'No active verification session.' };
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: twoFactorData.userId,
          email: twoFactorData.email,
          code,
          trustDevice,
        }),
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        setTwoFactorData(null);
        fetchUserPayments(data.token);
        fetchUserPages(data.token);
        return { success: true };
      }
      return { success: false, error: data.error || 'رمز التحقق غير صحيح.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification network error.' };
    }
  };

  const clearTwoFactorState = () => {
    setTwoFactorData(null);
  };

  const toggle2FA = async (enabled: boolean) => {
    if (!user || !token) return { success: false, error: 'Not logged in.' };
    try {
      const res = await fetch('/api/auth/2fa/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !token) return { success: false, error: 'Not logged in.' };
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success && resData.user) {
        setUser(resData.user);
        if (impersonatedUser && impersonatedUser.id === resData.user.id) {
          setImpersonatedUser(resData.user);
          localStorage.setItem('funnelcraft_impersonated_user', JSON.stringify(resData.user));
        }
        return { success: true };
      }
      return { success: false, error: resData.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.warn('Logout network error:', e);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('funnelcraft_admin_token');
    localStorage.removeItem('funnelcraft_impersonated_user');
    localStorage.removeItem('funnelcraft_real_admin_user');
    setToken(null);
    setUser(null);
    setImpersonatedUser(null);
    setRealAdminUser(null);
    setTwoFactorData(null);
    setUserPayments([]);
    setUserPages([]);
  };

  const saveUserPageToCloud = async (pageInput: {
    id?: string;
    title?: string;
    slug?: string;
    data: any;
  }) => {
    if (!token) {
      return { success: false, error: 'Authentication required to save pages to cloud.' };
    }

    try {
      const res = await fetch('/api/pages/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pageInput),
      });

      const data = await res.json();
      if (res.status === 403 || data.code === 'LIMIT_REACHED') {
        return {
          success: false,
          isLimitReached: true,
          error: data.error || 'Free tier limit reached (2/2 pages).',
        };
      }

      if (data.success && data.page) {
        setUserPages((prev) => {
          const index = prev.findIndex((p) => p.id === data.page.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.page;
            return updated;
          }
          return [data.page, ...prev];
        });

        if (typeof data.pagesCreatedCount === 'number' && user) {
          setUser({ ...user, pages_created_count: data.pagesCreatedCount });
        }

        return { success: true, page: data.page, message: data.message };
      }

      return { success: false, error: data.error || 'Failed to save page.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error saving page.' };
    }
  };

  const deleteUserPageFromCloud = async (pageId: string) => {
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUserPages((prev) => prev.filter((p) => p.id !== pageId));
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to delete page' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const duplicateUserPageInCloud = async (pageId: string) => {
    if (!token) return { success: false, error: 'Authentication required' };

    try {
      const res = await fetch(`/api/pages/${pageId}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 403 || data.code === 'LIMIT_REACHED') {
        return { success: false, isLimitReached: true, error: data.error };
      }
      if (data.success && data.page) {
        setUserPages((prev) => [data.page, ...prev]);
        if (typeof data.pagesCreatedCount === 'number' && user) {
          setUser({ ...user, pages_created_count: data.pagesCreatedCount });
        }
        return { success: true, page: data.page };
      }
      return { success: false, error: data.error || 'Failed to duplicate page' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const publishUserPageInCloud = async (
    pageId: string,
    slug: string,
    customDomain?: string,
    compiledHtml?: string
  ): Promise<{
    success: boolean;
    page?: StoredPage;
    liveUrl?: string;
    error?: string;
    isLimitReached?: boolean;
    code?: string;
  }> => {
    if (!token) {
      return { success: false, error: 'Authentication required to publish pages.' };
    }

    try {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slug, customDomain, compiledHtml }),
      });

      const data = await res.json();
      if (res.status === 403 || data.code === 'LIMIT_REACHED') {
        return { success: false, isLimitReached: true, error: data.error };
      }

      if (data.success && data.page) {
        setUserPages((prev) => {
          const index = prev.findIndex((p) => p.id === data.page.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.page;
            return updated;
          }
          return [data.page, ...prev];
        });
        return {
          success: true,
          page: data.page,
          liveUrl: data.liveUrl,
        };
      }

      return { success: false, error: data.error || 'Failed to publish page.', code: data.code };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while publishing.' };
    }
  };

  const unpublishUserPageInCloud = async (
    pageId: string
  ): Promise<{ success: boolean; page?: StoredPage; error?: string }> => {
    if (!token) return { success: false, error: 'Authentication required.' };

    try {
      const res = await fetch(`/api/pages/${pageId}/unpublish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.page) {
        setUserPages((prev) => {
          const index = prev.findIndex((p) => p.id === data.page.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.page;
            return updated;
          }
          return prev;
        });
        return { success: true, page: data.page };
      }
      return { success: false, error: data.error || 'Failed to unpublish.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const checkSlugAvailability = async (
    slug: string,
    excludeId?: string
  ): Promise<{ available: boolean; slug: string }> => {
    try {
      const params = new URLSearchParams({ slug });
      if (excludeId) params.append('excludeId', excludeId);
      const res = await fetch(`/api/pages/check-slug?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return { available: !!data.available, slug: data.slug };
      }
    } catch {
      // fallback
    }
    return { available: true, slug };
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token);
    }
  };

  const isPro = user?.subscription_status === 'active';
  const isAdmin = user?.role === 'admin' || user?.email?.includes('admin') || false;
  const pagesCreatedCount = user?.pages_created_count ?? 0;
  const isLimitReached = !isPro && pagesCreatedCount >= MAX_FREE_PAGES;
  const remainingFreePages = Math.max(0, MAX_FREE_PAGES - pagesCreatedCount);
  const hasPendingPayment = userPayments.some((p) => p.status === 'pending');

  const checkCanPerformAction = (): { allowed: boolean; reason?: string } => {
    if (isPro) {
      return { allowed: true };
    }
    if (isLimitReached) {
      return {
        allowed: false,
        reason: `You have reached your Free Tier limit of ${MAX_FREE_PAGES} landing pages. Upgrade to Pro for unlimited funnels!`,
      };
    }
    return { allowed: true };
  };

  const recordPageAction = async (): Promise<boolean> => {
    if (isPro) return true;

    if (token) {
      try {
        const res = await fetch('/api/user/increment-usage', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          return true;
        } else if (res.status === 403 || data.error === 'LIMIT_REACHED') {
          if (data.user) setUser(data.user);
          return false;
        }
      } catch (e) {
        console.error('Failed to update usage count:', e);
      }
    } else {
      const guestCount = Number(localStorage.getItem('fc_guest_pages_count') || '0');
      if (guestCount >= MAX_FREE_PAGES) {
        return false;
      }
      localStorage.setItem('fc_guest_pages_count', String(guestCount + 1));
      return true;
    }
    return true;
  };

  const upgradeToPro = async () => {
    if (!token) {
      return { success: false, message: 'Please sign in or create a free account first.' };
    }

    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.simulated && data.user) {
          setUser(data.user);
          return { success: true, message: data.message };
        } else if (data.url) {
          window.location.href = data.url;
          return { success: true, url: data.url };
        }
      }
      return { success: false, message: data.error || 'Upgrade failed.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Upgrade request failed.' };
    }
  };

  const submitManualPayment = async (
    method: MoroccanPaymentMethod,
    reference: string,
    amount: number = 100,
    proofImageUrl?: string,
    notes?: string
  ) => {
    if (!token) {
      return { success: false, error: 'Please sign in to submit payment proof.' };
    }

    try {
      const res = await fetch('/api/billing/manual-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          transactionReference: reference,
          amount,
          proofImageUrl,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success && data.payment) {
        setUserPayments((prev) => [data.payment, ...prev]);
        return { success: true, payment: data.payment, message: data.message };
      }
      return { success: false, error: data.error || 'Submission failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error submitting payment.' };
    }
  };

  const fetchAdminPayments = async (): Promise<ManualPaymentRequest[]> => {
    if (!token) return [];
    try {
      const res = await fetch('/api/admin/payments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.payments) {
        return data.payments;
      }
    } catch (e) {
      console.error('Failed to fetch admin payments:', e);
    }
    return [];
  };

  const approveAdminPayment = async (id: string) => {
    if (!token) return { success: false };
    try {
      const res = await fetch(`/api/admin/payments/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (user && data.user && user.id === data.user.id) {
          setUser(data.user);
        }
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const rejectAdminPayment = async (id: string) => {
    if (!token) return { success: false };
    try {
      const res = await fetch(`/api/admin/payments/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return { success: data.success, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const isImpersonating = Boolean(impersonatedUser && realAdminUser);

  const impersonateUser = async (targetUser: UserProfile) => {
    const activeAdminToken = localStorage.getItem('funnelcraft_admin_token') || token;
    if (!activeAdminToken) return { success: false, error: 'No active admin session' };

    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAdminToken}`,
        },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        // Save admin token if not already saved
        if (!localStorage.getItem('funnelcraft_admin_token')) {
          localStorage.setItem('funnelcraft_admin_token', token || '');
        }
        const adminToStore = realAdminUser || user;
        if (adminToStore) {
          localStorage.setItem('funnelcraft_real_admin_user', JSON.stringify(adminToStore));
          setRealAdminUser(adminToStore);
        }

        localStorage.setItem('funnelcraft_impersonated_user', JSON.stringify(data.user));
        localStorage.setItem(TOKEN_KEY, data.token);

        setImpersonatedUser(data.user);
        setUser(data.user);
        setToken(data.token);

        // Fetch target merchant's specific data
        fetchUserPayments(data.token);
        fetchUserPages(data.token);
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to impersonate merchant' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const stopImpersonating = async () => {
    const adminToken = localStorage.getItem('funnelcraft_admin_token');
    const storedAdminStr = localStorage.getItem('funnelcraft_real_admin_user');
    let storedAdmin: UserProfile | null = null;
    try {
      if (storedAdminStr) storedAdmin = JSON.parse(storedAdminStr);
    } catch (_) {}

    localStorage.removeItem('funnelcraft_admin_token');
    localStorage.removeItem('funnelcraft_impersonated_user');
    localStorage.removeItem('funnelcraft_real_admin_user');

    setImpersonatedUser(null);
    setRealAdminUser(null);

    if (adminToken) {
      localStorage.setItem(TOKEN_KEY, adminToken);
      setToken(adminToken);
      if (storedAdmin) {
        setUser(storedAdmin);
      }
      await fetchCurrentUser(adminToken);
    } else if (token) {
      await fetchCurrentUser(token);
    }
  };

  const getAdminAuthHeaders = () => {
    const adminToken = localStorage.getItem('funnelcraft_admin_token') || token;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };
  };

  const fetchAdminUsers = async (): Promise<UserProfile[]> => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        return data.users;
      }
    } catch (e) {
      console.warn('Failed to fetch admin users:', e);
    }
    return [];
  };

  const updateAdminUserPlan = async (
    userId: string,
    planId: 'free' | 'starter' | 'pro' | 'enterprise'
  ) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      return {
        success: data.success,
        user: data.user,
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateAdminUserStatus = async (userId: string, status: 'active' | 'suspended') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      return {
        success: data.success,
        user: data.user,
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteAdminUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      return { success: data.success, message: data.message, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const createAdminUserAccount = async (userData: any) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      return {
        success: data.success,
        user: data.user,
        message: data.message,
        error: data.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const fetchPlatformOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.stats) {
        return data.stats;
      }
    } catch (e) {
      console.warn('Failed to fetch platform overview:', e);
    }
    return null;
  };

  const fetchAdminFunnels = async (): Promise<StoredPage[]> => {
    try {
      const res = await fetch('/api/admin/funnels', {
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.pages)) {
        return data.pages;
      }
    } catch (e) {
      console.warn('Failed to fetch admin funnels:', e);
    }
    return [];
  };

  const fetchAdminOrders = async (): Promise<any[]> => {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        return data.orders;
      }
    } catch (e) {
      console.warn('Failed to fetch admin orders:', e);
    }
    return [];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggedIn: !!user,
        isPro,
        isAdmin,
        isImpersonating,
        impersonatedUser,
        realAdminUser,
        impersonateUser,
        stopImpersonating,
        fetchAdminUsers,
        updateAdminUserPlan,
        updateAdminUserStatus,
        deleteAdminUser,
        createAdminUserAccount,
        fetchPlatformOverview,
        fetchAdminFunnels,
        fetchAdminOrders,
        pagesCreatedCount,
        maxFreePages: MAX_FREE_PAGES,
        isLimitReached,
        remainingFreePages,
        userPayments,
        hasPendingPayment,
        userPages,
        fetchUserPages,
        saveUserPageToCloud,
        deleteUserPageFromCloud,
        duplicateUserPageInCloud,
        publishUserPageInCloud,
        unpublishUserPageInCloud,
        checkSlugAvailability,
        twoFactorData,
        login,
        register,
        loginWithGoogle,
        sendOtp,
        verifyOtp,
        clearTwoFactorState,
        toggle2FA,
        updateProfile,
        logout,
        refreshUser,
        checkCanPerformAction,
        recordPageAction,
        upgradeToPro,
        submitManualPayment,
        fetchAdminPayments,
        approveAdminPayment,
        rejectAdminPayment,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
