import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  ArrowRight,
  Scale,
  Sparkles,
  Printer,
  ExternalLink,
  Mail,
  Building2,
  Phone,
  AlertTriangle,
  Lock,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { PublicFooter } from './PublicFooter';

interface TermsPageProps {
  onBackToHome?: () => void;
  onNavigateToContact?: () => void;
  onNavigateToPrivacy?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({
  onBackToHome,
  onNavigateToContact,
  onNavigateToPrivacy,
}) => {
  const [activeSection, setActiveSection] = useState<string>('acceptance');

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'acceptance', title: '1. قبول الشروط' },
    { id: 'service', title: '2. وصف الخدمة' },
    { id: 'account', title: '3. حساب المستخدم والأمان' },
    { id: 'billing', title: '4. الاشتراكات والفوترة والدفع' },
    { id: 'acceptable-use', title: '5. الاستخدام المقبول والمحظور' },
    { id: 'ip', title: '6. الملكية الفكرية وحقوق المحتوى' },
    { id: 'disclaimer', title: '7. إخلاء المسؤولية وضمانات الخدمة' },
    { id: 'liability', title: '8. تحديد المسؤولية' },
    { id: 'termination', title: '9. إلغاء الحساب وإنهاء الخدمة' },
    { id: 'modifications', title: '10. التعديلات على الشروط' },
    { id: 'law', title: '11. القانون المطبق وحل النزاعات' },
    { id: 'contact', title: '12. معلومات التواصل القانوني' },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950"
    >
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between print:hidden">
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
            <span className="text-[10px] font-bold text-emerald-400">• الشروط والأحكام</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="طباعة أو حفظ كملف PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">طباعة / PDF</span>
          </button>

