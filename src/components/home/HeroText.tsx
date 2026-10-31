import React from 'react';
import { Truck } from 'lucide-react';
import { LocalizedLink } from '../LocalizedLink';
import { useLanguage } from '../../i18n/translations';

export const HeroText: React.FC = () => {
  const { t, dir } = useLanguage();

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

      {/* 4. Primary CTA Button Only */}
      <div className="mt-8 flex items-center w-full sm:w-auto">
        <LocalizedLink
          to="/login?mode=register"
          className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] font-bold text-[15px] shadow-lg transition cursor-pointer text-center w-full sm:w-auto"
        >
          <span>{t['home.hero.ctaPrimary']}</span>
        </LocalizedLink>
      </div>

      {/* 5. Social Proof Row */}
      <div className="mt-10 flex items-center gap-3">
        {/* Three overlapping circular avatars using strict brand palette */}
        <div className="flex items-center -space-x-2 rtl:space-x-reverse">
          <div className="w-7 h-7 rounded-full bg-[#E25B26] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#F8FAFC]">
            M
          </div>
          <div className="w-7 h-7 rounded-full bg-[#1E293B] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#F8FAFC]">
            Y
          </div>
          <div className="w-7 h-7 rounded-full bg-[#334155] border-2 border-[#0D131E] flex items-center justify-center text-[10px] font-extrabold text-[#F8FAFC]">
            S
          </div>
        </div>

        <span className="text-[13px] font-medium text-[#CBD5E1]">
          {t['home.hero.socialProof']}
        </span>

        <Truck className="w-4 h-4 text-[#CBD5E1] shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default HeroText;
