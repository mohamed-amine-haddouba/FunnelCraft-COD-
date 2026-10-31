import React from 'react';
import { useLanguage } from '../../i18n/translations';
import { HeroText } from './HeroText';
import { HeroVisual } from './HeroVisual';

export const HeroSection: React.FC = () => {
  const { dir, isRtl } = useLanguage();

  return (
    <section
      id="hero"
      dir={dir}
      className="relative w-full bg-brand-bg text-brand-primary overflow-hidden py-12 sm:py-16 lg:py-24"
    >
      {/* Soft Premium Orange Glow at 10% Opacity with blur-[120px] in Top Corner */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-32 ${
          isRtl ? '-left-32' : '-right-32'
        } w-[520px] h-[520px] rounded-full bg-brand-accent/10 blur-[120px]`}
      />

      {/* Symmetrical RTL/LTR Grid: Text on Right in AR / Left in EN-FR; Mockups on Left in AR / Right in EN-FR */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-12 items-center">
          <div className="lg:col-span-6">
            <HeroText />
          </div>

          <div className="lg:col-span-6">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
