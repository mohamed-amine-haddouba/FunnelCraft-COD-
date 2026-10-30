import React, { useState, useEffect } from 'react';
import { HeroBlock, ThemeConfig } from '../../types/landingPage';
import { Star, CheckCircle2, ShoppingBag, ShieldCheck, ChevronLeft, ChevronRight, Layers, Sparkles } from 'lucide-react';

interface Props {
  block: HeroBlock;
  theme: ThemeConfig;
}

export const HeroBlockView: React.FC<Props> = ({ block, theme }) => {
  const images =
    Array.isArray(block.images) && block.images.length > 0
      ? block.images
      : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80'];

  const [activeImg, setActiveImg] = useState(0);

  // Reset active image index if block.images array changes
  useEffect(() => {
    if (activeImg >= images.length) {
      setActiveImg(0);
    }
  }, [images.length, activeImg]);

  const discountPercentage =
    block.priceOriginal > block.priceDiscounted
      ? Math.round(((block.priceOriginal - block.priceDiscounted) / block.priceOriginal) * 100)
      : 0;

  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-3xl',
  };
  const activeRadiusClass = radiusMap[theme.borderRadius || 'lg'] || 'rounded-2xl';

  const scrollToForm = () => {
    const formEl = document.getElementById('cod-checkout-section');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImg((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImg((prev) => (prev + 1) % images.length);
  };

  const displayFeatures =
    Array.isArray(block.features) && block.features.length > 0
      ? block.features
      : Array.isArray(block.trustPoints)
      ? block.trustPoints
      : [];

  const displaySpecs = Array.isArray(block.specifications) ? block.specifications : [];

  return (
    <section className="py-10 md:py-16 px-4 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Image Gallery Column */}
        <div className="lg:col-span-6 order-1 lg:order-2">
          <div className="relative group">
            <div
              className={`overflow-hidden border border-slate-200 shadow-xl bg-slate-100 aspect-square relative ${activeRadiusClass}`}
            >
              <img
                src={images[activeImg] || images[0]}
                alt={block.headline}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              {discountPercentage > 0 && (
                <div
                  style={{ backgroundColor: theme.accentColor }}
                  className="absolute top-4 left-4 text-white font-extrabold px-3.5 py-1.5 rounded-full text-sm shadow-lg"
                >
                  -{discountPercentage}% OFF
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-slate-900/75 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-md">
                    {activeImg + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails Gallery Strip */}
            {images.length > 1 && (
              <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1.5">
                {images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImg(idx);
                    }}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                      activeImg === idx
                        ? 'scale-105 shadow-md ring-2 ring-offset-1'
                        : 'border-transparent opacity-65 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: activeImg === idx ? theme.primaryColor : 'transparent',
                    }}
                  >
                    <img
                      src={img}
                      alt={`${block.headline} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Copy, Description, Features, Specs & CTA Column */}
        <div className="lg:col-span-6 order-2 lg:order-1 flex flex-col justify-center">
          {/* Top Badge & Rating */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {block.badge && (
              <span
                style={{
                  backgroundColor: `${theme.primaryColor}18`,
                  color: theme.primaryColor,
                }}
                className="px-3.5 py-1 rounded-full text-xs md:text-sm font-bold tracking-wide"
              >
                {block.badge}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-amber-500 text-sm font-semibold">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-slate-800 font-bold">{block.rating}</span>
              <span className="text-slate-500 text-xs">({block.reviewCount.toLocaleString()}+)</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            {block.headline}
          </h1>

          {/* Full Description / Subheadline */}
          <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-6 whitespace-pre-line">
            {block.description || block.subheadline}
          </p>

          {/* Price Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                Special Offer Price
              </span>
              <div className="flex items-baseline gap-3">
                <span
                  style={{ color: theme.primaryColor }}
                  className="text-3xl md:text-4xl font-black tracking-tight"
                >
                  {block.priceDiscounted} {block.currency}
                </span>
                {block.priceOriginal > block.priceDiscounted && (
                  <span className="text-lg text-slate-400 line-through font-medium">
                    {block.priceOriginal} {block.currency}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Pay Cash on Delivery</span>
            </div>
          </div>

          {/* Extracted Features / Bullet Points */}
          {displayFeatures.length > 0 && (
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: theme.primaryColor }} />
                <span>Key Highlights & Benefits</span>
              </div>
              {displayFeatures.map((point, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <CheckCircle2
                    style={{ color: theme.primaryColor }}
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                  />
                  <span className="text-slate-700 font-medium text-sm md:text-base">{point}</span>
                </div>
              ))}
            </div>
          )}

          {/* Extracted Specifications Grid */}
          {displaySpecs.length > 0 && (
            <div className="mb-7 bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                <Layers className="w-3.5 h-3.5" style={{ color: theme.primaryColor }} />
                <span>Technical Specifications</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displaySpecs.slice(0, 6).map((spec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-white border border-slate-200/70 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-slate-500 truncate">{spec.label}:</span>
                    <span className="font-bold text-slate-800 truncate">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary CTA Button */}
          <div>
            <button
              type="button"
              onClick={scrollToForm}
              style={{ backgroundColor: theme.primaryColor }}
              className={`w-full py-4 px-6 text-white font-bold text-lg shadow-lg hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer ${activeRadiusClass}`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{block.ctaText}</span>
            </button>
            {block.ctaSubtext && (
              <p className="text-center text-xs md:text-sm text-slate-500 mt-2.5 font-medium">
                {block.ctaSubtext}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
