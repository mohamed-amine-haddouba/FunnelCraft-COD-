import React, { useState, useEffect, useMemo } from 'react';
import {
  CustomerOrder,
  OrderStatus,
  SubscriptionPlanId,
} from '../types/orders';
import { useLanguage } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  Truck,
  DollarSign,
  Search,
  Filter,
  Download,
  Share2,
  ExternalLink,
  MessageCircle,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  Crown,
  Sparkles,
  ChevronDown,
  XCircle,
  Check,
  FileSpreadsheet,
  Link as LinkIcon,
  ShoppingBag,
} from 'lucide-react';

interface Props {
  currentPlan: SubscriptionPlanId;
  onUpgradeClick: () => void;
  onNewOrderCreated?: () => void;
}

const MOROCCAN_CITIES = [
  'الدار البيضاء',
  'الرباط',
  'مراكش',
  'طنجة',
  'أكادير',
  'فاس',
  'تطوان',
  'مكناس',
  'وجدة',
  'القنيطرة',
];

const SAMPLE_PRODUCTS = [
  { name: 'ساعة ذكية Ultra Pro مقاومة للماء (شاشة AMOLED)', price: 299 },
  { name: 'بروجيكتور سينمائي مصغر 4K Ultra HD المحمول', price: 499 },
  { name: 'سماعات لاسلكية Pro عازلة للضوضاء ANC', price: 249 },
  { name: 'ماكينة حلاقة كهربائية Vintage T9 للرجال', price: 179 },
  { name: 'حامل هاتف ذكي مغناطيسي للسيارة 360°', price: 149 },
];

const SAMPLE_NAMES = [
  'محمد العلمي',
  'ياسين بناني',
  'سارة الإدريسي',
  'حمزة التازي',
  'زينب الفاسي',
  'أيوب المرابط',
  'هدى المنصوري',
];

