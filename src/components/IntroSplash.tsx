import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, X } from 'lucide-react';

export interface IntroSplashProps {
  onComplete: () => void;
}

export interface IntroEligibilityInput {
  introShownInSession: boolean;
  prefersReducedMotion: boolean;
  pathname: string;
  search?: string;
}

/**
 * Pure helper to determine whether the intro splash screen should be shown.
 */
export function shouldShowIntroSplash({
  introShownInSession,
  prefersReducedMotion,
  pathname,
  search = '',
}: IntroEligibilityInput): boolean {
  if (introShownInSession) return false;
  if (prefersReducedMotion) return false;
  if (search.includes('autostart=1')) return false;
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sandbox') ||
    pathname.startsWith('/admin') ||
    pathname.includes('/admin')
  ) {
    return false;
  }
  return true;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishIntro();
        return;
      }
    } catch {
      // Ignore matchMedia errors
    }

    // 15-second fallback timeout so slow connections or stalled media never block the site
    const timer = window.setTimeout(() => {
      finishIntro();
    }, 15000);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = false;
      video.volume = 1;
      setIsMuted(false);
    } catch {
      // Ignore unmute errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0D131E] flex items-center justify-center overflow-hidden select-none"
      role="dialog"
      aria-label="Intro video splash screen"
      data-testid="intro-splash"
    >
      {/* Loading Spinner before video canplay */}
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none"
          data-testid="intro-loading-spinner"
        >
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Fullscreen Intro Video */}
      <video
        ref={videoRef}
        src="/assets/brand/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onCanPlay={() => setIsLoading(false)}
        onEnded={finishIntro}
        onError={finishIntro}
        className="w-full h-full object-contain"
      />

      {/* Skip Button - visible immediately in top-right (top-left in RTL) */}
      <button
        type="button"
        onClick={finishIntro}
        aria-label="تخطي / Skip"
        className="absolute top-6 right-6 rtl:right-auto rtl:left-6 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/90 hover:text-white text-xs sm:text-sm font-medium backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-lg"
      >
        <span>تخطي / Skip</span>
        <X className="w-4 h-4" />
      </button>

      {/* Unmute Button - bottom-right, only appears while video is muted */}
      {isMuted && (
        <button
          type="button"
          onClick={handleUnmute}
          aria-label="تشغيل الصوت"
          className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs sm:text-sm font-medium backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
        >
          <Volume2 className="w-4 h-4 text-orange-400" />
          <span>🔊 تشغيل الصوت</span>
        </button>
      )}
    </div>
  );
};

export default IntroSplash;
