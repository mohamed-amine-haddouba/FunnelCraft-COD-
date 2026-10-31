import React from 'react';
import { Truck } from 'lucide-react';
import { LocalizedLink } from '../LocalizedLink';
import { useLanguage } from '../../i18n/translations';

export const HeroText: React.FC = () => {
  const { t, dir } = useLanguage();

  return (
    <div dir={dir} className="flex flex-col items-start text-start">
      {/* 1. Badge / Pill */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-xs sm:text-[13px] font-bold">
        <span>{t['home.hero.badge']}</span>
      </div>

      {/* 2. Headline (H1, large) */}
      <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[54px] font-black tracking-[-0.02em] leading-[1.15] text-brand-primary">
        <span className="block">{t['home.hero.headlineLine1']}</span>
        <span className="block text-brand-accent mt-1.5">
          {t['home.hero.headlineLine2Accent']}
        </span>
      </h1>

      {/* 3. Subheadline */}
      <p className="mt-6 text-base sm:text-[18px] font-normal leading-[1.75] text-brand-secondary max-w-[600px]">
        {t['home.hero.subheadline']}
      </p>

      {/* 4. Primary CTA Button Only */}
      <div className="mt-8 flex items-center w-full sm:w-auto">
        <LocalizedLink
          to="/login?mode=register"
          className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-brand-accent hover:opacity-90 text-white font-bold text-[15px] shadow-lg transition cursor-pointer text-center w-full sm:w-auto"
        >
          <span>{t['home.hero.ctaPrimary']}</span>
        </LocalizedLink>
      </div>

      {/* 5. Social Proof Row */}
      <div className="mt-10 flex items-center gap-3">
        {/* Three overlapping circular avatars using brand palette */}
        <div className="flex items-center -space-x-2 rtl:space-x-reverse">
          <div className="w-7 h-7 rounded-full bg-brand-accent border-2 border-brand-bg flex items-center justify-center text-[10px] font-extrabold text-white">
            M
          </div>
          <div className="w-7 h-7 rounded-full bg-brand-elevated border-2 border-brand-bg flex items-center justify-center text-[10px] font-extrabold text-white">
            Y
          </div>
          <div className="w-7 h-7 rounded-full bg-slate-500 border-2 border-brand-bg flex items-center justify-center text-[10px] font-extrabold text-white">
            S
          </div>
        </div>

        <span className="text-[13px] font-medium text-brand-secondary">
          {t['home.hero.socialProof']}
        </span>

        <Truck className="w-4 h-4 text-brand-secondary shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default HeroText;
