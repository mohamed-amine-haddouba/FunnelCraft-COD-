import { useEffect, useRef, useState } from 'react';

interface IntroSplashProps {
  onComplete: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useEffect(() => {
    // Reduced motion → skip entirely
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    // 15s fallback so slow networks never block the site
    const timeout = setTimeout(finish, 15000);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnmute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setIsMuted(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0D131E]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      <video
        ref={videoRef}
        src="/assets/brand/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        onCanPlay={() => setIsLoading(false)}
        onEnded={finish}
        onError={finish}
      />

      {/* Skip */}
      <button
        type="button"
        onClick={finish}
        className="absolute top-6 right-6 z-10 rounded-full bg-black/60 px-5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/80"
      >
        تخطي
      </button>

      {/* Unmute */}
      {isMuted && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute bottom-6 right-6 z-10 rounded-full bg-black/60 px-5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/80"
        >
          🔊 تشغيل الصوت
        </button>
      )}
    </div>
  );
}
