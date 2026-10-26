import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'fr' | 'en';

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
    cnameValue: 'cname.codworth.com',
    copyCname: 'نسخ القيمة',
    copied: 'تم النسخ!',
    passwordTitle: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور الجديدة',
    twoFactorTitle: 'التحقق بخطوتين (2FA)',
    twoFactorDesc: 'حماية إضافية لحسابك وأموالك عبر رمز OTP',
    enable2fa: 'تفعيل التحقق بخطوتين',

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
    cnameValue: 'cname.codworth.com',
    copyCname: 'Copier la valeur',
    copied: 'Copié !',
    passwordTitle: 'Modifier le Mot de Passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    twoFactorTitle: 'Authentification à Deux Facteurs (2FA)',
    twoFactorDesc: 'Sécurité accrue pour votre compte via code OTP',
    enable2fa: 'Activer la 2FA',

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
    cnameValue: 'cname.codworth.com',
    copyCname: 'Copy Value',
    copied: 'Copied!',
    passwordTitle: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    twoFactorTitle: 'Two-Factor Authentication (2FA)',
    twoFactorDesc: 'Extra security for your merchant earnings and account via OTP',
    enable2fa: 'Enable 2FA',

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
  language: 'ar',
  setLanguage: () => {},
  t: translations.ar,
  dir: 'rtl',
  isRtl: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('funnelcraft_lang') as Language;
      if (saved && (saved === 'ar' || saved === 'fr' || saved === 'en')) {
        return saved;
      }
    } catch (_) {}
    return 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('funnelcraft_lang', lang);
    } catch (_) {}
  };

  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    dir,
    isRtl,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