          <a
            href="/contact"
            onClick={(e) => {
              if (onNavigateToContact) {
                e.preventDefault();
                onNavigateToContact();
              }
            }}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            اتصل بنا
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Header Hero */}
        <div className="text-center space-y-3 max-w-3xl mx-auto border-b border-slate-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold shadow-sm">
            <Scale className="w-3.5 h-3.5 text-emerald-400" />
            <span>اتفاقية قانونية ملزمة وفقاً للتشريع التجاري المغربي 🇲🇦</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            شروط وأحكام الاستخدام (Terms of Service)
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
            آخر تحديث: 26 أكتوبر 2026 • سارية المفعول على جميع مستخدمي وتجار منصة CodWorth.
          </p>
        </div>

        {/* Quick Section Navigator (Pills) */}
        <div className="print:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                activeSection === sec.id
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>

        {/* Legal Document Content (12 Sections) */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-10 space-y-10 shadow-2xl leading-relaxed text-sm text-slate-300 text-justify">
          {/* Section 1 */}
          <section id="acceptance" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                01
              </span>
              <h2>1. قبول الشروط والأحكام (Acceptance of Terms)</h2>
            </div>
            <p>
              باستخدامك لمنصة <strong>CodWorth</strong> («المنصة»، «نحن»، «لنا») أو بإنشاء حساب تاجر أو
              استخدام محررات صفحات الهبوط والخدمات المرتبطة بها، فإنك تقر بأنك قد قرأت وفهمت ووافقت بالكامل
              على الالتزام بجميع بنود هذه الاتفاقية. إذا كنت لا توافق على هذه الشروط، يرجى الامتناع فوراً عن
              استخدام المنصة.
            </p>
            <p>
              تنطبق هذه الشروط على جميع الزوار، التجار، العملاء، ومقدمي الخدمات الذين يصلون إلى أي من خدماتنا
              سواء عبر النطاق الرئيسي أو النطاقات الفرعية أو النطاقات المخصصة المرتبطة.
            </p>
          </section>

          {/* Section 2 */}
          <section id="service" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                02
              </span>
              <h2>2. وصف الخدمة (Description of Service)</h2>
            </div>
            <p>
              توفر منصة CodWorth برمجيات سحابية (SaaS) موجهة لتجار التجارة الإلكترونية والدفع عند الاستلام
              (Cash on Delivery - COD) في المغرب ومنطقة الشرق الأوسط وشمال إفريقيا. تشمل الخدمات:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-300">
              <li>محرر مرئي تفاعلي لإنشاء وتعديل صفحات هبوط ومنتجات فائقة السرعة بدون برمجة.</li>
              <li>استيراد تلقائي للمنتجات والبيانات عبر الروابط من منصات التجارة الإلكترونية العالمية.</li>
              <li>نماذج دفع عند الاستلام ذكية ومخصصة مع حساب دقيق لخيارات العروض (Bundles).</li>
              <li>إمكانية الدفع المسبق عبر PayPal مع التحويل الآلي لأسعار العملات المحلية كـ (MAD) إلى (USD).</li>
              <li>لوحة تحكم لإدارة ومتابعة طلبات العملاء وتصديرها وتأكيدها عبر تطبيق WhatsApp.</li>
              <li>استضافة الصفحات على نطاقات فرعية سريعة أو ربط النطاقات الخاصة (Custom Domains).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section id="account" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                03
              </span>
              <h2>3. حساب المستخدم والأمان (User Accounts & Security)</h2>
            </div>
            <p>
              للاستفادة الكاملة من مميزات المنصة وحفظ صفحاتك وتتبع مبيعاتك، يجب عليك إنشاء حساب تاجر عبر تقديم
              بيانات صحيحة وكاملة ودقيقة تشمل الاسم والبريد الإلكتروني ورقم الهاتف وبيانات المتجر.
            </p>
            <p>
              أنت المسؤول الأول والوحيد عن الحفاظ على سرية بيانات تسجيل دخولك وكلمة المرور الخاصة بك وعن جميع
              الأنشطة التي تجري عبر حسابك. نوفر إمكانية تفعيل خاصية التحقق بخطوتين (2FA) لتعزيز حماية حسابك من
              أي دخول غير مصرح به. في حال اشتباهك في أي اختراق، يجب إخطار فريق الدعم فوراً على{' '}
              <a href="mailto:codworth.me@gmail.com" className="text-emerald-400 font-bold underline">
                codworth.me@gmail.com
              </a>
              .
            </p>
          </section>

          {/* Section 4 */}
          <section id="billing" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                04
              </span>
              <h2>4. الاشتراكات والفوترة والدفع (Subscriptions, Billing & Payment)</h2>
            </div>
            <p>
              توفر المنصة نموذجاً مرناً يجمع بين باقة مجانية (Free Tier) بحد أقصى صفحتين، وباقات مدفوعة
              (Starter، Pro، Enterprise) بنظام الاشتراك الشهري أو السنوي:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2 text-xs">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>التحويل البنكي المحلي في المغرب (Bank Transfer)</span>
                </div>
                <p className="text-xs text-slate-400">
                  ندعم الدفع بالدرهم المغربي عبر الحسابات البنكية المعتمدة للمنصة (CIH Bank، التجاري وفا بنك
                  Attijariwafa، والبنك الشعبي Banque Populaire). يتم تفعيل الحساب بعد التحقق اليدوي من صورة
                  وصل التحويل المرفقة عبر لوحة المالك خلال مدة لا تتجاوز 12 ساعة.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2 text-xs">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>الدفع الإلكتروني وPayPal (Multi-Currency)</span>
                </div>
                <p className="text-xs text-slate-400">
                  بما أن PayPal لا يدعم عملة الدرهم المغربي (MAD) بشكل مباشر، تقوم المنصة آلياً بحساب سعر
                  الصرف الفعلي إلى الدولار الأمريكي (USD) بشفافية تامة وعرض السعر المعادل للزبون قبل تأكيد
                  الطلب لمنع أي التباس مالي.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              جميع الأسعار المعروضة للباقات نهائية وواضحة. لا نقوم بسحب أي مبالغ تلقائية دون إذن التاجر.
              سياسة الاسترجاع: يحق للمشترك طلب استرداد رسوم الاشتراك خلال 7 أيام من تاريخ الدفع في حال وجود
              خلل تقني جوهري مثبت لم نتمكن من حله.
            </p>
          </section>

          {/* Section 5 */}
          <section id="acceptable-use" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                05
              </span>
              <h2>5. الاستخدام المقبول والمحظور (Acceptable & Prohibited Use)</h2>
            </div>
            <p>
              يلتزم المستخدم باستخدام المنصة للأغراض التجارية المشروعة فقط ووفقاً للأنظمة والقوانين المعمول بها.
              يُحظر حظراً باتاً استخدام صفحات CodWorth لأي من الأغراض التالية:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-300">
              <li>بيع أو الترويج لمنتجات غير قانونية، مقلدة، منتهكة للعلامات التجارية، أو مجهولة المصدر والمخالفة لسلامة المستهلك.</li>
              <li>ممارسة الاحتيال، الخداع الإعلاني، بيع منتجات وهمية لا يتم إرسالها للمشترين، أو التصيد الاحتيالي (Phishing).</li>
              <li>نشر أو تضمين برمجيات خبيثة، فيروسات، أو أكواد تضر بأجهزة الزوار أو تتلاعب ببيانات التصفح.</li>
              <li>إرسال رسائل غير مرغوب فيها (SPAM) أو مضايقة الزوار باستخدام أرقام هواتفهم وبياناتهم دون إذن.</li>
              <li>محاولة اختراق سيرفرات المنصة، التحميل الزائد المتعمد، أو استخراج أكواد المنصة بطرق غير مصرح بها.</li>
            </ul>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                تحتفظ إدارة المنصة بالحق الكامل في إيقاف أو حظر أي صفحة هبوط أو حساب تاجر يخالف هذه الضوابط
                فوراً وبدون سابق إنذار أو تعويض.
              </span>
            </div>
          </section>

          {/* Section 6 */}
          <section id="ip" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                06
              </span>
              <h2>6. الملكية الفكرية وحقوق المحتوى (Intellectual Property)</h2>
            </div>
            <p>
              <strong>محتوى التاجر:</strong> يحتفظ التاجر بكامل ملكيته وحقوقه في الصور، النصوص، الشعارات،
              والبيانات التي يرفعها إلى صفحاته. يمنح التاجر منصة CodWorth ترخيصاً تقنياً محدوداً لاستضافة وعرض
              هذا المحتوى بهدف تشغيل الصفحات واستقبال الطلبيات لصالح التاجر.
            </p>
            <p>
              <strong>ملكية المنصة:</strong> جميع الأكواد البرمجية، محرك السحب والإفلات، القوالب، التصاميم،
              الشعارات، وقواعد البيانات الخاصة بمنصة CodWorth هي ملكية حصرية لشركة CodWorth ومحمية بموجب قوانين
              الملكية الفكرية في المملكة المغربية والمعاهدات الدولية.
            </p>
          </section>

          {/* Section 7 */}
          <section id="disclaimer" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                07
              </span>
              <h2>7. إخلاء المسؤولية وضمانات الخدمة (Disclaimers & Warranties)</h2>
            </div>
            <p>
              يتم توفير خدمات المنصة على أساس «كما هي» (As-Is) و«حسب المتاح» (As-Available). بينما نبذل قصارى
              جهدنا التقني لضمان جاهزية المنصة بنسبة تصل إلى 99.9% وسرعة فائقة لتحميل الصفحات، فإننا لا نضمن
              عدم حدوث انقطاعات طارئة ناتجة عن أعمال صيانة السيرفرات، أعطال مزودي البنية التحتية العالمية، أو
              انقطاعات الإنترنت الإقليمية.
            </p>
            <p>
              لا تقدم المنصة أي ضمانات صريحة أو ضمنية بشأن تحقيق التاجر لمبيعات أو أرباح مالية محددة، حيث تعتمد
              المبيعات ونسب التحويل على جودة المنتجات، العروض التسويقية، وفاعلية الحملات الإعلانية للتاجر.
            </p>
          </section>

          {/* Section 8 */}
          <section id="liability" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                08
              </span>
              <h2>8. تحديد المسؤولية (Limitation of Liability)</h2>
            </div>
            <p>
              إلى أقصى حد يسمح به القانون، لا تتحمل شركة CodWorth أو مسؤولوها أو موظفوها أي مسؤولية عن:
            </p>
            <ul className="list-disc list-inside space-y-1 pr-2 text-slate-300">
              <li>أي نزاعات تجارية تنشأ بين التاجر وعملائه بخصوص جودة المنتجات، مطابقتها، أو مواعيد تسليمها.</li>
              <li>أي تأخير أو تلف أو تعثر في تحصيل الأموال ناتج عن شركات التوصيل والشحن المتعاقد معها التاجر.</li>
              <li>أي خسائر غير مباشرة أو تبعية أو خسارة في الأرباح ناتجة عن استخدام أو عدم القدرة على استخدام الخدمة.</li>
            </ul>
            <p>
              في جميع الأحوال، تقتصر المسؤولية المالية الإجمالية للمنصة تجاه أي تاجر على إجمالي المبالغ المدفوعة
              منه للمنصة خلال الأشهر الثلاثة الأخيرة السابقة للنزاع.
            </p>
          </section>

          {/* Section 9 */}
          <section id="termination" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                09
              </span>
              <h2>9. إلغاء الحساب وإنهاء الخدمة (Cancellation & Termination)</h2>
            </div>
            <p>
              يحق للتاجر التوقف عن استخدام المنصة أو طلب إغلاق حسابه وحذف بياناته في أي وقت عبر إرسال طلب رسمي إلى
              الدعم الفني.
            </p>
            <p>
              يحق لـ CodWorth تعليق أو إنهاء حساب أي تاجر بشكل فوري في حالات خرق هذه الشروط، محاولات الاحتيال،
              أو عدم سداد الاشتراكات في مواعيدها المستحقة بعد إشعار مسبق.
            </p>
          </section>

          {/* Section 10 */}
          <section id="modifications" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                10
              </span>
              <h2>10. التعديلات على الشروط والخدمة (Modifications to Terms)</h2>
            </div>
            <p>
              نحتفظ بالحق في تحديث وتعديل هذه الشروط في أي وقت لمواكبة التطورات التقنية أو التنظيمية. سنقوم بنشر
              الشروط المعدلة على هذه الصفحة مع تحديث تاريخ السريان أعلاه. يعتبر استمرارك في استخدام المنصة بعد أي
              تعديل موافقة صريحة منك على الشروط الجديدة.
            </p>
          </section>

          {/* Section 11 */}
          <section id="law" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                11
              </span>
              <h2>11. القانون المطبق وحل النزاعات (Governing Law & Jurisdiction)</h2>
            </div>
            <p>
              تخضع هذه الاتفاقية وجميع النزاعات الناشئة عنها وتفسر حصراً وفقاً لقوانين <strong>المملكة المغربية</strong>.
            </p>
            <p>
              في حال نشوء أي خلاف أو نزاع يتعذر حله ودياً بين الطرفين، يكون الاختصاص القضائي المكاني حصرياً
              <strong> للمحاكم التجارية المختصة بمدينة الدار البيضاء بالمغرب</strong>.
            </p>
          </section>

          {/* Section 12 */}
          <section id="contact" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2.5 text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-mono font-black">
                12
              </span>
              <h2>12. معلومات التواصل القانوني (Contact Information)</h2>
            </div>
            <p>
              إذا كان لديك أي استفسار أو إشعار قانوني يتعلق بهذه الشروط والأحكام، يرجى التواصل معنا عبر القنوات
              الرسمية المعتمدة:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                <Mail className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-white mb-0.5">البريد الإلكتروني</div>
                  <a
                    href="mailto:codworth.me@gmail.com"
                    dir="ltr"
                    className="text-emerald-400 hover:underline block"
                  >
                    codworth.me@gmail.com
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                <Phone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-white mb-0.5">الهاتف والواتساب</div>
                  <a
                    href="https://wa.me/212661849201"
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="text-emerald-400 hover:underline block"
                  >
                    +212 661-849201
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-white mb-0.5">المقر الرئيسي</div>
                  <span className="text-slate-300">الدار البيضاء، المملكة المغربية 🇲🇦</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Professional Public Footer + Floating WhatsApp Button */}
      <PublicFooter
        onNavigate={(targetPath) => {
          if (targetPath === '/' && onBackToHome) return onBackToHome();
          if (targetPath === '/contact' && onNavigateToContact) return onNavigateToContact();
          if (targetPath === '/privacy' && onNavigateToPrivacy) return onNavigateToPrivacy();
          window.location.href = targetPath;
        }}
      />
    </div>
  );
};

export default TermsPage;
