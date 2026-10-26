import React from 'react';
import { Sparkles, Mail, MessageCircle, MapPin, ShieldCheck, FileText, Lock, Home } from 'lucide-react';

interface PublicFooterProps {
  onNavigate?: (path: '/' | '/contact' | '/terms' | '/privacy') => void;
  showWhatsAppFloat?: boolean;
}

export const FloatingWhatsAppButton: React.FC = () => {
  return (
    <a
      href="https://wa.me/212722256897?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%81%D8%B1%D9%8A%D9%82%20CodWorth%D8%8C%20%D8%A3%D8%AD%D8%AA%D8%A7%D8%AC%20%D9%85%D8%B3%D8%A7%D8%B9%D8%AF%D8%A9%20%D8%A8%D8%AE%D8%B5%D9%88%D8%B5%20%D8%A7%D9%84%D9%85%D9%86%D8%B5%D8%A9"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      className="fixed bottom-6 left-6 z-50 group flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-extrabold text-xs sm:text-sm px-4 py-3 rounded-full shadow-2xl shadow-[#25D366]/30 border border-white/20 transition-all duration-200 hover:scale-105 print:hidden"
      dir="rtl"
    >
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
      </span>
      <MessageCircle className="w-5 h-5 fill-slate-950 text-slate-950 shrink-0" />
      <span>تواصل عبر واتساب</span>
    </a>
  );
};

export const PublicFooter: React.FC<PublicFooterProps> = ({
  onNavigate,
  showWhatsAppFloat = true,
}) => {
  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: '/' | '/contact' | '/terms' | '/privacy'
  ) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(targetPath);
    }
  };

  return (
    <>
      {showWhatsAppFloat && <FloatingWhatsAppButton />}

      <footer
        dir="rtl"
        className="border-t border-slate-800/80 bg-slate-950 text-slate-400 pt-12 pb-8 px-4 sm:px-8 mt-auto print:hidden font-sans"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-900">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-3.5">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, '/')}
              className="inline-flex items-center gap-2.5 text-white hover:opacity-90 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-slate-950 font-black">
                <Sparkles className="w-4 h-4 text-slate-950" />
              </div>
              <span className="font-black text-lg tracking-tight text-white">CodWorth</span>
            </a>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              المنصة المغربية الأولى لبناء صفحات الهبوط الاحترافية ومضاعفة مبيعات الدفع عند الاستلام (COD)
              بالذكاء الاصطناعي وبسرعة فائقة.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>نطاقات رسمية معتمدة ومتوافقة مع معايير الأمان وحماية البيانات 🇲🇦</span>
            </div>
          </div>

          {/* Quick Legal & Platform Links */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              روابط المنصة والصفحات القانونية
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="/"
                  onClick={(e) => handleLinkClick(e, '/')}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500" />
                  <span>الصفحة الرئيسية (المنصة)</span>
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLinkClick(e, '/contact')}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>تواصل معنا (الدعم الفني)</span>
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => handleLinkClick(e, '/terms')}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>شروط الاستخدام (Terms of Service)</span>
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => handleLinkClick(e, '/privacy')}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>سياسة الخصوصية (Privacy Policy)</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Direct Contact Details */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              معلومات التواصل المباشر
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="mailto:codworth.me@gmail.com"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span dir="ltr">codworth.me@gmail.com</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/212722256897"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span dir="ltr">+212 722-256897</span>
                </a>
              </li>
              <li className="inline-flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>الدار البيضاء، المملكة المغربية 🇲🇦</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} CodWorth SARL. جميع الحقوق محفوظة • المملكة المغربية 🇲🇦
          </div>
          <div className="flex items-center gap-4">
            <a href="/terms" onClick={(e) => handleLinkClick(e, '/terms')} className="hover:text-slate-300 transition">
              الشروط والأحكام
            </a>
            <span>•</span>
            <a href="/privacy" onClick={(e) => handleLinkClick(e, '/privacy')} className="hover:text-slate-300 transition">
              الخصوصية
            </a>
            <span>•</span>
            <a href="/contact" onClick={(e) => handleLinkClick(e, '/contact')} className="hover:text-slate-300 transition">
              الدعم الفني
            </a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default PublicFooter;
