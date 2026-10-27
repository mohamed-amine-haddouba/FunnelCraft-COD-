import nodemailer from 'nodemailer';

export function createMailerTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.SMTP_USER,
      clientId: process.env.GOOGLE_MAILER_CLIENT_ID,
      clientSecret: process.env.GOOGLE_MAILER_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
  });
}

function checkMailerConfig(): boolean {
  if (
    !process.env.SMTP_USER ||
    !process.env.GOOGLE_MAILER_CLIENT_ID ||
    !process.env.GOOGLE_MAILER_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    console.error('[Mailer Error] Mailer credentials missing in .env');
    return false;
  }
  return true;
}

export async function sendOtpEmail(
  to: string,
  otpCode: string,
  userName: string
): Promise<boolean> {
  if (!checkMailerConfig()) return false;

  const transporter = createMailerTransport();

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>رمز التحقق الأمني - CodWorth</title>
</head>
<body style="font-family: sans-serif; direction: rtl; text-align: right; background-color: #0b1120; color: #f8fafc; padding: 20px;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 30px; border: 1px solid #1e293b;">
    <h2 style="color: #10b981;">⚡ CodWorth</h2>
    <p>مرحباً ${userName || 'تاجرنا العزيز'}،</p>
    <p>رمز التحقق الخاص بك هو:</p>
    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #ffffff; padding: 20px; background: #020617; border-radius: 12px; border: 1px dashed #059669;">
      ${otpCode}
    </div>
    <p style="margin-top: 20px; color: #94a3b8; font-size: 12px;">هذا الرمز صالح لمدة 5 دقائق فقط.</p>
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
      subject: `رمز التحقق الخاص بك: ${otpCode} - CodWorth`,
      text: `مرحباً ${userName || 'تاجرنا'}، رمز التحقق الخاص بك هو: ${otpCode}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send OTP email to', to, error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  if (!checkMailerConfig()) return false;

  const transporter = createMailerTransport();

  const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إعادة تعيين كلمة المرور - CodWorth</title>
</head>
<body style="font-family: sans-serif; direction: rtl; text-align: right; background-color: #0b1120; color: #f8fafc; padding: 20px;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 30px; border: 1px solid #1e293b;">
    <h2 style="color: #10b981;">⚡ CodWorth</h2>
    <p>مرحباً ${userName || 'تاجرنا العزيز'}،</p>
    <p>لإعادة تعيين كلمة المرور، اضغط على الرابط أدناه:</p>
    <a href="${resetUrl}" style="display: block; text-align: center; background: #10b981; color: #000; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">إعادة تعيين كلمة المرور</a>
    <p style="margin-top: 20px; color: #94a3b8; font-size: 12px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
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
      subject: 'إعادة تعيين كلمة المرور - CodWorth',
      text: `مرحباً ${userName || 'تاجرنا'}، لإعادة تعيين كلمة المرور: ${resetUrl}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send password reset email to', to, error);
    return false;
  }
}

export async function sendAdminNotificationEmail(
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'naadianajah2020@gmail.com';

  if (!checkMailerConfig()) return false;

  const transporter = createMailerTransport();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      envelope: {
        from: process.env.SMTP_USER,
        to,
      },
      to,
      subject: `[CodWorth Admin] ${subject}`,
      text: `${subject} - ${htmlContent.replace(/<[^>]+>/g, ' ')}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('[Mailer Error] Failed to send admin notification email:', error);
    return false;
  }
}
