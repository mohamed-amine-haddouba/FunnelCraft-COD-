import React from 'react';

interface FloatingWhatsAppProps {
  phoneNumber?: string;
  message?: string;
}

export const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({
  phoneNumber = '212722256897',
  message = 'مرحباً فريق CodWorth، أحتاج مساعدة بخصوص المنصة',
}) => {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  return (
    <div
      dir="rtl"
      className="fixed bottom-5 end-5 z-50 flex items-center group print:hidden select-none"
    >
      {/* Hover Tooltip */}
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 me-3 px-3.5 py-2 rounded-xl bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap shadow-xl border border-slate-700/80 backdrop-blur-md">
        تواصل معنا على واتساب
      </span>

      {/* Circular WhatsApp Button with Subtle Pulse Ring */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="تواصل معنا على واتساب"
        title="تواصل معنا على واتساب"
        className="relative w-13 h-13 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center shadow-2xl shadow-[#25D366]/40 ring-4 ring-[#25D366]/25 transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <span className="absolute -inset-1 rounded-full bg-[#25D366]/30 animate-pulse pointer-events-none" />
        <svg
          viewBox="0 0 32 32"
          fill="currentColor"
          className="w-7 h-7 relative z-10 text-white"
          aria-hidden="true"
        >
          <path d="M16.004 3.2c-7.072 0-12.8 5.728-12.8 12.8 0 2.258.59 4.462 1.71 6.404L3.2 28.8l6.56-1.72c1.878 1.024 3.992 1.564 6.148 1.564h.006c7.068 0 12.8-5.728 12.8-12.8 0-3.42-1.332-6.636-3.75-9.054C22.546 4.532 19.424 3.2 16.004 3.2zm0 23.296h-.004c-1.91 0-3.784-.514-5.42-1.484l-.388-.23-3.892 1.02 1.038-3.794-.252-.402a10.614 10.614 0 0 1-1.63-5.654c0-5.874 4.78-10.652 10.656-10.652 2.846 0 5.52 1.108 7.532 3.122 2.012 2.014 3.12 4.69 3.118 7.536-.002 5.876-4.782 10.654-10.658 10.654zm5.844-7.98c-.32-.16-1.894-.934-2.188-1.042-.294-.106-.508-.16-.722.16-.214.32-.828 1.042-1.016 1.256-.186.214-.374.24-.694.08-.32-.16-1.352-.498-2.576-1.59-.952-.848-1.594-1.898-1.782-2.218-.186-.32-.02-.494.14-.654.144-.144.32-.374.48-.562.16-.186.214-.32.32-.534.106-.214.054-.4-.026-.56-.08-.16-.722-1.74-.988-2.382-.26-.624-.526-.54-.722-.55-.186-.008-.4-.01-.614-.01s-.56.08-.854.4c-.294.32-1.122 1.096-1.122 2.674s1.148 3.102 1.308 3.316c.16.214 2.26 3.45 5.476 4.838.764.33 1.362.528 1.826.676.768.244 1.466.21 2.018.128.616-.092 1.894-.774 2.162-1.522.268-.748.268-1.39.188-1.522-.08-.134-.294-.214-.614-.374z" />
        </svg>
      </a>
    </div>
  );
};

export default FloatingWhatsApp;
