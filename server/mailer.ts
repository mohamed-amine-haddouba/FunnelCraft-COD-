import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_USER || process.env.SMTP_FROM || 'CodWorth <no-reply@codworth.com>';

  return { host, port, secure, user, pass, from };
}

export function createMailerTransport() {
  const config = getSmtpConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
  });
}

/**
 * Sends a high-security 6-digit 2FA verification email to the user.
 * Template is rendered in RTL Arabic with CodWorth branding.
 */
export async function sendOtpEmail(
  to: string,
  otpCode: string,
  userName: string
): Promise<boolean> {
  // If SMTP credentials are missing, fail gracefully and log clear warning
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error(
      '[Mailer Error] SMTP credentials missing in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).'
    );
    return false;
  }

  const transporter = createMailerTransport();

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز التحقق الأمني - CodWorth</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; direction: rtl; text-align: right; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" cellspacing="0" cellpadding="0" border="0">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 30px; text-align: center;">
              <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                ⚡ CodWorth
              </div>
              <div style="font-size: 13px; color: #e6fffa; margin-top: 6px; font-weight: 500;">
                المنصة الأولى لصفحات الهبوط والدفع عند الاستلام بالمغرب 🇲🇦
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.4;">
                مرحباً ${userName || 'تاجرنا العزيز'}،
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                لحماية حسابك وبيانات متجرك، تلقينا طلباً لتسجيل الدخول إلى حسابك على منصة CodWorth. يرجى استخدام رمز التحقق التالي لإتمام العملية:
              </p>

              <!-- OTP Card -->
              <div style="background-color: #020617; border: 2px dashed #059669; border-radius: 18px; padding: 24px; text-align: center; margin: 28px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #10b981; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
                  رمز التحقق الخاص بك (2FA OTP)
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #ffffff; padding: 6px 0; direction: ltr;">
                  ${otpCode}
                </div>
                <div style="font-size: 12px; color: #cbd5e1; margin-top: 8px;">
                  ⏳ <strong>هذا الرمز صالح لمدة 5 دقائق فقط</strong>
                </div>
              </div>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 14px; padding: 14px 16px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 13px; color: #fbbf24; line-height: 1.5;">
                    ⚠️ <strong>تنبيه أمني هام:</strong> لا تشارك هذا الرمز مع أي شخص، حتى لو ادعى أنه من فريق دعم CodWorth.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                إذا لم تكن أنت من حاول تسجيل الدخول، يُرجى تجاهل هذه الرسالة فوراً وتغيير كلمة مرور حسابك.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #090d16; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #475569;">
              © ${new Date().getFullYear()} CodWorth Inc. جميع الحقوق محفوظة • المملكة المغربية
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      to,
      subject: `رمز التحقق الخاص بك: ${otpCode} - CodWorth`,
      text: `مرحباً ${userName || 'تاجرنا'}، رمز التحقق الخاص بك هو: ${otpCode}. هذا الرمز صالح لمدة 5 دقائق فقط. لا تشاركه مع أي شخص.`,
      html: htmlContent,
    });

    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send OTP email to', to, error);
    return false;
  }
}

/**
 * Sends a password reset link email to the user.
 * Template is rendered in RTL Arabic dark theme with CodWorth branding.
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error(
      '[Mailer Error] SMTP credentials missing in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).'
    );
    return false;
  }

  const transporter = createMailerTransport();

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إعادة تعيين كلمة المرور - CodWorth</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; direction: rtl; text-align: right; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" cellspacing="0" cellpadding="0" border="0">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 30px; text-align: center;">
              <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                ⚡ CodWorth
              </div>
              <div style="font-size: 13px; color: #e6fffa; margin-top: 6px; font-weight: 500;">
                المنصة الأولى لصفحات الهبوط والدفع عند الاستلام بالمغرب 🇲🇦
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.4;">
                مرحباً ${userName || 'تاجرنا العزيز'}،
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على منصة CodWorth. يمكنك تعيين كلمة مرور جديدة بالضغط على الزر أدناه:
              </p>

              <!-- Action Button Card -->
              <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 18px; padding: 28px 24px; text-align: center; margin: 28px 0;">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #020617; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
                  إعادة تعيين كلمة المرور
                </a>
                <div style="font-size: 12px; color: #cbd5e1; margin-top: 16px;">
                  ⏳ <strong>هذا الرابط صالح لمدة ساعة واحدة (1 ساعة) فقط</strong>
                </div>
              </div>

              <!-- Fallback Link -->
              <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                إذا لم يعمل الزر أعلاه، يمكنك نسخ الرابط التالي ولصقه في متصفحك:<br/>
                <a href="${resetUrl}" style="color: #10b981; word-break: break-all; direction: ltr; display: inline-block; margin-top: 6px;">${resetUrl}</a>
              </p>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px;">
                <tr>
                  <td style="font-size: 13px; color: #fbbf24; line-height: 1.5;">
                    ⚠️ <strong>تنبيه أمني:</strong> إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة وستبقى كلمة مرورك الحالية آمنة دون أي تغيير.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #090d16; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #475569;">
              © ${new Date().getFullYear()} CodWorth Inc. جميع الحقوق محفوظة • المملكة المغربية
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      to,
      subject: 'إعادة تعيين كلمة المرور - CodWorth',
      text: `مرحباً ${userName || 'تاجرنا'}، لإعادة تعيين كلمة المرور الخاصة بك، يرجى فتح الرابط التالي (صالح لمدة ساعة واحدة): ${resetUrl}`,
      html: htmlContent,
    });

    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send password reset email to', to, error);
    return false;
  }
}

/**
 * Sends a real-time platform event notification email to the Super Admin.
 * Template is rendered in RTL Arabic dark theme with CodWorth branding.
 */
