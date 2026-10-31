import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Truck,
  Sliders,
  BarChart3,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
import { LocalizedLink } from './LocalizedLink';
import { ThemeToggleButton } from './ThemeToggleButton';
import { HeroSection } from './home/HeroSection';
import { PublicFooter } from './PublicFooter';

export const HomeLandingPage: React.FC = () => {
  const { t, language, setLanguage, dir } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#features') {
      const el = document.getElementById('features');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.hash]);

  const handleFeaturesClick = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const statsBanner = [
    {
      value: '+1,500',
      label:
        language === 'ar'
          ? 'طلب تمت معالجته بنجاح'
          : language === 'fr'
          ? 'Commandes traitées avec succès'
          : 'Orders processed successfully',
    },
    {
      value: language === 'ar' ? '+500 ألف' : '+500K',
      label:
        language === 'ar'
          ? 'درهم مبيعات محققة'
          : language === 'fr'
          ? 'MAD de ventes générées'
          : 'MAD in generated sales',
    },
    {
      value: '99.9%',
      label:
        language === 'ar'
          ? 'وقت تشغيل واستقرار مستمر'
          : language === 'fr'
          ? 'Disponibilité et stabilité garanties'
          : 'Guaranteed Uptime & Reliability',
    },
    {
      value: '24/7',
      label:
        language === 'ar'
          ? 'دعم فني للعملاء'
          : language === 'fr'
          ? 'Support client dédié'
          : 'Dedicated Customer Support',
    },
  ];

  const bentoFeatures = [
    {
      icon: Sparkles,
      spanClass: 'md:col-span-2 lg:col-span-2',
      title:
        language === 'ar'
          ? 'ذكاء اصطناعي مدمج (Built-in AI)'
          : language === 'fr'
          ? 'IA Intégrée (Built-in AI)'
          : 'Built-in AI Generator',
      subtitle:
        language === 'ar'
          ? 'أنشئ صفحات هبوط احترافية ونصوص بيعية مقنعة بالدارجة المغربية، العربية أو الفرنسية في ثوانٍ معدودة بضغطة زر واحدة.'
          : language === 'fr'
          ? 'Générez des pages de vente complètes et des textes persuasifs en quelques secondes grâce à notre moteur IA.'
          : 'Generate high-converting COD landing pages and persuasive marketing copy in seconds with one click.',
    },
    {
      icon: TrendingUp,
      spanClass: 'md:col-span-1 lg:col-span-1',
      title:
        language === 'ar'
          ? 'تحويلات عالية (High Conversion)'
          : language === 'fr'
          ? 'Haute Conversion (High Conversion)'
          : 'High Conversion (Optimized for COD)',
      subtitle:
        language === 'ar'
          ? 'مصمم خصيصاً للدفع عند الاستلام مع استمارة طلب مباشر وعروض الكميات لمضاعفة قيمة السلة.'
          : language === 'fr'
          ? 'Optimisé pour le COD avec formulaires directs en une étape et offres groupées.'
          : 'Optimized for Cash on Delivery with frictionless one-step forms and quantity bundle offers.',
    },
    {
      icon: Truck,
      spanClass: 'md:col-span-1 lg:col-span-1',
      title:
        language === 'ar'
          ? 'تكامل مع شركات الشحن (Shipping Integrations)'
          : language === 'fr'
          ? 'Intégrations Livraison (Shipping Integrations)'
          : 'Shipping Integrations',
      subtitle:
        language === 'ar'
          ? 'ربط سلس مع أشهر شركات التوصيل في المغرب (Sendit, Cathedis, Ozone, Amana) و Google Sheets.'
          : language === 'fr'
          ? 'Connexion directe avec Sendit, Cathedis, Ozone Express, Amana et Google Sheets.'
          : 'Seamless workflow with Moroccan carriers (Sendit, Cathedis, Ozone, Amana) & Google Sheets.',
    },
    {
      icon: Sliders,
      spanClass: 'md:col-span-2 lg:col-span-2',
      title:
        language === 'ar'
          ? 'تخصيص كامل (Full Customization)'
          : language === 'fr'
          ? 'Personnalisation Totale (Full Customization)'
          : 'Full Customization',
      subtitle:
        language === 'ar'
          ? 'اربط دومينك الخاص (Custom Domain)، فعل بيكسلات الإعلانات (Meta, TikTok, Snap) بدقة عالية، وتحكم كلياً في الهوية البصرية لمتجرك بدون سطر برمجي واحد.'
          : language === 'fr'
          ? 'Connectez vos domaines personnalisés, intégrez vos pixels (Meta, TikTok, Snap) et personnalisez chaque bloc sans coder.'
          : 'Custom domains, Meta/TikTok/Snap tracking pixels, and complete visual branding control without writing a line of code.',
    },
    {
      icon: BarChart3,
      spanClass: 'md:col-span-1 lg:col-span-1',
      title:
        language === 'ar'
          ? 'تحليلات لحظية (Real-time Analytics)'
          : language === 'fr'
          ? 'Analytiques en Temps Réel (Real-time Analytics)'
          : 'Real-time Analytics',
      subtitle:
        language === 'ar'
          ? 'تتبع الزوار، معدل التحويل، أفضل المدن مبيعاً، والأرباح المؤكدة لحظة بلحظة من لوحة تحكم واحدة.'
          : language === 'fr'
          ? 'Suivez vos visiteurs, taux de conversion, ventes par ville et revenus en temps réel.'
          : 'Track live visitors, conversion rates, top-performing cities, and COD revenue in real time.',
    },
    {
      icon: Zap,
      spanClass: 'md:col-span-2 lg:col-span-2',
      title:
        language === 'ar'
          ? 'سرعة صاروخية (Lightning Fast)'
          : language === 'fr'
          ? 'Vitesse Éclair (Lightning Fast)'
          : 'Lightning Fast',
      subtitle:
        language === 'ar'
          ? 'تحميل في أجزاء من الثانية (Load in milliseconds) على شبكات الهاتف 4G/5G لضمان عدم ضياع أي نقرة إعلانية مدفوعة.'
          : language === 'fr'
          ? 'Chargement en quelques millisecondes sur mobile pour maximiser le retour sur investissement de vos publicités.'
          : 'Load in milliseconds on mobile networks so you never lose a single paid ad click to slow pages.',
    },
  ];

  return (
    <div
      dir={dir}
      className="min-h-screen w-screen bg-brand-bg text-brand-primary flex flex-col justify-between overflow-x-hidden select-none"
    >
      {/* Top Public Sticky Header */}
      <header className="w-full border-b border-brand bg-brand-bg/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Logo (Right in RTL / Left in LTR) */}
          <LocalizedLink to="/home" className="flex items-center shrink-0">
            <img
              src="/assets/brand/logo.jpg"
              alt="CodWorth"
              className="h-10 w-auto object-contain rounded-lg"
            />
          </LocalizedLink>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-brand-secondary">
            <LocalizedLink
              to="/home"
              className="text-brand-primary hover:text-brand-accent transition"
            >
              {t['home.hero.nav.home']}
            </LocalizedLink>
            <LocalizedLink
              to="/home#features"
              onClick={handleFeaturesClick}
              className="text-brand-secondary hover:text-brand-primary transition"
            >
              {t['home.hero.nav.features']}
            </LocalizedLink>
            <LocalizedLink
              to="/pricing"
              className="text-brand-secondary hover:text-brand-primary transition"
            >
              {t['home.hero.nav.pricing']}
            </LocalizedLink>
            <LocalizedLink
              to="/login"
              className="text-brand-secondary hover:text-brand-primary transition"
            >
              {t['home.hero.nav.templates']}
            </LocalizedLink>
          </nav>

          {/* Far Side: Language Switcher + Theme Toggle + Ghost Login + Solid Accent Signup */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              dir="ltr"
              className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-brand-surface border border-brand"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    language === lang.code
                      ? 'bg-brand-accent text-white'
                      : 'text-brand-secondary hover:text-brand-primary'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Global Theme Toggle Button */}
            <ThemeToggleButton />

            <LocalizedLink
              to="/login"
              className="px-3.5 py-2 rounded-xl border border-transparent hover:border-brand hover:bg-brand-surface text-brand-secondary hover:text-brand-primary text-xs sm:text-[13px] font-semibold transition"
            >
              {t['home.hero.nav.login']}
            </LocalizedLink>

            <LocalizedLink
              to="/login?mode=register"
              className="px-4 py-2 rounded-xl bg-brand-accent hover:opacity-90 text-white text-xs sm:text-[13px] font-bold shadow-md transition"
            >
              {t['home.hero.nav.signup']}
            </LocalizedLink>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center bg-brand-bg">
        <HeroSection />

        {/* Epic Interactive Features Section */}
        <section
          id="features"
          className="relative w-full bg-brand-bg border-t border-brand py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden"
        >
          {/* Subtle Ambient Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[360px] rounded-full bg-brand-accent/10 blur-[140px]"
          />

          <div className="relative z-10 max-w-7xl mx-auto space-y-16">
            {/* 1. Stats Banner (Top of Features) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {statsBanner.map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-brand-surface/80 backdrop-blur-sm border border-brand rounded-2xl p-6 text-center hover:border-brand-accent/50 transition-all duration-300"
                >
                  <div
                    dir="ltr"
                    className="text-2xl sm:text-4xl font-black text-brand-accent tracking-tight"
                  >
                    {stat.value}
                  </div>
                  <div className="mt-2 text-xs sm:text-sm font-bold text-brand-secondary">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Section Heading with Subtle Pulse */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                <span>
                  {language === 'ar'
                    ? 'المنصة رقم #1 للتجارة الإلكترونية في المغرب وإفريقيا'
                    : language === 'fr'
                    ? 'La plateforme N°1 du COD au Maroc & en Afrique'
                    : 'The #1 COD Platform in Morocco & Africa'}
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-brand-primary tracking-tight leading-tight animate-pulse">
                {language === 'ar'
                  ? 'كل ما تحتاجه لمضاعفة مبيعات الدفع عند الاستلام'
                  : language === 'fr'
                  ? 'Tout pour multiplier vos ventes Paiement à la Livraison'
                  : 'Everything You Need to Scale Your COD Sales'}
              </h2>

              <p className="text-sm sm:text-base text-brand-secondary leading-relaxed">
                {language === 'ar'
                  ? 'أدوات متكاملة صُممت خصيصاً لتلبية احتياجات التاجر المغربي والإفريقي من إنشاء الصفحة بالذكاء الاصطناعي حتى توصيل الطلب.'
                  : language === 'fr'
                  ? 'Des outils puissants conçus sur mesure pour accompagner les e-commerçants de la création IA jusqu’à la livraison.'
                  : 'Purpose-built tools engineered to take Moroccan and African COD merchants from AI page creation to confirmed delivery.'}
              </p>
            </div>

            {/* 2. Bento Grid Layout (6 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {bentoFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={index}
                    className={`${feature.spanClass} bg-brand-surface/80 backdrop-blur-sm border border-brand hover:-translate-y-2 hover:shadow-lg hover:border-brand-accent/50 transition-all duration-300 group rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-brand-bg border border-brand text-brand-accent group-hover:bg-brand-accent group-hover:text-white transition-colors flex items-center justify-center shadow-md">
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-brand-secondary/40 group-hover:text-brand-accent transition-colors" />
                      </div>

                      <h3 className="text-lg sm:text-xl font-extrabold text-brand-primary group-hover:text-brand-accent transition-colors">
                        {feature.title}
                      </h3>

                      <p className="text-sm text-brand-secondary leading-relaxed">
                        {feature.subtitle}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-brand/80 flex items-center justify-between text-xs font-bold text-brand-secondary">
                      <span>CodWorth Pro Engine</span>
                      <LocalizedLink
                        to="/login?mode=register"
                        className="text-brand-accent hover:underline"
                      >
                        {language === 'ar'
                          ? 'جرب الميزة مجاناً ←'
                          : language === 'fr'
                          ? 'Essayer gratuitement →'
                          : 'Try for free →'}
                      </LocalizedLink>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
};

export default HomeLandingPage;