export const OrdersDashboard: React.FC<Props> = ({
  currentPlan,
  onUpgradeClick,
  onNewOrderCreated,
}) => {
  const { t, dir, isRtl, language } = useLanguage();
  const { user, capabilities } = useAuth();
  const canExport =
    capabilities.canUseApiIntegrations ||
    capabilities.canExportOrders ||
    user?.role === 'admin' ||
    user?.plan_id === 'pro' ||
    user?.plan_id === 'enterprise' ||
    currentPlan === 'pro' ||
    currentPlan === 'enterprise';
  const isPro = canExport;

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [isSimulatingOrder, setIsSimulatingOrder] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('Ozon Express');
  const [carrierWebhookUrl, setCarrierWebhookUrl] = useState<string>('');

  // Fetch orders from backend (with authenticated Bearer token)
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('funnelcraft_auth_token');
      const res = await fetch('/api/orders', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch orders from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Status mapping
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: t.statusPending,
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          dot: 'bg-amber-400',
        };
      case 'confirmed':
        return {
          label: t.statusConfirmed,
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          dot: 'bg-blue-400',
        };
      case 'shipped':
        return {
          label: t.statusShipped,
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          dot: 'bg-purple-400',
        };
      case 'delivered':
        return {
          label: t.statusDelivered,
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-400',
        };
      case 'cancelled':
        return {
          label: t.statusCancelled,
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          dot: 'bg-rose-400',
        };
      case 'returned':
        return {
          label: t.statusReturned,
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
          dot: 'bg-slate-400',
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  // Update order status (with authenticated Bearer token)
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const authToken = localStorage.getItem('funnelcraft_auth_token');
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(
          language === 'ar'
            ? `تم تحديث حالة الطلب ${orderId}`
            : `Statut mis à jour pour la commande ${orderId}`
        );
      }
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
  };

  // Simulate a live Moroccan COD order
  const handleSimulateOrder = async () => {
    setIsSimulatingOrder(true);
    const randomProduct = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];
    const randomCity = MOROCCAN_CITIES[Math.floor(Math.random() * MOROCCAN_CITIES.length)];
    const randomName = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    const randomPhone = `06${Math.floor(10000000 + Math.random() * 90000000)}`;

    const newOrderPayload = {
      customerName: randomName,
      phone: randomPhone,
      city: randomCity,
      address: `شارع الحسن الثاني، عمارة ${Math.floor(1 + Math.random() * 50)}`,
      productName: randomProduct.name,
      price: randomProduct.price,
      quantity: 1,
      notes: 'طلب فوري تجريبي تم توليده من صفحة الهبوط',
    };

    try {
      const authToken = localStorage.getItem('funnelcraft_auth_token');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(newOrderPayload),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setOrders((prev) => [data.order, ...prev]);
        showToast(t.orderSimulatedSuccess);
        if (onNewOrderCreated) {
          onNewOrderCreated();
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulatingOrder(false);
    }
  };

  // Export orders to CSV (with UTF-8 BOM for Arabic Microsoft Excel support)
  const handleExportCsv = () => {
    if (!canExport) {
      onUpgradeClick();
      return;
    }

    if (orders.length === 0) {
      showToast(language === 'ar' ? 'لا توجد طلبيات للتصدير' : 'Aucune commande à exporter');
      return;
    }

    const headers = [
      'Order ID',
      'Customer Name',
      'Phone',
      'City',
      'Address',
      'Product',
      'Quantity',
      'Total Amount (MAD)',
      'Status',
      'Notes',
      'Created At',
    ];

    const rows = orders.map((o) => [
      `"${o.id}"`,
      `"${o.customerName}"`,
      `"${o.customerPhone}"`,
      `"${o.customerCity}"`,
      `"${o.customerAddress || ''}"`,
      `"${o.productName}"`,
      o.quantity,
      o.price,
      `"${o.status}"`,
      `"${o.customerNotes || ''}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CodWorth-Orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(language === 'ar' ? 'تم تنزيل ملف CSV بنجاح' : 'Fichier CSV téléchargé avec succès');
  };

  // WhatsApp One-Click Confirmation URL Generator
  const getWhatsAppLink = (order: CustomerOrder) => {
    let cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '212' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('212')) {
      cleanPhone = '212' + cleanPhone;
    }

    const storeName = 'CodWorth';
    const message =
      language === 'ar'
        ? `السلام عليكم ${order.customerName}، معك متجر ${storeName} 🚚.\nتوصلنا بالطلب ديالك بخصوص: ${order.productName}\nالمبلغ الإجمالي: ${order.price} درهم (الدفع عند الاستلام مع المعاينة).\nواش نأكدو ليك الإرسال دابا؟ شكراً لك! ✨`
        : `Bonjour ${order.customerName}, confirmation de votre commande ${storeName} 🚚:\nProduit: ${order.productName}\nTotal: ${order.price} DH (Paiement à la livraison).\nMerci de confirmer l'expédition!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !searchQuery ||
        o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerPhone?.includes(searchQuery) ||
        o.customerCity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.productName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = selectedStatus === 'all' || o.status === selectedStatus;
      const matchCity = selectedCity === 'all' || o.customerCity === selectedCity;

      return matchSearch && matchStatus && matchCity;
    });
  }, [orders, searchQuery, selectedStatus, selectedCity]);

  // Metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const confirmedOrders = orders.filter(
    (o) => o.status === 'confirmed' || o.status === 'shipped' || o.status === 'delivered'
  ).length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 p-4 md:p-6 space-y-4" dir={dir}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 end-5 z-50 bg-emerald-500 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <span>{t.ordersTitle}</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              {totalOrders} {t.ordersCountUnit}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t.ordersDesc}</p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Simulate Order Button */}
          <button
            type="button"
            onClick={handleSimulateOrder}
            disabled={isSimulatingOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
          >
            <PlusCircle className={`w-3.5 h-3.5 ${isSimulatingOrder ? 'animate-spin' : ''}`} />
            <span>{isSimulatingOrder ? '...' : t.newTestOrder}</span>
          </button>

          {/* Export CSV with Pro Lock Indicator */}
          <button
            type="button"
            onClick={handleExportCsv}
            data-testid="export-orders-csv-btn"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition ${
              canExport
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
            }`}
          >
            {canExport ? (
              <>
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.exportCsv}</span>
              </>
            ) : (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.exportCsv}</span>
                <span className="text-[10px] bg-amber-500/20 px-1 py-0.2 rounded font-bold">Pro</span>
              </>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchOrders}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title={t.refresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Compact 4-Card KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Orders */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>{t.totalOrders}</span>
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-white tracking-tight">{totalOrders}</div>
        </div>

        {/* Pending Orders */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>{t.pendingOrders}</span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-400 tracking-tight">{pendingOrders}</div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>{t.confirmedOrders}</span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 tracking-tight">{confirmedOrders}</div>
        </div>

        {/* Total Revenue */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>{t.totalRevenue}</span>
            <div className="w-6 h-6 rounded-md bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-white tracking-tight">
            {totalRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-400">{t.madCurrency}</span>
          </div>
        </div>
      </div>

      {/* High-Density Compact Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg ps-8 pe-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Status Filter */}
        <div className="w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">{t.allStatuses}</option>
            <option value="pending">{t.statusPending}</option>
            <option value="confirmed">{t.statusConfirmed}</option>
            <option value="shipped">{t.statusShipped}</option>
            <option value="delivered">{t.statusDelivered}</option>
            <option value="cancelled">{t.statusCancelled}</option>
            <option value="returned">{t.statusReturned}</option>
          </select>
        </div>

        {/* City Filter */}
        <div className="w-auto">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">{t.allCities}</option>
            {MOROCCAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* High-Density Orders Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
                <th className="py-2.5 px-3 text-start font-medium">{t.tableOrder}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableCustomer}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableCity}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableProduct}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableAmount}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableStatus}</th>
                <th className="py-2.5 px-3 text-start font-medium">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    {t.noOrdersFound}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const isPending = order.status === 'pending';

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-800/30 transition ${
                        isPending ? 'bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      {/* Order ID & Date */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] font-semibold text-slate-300">
                          {order.id}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'اليوم'}
                        </div>
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{order.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                          {order.customerPhone}
                        </div>
                      </td>

                      {/* City & Address */}
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-1 font-medium text-slate-300">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{order.customerCity}</span>
                        </div>
                        {order.customerAddress && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                            {order.customerAddress}
                          </div>
                        )}
                      </td>

                      {/* Product */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200 truncate max-w-[200px]">
                          {order.productName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {language === 'ar' ? `الكمية: ${order.quantity}` : `Qté: ${order.quantity}`}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 font-bold text-white">
                        {order.price}{' '}
                        <span className="text-[10px] font-normal text-slate-400">{t.madCurrency}</span>
                      </td>

                      {/* Status Selector Dropdown */}
                      <td className="py-2.5 px-3">
                        <div className="relative inline-block">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleUpdateStatus(order.id, e.target.value as OrderStatus)
                            }
                            className={`text-[11px] font-semibold px-2 py-1 rounded-md border appearance-none pe-5 cursor-pointer focus:outline-none ${badge.bg}`}
                          >
                            <option value="pending" className="bg-slate-900 text-white">
                              {t.statusPending}
                            </option>
                            <option value="confirmed" className="bg-slate-900 text-white">
                              {t.statusConfirmed}
                            </option>
                            <option value="shipped" className="bg-slate-900 text-white">
                              {t.statusShipped}
                            </option>
                            <option value="delivered" className="bg-slate-900 text-white">
                              {t.statusDelivered}
                            </option>
                            <option value="cancelled" className="bg-slate-900 text-white">
                              {t.statusCancelled}
                            </option>
                            <option value="returned" className="bg-slate-900 text-white">
                              {t.statusReturned}
                            </option>
                          </select>
                          <ChevronDown className="w-3 h-3 absolute top-1/2 -translate-y-1/2 end-1.5 pointer-events-none opacity-60" />
                        </div>
                      </td>

                      {/* WhatsApp 1-Click Action */}
                      <td className="py-2.5 px-3">
                        <a
                          href={getWhatsAppLink(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                          title="تأكيد الطلب مباشرة عبر واتساب"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          <span>{t.confirmWhatsApp}</span>
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Export & Delivery Carrier API Integration Card */}
      {canExport ? (
        <div
          className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
          data-testid="delivery-integration-unlocked"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'ar'
                  ? '✅ تصدير الطلبات والربط المباشر مع شركات التوصيل (مفعل لحسابك Pro)'
                  : '✅ Order Export & Delivery Carrier Sync (Active on your Pro Plan)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {language === 'ar'
                ? 'يمكنك تصدير جميع الطلبات بصيغة CSV/Excel أو إرسالها تلقائياً إلى شركة التوصيل المعتمدة لديك.'
                : 'Export orders to CSV/Excel or sync confirmed COD orders directly with your Moroccan delivery carrier.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="Ozon Express">Ozon Express (أوزون إكسبريس)</option>
              <option value="Cathedis">Cathedis (كاتيديس)</option>
              <option value="Amana">Amana (أمانة المغرب)</option>
              <option value="Tawssil">Tawssil / Sendit</option>
            </select>

            <input
              type="url"
              dir="ltr"
              value={carrierWebhookUrl}
              onChange={(e) => setCarrierWebhookUrl(e.target.value)}
              placeholder="https://api.carrier.ma/webhook..."
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-w-[200px]"
            />

            <button
              type="button"
              onClick={() =>
                showToast(
                  language === 'ar'
                    ? `تمت مزامنة الطلبيات مع ${selectedCarrier} بنجاح!`
                    : `Synced orders with ${selectedCarrier}!`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'مزامنة مع شركة التوصيل' : 'Sync Carrier'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.exportCsv}</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          data-testid="delivery-integration-locked"
        >
          <div className="space-y-1">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>🔒 تصدير الطلبات والربط مع شركات التوصيل ميزة حصرية لمشتركي Pro</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {language === 'ar'
                ? 'قم بترقية باقتك إلى Pro أو Enterprise لتفعيل تصدير ملفات Excel/CSV والربط التلقائي مع شركات التوصيل.'
                : 'Upgrade to Pro or Enterprise to unlock CSV/Excel exports and automated delivery carrier webhooks.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer shrink-0"
          >
            {language === 'ar' ? 'ترقية إلى باقة Pro' : 'Upgrade to Pro'}
          </button>
        </div>
      )}
    </div>
  );
};