export async function sendAdminNotificationEmail(
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const to =
    process.env.OWNER_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.SMTP_USER ||
    '';

  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      `[Admin Mailer] SMTP credentials or OWNER_EMAIL not configured. Skipping admin notification: "${subject}"`
    );
    return false;
  }

  const transporter = createMailerTransport();
  const isFullHtmlDoc =
    htmlContent.trim().toLowerCase().startsWith('<!doctype html') ||
    htmlContent.trim().toLowerCase().startsWith('<html');

  const wrappedHtml = isFullHtmlDoc
    ? htmlContent
    : `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject} - CodWorth Admin</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; direction: rtl; text-align: right; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 36px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);" cellspacing="0" cellpadding="0" border="0">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 26px 30px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                ⚡ CodWorth • إشعار الإدارة الفوري
              </div>
              <div style="font-size: 12px; color: #e6fffa; margin-top: 6px; font-weight: 600;">
                ${subject}
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px; font-size: 14px; line-height: 1.8; color: #e2e8f0;">
              ${htmlContent}
              <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #1e293b; text-align: center;">
                <a href="https://codworth.me" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #020617; font-size: 13px; font-weight: 800; text-decoration: none; padding: 12px 26px; border-radius: 12px;">
                  فتح لوحة تحكم الإدارة (Admin Panel) ➔
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #090d16; padding: 18px 28px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
              ⏰ توقيت الحدث: ${new Date().toLocaleString('ar-MA', { timeZone: 'Africa/Casablanca' })} • © ${new Date().getFullYear()} CodWorth HQ
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      to,
      subject: `[CodWorth Admin] ${subject}`,
      text: `${subject} - ${htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`,
      html: wrappedHtml,
    });
    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send admin notification email:', error);
    return false;
  }
}

/**
 * Sends a single-use, 20-minute Sandbox Owner Password Recovery email.
 * Never logs or exposes the resetUrl in server output.
 */
export async function sendSandboxResetEmail(
  to: string,
  resetUrl: string,
  ip: string
): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return false;
  }

  const transporter = createMailerTransport();
  const htmlContent = `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>FunnelCraft-COD Sandbox Recovery</title>
</head>
<body style="margin:0;padding:32px;background:#090d16;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 12px 0;color:#10b981;font-size:18px;">FunnelCraft-COD Owner Sandbox Recovery</h2>
    <p style="font-size:14px;line-height:1.6;color:#cbd5e1;">
      A password reset was requested for the owner Sandbox account from IP <code>${ip}</code>.
      This single-use link expires in <strong>20 minutes</strong>.
    </p>
    <p style="margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#020617;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">
        Reset Owner Password
      </a>
    </p>
    <p style="font-size:12px;color:#64748b;margin:0;">
      If you did not initiate this request, ignore this email. All active sessions remain protected.
    </p>
  </div>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      to,
      subject: '[Security] FunnelCraft-COD Owner Sandbox Password Reset (20m TTL)',
      text: `A password reset was requested for the FunnelCraft-COD Owner Sandbox from IP ${ip}. Open this single-use link within 20 minutes: ${resetUrl}`,
      html: htmlContent,
    });
    return true;
  } catch {
    return false;
  }
}


