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
      className="relative w-full bg-[#0D131E] text-[#F8FAFC] overflow-hidden py-12 sm:py-16 lg:py-24"
    >
      {/* Subtle Orange Glow at 5% Opacity in Top Corner */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-32 ${
          isRtl ? '-left-32' : '-right-32'
        } w-[520px] h-[520px] rounded-full bg-[#E25B26]/5 blur-3xl`}
      />

      {/* Faint Geometric Zellij Pattern Overlay at 3% Opacity */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(#F8FAFC 1px, transparent 1px), linear-gradient(45deg, #F8FAFC 1px, transparent 1px), linear-gradient(-45deg, #F8FAFC 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
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
