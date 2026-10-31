import React from 'react';
import { Link } from 'react-router-dom';
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
              className="h-10 w-auto object-contain rounded-lg"
              alt="CodWorth Logo"
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

      {/* Main Hero Section */}
      <main id="features" className="flex-1 flex flex-col justify-center bg-[#0D131E]">
        <HeroSection />
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
};

export default HomeLandingPage;
