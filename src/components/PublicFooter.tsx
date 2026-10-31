import React from 'react';
import { Mail, MessageCircle, MapPin, ShieldCheck, FileText, Lock, Home } from 'lucide-react';
import { LocalizedLink } from './LocalizedLink';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';
import { useLanguage } from '../i18n/translations';
import { FloatingWhatsApp } from './FloatingWhatsApp';

interface PublicFooterProps {
  onNavigate?: (path: string) => void;
  showWhatsAppFloat?: boolean;
}

export const FloatingWhatsAppButton: React.FC = () => {
  return <FloatingWhatsApp />;
};

export const PublicFooter: React.FC<PublicFooterProps> = ({
  onNavigate,
  showWhatsAppFloat = false,
}) => {
  const navigate = useLocalizedNavigate();
  const { dir } = useLanguage();

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string
  ) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(targetPath);
    }
  };

  return (
    <>
      {showWhatsAppFloat && <FloatingWhatsApp />}

      <footer
        dir={dir}
        className="border-t border-[#1E293B] bg-[#0D131E] text-[#CBD5E1] pt-12 pb-8 px-4 sm:px-8 mt-auto print:hidden font-sans"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#1E293B]">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-3.5">
            <LocalizedLink
              to="/home"
              onClick={(e) => handleLinkClick(e, '/home')}
              className="inline-flex items-center gap-2.5 text-[#F8FAFC] hover:opacity-90 transition"
            >
              <img
                src="/assets/brand/logo.jpg"
                alt="CodWorth"
                className="h-10 w-auto object-contain rounded-lg"
              />
            </LocalizedLink>

            <p className="text-xs text-[#CBD5E1] leading-relaxed max-w-sm">
              المنصة المغربية الأولى لبناء صفحات الهبوط الاحترافية ومضاعفة مبيعات الدفع عند الاستلام (COD)
              بالذكاء الاصطناعي وبسرعة فائقة.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-[#E25B26] font-semibold pt-1">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>نطاقات رسمية معتمدة ومتوافقة مع معايير الأمان وحماية البيانات 🇲🇦</span>
            </div>
          </div>

          {/* Quick Legal & Platform Links */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
              روابط المنصة والصفحات القانونية
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <LocalizedLink
                  to="/home"
                  onClick={(e) => handleLinkClick(e, '/home')}
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <Home className="w-3.5 h-3.5 text-[#E25B26]" />
                  <span>الصفحة الرئيسية (المنصة)</span>
                </LocalizedLink>
              </li>
              <li>
                <LocalizedLink
                  to="/contact"
                  onClick={(e) => handleLinkClick(e, '/contact')}
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#E25B26]" />
                  <span>تواصل معنا (الدعم الفني)</span>
                </LocalizedLink>
              </li>
              <li>
                <LocalizedLink
                  to="/terms"
                  onClick={(e) => handleLinkClick(e, '/terms')}
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <FileText className="w-3.5 h-3.5 text-[#E25B26]" />
                  <span>شروط الاستخدام (Terms of Service)</span>
                </LocalizedLink>
              </li>
              <li>
                <LocalizedLink
                  to="/privacy"
                  onClick={(e) => handleLinkClick(e, '/privacy')}
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <Lock className="w-3.5 h-3.5 text-[#E25B26]" />
                  <span>سياسة الخصوصية (Privacy Policy)</span>
                </LocalizedLink>
              </li>
            </ul>
          </div>

          {/* Direct Contact Details */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F8FAFC]">
              معلومات التواصل المباشر
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href="mailto:codworth.me@gmail.com"
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <Mail className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                  <span dir="ltr">codworth.me@gmail.com</span>
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/212722256897"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#CBD5E1] hover:text-[#E25B26] transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                  <span dir="ltr">+212 722-256897</span>
                </a>
              </li>
              <li className="inline-flex items-center gap-2 text-[#CBD5E1]">
                <MapPin className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                <span>الدار البيضاء، المملكة المغربية 🇲🇦</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#CBD5E1]/70">
          <div>
            © {new Date().getFullYear()} CodWorth SARL. جميع الحقوق محفوظة • المملكة المغربية 🇲🇦
          </div>
          <div className="flex items-center gap-4">
            <LocalizedLink
              to="/terms"
              onClick={(e) => handleLinkClick(e, '/terms')}
              className="hover:text-[#F8FAFC] transition"
            >
              الشروط والأحكام
            </LocalizedLink>
            <span>•</span>
            <LocalizedLink
              to="/privacy"
              onClick={(e) => handleLinkClick(e, '/privacy')}
              className="hover:text-[#F8FAFC] transition"
            >
              الخصوصية
            </LocalizedLink>
            <span>•</span>
            <LocalizedLink
              to="/contact"
              onClick={(e) => handleLinkClick(e, '/contact')}
              className="hover:text-[#F8FAFC] transition"
            >
              الدعم الفني
            </LocalizedLink>
          </div>
        </div>
      </footer>
    </>
  );
};

export default PublicFooter;
