import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Truck,
  ArrowUpRight,
  MapPin,
  Sparkles,
  BarChart3,
  Download,
  RefreshCw,
  Crown,
  Layers,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react';
import { SubscriptionPlanId } from '../types/orders';
import { useLanguage } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';

interface AnalyticsDashboardProps {
  currentPlan: SubscriptionPlanId;
  onUpgradeClick: () => void;
  onNavigateToBuilder?: () => void;
}

export interface CityStats {
  city: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface FunnelAnalyticsItem {
  id?: string;
  title: string;
  slug: string;
  visitors: number;
  orders: number;
  cr: string;
  revenue: string;
  status: string;
}

export interface AnalyticsApiResponse {
  success: boolean;
  hasData: boolean;
  totalVisitors: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  deliveryRate: number;
  formStarts: number;
  cityBreakdown: CityStats[];
  topFunnels: FunnelAnalyticsItem[];
}

export const EMPTY_ANALYTICS_MESSAGE_AR =
  'لا توجد بيانات بعد. أنشئ صفحة هبوط وشاركها لتبدأ في رؤية إحصائياتك الحقيقية هنا.';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  currentPlan,
  onUpgradeClick,
  onNavigateToBuilder,
}) => {
  const { t, dir, language } = useLanguage();
  const { user, token, capabilities } = useAuth();
  const isPro =
    capabilities.canUseApiIntegrations ||
    user?.role === 'admin' ||
    user?.email?.trim().toLowerCase() === 'naadianajah2020@gmail.com' ||
    user?.plan_id === 'pro' ||
    user?.plan_id === 'enterprise' ||
    currentPlan === 'pro' ||
    currentPlan === 'enterprise';

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const authToken = token || localStorage.getItem('funnelcraft_auth_token');
      const res = await fetch(`/api/analytics?range=${encodeURIComponent(timeRange)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      if (res.ok) {
        const data = (await res.json()) as AnalyticsApiResponse;
        if (data && data.success) {
          setAnalytics(data);
        }
      }
    } catch (err) {
      console.warn('Analytics fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, timeRange]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const totalVisitors = analytics?.totalVisitors ?? 0;
  const totalOrders = analytics?.totalOrders ?? 0;
  const avgOrderValue = analytics?.avgOrderValue ?? 0;
  const conversionRate = analytics?.conversionRate ?? 0;
  const deliveryRate = analytics?.deliveryRate ?? 0;
  const formStarts = analytics?.formStarts ?? 0;
  const cityList = analytics?.cityBreakdown ?? [];
  const topFunnels = analytics?.topFunnels ?? [];

  const isEmpty =
    !analytics ||
    (!analytics.hasData &&
      totalOrders === 0 &&
      totalVisitors === 0 &&
      topFunnels.length === 0 &&
      cityList.length === 0);

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-4 md:p-6 space-y-5" dir={dir}>
      {/* Top Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>{t.analyticsTitle}</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t.liveSync}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t.analyticsDesc}</p>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchAnalytics()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition cursor-pointer disabled:opacity-50"
            title="تحديث الإحصائيات"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Time Filter Pills */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  timeRange === range
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === '7d'
                  ? language === 'ar'
                    ? '7 أيام'
                    : '7j'
                  : range === '30d'
                  ? language === 'ar'
                    ? '30 يوماً'
                    : '30j'
                  : language === 'ar'
                  ? '3 أشهر'
                  : '90j'}
              </button>
            ))}
          </div>

          {/* Export Report (Pro Feature) */}
          <button
            type="button"
            onClick={isPro ? () => {} : onUpgradeClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isPro
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
            }`}
          >
            {isPro ? (
              <>
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>PDF / Excel</span>
              </>
            ) : (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'ar' ? 'تقرير متقدم (Pro)' : 'Rapport Pro'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Empty State when no real analytics exist yet */}
      {isEmpty ? (
        <div
          data-testid="analytics-empty-state"
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto my-6 space-y-4 shadow-xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <BarChart3 className="w-7 h-7" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-white">
            {EMPTY_ANALYTICS_MESSAGE_AR}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            يتم احتساب الزيارات، معدل التحويل، والمبيعات حسب المدن تلقائياً وفورياً من صفحات الهبوط المنشورة والطلبات الحقيقية المسجلة في حسابك.
          </p>
          {onNavigateToBuilder && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToBuilder}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'ar' ? 'إنشاء صفحة هبوط جديدة' : 'Créer une page de vente'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 4-Card Compact KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Conversion Rate */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>{t.conversionRate}</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {conversionRate}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{t.moroccanCodBenchmark}</p>
            </div>

            {/* KPI 2: Total Visitors */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>{t.visitors}</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {totalVisitors.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {language === 'ar' ? 'زيارات صفحات الهبوط النشطة' : 'Visites uniques actives'}
              </p>
            </div>

            {/* KPI 3: Average Order Value (AOV) */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>{t.aov}</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {avgOrderValue}{' '}
                  <span className="text-xs font-normal text-slate-400">{t.madCurrency}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {language === 'ar' ? 'متوسط قيمة الطلب الفعلي' : 'Panier moyen réel'}
              </p>
            </div>

            {/* KPI 4: Delivery Rate */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>{t.deliveryRate}</span>
                <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {deliveryRate}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {language === 'ar' ? 'الطلبات المؤكدة والمسلمة' : 'Commandes confirmées et livrées'}
              </p>
            </div>
          </div>

          {/* Middle Row: Funnel Conversion Visualizer & City Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Sales Conversion Funnel (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>{t.funnelFunnel}</span>
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    {language === 'ar' ? 'مراحل الشراء المتكاملة' : 'Étapes du tunnel'}
                  </span>
                </div>

                {/* Funnel Step 1: Page Impressions */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">{t.impressions}</span>
                      <span className="text-slate-400">
                        {totalVisitors.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-500">(100%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: totalVisitors > 0 ? '100%' : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Funnel Step 2: Form Interaction */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">{t.formStarts}</span>
                      <span className="text-slate-400">
                        {formStarts.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{
                          width: `${
                            totalVisitors > 0
                              ? Math.min(100, Math.round((formStarts / totalVisitors) * 100))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Funnel Step 3: Orders Placed */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-emerald-300 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t.ordersPlaced}</span>
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {totalOrders}{' '}
                        <span className="text-[10px] text-emerald-500">({conversionRate}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${Math.min(100, conversionRate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">{t.performanceSummary}</span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {totalOrders} {t.ordersCountUnit}
                </span>
              </div>
            </div>

            {/* Regional Breakdown (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>{t.salesByCity}</span>
                </h2>
                <span className="text-[11px] text-slate-400">Top {cityList.length}</span>
              </div>

              {cityList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {EMPTY_ANALYTICS_MESSAGE_AR}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cityList.map((c, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{c.city}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">
                            {c.count} {t.ordersCountUnit}
                          </span>
                          <span className="font-semibold text-white text-[11px]">
                            {c.revenue} {t.madCurrency}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(c.percentage, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Performing Landing Pages Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{t.topFunnels}</span>
                </h2>
              </div>
              {onNavigateToBuilder && (
                <button
                  type="button"
                  onClick={onNavigateToBuilder}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>{language === 'ar' ? 'فتح المحرر' : 'Aller au builder'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {topFunnels.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {EMPTY_ANALYTICS_MESSAGE_AR}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                      <th className="py-2 px-3 text-start font-medium">
                        {language === 'ar' ? 'صفحة الهبوط' : 'Page'}
                      </th>
                      <th className="py-2 px-3 text-start font-medium">{t.visitors}</th>
                      <th className="py-2 px-3 text-start font-medium">{t.ordersPlaced}</th>
                      <th className="py-2 px-3 text-start font-medium">{t.conversionRate}</th>
                      <th className="py-2 px-3 text-start font-medium">{t.totalRevenue}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {topFunnels.map((funnel, i) => (
                      <tr key={funnel.id || i} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-white">{funnel.title}</div>
                          <div className="text-[11px] text-slate-500">/{funnel.slug}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {funnel.visitors.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-semibold">
                          {funnel.orders}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {funnel.cr}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">
                          {funnel.revenue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
