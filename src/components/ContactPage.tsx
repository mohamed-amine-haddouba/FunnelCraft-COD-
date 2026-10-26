import React, { useState } from 'react';
import {
  Mail,
  MessageCircle,
  MapPin,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  ShieldCheck,
  Building2,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { PublicFooter } from './PublicFooter';

interface ContactPageProps {
  onBackToHome?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({
  onBackToHome,
  onNavigateToTerms,
  onNavigateToPrivacy,
}) => {
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('technical');
  const [message, setMessage] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة قبل الإرسال.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'تعذر إرسال الرسالة، يرجى المحاولة لاحقاً.');
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      setFullName('');
      setEmail('');
      setMessage('');
      setSubject('technical');
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'حدث خطأ أثناء إرسال الرسالة.');
    }
  };

  const faqItems = [
    {
      question: 'كيف يمكنني البدء في استخدام CodWorth؟',
      answer:
        'يمكنك إنشاء حساب مجاني والبدء فوراً في إنشاء صفحات الهبوط الخاصة بمنتجاتك وتخصيصها دون الحاجة لبطاقة بنكية. توفر المنصة قوالب جاهزة ومحرر سحب وإفلات سريع يدعم الدفع عند الاستلام بالكامل.',
    },
    {
      question: 'ما هي طرق الدفع المتاحة للاشتراك في باقة Pro؟',
      answer:
        'ندعم التحويل البنكي المحلي في المغرب عبر أشهر الأبناك (CIH Bank، التجاري وفا بنك Attijariwafa، البنك الشعبي Banque Populaire) بالإضافة إلى بطاقات الدفع العالمية وPayPal بأسعار صرف حية وشفافة.',
    },
    {
      question: 'هل تتوفر فترة تجريبية مجانية؟',
      answer:
        'نعم، يمكنك استخدام الباقة المجانية بدون قيود زمنية لإنشاء صفحاتك الأولى وتجربة كافة مميزات المنصة الأساسية قبل الترقية لتوسيع تجارتك وربط الدومين المخصص.',
    },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950"
    >
      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              if (onBackToHome) {
                e.preventDefault();
                onBackToHome();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>العودة للمنصة</span>
          </a>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <span className="font-black text-sm tracking-tight text-white">CodWorth</span>
            <span className="text-[10px] font-bold text-emerald-400">• الدعم الفني</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <a
            href="/terms"
            onClick={(e) => {
              if (onNavigateToTerms) {
                e.preventDefault();
                onNavigateToTerms();
              }
            }}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            شروط الاستخدام
          </a>
          <a
            href="/privacy"
            onClick={(e) => {
              if (onNavigateToPrivacy) {
                e.preventDefault();
                onNavigateToPrivacy();
              }
            }}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            سياسة الخصوصية
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-14">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold shadow-sm">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>نرد على كافة الاستفسارات خلال 24 ساعة كحد أقصى</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            تواصل معنا
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            نحن هنا لمساعدتك في أي وقت. فريق دعم CodWorth يجيب على استفساراتك حول المنصة، باقات الاشتراك،
            والربط مع شركات التوصيل خلال 24 ساعة.
          </p>
        </div>

        {/* Contact Info Cards (3 cards in a grid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. البريد الإلكتروني (Email) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">البريد الإلكتروني</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              للاستفسارات العامة، الدعم الفني، وطلبات الحسابات والفوترة
            </p>
            <a
              href="mailto:codworth.me@gmail.com"
              dir="ltr"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition group-hover:underline"
            >
              <span>codworth.me@gmail.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* 2. واتساب (WhatsApp) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">واتساب (WhatsApp)</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              دعم فوري للتجار المشتركين ومساعدتكم في إعداد الحملات والصفحات
            </p>
            <a
              href="https://wa.me/212661849201"
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition group-hover:underline"
            >
              <span>+212 661-849201</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* 3. المقر (Location) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white mb-1">المقر الرئيسي</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              فريقنا يعمل من قلب العاصمة الاقتصادية للمملكة المغربية 🇲🇦
            </p>
            <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>الدار البيضاء، المغرب</span>
            </div>
          </div>
        </div>

        {/* Contact Form & Support Guarantees */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold text-white mb-1">أرسل لنا رسالة مباشرة</h2>
              <p className="text-xs text-slate-400">
                املأ النموذج وسيقوم أحد ممثلي الدعم بالتواصل معك عبر البريد الإلكتروني.
              </p>
            </div>

            {isSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-white">تم استلام رسالتك بنجاح!</h3>
                <p className="text-xs text-emerald-300 leading-relaxed max-w-md mx-auto">
                  شكراً لتواصلك مع CodWorth. فريق الدعم يقوم حالياً بمراجعة استفسارك وسنرد عليك عبر البريد
                  خلال 24 ساعة كحد أقصى.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: يوسف العلمي"
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      البريد الإلكتروني *
                    </label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="merchant@example.com"
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition text-right"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    موضوع الاستفسار *
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="technical">الدعم الفني والتقني (Technical Support)</option>
                    <option value="billing">الفوترة وتفعيل الاشتراكات (Billing & Subscriptions)</option>
                    <option value="partnership">الشراكات والأعمال والتوزيع (Partnership & Business)</option>
                    <option value="other">استفسار عام / أخرى (General Inquiry / Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الرسالة / تفاصيل الاستفسار *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب استفسارك بالتفصيل وسنوافيك بالحل المناسب..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الإرسال...' : 'إرسال الرسالة'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Guarantees & Help Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>التزامنا تجاه تجار المنصة</span>
              </h3>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p>
                    <strong className="text-white">دعم باللغة العربية والفرنسية:</strong> فريقنا يتحدث لغتك
                    ويفهم خصوصية التجارة الإلكترونية في المغرب وإفريقيا.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p>
                    <strong className="text-white">تأكيد يدوي فوري للتحويلات البنكية:</strong> تفعيل فوري
                    للاشتراكات بمجرد إرفاق وصل التحويل (CIH, Attijari, BP).
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <p>
                    <strong className="text-white">أمان وحماية تامة للبيانات:</strong> سيرفرات سريعة مشفرة
                    ومتوافقة مع معايير الأمان المغربية والعالمية.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Contact Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/20 text-xs space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>هل تحتاج استشارة عاجلة بخصوص متجرك؟</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                تواصل مع فريقنا مباشرة عبر واتساب للحصول على توجيه مجاني حول تحسين معدل التحويل وصفحات الدفع
                عند الاستلام.
              </p>
              <a
                href="https://wa.me/212661849201"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold pt-1"
              >
                <span>محادثة واتساب مباشرة</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* FAQ Quick Section */}
        <section className="space-y-6 pt-6 border-t border-slate-800">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <HelpCircle className="w-4 h-4" />
              <span>الأسئلة الشائعة</span>
            </div>
            <h2 className="text-2xl font-black text-white">إجابات سريعة على أهم استفسارات التجار</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqItems.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-right hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <span className="font-bold text-white text-xs sm:text-sm">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-4 sm:p-5 pt-0 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/40">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Professional Public Footer + Floating WhatsApp Button */}
      <PublicFooter
        onNavigate={(targetPath) => {
          if (targetPath === '/' && onBackToHome) return onBackToHome();
          if (targetPath === '/terms' && onNavigateToTerms) return onNavigateToTerms();
          if (targetPath === '/privacy' && onNavigateToPrivacy) return onNavigateToPrivacy();
          window.location.href = targetPath;
        }}
      />
    </div>
  );
};

export default ContactPage;
