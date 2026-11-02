import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isReservedRootPath,
  extractLangFromPath,
  getLanguageConfig,
  type Language,
} from './config';

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isReservedRootPath,
  extractLangFromPath,
  getLanguageConfig,
  type Language,
};

export interface Translations {
  // Navigation & General
  navBuilder: string;
  navOrders: string;
  navAnalytics: string;
  navSettings: string;
  funnelCraft: string;
  codBadge: string;
  templates: string;
  myPages: string;
  aiGenerate: string;
  exportCode: string;
  publish: string;
  published: string;
  liveUrl: string;
  undo: string;
  redo: string;
  desktop: string;
  tablet: string;
  mobile: string;
  preview: string;
  edit: string;
  save: string;
  saving: string;
  saved: string;
  unsaved: string;
  upgrade: string;
  freeBadge: string;
  starterBadge: string;
  proBadge: string;
  enterpriseBadge: string;
  adminPanel: string;
  login: string;
  logout: string;
  language: string;

  // Orders Dashboard
  ordersTitle: string;
  ordersDesc: string;
  totalOrders: string;
  pendingOrders: string;
  confirmedOrders: string;
  totalRevenue: string;
  exportCsv: string;
  searchPlaceholder: string;
  allStatuses: string;
  allCities: string;
  filter: string;
  newTestOrder: string;
  refresh: string;
  tableOrder: string;
  tableCustomer: string;
  tableCity: string;
  tableProduct: string;
  tableAmount: string;
  tableStatus: string;
  tableDate: string;
  tableActions: string;
  confirmWhatsApp: string;
  noOrdersFound: string;
  statusPending: string;
  statusConfirmed: string;
  statusShipped: string;
  statusDelivered: string;
  statusCancelled: string;
  statusReturned: string;
  orderNote: string;
  changeStatus: string;
  ordersCountUnit: string;
  madCurrency: string;
  orderSimulatedSuccess: string;

  // Analytics Dashboard
  analyticsTitle: string;
  analyticsDesc: string;
  conversionRate: string;
  visitors: string;
  aov: string;
  deliveryRate: string;
  salesByCity: string;
  topFunnels: string;
  funnelFunnel: string;
  impressions: string;
  formStarts: string;
  ordersPlaced: string;
  ordersRate: string;
  revenueByCity: string;
  ordersShare: string;
  performanceSummary: string;
  performanceDesc: string;
  moroccanCodBenchmark: string;
  liveSync: string;

  // Settings
  settingsTitle: string;
  settingsDesc: string;
  tabProfile: string;
  tabDomain: string;
  tabSecurity: string;
  saveSettings: string;
  fullName: string;
  email: string;
  phone: string;
  storeName: string;
  customDomainTitle: string;
  customDomainDesc: string;
  domainConnected: string;
  domainPending: string;
  domainVerifyCta: string;
  domainInstruction: string;
  cnameRecord: string;
  cnameValue: string;
  copyCname: string;
  copied: string;
  passwordTitle: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  twoFactorTitle: string;
  twoFactorDesc: string;
  enable2fa: string;

  // Merchant Referrals System
  tabReferrals: string;
  referralsTitle: string;
  referralsDesc: string;
  referralLink: string;
  copyReferralLink: string;
  referralLinkCopied: string;
  merchantsInvited: string;
  rewardsEarned: string;
  referralCommissionRate: string;
  howItWorks: string;
  referralStep1: string;
  referralStep2: string;
  referralStep3: string;
  invitedByFriendBanner: string;
  referralCodeApplied: string;

  // Realistic Moroccan Pricing Tiers & Real Features
  pricingBadge: string;
  pricingTitle: string;
  pricingSubtitle: string;
  billedMonthly: string;
  billedAnnually: string;
  save20Percent: string;
  perMonth: string;
  includedFeaturesLabel: string;
  tierPopularBadge: string;
  tierBusinessBadge: string;
  tierStarterName: string;
  tierStarterSub: string;
  tierStarterLimits: string;
  tierStarterDesc: string;
  tierStarterCta: string;
  tierStarterFeat1: string;
  tierStarterFeat2: string;
  tierStarterFeat3: string;
  tierStarterFeat4: string;
  tierStarterFeat5: string;
  tierProName: string;
  tierProSub: string;
  tierProLimits: string;
  tierProDesc: string;
  tierProCta: string;
  tierProFeat1: string;
  tierProFeat2: string;
  tierProFeat3: string;
  tierProFeat4: string;
  tierProFeat5: string;
  tierBusinessName: string;
  tierBusinessSub: string;
  tierBusinessLimits: string;
  tierBusinessDesc: string;
  tierBusinessCta: string;
  tierBusinessFeat1: string;
  tierBusinessFeat2: string;
  tierBusinessFeat3: string;
  tierBusinessFeat4: string;

  // Pro Gating & Paywall
  proFeatureTitle: string;
  proFeatureDesc: string;
  proFeatureBadge: string;
  unlockWithPro: string;
  upgradeModalTitle: string;
  upgradeModalSub: string;
  choosePayment: string;
  bankTransfer: string;
  paypalCard: string;
  cihBank: string;
  attijariBank: string;
  chaabiBank: string;
  cashPlus: string;
  submitProof: string;
  transactionRef: string;

  // Auth Page & Security Gate
  authTitleLogin: string;
  authSubLogin: string;
  authTitleRegister: string;
  authSubRegister: string;
  authLoginTab: string;
  authRegisterTab: string;
  authEmailLabel: string;
  authPasswordLabel: string;
  authFullNameLabel: string;
  authStoreNameLabel: string;
  authPhoneLabel: string;
  authRememberMe: string;
  authForgotPassword: string;
  authSignInBtn: string;
  authSignUpBtn: string;
  authOrContinueWith: string;
  authGoogleSignIn: string;
  authQuickDemoMerchant: string;
  authQuickDemoBadge: string;
  authShowcaseTitle: string;
  authShowcaseDesc: string;
  authShowcaseStat1Title: string;
  authShowcaseStat1Sub: string;
  authShowcaseStat2Title: string;
  authShowcaseStat2Sub: string;
  authShowcaseBadge: string;
  authPasswordWeak: string;
  authPasswordFair: string;
  authPasswordGood: string;
  authPasswordStrong: string;
  authTermsNotice: string;
  authSimulate2fa: string;

  // 2FA OTP Modal / View
  tfaTitle: string;
  tfaSub: string;
  tfaWhatsAppOption: string;
  tfaEmailOption: string;
  tfaOtpPlaceholder: string;
  tfaVerifyBtn: string;
  tfaResendCode: string;
  tfaResendIn: string;
  tfaDeviceVerified: string;
  tfaBackToLogin: string;
  tfaInvalidCode: string;
  tfaCodeSentToast: string;
  tfaDevPreviewBanner: string;
  tfaSelectChannel: string;
  tfaTtlBadge: string;
  tfaVerifiedToast: string;
  authRequiredFieldsError: string;
  authPasswordMinLengthError: string;
  authPasswordStrengthLabel: string;
  authTopMoroccanCities: string;
  authForgotSentDesc: string;
  authForgotPromptDesc: string;
  authForgotSendBtn: string;
  authCancelBtn: string;
  authOkBtn: string;

  // Multi-Tier Roles & Live Storefront
  navAdminPortal: string;
  customerLiveView: string;
  storefrontLivePreview: string;
  exitStorefront: string;
  quickRoleSwitcher: string;
  roleOwner: string;
  roleMerchantPro: string;
  roleMerchantStarter: string;
  roleMerchantFree: string;
  impersonationReturnBtn: string;

  // Public Landing Page Hero Section
  'home.hero.badge': string;
  'home.hero.headlineLine1': string;
  'home.hero.headlineLine2Accent': string;
  'home.hero.subheadline': string;
  'home.hero.ctaPrimary': string;
  'home.hero.ctaSecondary': string;
  'home.hero.socialProof': string;
  'home.hero.revenueCardLabel': string;
  'home.hero.revenueCardValue': string;
  'home.hero.productCardLabel': string;
  'home.hero.productCardValue': string;
  'home.hero.nav.login': string;
  'home.hero.nav.signup': string;
  'home.hero.nav.home': string;
  'home.hero.nav.features': string;
  'home.hero.nav.pricing': string;
  'home.hero.nav.templates': string;
  'home.hero.brandName': string;

