import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [needsTapForSound, setNeedsTapForSound] = useState(false);

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
      // Ignore matchMedia errors
    }

    // 15s fallback — never block the site
    const timer = window.setTimeout(finishIntro, 15000);

    const video = videoRef.current;
    if (video) {
      // Try autoplay WITH sound first
      video.muted = false;
      video.volume = 1;
      const playPromise = video.play();

      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setIsMuted(false);
            setNeedsTapForSound(false);
          })
          .catch(() => {
            // Blocked → fallback to muted autoplay + big "tap for sound" prompt
            video.muted = true;
            setIsMuted(true);
            setNeedsTapForSound(true);
            video.play().catch(() => finishIntro());
          });
      } else {
        // Older browsers
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => finishIntro());
      }
    }

    return () => window.clearTimeout(timer);
  }, [finishIntro]);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = false;
      video.volume = 1;
      setIsMuted(false);
      setNeedsTapForSound(false);
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          video.muted = true;
          setIsMuted(true);
        });
      }
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
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 pointer-events-none"
          data-testid="intro-loading-spinner"
        >
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

      {/* Skip Button */}
      <button
        type="button"
        onClick={finishIntro}
        aria-label="تخطي / Skip"
        className="absolute top-6 right-6 rtl:right-auto rtl:left-6 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/90 hover:text-white text-xs sm:text-sm font-medium backdrop-blur-md border border-white/15 transition-all cursor-pointer shadow-lg"
      >
        <span>تخطي / Skip</span>
        <X className="w-4 h-4" />
      </button>

      {/* Big "tap for sound" overlay when autoplay-with-sound was blocked */}
      {needsTapForSound && (
        <button
          type="button"
          onClick={handleUnmute}
          aria-label="تشغيل الصوت"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 cursor-pointer"
        >
          <div className="bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-full p-6 mb-4 transition">
            <Volume2 className="w-14 h-14 text-white" />
          </div>
          <span className="text-white text-lg sm:text-xl font-semibold drop-shadow-lg">
            اضغط لتشغيل الصوت
          </span>
          <span className="text-white/70 text-sm mt-2 drop-shadow">
            أو انتظر — الفيديو يعمل بدون صوت
          </span>
        </button>
      )}

      {/* Small unmute button (when muted but user already dismissed overlay) */}
      {isMuted && !needsTapForSound && (
        <button
          type="button"
          onClick={handleUnmute}
          aria-label="تشغيل الصوت"
          className="absolute bottom-6 right-6 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs sm:text-sm font-medium backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
        >
          <Volume2 className="w-4 h-4 text-orange-400" />
          <span>🔊 تشغيل الصوت</span>
        </button>
      )}
    </div>
  );
};

export default IntroSplash;
