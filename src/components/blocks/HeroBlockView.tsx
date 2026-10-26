import React, { useState } from 'react';
import { HeroBlock, PageTheme, ViewportMode } from '../../types/landingPage';
import { Star, ShieldCheck, Truck, Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface Props {
  block: HeroBlock;
  theme: PageTheme;
  viewport?: ViewportMode;
  isRtl?: boolean;
  onCtaClick?: () => void;
}

export const HeroBlockView: React.FC<Props> = ({ block, theme, viewport = 'desktop', isRtl, onCtaClick }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';

  const images = block.images && block.images.length > 0
    ? block.images
    : ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80'];

  const discountPercent =
    block.priceOriginal && block.priceDiscounted
      ? Math.round(((block.priceOriginal - block.priceDiscounted) / block.priceOriginal) * 100)
      : 50;

  return (
    <section className={`mx-auto ${isMobile ? 'px-3 py-6' : 'max-w-6xl px-4 py-8 md:py-16'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={isMobile || isTablet ? 'flex flex-col gap-6' : 'grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center'}>
        {/* Gallery */}
        <div className={isMobile || isTablet ? 'w-full space-y-3' : 'lg:col-span-6 space-y-4'}>
          <div className="relative rounded-3xl overflow-hidden bg-gray-100 shadow-xl border border-gray-200 aspect-square group">
            <img
              src={images[selectedImageIndex]}
              alt={block.headline}
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
            />
            <span className="absolute top-4 start-4 bg-red-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
              -{discountPercent}% OFF
            </span>
            <div className="absolute bottom-4 end-4 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full">
              Cash on Delivery Available
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative ${isMobile ? 'w-16 h-16' : 'w-20 h-20'} rounded-2xl overflow-hidden shrink-0 border-2 transition ${
                    selectedImageIndex === idx
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content & Offer */}
        <div className={isMobile || isTablet ? 'w-full space-y-4' : 'lg:col-span-6 space-y-6'}>
          {block.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold tracking-wide">
              <span>{block.badge}</span>
            </div>
          )}

          <h1 className={`${isMobile ? 'text-2xl font-black leading-tight' : 'text-3xl md:text-5xl font-black leading-tight'} text-gray-900 tracking-tight`}>
            {block.headline}
          </h1>

          <p className={`${isMobile ? 'text-sm' : 'text-base md:text-lg'} text-gray-600 leading-relaxed font-normal`}>
            {block.subheadline}
          </p>

          {/* Pricing Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl md:text-4xl font-black text-emerald-600">
                {block.priceDiscounted} {block.currency}
              </span>
              <span className="text-xl text-gray-400 line-through">
                {block.priceOriginal} {block.currency}
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-lg">
                Save {discountPercent}% Today
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="font-bold text-gray-900">{block.rating || 4.9}/5</span>
              <span className="text-gray-400">({block.reviewCount || 2400}+ Verified Reviews)</span>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onCtaClick}
              className="w-full py-4 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg md:text-xl rounded-2xl shadow-xl hover:shadow-2xl transition transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer group"
              style={{ backgroundColor: theme.primaryColor || '#059669' }}
            >
              <span>{block.ctaText}</span>
              {isRtl ? (
                <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
              ) : (
                <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
              )}
            </button>
            <p className="text-center text-xs text-gray-500 font-medium">
              {block.ctaSubtext}
            </p>
          </div>

          {/* Bullet points */}
          {block.trustPoints && block.trustPoints.length > 0 && (
            <ul className="space-y-2.5 pt-2 border-t border-gray-100">
              {block.trustPoints.map((pt, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
