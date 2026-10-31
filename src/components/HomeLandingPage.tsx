import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TrendingUp, Zap, MapPin } from 'lucide-react';
import { useLanguage, Language } from '../i18n/translations';
import { HeroSection } from './home/HeroSection';
import { PublicFooter } from './PublicFooter';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ar', label: 'AR' },
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

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

  const featuresList = [
    {
      icon: TrendingUp,
      title:
        language === 'ar'
          ? 'تحويلات عالية (High Conversion)'
          : language === 'fr'
          ? 'Haute Conversion (High Conversion)'
          : 'High Conversion',
      subtitle:
        language === 'ar'
          ? 'مُحسّن خصيصاً للدفع عند الاستلام (Optimized for COD) مع نماذج طلب فورية تضاعف المبيعات.'
          : language === 'fr'
          ? 'Optimisé pour le paiement à la livraison (Optimized for COD) avec formulaires directs.'
          : 'Optimized for COD with frictionless one-step order forms designed to maximize sales.',
    },
    {
      icon: Zap,
      title:
        language === 'ar'
          ? 'سرعة البرق (Lightning Fast)'
          : language === 'fr'
          ? 'Ultra Rapide (Lightning Fast)'
          : 'Lightning Fast',
      subtitle:
        language === 'ar'
          ? 'تحميل في أجزاء من الثانية (Load in milliseconds) لضمان عدم خسارة أي زائر من إعلاناتك.'
          : language === 'fr'
          ? 'Chargement en quelques millisecondes (Load in milliseconds) pour retenir chaque visiteur.'
          : 'Load in milliseconds so you never lose a single paid ad click to slow mobile connections.',
    },
    {
      icon: MapPin,
      title:
        language === 'ar'
          ? 'مصمم للسوق المغربي (Moroccan Market)'
          : language === 'fr'
          ? 'Marché Marocain (Moroccan Market)'
          : 'Moroccan Market',
      subtitle:
        language === 'ar'
          ? 'قوائم مدن متسلسلة وربط مباشر مع شركات التوصيل (Cascading cities & shipping integrations).'
          : language === 'fr'
          ? 'Villes en cascade et intégrations de livraison (Cascading cities & shipping integrations).'
          : 'Cascading cities & shipping integrations tailored for Moroccan COD e-commerce.',
    },
  ];

  return (
    <div
      dir={dir}
      className="min-h-screen w-screen bg-[#0D131E] text-[#F8FAFC] flex flex-col justify-between overflow-x-hidden select-none"
    >
      {/* Top Public Header */}
      <header className="w-full border-b border-[#1E293B] bg-[#0D131E] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Logo (Right in RTL / Left in LTR) */}
          <Link to="/home" className="flex items-center shrink-0">
            <img
              src="/assets/brand/logo.jpg"
              alt="CodWorth"
              className="h-10 w-auto object-contain rounded-lg"
            />
          </Link>

          {/* Center Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#CBD5E1]">
            <Link
              to="/home"
              className="text-[#F8FAFC] hover:text-[#E25B26] transition"
            >
              {t['home.hero.nav.home']}
            </Link>
            <Link
              to="/home#features"
              onClick={handleFeaturesClick}
              className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
            >
              {t['home.hero.nav.features']}
            </Link>
            <Link
              to="/pricing"
              className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
            >
              {t['home.hero.nav.pricing']}
            </Link>
            <Link
              to="/login"
              className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
            >
              {t['home.hero.nav.templates']}
            </Link>
          </nav>

          {/* Far Side: Language Switcher + Ghost Login + Solid Accent Signup */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              dir="ltr"
              className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-[#131B2A] border border-[#1E293B]"
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    language === lang.code
                      ? 'bg-[#E25B26] text-[#F8FAFC]'
                      : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <Link
              to="/login"
              className="px-3.5 py-2 rounded-xl border border-transparent hover:border-[#334155] hover:bg-[#131B2A] text-[#CBD5E1] hover:text-[#F8FAFC] text-xs sm:text-[13px] font-semibold transition"
            >
              {t['home.hero.nav.login']}
            </Link>

            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] text-xs sm:text-[13px] font-bold shadow-md transition"
            >
              {t['home.hero.nav.signup']}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center bg-[#0D131E]">
        <HeroSection />

        {/* Features Section */}
        <section
          id="features"
          className="w-full bg-[#0D131E] border-t border-[#1E293B] py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuresList.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={index}
                    className="bg-[#131B2A] border border-[#1E293B] hover:border-[#334155] rounded-2xl p-6 sm:p-7 transition flex flex-col gap-4 shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#0D131E] border border-[#1E293B] flex items-center justify-center">
                      <IconComponent className="w-6 h-6 text-[#E25B26]" />
                    </div>
                    <h3 className="text-lg font-extrabold text-[#F8FAFC]">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#CBD5E1] leading-relaxed">
                      {feature.subtitle}
                    </p>
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
