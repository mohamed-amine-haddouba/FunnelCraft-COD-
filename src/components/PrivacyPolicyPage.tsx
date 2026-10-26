import React from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Printer,
  Mail,
  Building2,
  Phone,
  FileText,
  UserCheck,
  Eye,
  Database,
  Globe,
} from 'lucide-react';
import { PublicFooter } from './PublicFooter';

interface PrivacyPolicyPageProps {
  onBackToHome?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToContact?: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onBackToHome,
  onNavigateToTerms,
  onNavigateToContact,
}) => {
  const handlePrint = () => {
    window.print();
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
            <span className="text-[10px] font-bold text-emerald-400">• سياسة الخصوصية</span>
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
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Header Hero */}
        <div className="text-center space-y-3 max-w-3xl mx-auto border-b border-slate-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>متوافق مع القانون المغربي 09-08 وسياسات حماية البيانات العالمية 🇲🇦</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            سياسة الخصوصية وحماية المعطيات
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto">
            آخر تحديث: 26 أكتوبر 2026 • تلتزم CodWorth بحماية خصوصية وأمان بيانات التجار والمشترين.
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-10 space-y-8 shadow-2xl leading-relaxed text-sm text-slate-300 text-justify">
          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              1. مقدمة والتزام بالخصوصية (Privacy Commitment)
            </h2>
            <p>
              تعتبر حماية بياناتك الشخصية والتجارية أولوية قصوى لدى <strong>CodWorth</strong>. توضح هذه الوثيقة
              الشفافة أنواع البيانات التي نقوم بجمعها عند استخدامك لمنصتنا، كيفية معالجتها، الغرض منها،
              والتدابير التقنية والتنظيمية المتخذة لحمايتها وفقاً لمقتضيات القانون المغربي رقم 09-08 المتعلق بحماية
              الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              2. البيانات التي نقوم بجمعها (Data We Collect)
            </h2>
            <p>نقوم بجمع البيانات الضرورية فقط لتمكينك من إنشاء وإدارة صفحات الهبوط ومعالجة الطلبات:</p>
            <ul className="list-disc list-inside space-y-1.5 pr-2">
              <li>
                <strong>بيانات حساب التاجر:</strong> الاسم الكامل، عنوان البريد الإلكتروني، رقم الهاتف، واسم
                المتجر، وكلمة المرور المشفرة (Hashed).
              </li>
              <li>
                <strong>بيانات صفحات الهبوط:</strong> نصوص المنتجات، الصور، الأسعار، العروض، وإعدادات التصميم.
              </li>
              <li>
                <strong>بيانات طلبات الشراء (COD Orders):</strong> اسم العميل النهائي، رقم هاتفه، مدينته، وعنوان
                التوصيل المعبأ عبر استمارة الدفع عند الاستلام، وذلك لصالح التاجر المشترك فقط.
              </li>
              <li>
                <strong>البيانات التقنية:</strong> عنوان بروتوكول الإنترنت (IP)، نوع المتصفح، ومعلومات الجلسة
                المستخدمة لمنع الهجمات الإلكترونية وضمان أمان الحسابات.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              3. سياسة Google OAuth واستخدام بيانات المستخدم (Google API Policy Compliance)
            </h2>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="font-bold text-white flex items-center gap-2 text-xs">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>الامتثال لسياسة بيانات مستخدم خدمات Google API (Limited Use Policy)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                في حال قيامك بتسجيل الدخول باستخدام زر Google Sign-In، فإننا نصل حصرياً إلى بيانات ملفك الشخصي
                الأساسية (الاسم الكامل، عنوان البريد الإلكتروني، ومعرف الحساب الفريد) لغرض المصادقة وتأمين الحساب
                فقط.
              </p>
              <p className="text-xs text-emerald-400 font-bold">
                تلتزم CodWorth بعدم مشاركة أو بيع أي بيانات يتم الحصول عليها عبر Google APIs لأي جهات إعلانية أو
                أطراف خارجية تحت أي ظرف، وفقاً لمتطلبات الاستخدام المحدود (Google Limited Use Requirements).
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              4. الغرض من معالجة البيانات (Purpose of Processing)
            </h2>
            <p>نستخدم المعطيات المجمعة للأغراض التالية فقط:</p>
            <ul className="list-disc list-inside space-y-1.5 pr-2">
              <li>تشغيل وتوفير خدمات منصة بناء صفحات الهبوط واستضافة المواقع.</li>
              <li>تمكين التجار من إدارة واستخراج قائمة طلبات زبنائهم والتواصل معهم لتأكيد وتوصيل الشحنات.</li>
              <li>إدارة الاشتراكات والفوترة والتحقق من وصولات التحويل البنكي المغربي.</li>
              <li>تقديم الدعم الفني وحل المشكلات التقنية للمستخدمين.</li>
              <li>تحسين أداء وسرعة المنصة ومكافحة الأنشطة الاحتيالية والاختراقات.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              5. تدابير الحماية والأمان (Data Security & Encryption)
            </h2>
            <p>
              نطبق أعلى المعايير الأمنية لحماية المعطيات من التلف، الفقدان، أو الوصول غير المصرح به:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pr-2">
              <li>تشفير جميع الاتصالات عبر بروتوكول HTTPS / TLS 1.3 المتقدم.</li>
              <li>تشفير كلمات المرور باستخدام خوارزميات غير قابلة للعكس (Bcrypt / Salted Hashes).</li>
              <li>إمكانية تفعيل خاصية المصادقة الثنائية (2FA) لحماية الحسابات.</li>
              <li>عزل كامل لقواعد البيانات وصلاحيات وصول صارمة مقتصرة على موظفي الدعم المصرح لهم.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              6. حقوق المستخدم وحذف البيانات (User Rights & Deletion Requests)
            </h2>
            <p>
              بموجب القانون المغربي 09-08 واللوائح العالمية لحماية البيانات، يحق لك في أي وقت:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pr-2">
              <li>الاطلاع على كافة البيانات الشخصية المخزنة بحسابك.</li>
              <li>تعديل أو تصحيح أي بيانات غير دقيقة.</li>
              <li>
                <strong>طلب حذف حسابك وبياناتك بالكامل:</strong> يمكنك مراسلة مسؤول حماية البيانات مباشرة عبر{' '}
                <a href="mailto:codworth.me@gmail.com" className="text-emerald-400 font-bold underline">
                  codworth.me@gmail.com
                </a>{' '}
                وسيتم محو كافة بيانات صفحاتك وطلباتك نهائياً من خوادمنا خلال 48 ساعة من تأكيد الطلب.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-white font-extrabold text-lg sm:text-xl border-b border-slate-800/60 pb-2">
              7. معلومات الاتصال بمسؤول الخصوصية (Contact DPO)
            </h2>
            <p>
              لأي استفسار أو طلب يتعلق بسياسة الخصوصية وحماية المعطيات، يرجى التواصل مع فريقنا القانوني:
            </p>
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-white">مسؤول حماية البيانات (Data Protection Officer)</div>
                <div className="text-slate-400">CodWorth SARL • الدار البيضاء، المملكة المغربية 🇲🇦</div>
              </div>
              <a
                href="mailto:codworth.me@gmail.com"
                dir="ltr"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-bold hover:text-white transition"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>codworth.me@gmail.com</span>
              </a>
            </div>
          </section>
        </div>
      </main>

      {/* Professional Public Footer + Floating WhatsApp Button */}
      <PublicFooter
        onNavigate={(targetPath) => {
          if (targetPath === '/' && onBackToHome) return onBackToHome();
          if (targetPath === '/terms' && onNavigateToTerms) return onNavigateToTerms();
          if (targetPath === '/contact' && onNavigateToContact) return onNavigateToContact();
          window.location.href = targetPath;
        }}
      />
    </div>
  );
};

export default PrivacyPolicyPage;