  // Standalone AI Page Builder Workspace
  navAiBuilder: string;
  aiBuilderTitle: string;
  aiBuilderSubtitle: string;
  aiBuilderPlaceholder: string;
  aiBuilderAttachFile: string;
  aiBuilderProductPage: string;
  aiBuilderModeProductPage: string;
  aiBuilderModeCodFunnel: string;
  aiBuilderModeUrlImport: string;
  aiBuilderGenerate: string;
  aiBuilderGenerating: string;
  aiBuilderScrapingUrl: string;
  aiBuilderNewChat: string;
  aiBuilderChatHistory: string;
  aiBuilderHistoryEmpty: string;
  aiBuilderHistoryClear: string;
  aiBuilderHistoryUsePrompt: string;
  aiBuilderPlanLockedBadge: string;
  aiBuilderPlanLockedTitle: string;
  aiBuilderPlanLockedDesc: string;
  aiBuilderUpgradeCta: string;
  aiBuilderIllegalContentError: string;
  aiBuilderAttachedFileLabel: string;
  aiBuilderRemoveFile: string;
  aiBuilderQuickSuggestionsLabel: string;
  aiBuilderSuggestion1: string;
  aiBuilderSuggestion2: string;
  aiBuilderSuggestion3: string;
}

export const translations: Record<Language, Translations> = {
  ar: {
    // Navigation
    navBuilder: 'محرر الصفحات',
    navOrders: 'الطلبيات والمبيعات',
    navAnalytics: 'الإحصائيات والتحليلات',
    navSettings: 'الإعدادات والدومين',
    funnelCraft: 'CodWorth',
    codBadge: 'COD المغرب',
    templates: 'القوالب',
    myPages: 'صفحاتي',
    aiGenerate: 'توليد بالذكاء الاصطناعي',
    exportCode: 'تصدير الكود',
    publish: 'نشر الصفحة',
    published: 'منشور',
    liveUrl: 'الرابط المباشر',
    undo: 'تراجع',
    redo: 'إعادة',
    desktop: 'حاسوب',
    tablet: 'تابلت',
    mobile: 'هاتف',
    preview: 'معاينة',
    edit: 'تعديل',
    save: 'حفظ',
    saving: 'جار الحفظ...',
    saved: 'تم الحفظ',
    unsaved: 'تعديلات غير محفوظة',
    upgrade: 'ترقية الحساب',
    freeBadge: 'باقة مجانية',
    starterBadge: 'Starter',
    proBadge: 'Pro 👑',
    enterpriseBadge: 'Enterprise',
    adminPanel: 'التحقق من الدفعات',
    login: 'تسجيل الدخول',
    logout: 'خروج',
    language: 'اللغة',

    // Orders
    ordersTitle: 'سجل طلبيات الدفع عند الاستلام (COD)',
    ordersDesc: 'متابعة وتأكيد مبيعات صفحات الهبوط لمتجرك في المدن المغربية',
    totalOrders: 'إجمالي الطلبيات',
    pendingOrders: 'في انتظار التأكيد',
    confirmedOrders: 'تم التأكيد والشحن',
    totalRevenue: 'إجمالي المداخيل',
    exportCsv: 'تصدير CSV',
    searchPlaceholder: 'ابحث باسم الزبون، الهاتف، أو المدينة...',
    allStatuses: 'جميع الحالات',
    allCities: 'جميع المدن المغربية',
    filter: 'تصفية',
    newTestOrder: 'طلب تجريبي',
    refresh: 'تحديث',
    tableOrder: 'رقم الطلب',
    tableCustomer: 'الزبون والهاتف',
    tableCity: 'المدينة والعنوان',
    tableProduct: 'المنتج والكمية',
    tableAmount: 'المبلغ',
    tableStatus: 'الحالة',
    tableDate: 'التاريخ',
    tableActions: 'تأكيد سريع',
    confirmWhatsApp: 'واتساب',
    noOrdersFound: 'لا توجد طلبيات تطابق معايير البحث',
    statusPending: 'قيد الانتظار',
    statusConfirmed: 'تم التأكيد',
    statusShipped: 'تم الشحن',
    statusDelivered: 'تم التسليم',
    statusCancelled: 'ملغاة',
    statusReturned: 'راجعة',
    orderNote: 'ملاحظة',
    changeStatus: 'تغيير الحالة',
    ordersCountUnit: 'طلب',
    madCurrency: 'د.م',
    orderSimulatedSuccess: 'تم إنشاء طلب تجريبي جديد بنجاح',

    // Analytics
    analyticsTitle: 'لوحة التحليلات والإحصائيات',
    analyticsDesc: 'مؤشرات الأداء ومعدل التحويل ومبيعات المدن المغربية لصفحاتك',
    conversionRate: 'معدل التحويل (CR)',
    visitors: 'إجمالي الزيارات',
    aov: 'متوسط قيمة الطلب',
    deliveryRate: 'نسبة التسليم التقديرية',
    salesByCity: 'توزيع الطلبيات حسب المدن المغربية',
    topFunnels: 'أفضل صفحات الهبوط أداءً',
    funnelFunnel: 'مسار التحويل البيعي',
    impressions: 'زيارات الصفحة',
    formStarts: 'بدء ملء النموذج',
    ordersPlaced: 'إتمام الطلب بنجاح',
    ordersRate: 'نسبة الإتمام',
    revenueByCity: 'المداخيل حسب المدينة',
    ordersShare: 'حصة الطلبيات',
    performanceSummary: 'ملخص أداء المتجر',
    performanceDesc: 'تظهر البيانات أن الدار البيضاء ومراكش وطنجة تقود أعلى معدلات الشراء.',
    moroccanCodBenchmark: 'معيار COD بالمغرب: معدل تحويل ممتاز (+3.8%)',
    liveSync: 'تحديث حي ومباشر',

    // Settings
    settingsTitle: 'إعدادات الحساب والمتجر',
    settingsDesc: 'إدارة الملف الشخصي، ربط النطاق الخاص (Custom Domain)، والأمان',
    tabProfile: 'الملف الشخصي',
    tabDomain: 'الدومين المخصص',
    tabSecurity: 'الأمان وكلمة المرور',
    saveSettings: 'حفظ التعديلات',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف (واتساب)',
    storeName: 'اسم المتجر / العلامة التجارية',
    customDomainTitle: 'ربط النطاق الخاص بك (Custom Domain)',
    customDomainDesc: 'اربط دومينك الخاص مثل store.ma لزيادة ثقة المشترين في المغرب',
    domainConnected: 'الدومين متصل ويعمل بنجاح (SSL مفعل)',
    domainPending: 'في انتظار التحقق من DNS',
    domainVerifyCta: 'تحقق من الربط',
    domainInstruction: 'أضف سجل CNAME في مزود النطاق الخاص بك لتوجيه الزوار إلى متجرك',
    cnameRecord: 'سجل CNAME',
    cnameValue: 'domains.codworth.me',
    copyCname: 'نسخ القيمة',
    copied: 'تم النسخ!',
    passwordTitle: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    twoFactorTitle: 'التحقق بخطوتين (2FA)',
    twoFactorDesc: 'تأمين إضافي لحسابك يتطلب رمز تأكيد عند تسجيل الدخول',
    enable2fa: 'تفعيل التحقق بخطوتين',

    // Merchant Referrals System (AR)
    tabReferrals: 'الإحالات',
    referralsTitle: 'برنامج إحالة التجار',
    referralsDesc: 'شارك رابط الإحالة الخاص بك واكسب مكافآت وعمولات مع كل تاجر جديد يشترك في المنصة.',
    referralLink: 'رابط الإحالة الخاص بك',
    copyReferralLink: 'نسخ الرابط',
    referralLinkCopied: 'تم نسخ رابط الإحالة بنجاح!',
    merchantsInvited: 'التجار المدعوون',
    rewardsEarned: 'المكافآت المحققة',
    referralCommissionRate: 'نسبة العمولة',
    howItWorks: 'كيف يعمل النظام؟',
    referralStep1: '1. شارك رابط الإحالة الفريد الخاص بك مع التجار وأصحاب المتاجر.',
    referralStep2: '2. يسجل التاجر في المنصة ويبدأ باستخدام باقاتنا الاحترافية.',
    referralStep3: '3. احصل على عمولة ومكافأة فورية تضاف إلى رصيدك.',
    invitedByFriendBanner: 'لقد تمت دعوتك بواسطة صديق! 🎁',
    referralCodeApplied: 'كود الإحالة مفعل',

    // Realistic Moroccan Pricing Tiers & Real Features (AR)
    pricingBadge: 'باقات مرنة مصممة لتجار الدفع عند الاستلام COD بالمغرب',
    pricingTitle: 'اختر الباقة المناسبة لنمو متجرك',
    pricingSubtitle: 'أسعار مناسبة للسوق المغربي بالدرهم (99، 199، 299 درهم/شهر) مع خصم 20% عند الدفع السنوي.',
    billedMonthly: 'دفع شهري',
    billedAnnually: 'دفع سنوي',
    save20Percent: 'وفر 20%',
    perMonth: 'شهر',
    includedFeaturesLabel: 'المميزات المتوفرة في الباقة:',
    tierPopularBadge: 'الأكثر شعبية ⭐',
    tierBusinessBadge: 'للشركات والوكالات 🚀',
    tierStarterName: 'المبتدئ (Starter)',
    tierStarterSub: '99 درهم / شهر',
    tierStarterLimits: '2 صفحات • 100 طلب/شهر • 1,000 زيارة/شهر',
    tierStarterDesc: 'انطلاقة مثالية للتجار المبتدئين لاختبار المنتجات وإطلاق صفحات الهبوط.',
    tierStarterCta: 'اشترك في باقة المبتدئ',
    tierStarterFeat1: 'محرر الصفحات الاحترافي (Page Builder)',
    tierStarterFeat2: 'استيراد المنتجات بـ 3 طبقات (3-Layer Scraper)',
    tierStarterFeat3: 'استمارة الدفع عند الاستلام (COD Form)',
    tierStarterFeat4: 'تحليلات أساسية للمبيعات (Basic Analytics)',
    tierStarterFeat5: 'التحقق عبر البريد الإلكتروني (Email Verification)',
    tierProName: 'بريميوم (Professional)',
    tierProSub: '199 درهم / شهر',
    tierProLimits: '5 صفحات • 500 طلب/شهر • 5,000 زيارة/شهر',
    tierProDesc: 'الباقة الأكثر طلباً للتجار المحترفين مع الدومين المخصص، البيكسل، والذكاء الاصطناعي.',
    tierProCta: 'اشترك في باقة بريميوم',
    tierProFeat1: 'كل مميزات باقة المبتدئ (Everything in Starter)',
    tierProFeat2: 'ربط الدومين المخصص (Custom Domain)',
    tierProFeat3: 'بيكسل فيسبوك وتيك توك (Facebook & TikTok Pixels)',
    tierProFeat4: 'تحليلات وإحصائيات متقدمة (Advanced Analytics)',
    tierProFeat5: 'توليد الصفحات بالذكاء الاصطناعي (AI Page Generation - Gemini)',
    tierBusinessName: 'الأعمال (Business)',
    tierBusinessSub: '299 درهم / شهر',
    tierBusinessLimits: 'صفحات، طلبات، وزيارات غير محدودة',
    tierBusinessDesc: 'حل متكامل بلا حدود للمتاجر الكبرى مع ربط شركات الشحن ودعم فني ذو أولوية.',
    tierBusinessCta: 'اشترك في باقة الأعمال',
    tierBusinessFeat1: 'كل مميزات باقة بريميوم (Everything in Professional)',
    tierBusinessFeat2: 'الربط مع شركات الشحن والتوصيل (Shipping API Integrations)',
    tierBusinessFeat3: 'صفحات وطلبات وزيارات غير محدودة (Unlimited Everything)',
    tierBusinessFeat4: 'دعم فني ذو أولوية (Priority Support)',

    // Pro Gating & Paywall
    proFeatureTitle: 'ميزة حصرية لمشتركي باقة Pro 👑',
    proFeatureDesc: 'قم بترقية حسابك للوصول غير المحدود إلى هذه الميزة ومضاعفة مبيعاتك.',
    proFeatureBadge: 'Pro Feature 👑',
    unlockWithPro: 'افتح الميزة - ترقية إلى Pro',
    upgradeModalTitle: 'اختر الباقة المناسبة لتنمية متجرك',
    upgradeModalSub: 'دفع فوري عبر البنوك المغربية أو بطاقات الائتمان / PayPal',
    choosePayment: 'طريقة الدفع',
    bankTransfer: 'تحويل بنكي محلي (المغرب)',
    paypalCard: 'بطاقة مصرفية / PayPal',
    cihBank: 'CIH Bank',
    attijariBank: 'Attijariwafa Bank',
    chaabiBank: 'Banque Populaire (الشعبي)',
    cashPlus: 'كاش بلوس (Cash Plus)',
    submitProof: 'إرسال وصل التحويل للتحقق',
    transactionRef: 'رقم المعاملة / الوصل',

    // Auth & Security Gate (Arabic)
    authTitleLogin: 'تسجيل الدخول إلى حساب التاجر',
    authSubLogin: 'أدخل بياناتك لإدارة صفحات الهبوط ومتابعة طلبيات الدفع عند الاستلام',
    authTitleRegister: 'إنشاء حساب تاجر جديد',
    authSubRegister: 'ابدأ مجاناً وأطلق صفحات بيع احترافية متوافقة مع السوق المغربي',
    authLoginTab: 'تسجيل الدخول',
    authRegisterTab: 'حساب جديد',
    authEmailLabel: 'البريد الإلكتروني',
    authPasswordLabel: 'كلمة المرور',
    authFullNameLabel: 'الاسم الكامل للتاجر',
    authStoreNameLabel: 'اسم المتجر / العلامة التجارية',
    authPhoneLabel: 'رقم الهاتف (واتساب المغرب)',
    authRememberMe: 'تذكر هذا الجهاز لمدة 30 يوماً',
    authForgotPassword: 'نسيت كلمة المرور؟',
    authSignInBtn: 'تسجيل الدخول ومتابعة العمل',
    authSignUpBtn: 'إنشاء حساب تاجر والبدء مجاناً',
    authOrContinueWith: 'أو المتابعة السريعة عبر',
    authGoogleSignIn: 'تسجيل الدخول عبر Google',
    authQuickDemoMerchant: 'ملء بيانات التاجر التجريبي',
    authQuickDemoBadge: 'تجربة سريعة',
    authShowcaseTitle: 'المنصة المغربية الأولى لمضاعفة مبيعات الـ COD',
    authShowcaseDesc: 'صفحات هبوط فائقة السرعة، نماذج دفع عند الاستلام محكمة، وتتبع مباشر للطلبيات في كافة المدن المغربية.',
    authShowcaseStat1Title: '+4.2% معدل التحويل',
    authShowcaseStat1Sub: 'أعلى من متوسط متاجر الـ COD التقليدية',
    authShowcaseStat2Title: '83.4% تسليم ناجح',
    authShowcaseStat2Sub: 'تأكيد فوري للطلبات عبر واتساب',
    authShowcaseBadge: 'نظام آمن 100% 🇲🇦',
    authPasswordWeak: 'ضعيفة جداً',
    authPasswordFair: 'متوسطة',
    authPasswordGood: 'جيدة',
    authPasswordStrong: 'قوية ومحمية',
    authTermsNotice: 'بتسجيلك، فإنك توافق على شروط الاستخدام وسياسة الخصوصية لمنصة CodWorth.',
    authSimulate2fa: 'تفعيل التحقق الثنائي (2FA) لهذا الجهاز',

    // 2FA OTP Modal / View (Arabic)
    tfaTitle: 'التحقق الأمني بخطوتين (2FA)',
    tfaSub: 'لحماية حسابك وأموالك، يرجى إدخال رمز الأمان المكون من 6 أرقام المرسل إليك.',
    tfaWhatsAppOption: '📱 رسالة واتساب (WhatsApp OTP)',
    tfaEmailOption: '📧 البريد الإلكتروني (Email OTP)',
    tfaOtpPlaceholder: 'أدخل الرمز 6 أرقام',
    tfaVerifyBtn: 'تأكيد الرمز والدخول للمنصة',
    tfaResendCode: 'إعادة إرسال الرمز',
    tfaResendIn: 'إعادة الإرسال بعد',
    tfaDeviceVerified: 'جهاز موثوق • IP مغربي تم التحقق منه',
    tfaBackToLogin: 'العودة لتسجيل الدخول',
    tfaInvalidCode: 'رمز التحقق غير صحيح، يرجى التأكد وإعادة المحاولة.',
    tfaCodeSentToast: 'تم إرسال رمز الأمان بنجاح!',
    tfaDevPreviewBanner: 'رمز التحقق السريع لبيئة المعاينة:',
    tfaSelectChannel: 'اختر وسيلة استلام الرمز:',
    tfaTtlBadge: 'صالح لـ 5 دقائق',
    tfaVerifiedToast: 'تم تأكيد الرمز وتأمين الدخول!',
    authRequiredFieldsError: 'يرجى ملء جميع الحقول المطلوبة',
    authPasswordMinLengthError: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    authPasswordStrengthLabel: 'قوة كلمة المرور:',
    authTopMoroccanCities: 'المدن الأكثر طلباً وتحويلاً في المغرب',
    authForgotSentDesc: 'إذا كان البريد مسجلاً لدينا، فقد تم إرسال رابط إعادة تعيين كلمة المرور.',
    authForgotPromptDesc: 'أدخل بريدك الإلكتروني لاستلام رابط إعادة تعيين كلمة المرور.',
    authForgotSendBtn: 'إرسال الرابط',
    authCancelBtn: 'إلغاء',
    authOkBtn: 'حسناً',

    // Multi-Tier Roles & Live Storefront
    navAdminPortal: '👑 لوحة المالك (Admin)',
    customerLiveView: 'معاينة كزبون',
    storefrontLivePreview: 'معاينة متجر الزبائن الحقيقي (COD Storefront)',
    exitStorefront: '✕ إنهاء المعاينة والعودة للوحة التحكم',
    quickRoleSwitcher: '⚡ تجربة الحسابات والأدوار فوراً (Quick Role Switcher)',
    roleOwner: '👑 المالك / الأدمن (هدوبة)',
    roleMerchantPro: '🏪 تاجر Pro (يوسف)',
    roleMerchantStarter: '💄 تاجر Starter (سلمى)',
    roleMerchantFree: '🛒 تاجر مجاني (كريم)',
    impersonationReturnBtn: '↩️ العودة للوحة تحكم المالك (Admin)',

    // Public Landing Page Hero Section (Arabic)
    'home.hero.badge': '✨ المنصة المغربية الأولى للدفع عند الاستلام (COD)',
    'home.hero.headlineLine1': 'أنشئ صفحات هبوط COD احترافية في دقائق',
    'home.hero.headlineLine2Accent': 'وضاعف مبيعاتك',
    'home.hero.subheadline': 'صمم صفحات هبوط عالية التحويل لبيع منتجاتك بالدفع عند الاستلام بالمغرب. بدون الحاجة لخبرة في البرمجة، وكل سهولة من هاتفك أو حاسوبك.',
    'home.hero.ctaPrimary': 'ابدأ تجربتك المجانية الآن',
    'home.hero.ctaSecondary': 'شاهد كيف يعمل',
    'home.hero.socialProof': '+5,000 تاجر مغربي يثق بنا',
    'home.hero.revenueCardLabel': 'الطلبات اليومية',
    'home.hero.revenueCardValue': '12,450 درهم',
    'home.hero.productCardLabel': 'العرض على المتن',
    'home.hero.productCardValue': '249 درهم',
    'home.hero.nav.login': 'تسجيل الدخول',
    'home.hero.nav.signup': 'أنشئ حسابك مجاناً',
    'home.hero.nav.home': 'الرئيسية',
    'home.hero.nav.features': 'المميزات',
    'home.hero.nav.pricing': 'الأسعار',
    'home.hero.nav.templates': 'قوالب',
    'home.hero.brandName': 'CodWorth / كود ورث',

    // Standalone AI Page Builder Workspace (Arabic)
    navAiBuilder: 'منشئ الصفحات AI',
    aiBuilderTitle: 'منشئ الصفحات AI',
    aiBuilderSubtitle: 'صف منتجك بالتفصيل أو الصق رابط منتج من AliExpress أو Shopify أو YouCan لتوليد صفحة هبوط COD عالية التحويل في ثوانٍ.',
    aiBuilderPlaceholder: 'صف منتجك أو الصق رابطاً ...',
    aiBuilderAttachFile: 'إرفاق ملف',
    aiBuilderProductPage: 'صفحة منتج',
    aiBuilderModeProductPage: 'صفحة منتج متكاملة',
    aiBuilderModeCodFunnel: 'صفحة عرض الدفع عند الاستلام (COD)',
    aiBuilderModeUrlImport: 'استيراد ذكي من رابط منتج',
    aiBuilderGenerate: 'توليد',
    aiBuilderGenerating: 'جاري توليد الصفحة...',
    aiBuilderScrapingUrl: 'جاري سحب بيانات المنتج وتوليد الصفحة...',
    aiBuilderNewChat: 'دردشة جديدة +',
    aiBuilderChatHistory: 'سجل المحادثات',
    aiBuilderHistoryEmpty: 'لا توجد محادثات أو عمليات توليد سابقة حتى الآن.',
    aiBuilderHistoryClear: 'مسح السجل',
    aiBuilderHistoryUsePrompt: 'استخدام هذا الوصف',
    aiBuilderPlanLockedBadge: 'ميزة حصرية لباقة بريميوم والأعمال 👑',
    aiBuilderPlanLockedTitle: 'منشئ الصفحات بالذكاء الاصطناعي متاح في باقة بريميوم (Pro) والأعمال (Business)',
    aiBuilderPlanLockedDesc: 'حسابك الحالي على باقة المبتدئ أو المجانية. قم بترقية اشتراكك لتوليد صفحات هبوط احترافية بالذكاء الاصطناعي واستيراد المنتجات بنقرة واحدة.',
    aiBuilderUpgradeCta: 'ترقية الباقة الآن',
    aiBuilderIllegalContentError: 'عذراً، لا يمكن توليد صفحات لمنتجات غير قانونية أو محظورة (مثل الأسلحة، المواد المخدرة، المنتجات المقلدة، أو الأنشطة الاحتيالية). يرجى إدخال منتج تجاري قانوني.',
    aiBuilderAttachedFileLabel: 'ملف مرفق:',
    aiBuilderRemoveFile: 'إزالة المرفق',
    aiBuilderQuickSuggestionsLabel: 'أمثلة سريعة للتجربة:',
    aiBuilderSuggestion1: 'ساعة ذكية رياضية مقاومة للماء مع قياس نبضات القلب وخصم 50% والدفع عند الاستلام في المغرب',
    aiBuilderSuggestion2: 'خلاط محمول قابل للشحن USB لتحضير العصائر الطازجة مع عرض قطعتين بسعر خاص وتوصيل مجاني',
    aiBuilderSuggestion3: 'سيروم الكولاجين الطبيعي للعناية بالبشرة وإزالة التجاعيد مع ضمان استرجاع الأموال',
  },

  fr: {
    // Navigation
    navBuilder: 'Éditeur de Pages',
    navOrders: 'Commandes & Ventes',
    navAnalytics: 'Analytique & Stats',
    navSettings: 'Paramètres & Domaine',
    funnelCraft: 'CodWorth',
    codBadge: 'COD Maroc',
    templates: 'Modèles',
    myPages: 'Mes Pages',
    aiGenerate: 'Générateur IA',
    exportCode: 'Exporter le Code',
    publish: 'Publier la Page',
    published: 'Publié',
    liveUrl: 'Lien Direct',
    undo: 'Annuler',
    redo: 'Rétablir',
    desktop: 'Bureau',
    tablet: 'Tablette',
    mobile: 'Mobile',
    preview: 'Aperçu',
    edit: 'Modifier',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    unsaved: 'Non enregistré',
    upgrade: 'Passer à Pro',
    freeBadge: 'Gratuit',
    starterBadge: 'Starter',
    proBadge: 'Pro 👑',
    enterpriseBadge: 'Enterprise',
    adminPanel: 'Vérification Paiements',
    login: 'Connexion',
    logout: 'Déconnexion',
    language: 'Langue',

    // Orders
    ordersTitle: 'Commandes Paiement à la Livraison (COD)',
    ordersDesc: 'Suivi et confirmation des ventes de vos pages de vente au Maroc',
    totalOrders: 'Total Commandes',
    pendingOrders: 'En Attente',
    confirmedOrders: 'Confirmées & Expédiées',
    totalRevenue: 'Chiffre d\'Affaires',
    exportCsv: 'Exporter CSV',
    searchPlaceholder: 'Rechercher par nom, téléphone, ville...',
    allStatuses: 'Tous les statuts',
    allCities: 'Toutes les villes marocaines',
    filter: 'Filtrer',
    newTestOrder: 'Commande Test',
    refresh: 'Actualiser',
    tableOrder: 'N° Commande',
    tableCustomer: 'Client & Téléphone',
    tableCity: 'Ville & Adresse',
    tableProduct: 'Produit & Qté',
    tableAmount: 'Montant',
    tableStatus: 'Statut',
    tableDate: 'Date',
    tableActions: 'Confirmation',
    confirmWhatsApp: 'WhatsApp',
    noOrdersFound: 'Aucune commande ne correspond à vos critères',
    statusPending: 'En attente',
    statusConfirmed: 'Confirmée',
    statusShipped: 'Expédiée',
    statusDelivered: 'Livrée',
    statusCancelled: 'Annulée',
    statusReturned: 'Retournée',
    orderNote: 'Note',
    changeStatus: 'Changer le statut',
    ordersCountUnit: 'cmd',
    madCurrency: 'DH',
    orderSimulatedSuccess: 'Nouvelle commande test simulée avec succès',

    // Analytics
    analyticsTitle: 'Tableau de Bord Analytique',
    analyticsDesc: 'KPIs en temps réel, taux de conversion et ventes par ville marocaine',
    conversionRate: 'Taux de Conversion (CR)',
    visitors: 'Visiteurs Uniques',
    aov: 'Panier Moyen (AOV)',
    deliveryRate: 'Taux de Livraison Estimé',
    salesByCity: 'Répartition des Ventes par Ville',
    topFunnels: 'Pages les Plus Performantes',
    funnelFunnel: 'Entonnoir de Conversion',
    impressions: 'Visites de Page',
    formStarts: 'Début Formulaire',
    ordersPlaced: 'Commandes Finalisées',
    ordersRate: 'Taux Final',
    revenueByCity: 'Revenus par Ville',
    ordersShare: 'Part des Commandes',
    performanceSummary: 'Résumé des Performances',
    performanceDesc: 'Casablanca, Rabat et Marrakech affichent les meilleurs taux de conversion.',
    moroccanCodBenchmark: 'Benchmark COD Maroc : Excellente performance (+3.8%)',
    liveSync: 'Synchronisation en direct',

    // Settings
    settingsTitle: 'Paramètres du Compte & Boutique',
    settingsDesc: 'Gérez votre profil, nom de domaine personnalisé et sécurité',
    tabProfile: 'Profil',
    tabDomain: 'Domaine Personnalisé',
    tabSecurity: 'Sécurité & 2FA',
    saveSettings: 'Enregistrer',
    fullName: 'Nom Complet',
    email: 'Adresse Email',
    phone: 'Téléphone (WhatsApp)',
    storeName: 'Nom de la Boutique / Marque',
    customDomainTitle: 'Liez votre Nom de Domaine Personnalisé',
    customDomainDesc: 'Connectez un domaine comme boutique.ma pour renforcer la confiance des acheteurs',
    domainConnected: 'Domaine connecté et actif (SSL actif)',
    domainPending: 'En attente de vérification DNS',
    domainVerifyCta: 'Vérifier la connexion',
    domainInstruction: 'Ajoutez un enregistrement CNAME chez votre registraire DNS pour lier votre domaine',
    cnameRecord: 'Enregistrement CNAME',
    cnameValue: 'domains.codworth.me',
    copyCname: 'Copier la valeur',
    copied: 'Copié !',
    passwordTitle: 'Modifier le Mot de Passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    twoFactorTitle: 'Authentification à Deux Facteurs (2FA)',
    twoFactorDesc: 'Sécurisez votre compte en exigeant un code de vérification à chaque connexion',
    enable2fa: 'Activer la 2FA',

    // Merchant Referrals System (FR)
    tabReferrals: 'Parrainages',
    referralsTitle: 'Programme de Parrainage Marchand',
    referralsDesc: 'Partagez votre lien de parrainage et gagnez des récompenses et commissions pour chaque nouveau marchand.',
    referralLink: 'Votre lien de parrainage',
    copyReferralLink: 'Copier le lien',
    referralLinkCopied: 'Lien de parrainage copié avec succès !',
    merchantsInvited: 'Marchands invités',
    rewardsEarned: 'Gains cumulés',
    referralCommissionRate: 'Taux de commission',
    howItWorks: 'Comment ça fonctionne ?',
    referralStep1: '1. Partagez votre lien de parrainage unique avec d’autres commerçants.',
    referralStep2: '2. Le marchand s’inscrit sur la plateforme et choisit un forfait.',
    referralStep3: '3. Vous recevez directement votre commission et vos récompenses.',
    invitedByFriendBanner: 'Vous avez été invité par un ami ! 🎁',
    referralCodeApplied: 'Code de parrainage appliqué',

    // Realistic Moroccan Pricing Tiers & Real Features (FR)
    pricingBadge: 'Forfaits adaptés aux e-commerçants COD au Maroc',
    pricingTitle: 'Choisissez le forfait adapté à votre croissance',
    pricingSubtitle: 'Tarifs transparents en Dirhams (99, 199, 299 MAD/mois) avec -20% sur l’abonnement annuel.',
    billedMonthly: 'Mensuel',
    billedAnnually: 'Annuel',
    save20Percent: '-20%',
    perMonth: 'mois',
    includedFeaturesLabel: 'Fonctionnalités incluses :',
    tierPopularBadge: 'Le Plus Populaire ⭐',
    tierBusinessBadge: 'Pour Agences & Marques 🚀',
    tierStarterName: 'Débutant (Starter)',
    tierStarterSub: '99 MAD / mois',
    tierStarterLimits: '2 pages • 100 commandes/mois • 1 000 visites/mois',
    tierStarterDesc: 'Idéal pour lancer vos premières campagnes COD et tester vos produits au Maroc.',
    tierStarterCta: 'Choisir le plan Starter',
    tierStarterFeat1: 'Éditeur de pages glisser-déposer (Page Builder)',
    tierStarterFeat2: 'Importateur produit à 3 niveaux (3-Layer Scraper)',
    tierStarterFeat3: 'Formulaire de commande COD (COD Form)',
    tierStarterFeat4: 'Statistiques de base (Basic Analytics)',
    tierStarterFeat5: 'Vérification par e-mail (Email Verification)',
    tierProName: 'Professionnel (بريميوم)',
    tierProSub: '199 MAD / mois',
    tierProLimits: '5 pages • 500 commandes/mois • 5 000 visites/mois',
    tierProDesc: 'Le choix préféré des marchands pour évoluer avec domaine personnalisé, pixels et IA.',
    tierProCta: 'Choisir le plan Professionnel',
    tierProFeat1: 'Tout dans le plan Starter (Everything in Starter)',
    tierProFeat2: 'Domaine personnalisé (Custom Domain)',
    tierProFeat3: 'Pixels Facebook & TikTok (Pixels)',
    tierProFeat4: 'Analytique avancée (Advanced Analytics)',
    tierProFeat5: 'Génération de pages par IA (Gemini AI)',
    tierBusinessName: 'Business (الأعمال)',
    tierBusinessSub: '299 MAD / mois',
    tierBusinessLimits: 'Pages, commandes et visites illimitées',
    tierBusinessDesc: 'Solution complète sans limites avec intégrations sociétés de livraison et support prioritaire.',
    tierBusinessCta: 'Choisir le plan Business',
    tierBusinessFeat1: 'Tout dans le plan Professionnel (Everything in Professional)',
    tierBusinessFeat2: 'Intégrations API sociétés de livraison (Shipping API)',
    tierBusinessFeat3: 'Pages, commandes et visites illimitées (Unlimited Everything)',
    tierBusinessFeat4: 'Support prioritaire dédié (Priority Support)',

    // Pro Gating & Paywall
    proFeatureTitle: 'Fonctionnalité Réservée aux Membres Pro 👑',
    proFeatureDesc: 'Passez à la formule Pro pour débloquer cette fonctionnalité et booster vos ventes.',
    proFeatureBadge: 'Fonction Pro 👑',
    unlockWithPro: 'Débloquer avec le Plan Pro',
    upgradeModalTitle: 'Choisissez le Plan Adapté à Votre Croissance',
    upgradeModalSub: 'Paiement instantané par virement marocain ou carte bancaire / PayPal',
    choosePayment: 'Mode de Paiement',
    bankTransfer: 'Virement Bancaire Marocain',
    paypalCard: 'Carte Bancaire / PayPal',
    cihBank: 'CIH Bank',
    attijariBank: 'Attijariwafa Bank',
    chaabiBank: 'Banque Populaire (Chaabi)',
    cashPlus: 'Cash Plus Maroc',
    submitProof: 'Envoyer le reçu de virement',
    transactionRef: 'Référence de transaction / reçu',

    // Auth & Security Gate (French)
    authTitleLogin: 'Connexion Espace Marchand',
    authSubLogin: 'Gérez vos tunnels de vente et le suivi des commandes au Maroc',
    authTitleRegister: 'Créer un Compte Marchand',
    authSubRegister: 'Lancez vos pages de vente optimisées pour le Cash on Delivery au Maroc',
    authLoginTab: 'Connexion',
    authRegisterTab: 'Inscription',
    authEmailLabel: 'Adresse Email',
    authPasswordLabel: 'Mot de Passe',
    authFullNameLabel: 'Nom Complet du Marchand',
    authStoreNameLabel: 'Nom de la Boutique / Marque',
    authPhoneLabel: 'Téléphone (WhatsApp Maroc)',
    authRememberMe: 'Faire confiance à cet appareil pendant 30 jours',
    authForgotPassword: 'Mot de passe oublié ?',
    authSignInBtn: 'Se connecter à l\'espace marchand',
    authSignUpBtn: 'Créer mon compte gratuitement',
    authOrContinueWith: 'Ou continuer rapidement avec',
    authGoogleSignIn: 'Continuer avec Google',
    authQuickDemoMerchant: 'Remplir compte marchand démo',
    authQuickDemoBadge: 'Accès Rapide',
    authShowcaseTitle: 'La Plateforme N°1 du COD au Maroc',
    authShowcaseDesc: 'Tunnels à haute conversion, formulaires de commande ultra-rapides et suivi instantané des livraisons.',
    authShowcaseStat1Title: '+4.2% Taux de Conversion',
    authShowcaseStat1Sub: 'Supérieur aux boutiques e-commerce classiques',
    authShowcaseStat2Title: '83.4% Taux de Livraison',
    authShowcaseStat2Sub: 'Confirmation WhatsApp automatisée',
    authShowcaseBadge: 'Système 100% Sécurisé 🇲🇦',
    authPasswordWeak: 'Très faible',
    authPasswordFair: 'Moyen',
    authPasswordGood: 'Bon',
    authPasswordStrong: 'Très sécurisé',
    authTermsNotice: 'En vous inscrivant, vous acceptez nos conditions d\'utilisation et notre politique de confidentialité.',
    authSimulate2fa: 'Activer la validation en deux étapes (2FA) pour cet appareil',

    // 2FA OTP Modal / View (French)
    tfaTitle: 'Vérification en Deux Étapes (2FA)',
    tfaSub: 'Pour sécuriser vos transactions, veuillez saisir le code à 6 chiffres envoyé.',
    tfaWhatsAppOption: '📱 Message WhatsApp (OTP WhatsApp)',
    tfaEmailOption: '📧 Courriel (OTP Email)',
    tfaOtpPlaceholder: 'Code à 6 chiffres',
    tfaVerifyBtn: 'Valider et Accéder à la Boutique',
    tfaResendCode: 'Renvoyer le code',
    tfaResendIn: 'Renvoyer dans',
    tfaDeviceVerified: 'Appareil vérifié • IP Marocaine validée',
    tfaBackToLogin: 'Retour à la connexion',
    tfaInvalidCode: 'Code incorrect ou expiré. Veuillez réessayer.',
    tfaCodeSentToast: 'Code de sécurité envoyé avec succès !',
    tfaDevPreviewBanner: 'Code de test instantané pour environnement de démo :',
    tfaSelectChannel: 'Canal de réception du code :',
    tfaTtlBadge: 'Valide 5 min',
    tfaVerifiedToast: 'Vérification réussie ! Connexion sécurisée.',
    authRequiredFieldsError: 'Veuillez remplir tous les champs obligatoires',
    authPasswordMinLengthError: 'Le mot de passe doit contenir au moins 6 caractères',
    authPasswordStrengthLabel: 'Sécurité du mot de passe :',
    authTopMoroccanCities: 'Villes à fort taux de conversion au Maroc',
    authForgotSentDesc: 'Si cette adresse est enregistrée, un lien de réinitialisation a été envoyé.',
    authForgotPromptDesc: 'Saisissez votre adresse email pour recevoir le lien de réinitialisation.',
    authForgotSendBtn: 'Envoyer le lien',
    authCancelBtn: 'Annuler',
    authOkBtn: 'D\'accord',

    // Multi-Tier Roles & Live Storefront
    navAdminPortal: '👑 Portail Admin',
    customerLiveView: 'Vue Client Directe',
    storefrontLivePreview: 'Aperçu Direct Boutique Client (COD Storefront)',
    exitStorefront: '✕ Quitter et retourner au panneau',
    quickRoleSwitcher: '⚡ Sélecteur Rapide de Rôles & Comptes Démo',
    roleOwner: '👑 Propriétaire / Admin (Hedouba)',
    roleMerchantPro: '🏪 Marchand Pro (Youssef)',
    roleMerchantStarter: '💄 Marchande Starter (Salma)',
    roleMerchantFree: '🛒 Marchand Gratuit (Karim)',
    impersonationReturnBtn: '↩️ Retour au Tableau Admin',

    // Public Landing Page Hero Section (French)
    'home.hero.badge': '✨ La 1ère plateforme marocaine pour le COD',
    'home.hero.headlineLine1': 'Créez des landing pages COD professionnelles en quelques minutes',
    'home.hero.headlineLine2Accent': 'et multipliez vos ventes',
    'home.hero.subheadline': 'Concevez des pages à haute conversion pour vendre vos produits en paiement à la livraison au Maroc. Sans coder, depuis votre téléphone ou ordinateur.',
    'home.hero.ctaPrimary': 'Démarrer l\'essai gratuit',
    'home.hero.ctaSecondary': 'Voir comment ça marche',
    'home.hero.socialProof': '+5 000 marchands marocains nous font confiance',
    'home.hero.revenueCardLabel': 'Commandes du jour',
    'home.hero.revenueCardValue': '12 450 MAD',
    'home.hero.productCardLabel': 'Offre en cours',
    'home.hero.productCardValue': '249 MAD',
    'home.hero.nav.login': 'Connexion',
    'home.hero.nav.signup': 'Créer un compte',
    'home.hero.nav.home': 'Accueil',
    'home.hero.nav.features': 'Fonctionnalités',
    'home.hero.nav.pricing': 'Tarifs',
    'home.hero.nav.templates': 'Modèles',
    'home.hero.brandName': 'CodWorth',

    // Standalone AI Page Builder Workspace (French)
    navAiBuilder: 'Créateur IA',
    aiBuilderTitle: 'Créateur de Pages IA',
    aiBuilderSubtitle: 'Décrivez votre produit ou collez un lien AliExpress, Shopify ou YouCan pour générer une page de vente COD haute conversion.',
    aiBuilderPlaceholder: 'Décrivez votre produit ou collez un lien...',
    aiBuilderAttachFile: 'Joindre un fichier',
    aiBuilderProductPage: 'Page produit',
    aiBuilderModeProductPage: 'Page produit complète',
    aiBuilderModeCodFunnel: 'Tunnel COD Offre Flash',
    aiBuilderModeUrlImport: 'Importation intelligente par URL',
    aiBuilderGenerate: 'Générer',
    aiBuilderGenerating: 'Génération en cours...',
    aiBuilderScrapingUrl: 'Extraction du produit et génération...',
    aiBuilderNewChat: 'Nouvelle discussion +',
    aiBuilderChatHistory: 'Historique des discussions',
    aiBuilderHistoryEmpty: 'Aucun historique de génération pour le moment.',
    aiBuilderHistoryClear: 'Effacer l’historique',
    aiBuilderHistoryUsePrompt: 'Réutiliser ce prompt',
    aiBuilderPlanLockedBadge: 'Exclusif Pro & Business 👑',
    aiBuilderPlanLockedTitle: 'Le Créateur de Pages IA est réservé aux plans Professionnel et Business',
    aiBuilderPlanLockedDesc: 'Passez au forfait Professionnel (199 MAD) ou Business (299 MAD) pour débloquer la génération illimitée par IA.',
    aiBuilderUpgradeCta: 'Mettre à niveau maintenant',
    aiBuilderIllegalContentError: 'Désolé, nous ne pouvons pas générer de pages pour des produits illégaux, dangereux ou interdits (armes, drogues, contrefaçons, arnaques). Veuillez saisir un produit e-commerce légal.',
    aiBuilderAttachedFileLabel: 'Fichier joint :',
    aiBuilderRemoveFile: 'Retirer',
    aiBuilderQuickSuggestionsLabel: 'Exemples rapides :',
    aiBuilderSuggestion1: 'Montre connectée étanche avec suivi cardiaque, offre -50% et paiement à la livraison au Maroc',
    aiBuilderSuggestion2: 'Mini mixeur portable rechargeable USB pour smoothies avec livraison gratuite',
    aiBuilderSuggestion3: 'Sérum visage anti-âge au collagène naturel avec garantie satisfait ou remboursé',
  },

  en: {
    // Navigation
    navBuilder: 'Page Builder',
    navOrders: 'Orders & Sales',
    navAnalytics: 'Analytics & Stats',
    navSettings: 'Settings & Domain',
    funnelCraft: 'CodWorth',
    codBadge: 'Morocco COD',
    templates: 'Templates',
    myPages: 'My Pages',
    aiGenerate: 'AI Generator',
    exportCode: 'Export Code',
    publish: 'Publish Page',
    published: 'Published',
    liveUrl: 'Live URL',
    undo: 'Undo',
    redo: 'Redo',
    desktop: 'Desktop',
    tablet: 'Tablet',
    mobile: 'Mobile',
    preview: 'Preview',
    edit: 'Edit',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    upgrade: 'Upgrade to Pro',
    freeBadge: 'Free Plan',
    starterBadge: 'Starter',
    proBadge: 'Pro 👑',
    enterpriseBadge: 'Enterprise',
    adminPanel: 'Verify Payments',
    login: 'Log In',
    logout: 'Log Out',
    language: 'Language',

    // Orders
    ordersTitle: 'Cash on Delivery (COD) Orders',
    ordersDesc: 'Track and verify Moroccan COD funnel landing page orders and conversions',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Review',
    confirmedOrders: 'Confirmed & Shipped',
    totalRevenue: 'Total Revenue',
    exportCsv: 'Export CSV',
    searchPlaceholder: 'Search by customer name, phone, or city...',
    allStatuses: 'All Statuses',
    allCities: 'All Moroccan Cities',
    filter: 'Filter',
    newTestOrder: 'Simulate Order',
    refresh: 'Refresh',
    tableOrder: 'Order #',
    tableCustomer: 'Customer & Phone',
    tableCity: 'City & Address',
    tableProduct: 'Product & Qty',
    tableAmount: 'Amount',
    tableStatus: 'Status',
    tableDate: 'Date',
    tableActions: 'Quick Confirm',
    confirmWhatsApp: 'WhatsApp',
    noOrdersFound: 'No orders match your filter criteria',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusShipped: 'Shipped',
    statusDelivered: 'Delivered',
    statusCancelled: 'Cancelled',
    statusReturned: 'Returned',
    orderNote: 'Note',
    changeStatus: 'Change status',
    ordersCountUnit: 'orders',
    madCurrency: 'MAD',
    orderSimulatedSuccess: 'New simulated test order created successfully',

    // Analytics
    analyticsTitle: 'Analytics & Performance',
    analyticsDesc: 'Conversion funnel insights, sales metrics, and Moroccan regional data',
    conversionRate: 'Conversion Rate (CR)',
    visitors: 'Unique Visitors',
    aov: 'Average Order Value (AOV)',
    deliveryRate: 'Estimated Delivery Rate',
    salesByCity: 'Sales Distribution by Moroccan City',
    topFunnels: 'Top Performing Landing Pages',
    funnelFunnel: 'Sales Conversion Funnel',
    impressions: 'Page Impressions',
    formStarts: 'Form Started',
    ordersPlaced: 'Orders Completed',
    ordersRate: 'Completion Rate',
    revenueByCity: 'Revenue by City',
    ordersShare: 'Orders Share',
    performanceSummary: 'Store Performance Overview',
    performanceDesc: 'Casablanca, Rabat, and Marrakech drive the highest order volume and conversion rate.',
    moroccanCodBenchmark: 'Morocco COD Benchmark: Exceptional performance (+3.8%)',
    liveSync: 'Live sync active',

    // Settings
    settingsTitle: 'Account & Store Settings',
    settingsDesc: 'Manage profile, custom domain mapping, and account security',
    tabProfile: 'Profile',
    tabDomain: 'Custom Domain',
    tabSecurity: 'Security & 2FA',
    saveSettings: 'Save Changes',
    fullName: 'Full Name',
    email: 'Email Address',
    phone: 'WhatsApp Phone',
    storeName: 'Store / Brand Name',
    customDomainTitle: 'Connect Custom Domain',
    customDomainDesc: 'Link your custom domain (e.g. yourstore.ma) to boost shopper trust in Morocco',
    domainConnected: 'Domain connected & live (SSL active)',
    domainPending: 'Pending DNS verification',
    domainVerifyCta: 'Verify DNS Records',
    domainInstruction: 'Add a CNAME record at your domain DNS registrar to point to CodWorth',
    cnameRecord: 'CNAME Record',
    cnameValue: 'domains.codworth.me',
    copyCname: 'Copy Value',
    copied: 'Copied!',
    passwordTitle: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    twoFactorTitle: 'Two-Factor Authentication (2FA)',
    twoFactorDesc: 'Add an extra layer of security requiring a verification code upon login',
    enable2fa: 'Enable 2FA',

    // Merchant Referrals System (EN)
    tabReferrals: 'Referrals',
    referralsTitle: 'Merchant Referral Program',
    referralsDesc: 'Share your referral link and earn recurring commission & bonuses with every merchant you invite.',
    referralLink: 'Your Referral Link',
    copyReferralLink: 'Copy Link',
    referralLinkCopied: 'Referral link copied successfully!',
    merchantsInvited: 'Merchants Invited',
    rewardsEarned: 'Rewards Earned',
    referralCommissionRate: 'Commission Rate',
    howItWorks: 'How it Works',
    referralStep1: '1. Share your unique referral link with fellow merchants and store owners.',
    referralStep2: '2. The merchant creates an account and subscribes to any paid plan.',
    referralStep3: '3. You earn immediate commission credited to your balance.',
    invitedByFriendBanner: 'You were invited by a friend! 🎁',
    referralCodeApplied: 'Referral code applied',

    // Realistic Moroccan Pricing Tiers & Real Features (EN)
    pricingBadge: 'Flexible plans built for Moroccan COD merchants',
    pricingTitle: 'Choose the right plan to scale your store',
    pricingSubtitle: 'Realistic Moroccan market pricing (99, 199, 299 MAD/month) with 20% off on annual billing.',
    billedMonthly: 'Monthly',
    billedAnnually: 'Annual',
    save20Percent: 'Save 20%',
    perMonth: 'mo',
    includedFeaturesLabel: 'Included features:',
    tierPopularBadge: 'Most Popular ⭐',
    tierBusinessBadge: 'For Scaling Brands 🚀',
    tierStarterName: 'Starter (المبتدئ)',
    tierStarterSub: '99 MAD / month',
    tierStarterLimits: '2 pages • 100 orders/mo • 1,000 visits/mo',
    tierStarterDesc: 'Perfect for new merchants testing products and launching fast COD landing pages.',
    tierStarterCta: 'Choose Starter Plan',
    tierStarterFeat1: 'Drag & Drop Page Builder',
    tierStarterFeat2: '3-Layer Product Scraper',
    tierStarterFeat3: 'High-Converting COD Form',
    tierStarterFeat4: 'Basic Sales Analytics',
    tierStarterFeat5: 'Email Verification',
    tierProName: 'Professional (بريميوم)',
    tierProSub: '199 MAD / month',
    tierProLimits: '5 pages • 500 orders/mo • 5,000 visits/mo',
    tierProDesc: 'Our most popular tier with custom domain, ad pixels, and Gemini AI page generation.',
    tierProCta: 'Choose Professional Plan',
    tierProFeat1: 'Everything in Starter',
    tierProFeat2: 'Custom Domain Connection',
    tierProFeat3: 'Pixels (Facebook & TikTok)',
    tierProFeat4: 'Advanced Conversion Analytics',
    tierProFeat5: 'AI Page Generation (Gemini)',
    tierBusinessName: 'Business (الأعمال)',
    tierBusinessSub: '299 MAD / month',
    tierBusinessLimits: 'Unlimited pages, orders & visits',
    tierBusinessDesc: 'Unrestricted scale with delivery carrier API integrations and priority support.',
    tierBusinessCta: 'Choose Business Plan',
    tierBusinessFeat1: 'Everything in Professional',
    tierBusinessFeat2: 'Shipping API Integrations',
    tierBusinessFeat3: 'Unlimited Everything (Pages, Orders, Visits)',
    tierBusinessFeat4: 'Priority Support',

    // Pro Gating & Paywall
    proFeatureTitle: 'Pro Plan Exclusive Feature 👑',
    proFeatureDesc: 'Upgrade your subscription to unlock this feature and scale your e-commerce sales.',
    proFeatureBadge: 'Pro Feature 👑',
    unlockWithPro: 'Unlock with Pro Plan',
    upgradeModalTitle: 'Choose the Right Plan to Scale Your Business',
    upgradeModalSub: 'Instant activation via Moroccan local bank transfers or Credit Card / PayPal',
    choosePayment: 'Payment Method',
    bankTransfer: 'Moroccan Bank Transfer',
    paypalCard: 'Debit / Credit Card & PayPal',
    cihBank: 'CIH Bank',
    attijariBank: 'Attijariwafa Bank',
    chaabiBank: 'Banque Populaire (Chaabi)',
    cashPlus: 'Cash Plus Morocco',
    submitProof: 'Submit Transfer Receipt',
    transactionRef: 'Transaction Reference / Receipt ID',

    // Auth & Security Gate (English)
    authTitleLogin: 'Merchant Portal Sign In',
    authSubLogin: 'Manage high-converting COD funnels and track delivery performance',
    authTitleRegister: 'Create Your Merchant Account',
    authSubRegister: 'Launch high-converting COD landing pages optimized for Morocco',
    authLoginTab: 'Sign In',
    authRegisterTab: 'Register',
    authEmailLabel: 'Email Address',
    authPasswordLabel: 'Password',
    authFullNameLabel: 'Merchant Full Name',
    authStoreNameLabel: 'Store / Brand Name',
    authPhoneLabel: 'WhatsApp Phone (+212 Morocco)',
    authRememberMe: 'Trust this device for 30 days',
    authForgotPassword: 'Forgot password?',
    authSignInBtn: 'Sign In to Workspace',
    authSignUpBtn: 'Create Free Merchant Account',
    authOrContinueWith: 'Or continue seamlessly with',
    authGoogleSignIn: 'Sign in with Google',
    authQuickDemoMerchant: 'Fill Demo Merchant Profile',
    authQuickDemoBadge: '1-Click Demo',
    authShowcaseTitle: 'Morocco\'s #1 COD Conversion Platform',
    authShowcaseDesc: 'Lightning-fast sales funnels, high-converting Cash on Delivery checkout, and real-time Moroccan orders tracking.',
    authShowcaseStat1Title: '+4.2% Conversion Rate',
    authShowcaseStat1Sub: 'Outperforming standard e-commerce stores',
    authShowcaseStat2Title: '83.4% Delivery Rate',
    authShowcaseStat2Sub: 'Automated 1-click WhatsApp customer confirmation',
    authShowcaseBadge: '100% Secured 🇲🇦',
    authPasswordWeak: 'Weak',
    authPasswordFair: 'Fair',
    authPasswordGood: 'Good',
    authPasswordStrong: 'Strong & Protected',
    authTermsNotice: 'By signing up, you agree to CodWorth\'s Terms of Service and Privacy Policy.',
    authSimulate2fa: 'Enable Two-Factor Authentication (2FA) for this login',

    // 2FA OTP Modal / View (English)
    tfaTitle: 'Two-Factor Security Verification (2FA)',
    tfaSub: 'To protect your merchant account and payouts, please enter the 6-digit verification code.',
    tfaWhatsAppOption: '📱 WhatsApp Message (WhatsApp OTP)',
    tfaEmailOption: '📧 Email Message (Email OTP)',
    tfaOtpPlaceholder: '6-digit security code',
    tfaVerifyBtn: 'Verify Code & Enter Dashboard',
    tfaResendCode: 'Resend Code',
    tfaResendIn: 'Resend in',
    tfaDeviceVerified: 'Verified Device • Moroccan IP Validated',
    tfaBackToLogin: 'Back to Sign In',
    tfaInvalidCode: 'Invalid or expired verification code. Please try again.',
    tfaCodeSentToast: 'Security code sent successfully!',
    tfaDevPreviewBanner: 'Instant Preview Environment Test Code:',
    tfaSelectChannel: 'Select OTP delivery channel:',
    tfaTtlBadge: '5:00 min TTL',
    tfaVerifiedToast: 'Code verified & login secured!',
    authRequiredFieldsError: 'Please fill in all required fields',
    authPasswordMinLengthError: 'Password must be at least 6 characters',
    authPasswordStrengthLabel: 'Password strength:',
    authTopMoroccanCities: 'Top Converting Cities in Morocco',
    authForgotSentDesc: 'If this email is registered, a password reset link has been sent.',
    authForgotPromptDesc: 'Enter your email address to receive a password reset link.',
    authForgotSendBtn: 'Send Reset Link',
    authCancelBtn: 'Cancel',
    authOkBtn: 'OK',

    // Multi-Tier Roles & Live Storefront
    navAdminPortal: '👑 Owner Portal',
    customerLiveView: 'Customer Live View',
    storefrontLivePreview: 'Live Customer COD Storefront Preview',
    exitStorefront: '✕ Exit Storefront & Return',
    quickRoleSwitcher: '⚡ Instant Role & Demo Account Switcher',
    roleOwner: '👑 Owner / Admin (Hedouba)',
    roleMerchantPro: '🏪 Pro Merchant (Youssef)',
    roleMerchantStarter: '💄 Starter Merchant (Salma)',
    roleMerchantFree: '🛒 Free Merchant (Karim)',
    impersonationReturnBtn: '↩️ Return to Admin Owner Dashboard',

    // Public Landing Page Hero Section (English)
    'home.hero.badge': '✨ Morocco\'s #1 COD platform',
    'home.hero.headlineLine1': 'Build professional COD landing pages in minutes',
    'home.hero.headlineLine2Accent': 'and multiply your sales',
    'home.hero.subheadline': 'Design high-converting landing pages to sell your products via Cash on Delivery in Morocco. No coding needed, from your phone or computer.',
    'home.hero.ctaPrimary': 'Start your free trial',
    'home.hero.ctaSecondary': 'See how it works',
    'home.hero.socialProof': '+5,000 Moroccan merchants trust us',
    'home.hero.revenueCardLabel': 'Today\'s orders',
    'home.hero.revenueCardValue': '12,450 MAD',
    'home.hero.productCardLabel': 'Current offer',
    'home.hero.productCardValue': '249 MAD',
    'home.hero.nav.login': 'Sign In',
    'home.hero.nav.signup': 'Create account',
    'home.hero.nav.home': 'Home',
    'home.hero.nav.features': 'Features',
    'home.hero.nav.pricing': 'Pricing',
    'home.hero.nav.templates': 'Templates',
    'home.hero.brandName': 'CodWorth',

    // Standalone AI Page Builder Workspace (English)
    navAiBuilder: 'AI Page Builder',
    aiBuilderTitle: 'AI Page Builder',
    aiBuilderSubtitle: 'Describe your product or paste an AliExpress, Shopify, or YouCan link to generate a high-converting COD landing page in seconds.',
    aiBuilderPlaceholder: 'Describe your product or paste a link...',
    aiBuilderAttachFile: 'Attach file',
    aiBuilderProductPage: 'Product page',
    aiBuilderModeProductPage: 'Full Product Page',
    aiBuilderModeCodFunnel: 'COD Flash Offer Funnel',
    aiBuilderModeUrlImport: 'Smart URL Product Import',
    aiBuilderGenerate: 'Generate',
    aiBuilderGenerating: 'Generating page...',
    aiBuilderScrapingUrl: 'Extracting product & generating page...',
    aiBuilderNewChat: 'New Chat +',
    aiBuilderChatHistory: 'Chat History',
    aiBuilderHistoryEmpty: 'No previous chat prompts yet.',
    aiBuilderHistoryClear: 'Clear History',
    aiBuilderHistoryUsePrompt: 'Use this prompt',
    aiBuilderPlanLockedBadge: 'Pro & Business Exclusive 👑',
    aiBuilderPlanLockedTitle: 'AI Page Builder requires the Professional or Business Plan',
    aiBuilderPlanLockedDesc: 'Upgrade your subscription to Professional (199 MAD/mo) or Business (299 MAD/mo) to unlock AI landing page generation.',
    aiBuilderUpgradeCta: 'Upgrade Plan Now',
    aiBuilderIllegalContentError: 'Sorry, we cannot generate landing pages for illegal, restricted, or prohibited products (weapons, drugs, counterfeit goods, or scams). Please enter a legal e-commerce product.',
    aiBuilderAttachedFileLabel: 'Attached file:',
    aiBuilderRemoveFile: 'Remove file',
    aiBuilderQuickSuggestionsLabel: 'Quick examples to try:',
    aiBuilderSuggestion1: 'Smart waterproof fitness watch with heart-rate monitor, 50% off + free Cash on Delivery in Morocco',
    aiBuilderSuggestion2: 'Portable rechargeable USB blender for fresh smoothies with buy 1 get 1 offer',
    aiBuilderSuggestion3: 'Organic vitamin C & collagen facial serum with 30-day money-back guarantee',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: translations[DEFAULT_LANGUAGE],
  dir: 'rtl',
  isRtl: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const urlLang = extractLangFromPath(location.pathname);

  const [language, setLanguageState] = useState<Language>(() => {
    if (urlLang) return urlLang;
    try {
      const saved = localStorage.getItem('funnelcraft_lang') as Language;
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch (_) {}
    return DEFAULT_LANGUAGE;
  });

  // Sync state if URL prefix changes
  useEffect(() => {
    if (urlLang && urlLang !== language) {
      setLanguageState(urlLang);
      try {
        localStorage.setItem('funnelcraft_lang', urlLang);
      } catch (_) {}
    }
  }, [urlLang, language]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('funnelcraft_lang', newLang);
    } catch (_) {}

    // Immediately update document dir and lang for instant RTL/LTR transitions
    const newConfig = getLanguageConfig(newLang);
    document.documentElement.dir = newConfig.dir;
    document.documentElement.lang = newLang;

    const currentPath = location.pathname;

    // If currently on a reserved root path (e.g. /dashboard or /sandbox), do NOT prefix with language
    if (isReservedRootPath(currentPath)) {
      return;
    }

    // Replace current path language prefix or prepend new language
    const parts = currentPath.split('/').filter(Boolean);
    let targetPath = '';

    if (parts.length > 0 && SUPPORTED_LANGUAGES.some((l) => l.code === parts[0])) {
      parts[0] = newLang;
      targetPath = '/' + parts.join('/');
    } else {
      targetPath = `/${newLang}${currentPath === '/' ? '' : currentPath}`;
    }

    const searchAndHash = `${location.search}${location.hash}`;
    navigate(`${targetPath}${searchAndHash}`);
  };

  const langConfig = getLanguageConfig(language);
  const dir = langConfig.dir;
  const isRtl = dir === 'rtl';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language] || translations[DEFAULT_LANGUAGE],
    dir,
    isRtl,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
