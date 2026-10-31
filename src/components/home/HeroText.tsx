import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Truck } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';

export const HeroText: React.FC = () => {
  const { t, dir, isRtl } = useLanguage();

  return (
    <div dir={dir} className="flex flex-col items-start text-start">
      {/* 1. Badge / Pill */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#E25B26] text-xs sm:text-[13px] font-bold">
        <span>{t['home.hero.badge']}</span>
      </div>

      {/* 2. Headline (H1, large) */}
      <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[54px] font-black tracking-[-0.02em] leading-[1.15] text-[#F8FAFC]">
        <span className="block">{t['home.hero.headlineLine1']}</span>
        <span className="block text-[#E25B26] mt-1.5">
          {t['home.hero.headlineLine2Accent']}
        </span>
      </h1>

      {/* 3. Subheadline */}
      <p className="mt-6 text-base sm:text-[18px] font-normal leading-[1.75] text-[#CBD5E1] max-w-[600px]">
        {t['home.hero.subheadline']}
      </p>

      {/* 4. CTA Row */}
      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] font-bold text-[15px] shadow-lg transition cursor-pointer text-center"
        >
          <span>{t['home.hero.ctaPrimary']}</span>
        </Link>

        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-transparent hover:bg-[#131B2A] border border-[#334155] text-[#F8FAFC] font-semibold text-[15px] transition cursor-pointer text-center"
        >
          <span>{t['home.hero.ctaSecondary']}</span>
          <Play
            className={`w-4 h-4 text-[#E25B26] fill-[#E25B26] shrink-0 ${
              isRtl ? 'rotate-180' : ''
            }`}
          />
        </Link>
      </div>

      {/* 5. Social Proof Row */}
      <div className="mt-10 flex items-center gap-3">
        {/* Three overlapping circular avatars (28px, pure CSS divs) */}
        <div className="flex items-center -space-x-2 rtl:space-x-reverse">
          <div className="w-7 h-7 rounded-full bg-[#E25B26] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#F8FAFC]">
            M
          </div>
          <div className="w-7 h-7 rounded-full bg-[#2CD36F] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#0D131E]">
            Y
          </div>
          <div className="w-7 h-7 rounded-full bg-[#F59E0B] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#0D131E]">
            S
          </div>
        </div>

        <span className="text-[13px] font-medium text-[#CBD5E1]">
          {t['home.hero.socialProof']}
        </span>

        <Truck className="w-4 h-4 text-[#94A3B8] shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default HeroText;
