import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX, X } from 'lucide-react';

export interface IntroSplashProps {
  onComplete: () => void;
}

export interface IntroEligibilityInput {
  introShownInSession: boolean;
  prefersReducedMotion: boolean;
  pathname: string;
  search?: string;
}

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

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finishIntro();
        return;
      }
    } catch {
      // Ignore
    }

    const timer = window.setTimeout(finishIntro, 15000);

    const video = videoRef.current;
    if (video) {
      // Try autoplay with sound; fall back silently to muted (no overlay)
      video.muted = false;
      video.volume = 1;
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => setIsMuted(false)).catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => finishIntro());
        });
      } else {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => finishIntro());
      }
    }

    return () => window.clearTimeout(timer);
  }, [finishIntro]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.muted) {
        video.muted = false;
        video.volume = 1;
        setIsMuted(false);
      } else {
        video.muted = true;
        setIsMuted(true);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0D131E] flex items-center justify-center overflow-hidden select-none"
      role="dialog"
      aria-label="Intro video splash screen"
      data-testid="intro-splash"
    >
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      )}

      <video
        ref={videoRef}
        src="/assets/brand/intro.mp4"
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setIsLoading(false)}
        onEnded={finishIntro}
        onError={finishIntro}
        className="w-full h-full object-contain"
      />

      {/* Skip — top right */}
      <button
        type="button"
        onClick={finishIntro}
        aria-label="تخطي / Skip"
        className="absolute top-6 right-6 rtl:right-auto rtl:left-6 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white text-xs sm:text-sm font-medium backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-lg"
      >
        <span>تخطي</span>
        <X className="w-4 h-4" />
      </button>

      {/* Sound toggle — small, bottom-left, gentle pulse when muted */}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
        title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
        className={`absolute bottom-6 left-6 rtl:left-auto rtl:right-6 z-30 inline-flex items-center justify-center w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg ${
          isMuted ? 'animate-pulse' : ''
        }`}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export default IntroSplash;

