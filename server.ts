import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { LandingPageData } from './src/types/landingPage';
import { generateStandaloneHtml } from './src/utils/htmlExporter';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  createSession,
  getUserByToken,
  deleteSession,
  toSafeProfile,
  incrementUserUsage,
  updateUserSubscription,
  findUserById,
  updateUser2FA,
  updateUserProfile,
  findOrCreateGoogleUser,
  createManualPaymentRequest,
  getManualPaymentsByUser,
  getAllManualPayments,
  approveManualPayment,
  rejectManualPayment,
  saveUserPage,
  getUserPages,
  getUserPageById,
  deleteUserPage,
  duplicateUserPage,
  publishPage,
  unpublishPage,
  getPublishedPageBySlug,
  getPublishedPageByDomain,
  incrementPageViews,
  incrementPageOrders,
  recordPageOrder,
  isSlugAvailable,
  getPageOrders,
  getAllOrders,
  recordCodOrder,
  updateOrderStatus,
  getAllUsers,
  updateUserPlan,
  updateUserAccountStatus,
  deleteUser,
  createAdminUser,
  getOrdersForUser,
  getAllPagesAdmin,
  getGlobalPlatformStats,
  setResetPasswordToken,
  clearResetPasswordToken,
  updateUserPassword,
  getBankAccounts,
  saveBankAccounts,
  upsertBankAccount,
  deleteBankAccount,
  ensureDataFiles,
} from './server/db';
import {
  DEFAULT_EXCHANGE_RATES,
  normalizeExchangeRates,
  calculatePayPalUsdSettlement,
} from './src/utils/currencyAndBanks';
import crypto from 'crypto';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { scrapeProductFromUrl, validateProductUrl, ScrapedProduct } from './server/urlScraper';
import { scrapeProductData } from './server/scraper';
import { sendOtpEmail, sendPasswordResetEmail, sendAdminNotificationEmail } from './server/mailer';
import { verifyGoogleCredential, isGoogleAuthConfigured } from './server/googleAuth';
import { verifyCaptchaToken, verifyTurnstileToken, extractClientIp } from './server/captcha';
import { createSandboxRouter, sandboxPageServerGuard } from './server/sandbox';
import {
  Client as PayPalClient,
  Environment as PayPalEnvironment,
  OrdersController,
  CheckoutPaymentIntent,
  ApiError as PayPalApiError,
} from '@paypal/paypal-server-sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize PayPal Server SDK Client & OrdersController
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const paypalEnvironment =
  process.env.PAYPAL_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production'
    ? PayPalEnvironment.Production
    : PayPalEnvironment.Sandbox;

const paypalClient = new PayPalClient({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: paypalEnvironment,
});

const paypalOrdersController = new OrdersController(paypalClient);

// Initialize Gemini SDK with recommended user-agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface AuthRequest extends Request {
  user?: ReturnType<typeof toSafeProfile>;
  token?: string;
}

// Authentication Middleware
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.substring(7);
  const user = getUserByToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session' });
  }

  req.user = toSafeProfile(user);
  req.token = token;
  next();
}

// Optional Auth Middleware (attaches user if present, but doesn't block guests)
function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = getUserByToken(token);
    if (user) {
      req.user = toSafeProfile(user);
      req.token = token;
    }
  }
  next();
}

// Input Sanitization Helper (prevents stored XSS in customer/merchant text fields)
function sanitizeInput(val: unknown, maxLength: number = 500): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

/* ---------------- RATE LIMITERS (BRUTE-FORCE PROTECTION) ---------------- */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error: 'تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول (10 محاولات). يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً.',
  },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 OTP verification attempts per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error: 'تم تجاوز الحد الأقصى لمحاولات التحقق من الرمز (5 محاولات). يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً.',
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 password reset requests per 1 hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error: 'تم تجاوز الحد الأقصى لطلبات استعادة كلمة المرور (3 طلبات في الساعة). يرجى المحاولة لاحقاً.',
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS Configuration (supports codworth.me, localhost, and preview URLs)
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  // Security Headers Middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Owner-Only Sandbox API & Server-Side Route Guard
  app.use('/api/sandbox', createSandboxRouter());
  app.get('/sandbox', sandboxPageServerGuard);

  /* ---------------- AUTHENTICATION & LIVE 2FA OTP ENGINE ---------------- */

  interface ActiveOtp {
    code: string;
    userId: string;
    email: string;
    phone: string;
    channel: 'whatsapp' | 'email';
    expiresAt: number;
    attempts: number;
    lastSentAt: number;
    deviceInfo: {
      browser: string;
      os: string;
      ip: string;
    };
  }

  // Active OTP Memory Store (TTL: 5 minutes)
  const activeOtps = new Map<string, ActiveOtp>();

  // Masking helpers
  const maskPhone = (phone: string = '+212 722-256897') => {
    const clean = phone.trim();
    if (clean.length < 8) return '+212 6•• ••0000';
    return clean.slice(0, 7) + '•• ••' + clean.slice(-4);
  };

  const maskEmail = (email: string = 'user@example.com') => {
    const [userPart, domain] = email.split('@');
    if (!domain) return email;
    const visible = userPart.slice(0, 2);
    return `${visible}•••@${domain}`;
  };

  const extractDeviceInfo = (req: Request) => {
    const userAgent = req.headers['user-agent'] || '';
    let browser = 'Chrome';
    if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    let os = 'Windows';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('Linux')) os = 'Linux';

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '196.200.180.14 (Casablanca, MA)';
    return { browser, os, ip: ip.includes('::') ? '196.200.180.14 (Casablanca, MA)' : ip };
  };

  // 1. Sign Up / Merchant Registration
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const {
      email,
      password,
      full_name,
      store_name,
      phone,
      two_factor_enabled,
      recaptchaToken,
      turnstileToken,
      captchaToken,
    } = req.body;

    const isCaptchaValid = await verifyCaptchaToken({
      recaptchaToken: recaptchaToken || req.body['g-recaptcha-response'],
      turnstileToken: turnstileToken || req.body['cf-turnstile-response'],
      captchaToken,
      remoteIp: extractClientIp(req),
      expectedAction: 'register',
    });
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        error: 'فشل التحقق الأمني (CAPTCHA). يرجى المحاولة مرة أخرى.',
      });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    try {
      // Registration strictly assigns role: 'merchant' through createUser (auto-activated)
      const newUser = createUser(
        email,
        password,
        full_name || 'Merchant',
        store_name,
        phone,
        two_factor_enabled ?? false
      );

      // Notify Admin of new merchant registration (non-blocking)
      void sendAdminNotificationEmail(
        `🎉 تسجيل تاجر جديد: ${newUser.full_name}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">انضم تاجر جديد إلى منصة CodWorth!</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>👤 الاسم الكامل:</strong> ${newUser.full_name}</p>
          <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${newUser.email}</span></p>
          <p style="margin: 6px 0;"><strong>🏪 اسم المتجر:</strong> ${newUser.store_name || 'متجر COD الجديد'}</p>
          <p style="margin: 6px 0;"><strong>📱 رقم الهاتف:</strong> <span dir="ltr">${newUser.phone || 'غير محدد'}</span></p>
          <p style="margin: 6px 0;"><strong>✅ حالة الحساب:</strong> مفعل تلقائياً (Active)</p>
        </div>
        `
      ).catch((err) => console.error('Admin notification error (register):', err));

      // If merchant enabled 2FA, trigger verification step via email
      if (newUser.two_factor_enabled) {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const deviceInfo = extractDeviceInfo(req);

        activeOtps.set(newUser.id, {
          code: otpCode,
          userId: newUser.id,
          email: newUser.email,
          phone: newUser.phone || phone || '+212 722-256897',
          channel: 'email',
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0,
          lastSentAt: Date.now(),
          deviceInfo,
        });

        // Deliver OTP exclusively to merchant email address
        const emailSent = await sendOtpEmail(newUser.email, otpCode, newUser.full_name);
        if (!emailSent) {
          activeOtps.delete(newUser.id);
          return res.status(500).json({
            success: false,
            error: 'تعذر إرسال رمز التحقق، يرجى المحاولة لاحقاً',
          });
        }

        return res.json({
          success: true,
          requires2FA: true,
          userId: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          maskedPhone: maskPhone(newUser.phone),
          maskedEmail: maskEmail(newUser.email),
          channel: 'email',
          device: deviceInfo,
          message: `تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني: ${maskEmail(newUser.email)}`,
        });
      }

      const token = createSession(newUser.id);
      return res.json({
        success: true,
        user: toSafeProfile(newUser),
        token,
        message: 'Account created! Welcome to CodWorth.',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message || 'Registration failed.' });
    }
  });

  // 2. Merchant & Super Admin Login (Protected by loginLimiter)
  app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
    const { email, password, simulate2fa, recaptchaToken, turnstileToken, captchaToken } = req.body;

    const isCaptchaValid = await verifyCaptchaToken({
      recaptchaToken: recaptchaToken || req.body['g-recaptcha-response'],
      turnstileToken: turnstileToken || req.body['cf-turnstile-response'],
      captchaToken,
      remoteIp: extractClientIp(req),
      expectedAction: 'login',
    });
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        error: 'فشل التحقق الأمني (CAPTCHA). يرجى المحاولة مرة أخرى.',
      });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(user, password)) {
      return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    // Standard 2FA workflow for all users (including Super Admin)
    const requires2FA = user.two_factor_enabled || simulate2fa;

    if (requires2FA) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const deviceInfo = extractDeviceInfo(req);
      const chosenChannel = user.phone && !user.email ? 'whatsapp' : 'email';

      activeOtps.set(user.id, {
        code: otpCode,
        userId: user.id,
        email: user.email,
        phone: user.phone || '+212 722-256897',
        channel: chosenChannel,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0,
        lastSentAt: Date.now(),
        deviceInfo,
      });

      if (chosenChannel === 'email') {
        const emailSent = await sendOtpEmail(user.email, otpCode, user.full_name);
        if (!emailSent) {
          activeOtps.delete(user.id);
          return res.status(500).json({
            success: false,
            error: 'تعذر إرسال رمز التحقق، يرجى المحاولة لاحقاً',
          });
        }
      }

      return res.json({
        success: true,
        requires2FA: true,
        userId: user.id,
        email: user.email,
        phone: user.phone || '+212 722-256897',
        maskedPhone: maskPhone(user.phone),
        maskedEmail: maskEmail(user.email),
        channel: chosenChannel,
        device: deviceInfo,
        message:
          chosenChannel === 'whatsapp'
            ? `تم إرسال رمز التحقق الأمني (OTP) عبر الواتساب: ${maskPhone(user.phone)}`
            : `تم إرسال رمز التحقق الأمني (OTP) إلى بريدك الإلكتروني: ${maskEmail(user.email)}`,
      });
    }

    const token = createSession(user.id);
    return res.json({
      success: true,
      user: toSafeProfile(user),
      token,
      message: 'Successfully logged in.',
    });
  });

  // 3. Send / Resend OTP Code (Merchant choice: Email or WhatsApp, with 45s cooldown)
  app.post('/api/auth/send-otp', async (req: Request, res: Response) => {
    const { userId, email, channel } = req.body;
    const targetUserId = userId || (email ? findUserByEmail(email)?.id : undefined);

    if (!targetUserId && !email) {
      return res.status(400).json({ success: false, error: 'User identifier is required.' });
    }

    const user = targetUserId ? findUserById(targetUserId) : findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const storeKey = user.id;
    const existing = activeOtps.get(storeKey);

    // Rate limiting: 45 seconds cooldown between resends
    if (existing && Date.now() - existing.lastSentAt < 45000) {
      const waitSec = Math.ceil((45000 - (Date.now() - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `يرجى الانتظار ${waitSec} ثانية قبل إعادة طلب رمز تحقق جديد (Rate Limit).`,
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const deviceInfo = extractDeviceInfo(req);
    const chosenChannel = channel === 'whatsapp' ? 'whatsapp' : 'email';
    const targetPhone = user.phone || '+212 722-256897';
    const targetEmail = user.email || 'merchant@example.com';

    activeOtps.set(storeKey, {
      code: otpCode,
      userId: user.id,
      email: targetEmail,
      phone: targetPhone,
      channel: chosenChannel,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      lastSentAt: Date.now(),
      deviceInfo,
    });

    if (chosenChannel === 'email') {
      const emailSent = await sendOtpEmail(targetEmail, otpCode, user.full_name);
      if (!emailSent) {
        activeOtps.delete(storeKey);
        return res.status(500).json({
          success: false,
          error: 'تعذر إرسال رمز التحقق، يرجى المحاولة لاحقاً',
        });
      }
    }

    return res.json({
      success: true,
      channel: chosenChannel,
      target: chosenChannel === 'whatsapp' ? maskPhone(targetPhone) : maskEmail(targetEmail),
      expiresIn: 300,
      message:
        chosenChannel === 'whatsapp'
          ? `تم إرسال رمز الأمان (OTP) بنجاح عبر الواتساب: ${maskPhone(targetPhone)}`
          : `تم إرسال رمز الأمان (OTP) بنجاح إلى البريد الإلكتروني: ${maskEmail(targetEmail)}`,
    });
  });

  // 4. Verify 6-digit OTP Code (Strict verification, max 5 attempts, protected by verifyOtpLimiter)
  app.post('/api/auth/verify-otp', verifyOtpLimiter, (req: Request, res: Response) => {
    const { userId, email, code } = req.body;
    if (!code || code.toString().trim().length !== 6) {
      return res.status(400).json({ success: false, error: 'الرمز يجب أن يتكون من 6 أرقام.' });
    }

    const cleanCode = code.toString().trim();
    const storeKey = userId || (email ? findUserByEmail(email)?.id : undefined);
    const record = storeKey ? activeOtps.get(storeKey) : undefined;

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'انتهت صلاحية رمز التحقق أو لم يتم طلبه بعد. يرجى طلب رمز جديد.',
      });
    }

    if (Date.now() > record.expiresAt) {
      if (storeKey) activeOtps.delete(storeKey);
      return res.status(400).json({ success: false, error: 'انتهت صلاحية الرمز (صالح لمدة 5 دقائق).' });
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      if (storeKey) activeOtps.delete(storeKey);
      return res.status(429).json({
        success: false,
        error: 'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم إبطال الرمز لحماية حسابك، يرجى طلب رمز جديد.',
      });
    }

    // Strict code match - no on-screen bypass shortcuts
    if (record.code !== cleanCode) {
      const remaining = Math.max(0, 5 - record.attempts);
      return res.status(400).json({
        success: false,
        error: `رمز التحقق غير صحيح. تبقى لك ${remaining} ${remaining === 1 ? 'محاولة' : 'محاولات'}.`,
      });
    }

    // OTP Verified! Clear active OTP and generate session
    if (storeKey) activeOtps.delete(storeKey);

    const user = findUserById(record.userId) || findUserByEmail(record.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const token = createSession(user.id);
    return res.json({
      success: true,
      token,
      user: toSafeProfile(user),
      message: 'تم التحقق بنجاح!',
    });
  });

  // 5. Google Sign-In & Merchant Session Creation (Verified JWT via google-auth-library)
  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const { credential } = req.body;

    if (!isGoogleAuthConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'تسجيل الدخول عبر Google غير مفعل حالياً (GOOGLE_CLIENT_ID غير مضبوط).',
      });
    }

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'رمز التحقق من Google (credential) مطلوب.',
      });
    }

    try {
      const verifiedUser = await verifyGoogleCredential(credential);
      const existingBeforeGoogle = findUserByEmail(verifiedUser.email);
      const user = findOrCreateGoogleUser({
        email: verifiedUser.email,
        name: verifiedUser.fullName,
        picture: verifiedUser.picture,
      });

      if (!existingBeforeGoogle) {
        void sendAdminNotificationEmail(
          `🌐 تسجيل تاجر جديد عبر Google: ${user.full_name}`,
          `
          <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">انضم تاجر جديد عبر حساب Google!</h3>
          <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
            <p style="margin: 6px 0;"><strong>👤 الاسم الكامل:</strong> ${user.full_name}</p>
            <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${user.email}</span></p>
            <p style="margin: 6px 0;"><strong>🏪 اسم المتجر:</strong> ${user.store_name || 'Merchant COD Store'}</p>
            <p style="margin: 6px 0;"><strong>✅ حالة الحساب:</strong> مفعل تلقائياً (Active)</p>
          </div>
          `
        ).catch((err) => console.error('Admin notification error (google register):', err));
      }

      if (user.two_factor_enabled) {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const deviceInfo = extractDeviceInfo(req);
        const chosenChannel = user.phone && !user.email ? 'whatsapp' : 'email';

        activeOtps.set(user.id, {
          code: otpCode,
          userId: user.id,
          email: user.email,
          phone: user.phone || '+212 722-256897',
          channel: chosenChannel,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0,
          lastSentAt: Date.now(),
          deviceInfo,
        });

        if (chosenChannel === 'email') {
          const emailSent = await sendOtpEmail(user.email, otpCode, user.full_name);
          if (!emailSent) {
            activeOtps.delete(user.id);
            return res.status(500).json({
              success: false,
              error: 'تعذر إرسال رمز التحقق، يرجى المحاولة لاحقاً',
            });
          }
        }

        return res.json({
          success: true,
          requires2FA: true,
          userId: user.id,
          email: user.email,
          phone: user.phone || '+212 722-256897',
          maskedPhone: maskPhone(user.phone),
          maskedEmail: maskEmail(user.email),
          channel: chosenChannel,
          device: deviceInfo,
          message:
            chosenChannel === 'whatsapp'
              ? `تم إرسال رمز التحقق الأمني (OTP) عبر الواتساب: ${maskPhone(user.phone)}`
              : `تم إرسال رمز التحقق الأمني (OTP) إلى بريدك الإلكتروني: ${maskEmail(user.email)}`,
        });
      }

      const token = createSession(user.id);
      return res.json({
        success: true,
        user: toSafeProfile(user),
        token,
        message: 'Successfully authenticated with Google!',
      });
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: err.message || 'فشل التحقق من حساب Google.',
      });
    }
  });

  // 6. Toggle 2FA Security (Strictly scoped to authenticated user from token — prevents IDOR)
  app.post('/api/auth/2fa/toggle', authMiddleware, (req: AuthRequest, res: Response) => {
    const { enabled } = req.body;
    const targetUserId = req.user!.id;

    try {
      const updated = updateUser2FA(targetUserId, Boolean(enabled));
      return res.json({
        success: true,
        user: updated,
        twoFactorEnabled: updated.two_factor_enabled,
        message: enabled ? '2FA activated successfully!' : '2FA deactivated.',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7. Update Merchant Profile (Supports both PUT and PATCH — strictly scoped to authenticated user)
  const handleUpdateMerchantProfile = (req: AuthRequest, res: Response) => {
    const targetUserId = req.user!.id;

    try {
      const rawFullName = req.body.full_name ?? req.body.fullName;
      const rawStoreName = req.body.store_name ?? req.body.storeName;
      const rawPhone = req.body.phone;
      const rawAvatar = req.body.avatar;
      const rawCustomDomain = req.body.custom_domain ?? req.body.customDomain;

      const safeProfileUpdates = {
        full_name: typeof rawFullName === 'string' && rawFullName.trim() ? sanitizeInput(rawFullName, 120) : undefined,
        store_name: typeof rawStoreName === 'string' && rawStoreName.trim() ? sanitizeInput(rawStoreName, 120) : undefined,
        phone: typeof rawPhone === 'string' && rawPhone.trim() ? sanitizeInput(rawPhone, 40) : undefined,
        avatar: typeof rawAvatar === 'string' && rawAvatar.trim() ? rawAvatar.trim() : undefined,
        custom_domain:
          typeof rawCustomDomain === 'string' ? sanitizeInput(rawCustomDomain, 120) : undefined,
        two_factor_enabled:
          typeof req.body.two_factor_enabled === 'boolean' ? req.body.two_factor_enabled : undefined,
      };
      const updated = updateUserProfile(targetUserId, safeProfileUpdates);
      return res.json({ success: true, user: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  };

  app.put('/api/auth/profile', authMiddleware, handleUpdateMerchantProfile);
  app.patch('/api/auth/profile', authMiddleware, handleUpdateMerchantProfile);

  // 8. Get Current Session Profile
  app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
    return res.json({
      success: true,
      user: req.user,
    });
  });

  // 9. Logout
  app.post('/api/auth/logout', authMiddleware, (req: AuthRequest, res: Response) => {
    if (req.token) {
      deleteSession(req.token);
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  });

  // 10. Forgot Password (Protected by forgotPasswordLimiter)
  app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response) => {
    const { email, recaptchaToken, turnstileToken, captchaToken } = req.body;

    const isCaptchaValid = await verifyCaptchaToken({
      recaptchaToken: recaptchaToken || req.body['g-recaptcha-response'],
      turnstileToken: turnstileToken || req.body['cf-turnstile-response'],
      captchaToken,
      remoteIp: extractClientIp(req),
      expectedAction: 'forgot_password',
    });
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        error: 'فشل التحقق الأمني (CAPTCHA). يرجى المحاولة مرة أخرى.',
      });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني مطلوب.' });
    }

    const user = findUserByEmail(email.trim());

    // Always return success even if user is not found to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now

    setResetPasswordToken(user.email, token, expiresAt);

    const resetUrl = `https://codworth.me/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendPasswordResetEmail(user.email, user.full_name, resetUrl);

    return res.json({
      success: true,
      message: 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين.',
    });
  });

  // 11. Reset Password
  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'جميع الحقول مطلوبة لإعادة تعيين كلمة المرور.',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.',
      });
    }

    const user = findUserByEmail(email.trim());
    if (
      !user ||
      !user.resetPasswordToken ||
      user.resetPasswordToken !== token ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        error: 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.',
      });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha512').toString('hex');

    updateUserPassword(user.email, newHash, newSalt);
    clearResetPasswordToken(user.email);

    return res.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.',
    });
  });

  /* ---------------- USAGE TRACKING & GUARD ROUTES ---------------- */

  // Check Usage Limits and Increment Pages Count
  app.post('/api/user/increment-usage', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const result = incrementUserUsage(req.user!.id);
      if (!result.allowed) {
        return res.status(403).json({
          success: false,
          error: 'LIMIT_REACHED',
          message: 'Free Plan limit reached (2/2 pages used). Upgrade to Pro for unlimited pages.',
          user: result.user,
        });
      }
      return res.json({
        success: true,
        user: result.user,
        message: 'Page usage incremented.',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  /* ---------------- STRIPE & SUBSCRIPTION BILLING ($10/MO) ---------------- */

  // Create Stripe Checkout Session
  app.post('/api/billing/create-checkout-session', authMiddleware, async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const returnUrl = req.body.returnUrl || 'http://localhost:3000';

    // If real Stripe API key is configured, create live Stripe Checkout Session
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        // Dynamic import of stripe if installed or native https request
        const stripeModule = await import('stripe');
        const Stripe = (stripeModule as any).default || stripeModule;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'CodWorth Pro Subscription',
                  description: 'Unlimited landing pages, AI generations, and clean HTML exports.',
                },
                unit_amount: 1000, // $10.00
                recurring: { interval: 'month' },
              },
              quantity: 1,
            },
          ],
          customer_email: user.email,
          client_reference_id: user.id,
          success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&billing=success`,
          cancel_url: `${returnUrl}?billing=cancelled`,
        });

        return res.json({ success: true, url: session.url, sessionId: session.id });
      } catch (stripeErr: any) {
        console.warn('Stripe checkout session creation failed, using sandbox simulator:', stripeErr.message);
      }
    }

    // Interactive Instant Sandbox Upgrade for Preview & Prototyping
    const updatedUser = updateUserSubscription(
      user.id,
      'active',
      'pro_monthly',
      'cus_test_stripe_' + Date.now(),
      'sub_test_stripe_' + Date.now(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    void sendAdminNotificationEmail(
      `💎 ترقية اشتراك Pro جديدة: ${updatedUser.full_name}`,
      `
      <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">تمت ترقية حساب تاجر إلى باقة Pro!</h3>
      <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
        <p style="margin: 6px 0;"><strong>👤 التاجر:</strong> ${updatedUser.full_name}</p>
        <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${updatedUser.email}</span></p>
        <p style="margin: 6px 0;"><strong>💳 الباقة:</strong> Pro Monthly ($10/mo)</p>
      </div>
      `
    ).catch((err) => console.error('Admin notification error (checkout upgrade):', err));

    return res.json({
      success: true,
      simulated: true,
      user: updatedUser,
      message: 'Successfully upgraded to Pro ($10/mo)! Unlimited pages unlocked.',
    });
  });

  // Direct Simulated Upgrade for 1-Click Testing in AI Studio
  app.post('/api/billing/simulate-upgrade', authMiddleware, (req: AuthRequest, res: Response) => {
    const updatedUser = updateUserSubscription(
      req.user!.id,
      'active',
      'pro_monthly',
      'cus_test_' + Date.now(),
      'sub_test_' + Date.now(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    void sendAdminNotificationEmail(
      `💎 ترقية اشتراك Pro: ${updatedUser.full_name}`,
      `
      <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">تم تفعيل اشتراك Pro لتاجر!</h3>
      <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
        <p style="margin: 6px 0;"><strong>👤 التاجر:</strong> ${updatedUser.full_name}</p>
        <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${updatedUser.email}</span></p>
        <p style="margin: 6px 0;"><strong>💳 الباقة:</strong> Pro Monthly ($10/mo)</p>
      </div>
      `
    ).catch((err) => console.error('Admin notification error (simulate upgrade):', err));

    return res.json({
      success: true,
      user: updatedUser,
      message: '🎉 Upgraded to CodWorth Pro ($10/month)! Unlimited pages unlocked.',
    });
  });

  // Stripe Webhook Endpoint
  app.post('/api/billing/webhook', (req: Request, res: Response) => {
    const event = req.body;
    console.log('Received billing webhook event:', event?.type);

    try {
      if (event?.type === 'checkout.session.completed') {
        const session = event.data?.object;
        const userId = session?.client_reference_id;
        const customerId = session?.customer;
        const subscriptionId = session?.subscription;

        if (userId) {
          updateUserSubscription(
            userId,
            'active',
            'pro_monthly',
            customerId,
            subscriptionId,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          );
        }
      } else if (event?.type === 'customer.subscription.deleted') {
        const sub = event.data?.object;
        const customerId = sub?.customer;
        // Find user by customer ID and mark cancelled
        if (customerId) {
          // find and update
        }
      }
      return res.json({ received: true });
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  /* ---------------- MULTI-CURRENCY EXCHANGE RATES (PUBLIC, 1-HOUR CACHE) ---------------- */

  let exchangeRatesCache: {
    rates: Record<string, number>;
    lastFetch: number;
  } | null = null;
  const EXCHANGE_RATES_TTL_MS = 60 * 60 * 1000; // 1 hour

  app.get('/api/exchange-rates', async (_req: Request, res: Response) => {
    const now = Date.now();
    if (exchangeRatesCache && now - exchangeRatesCache.lastFetch < EXCHANGE_RATES_TTL_MS) {
      return res.json({
        base: 'USD',
        rates: exchangeRatesCache.rates,
        updatedAt: exchangeRatesCache.lastFetch,
      });
    }

    const endpoints = [
      'https://api.exchangerate-api.com/v4/latest/USD',
      'https://open.er-api.com/v6/latest/USD',
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) continue;

        const data = (await response.json()) as { rates?: Record<string, unknown> };
        if (data && data.rates && typeof data.rates === 'object') {
          const normalized = normalizeExchangeRates(data.rates);
          const cleanRates = {
            USD: 1,
            MAD: normalized.MAD,
            EUR: normalized.EUR,
            GBP: normalized.GBP,
            CAD: normalized.CAD,
            AUD: normalized.AUD,
          };
          exchangeRatesCache = {
            rates: cleanRates,
            lastFetch: Date.now(),
          };
          return res.json({
            base: 'USD',
            rates: cleanRates,
            updatedAt: exchangeRatesCache.lastFetch,
          });
        }
      } catch (_err) {
        // Proceed to next fallback endpoint or hardcoded fallback
      }
    }

    const fallbackRates = exchangeRatesCache?.rates || {
      USD: 1,
      MAD: DEFAULT_EXCHANGE_RATES.MAD,
      EUR: DEFAULT_EXCHANGE_RATES.EUR,
      GBP: DEFAULT_EXCHANGE_RATES.GBP,
      CAD: DEFAULT_EXCHANGE_RATES.CAD,
      AUD: DEFAULT_EXCHANGE_RATES.AUD,
    };

    return res.json({
      base: 'USD',
      rates: fallbackRates,
      updatedAt: exchangeRatesCache?.lastFetch || now,
      stale: true,
    });
  });

  /* ---------------- MOROCCAN LOCAL PAYMENT METHODS (CIH, ATTIJARI, BANQUE POPULAIRE, CASH PLUS, WAFACASH) ---------------- */

  // Public/Merchant endpoint to fetch active Moroccan bank accounts dynamically from data/settings.json
  const handleGetPublicBanks = (req: Request, res: Response) => {
    try {
      const includeInactive = req.query.all === 'true';
      const banks = getBankAccounts(!includeInactive);
      return res.json({ success: true, banks });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/settings/banks', handleGetPublicBanks);
  app.get('/api/banks', handleGetPublicBanks);
  app.get('/api/billing/banks', handleGetPublicBanks);

  // Get current user's manual payment requests
  app.get('/api/billing/manual-payments', authMiddleware, (req: AuthRequest, res: Response) => {
    const userPayments = getManualPaymentsByUser(req.user!.id);
    return res.json({ success: true, payments: userPayments });
  });

  // Submit a manual payment proof
  app.post('/api/billing/manual-payment', authMiddleware, (req: AuthRequest, res: Response) => {
    const { method, transactionReference, amount = 100, proofImageUrl, notes } = req.body;

    if (!method || !transactionReference) {
      return res.status(400).json({
        success: false,
        error: 'Payment method and transaction reference code are required.',
      });
    }

    const validMethods = ['CIH', 'Attijariwafa', 'BanquePopulaire', 'CashPlus', 'Wafacash'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        error: `Invalid payment method. Choose from: ${validMethods.join(', ')}`,
      });
    }

    try {
      const payment = createManualPaymentRequest(
        req.user!.id,
        req.user!.email,
        req.user!.full_name,
        method,
        transactionReference,
        Number(amount) || 100,
        proofImageUrl,
        notes
      );

      void sendAdminNotificationEmail(
        `💰 طلب تفعيل دفع محلي جديد (${method}) - ${req.user!.full_name}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #fbbf24; font-size: 18px;">وصل إشعار تحويل بنكي جديد بانتظار المراجعة!</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>👤 التاجر:</strong> ${req.user!.full_name}</p>
          <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${req.user!.email}</span></p>
          <p style="margin: 6px 0;"><strong>🏦 وسيلة الدفع:</strong> ${method}</p>
          <p style="margin: 6px 0;"><strong>💵 المبلغ:</strong> ${Number(amount) || 100} MAD</p>
          <p style="margin: 6px 0;"><strong>🔢 رقم المعاملة (Reference):</strong> <span dir="ltr">${transactionReference}</span></p>
          ${notes ? `<p style="margin: 6px 0;"><strong>📝 ملاحظات:</strong> ${sanitizeInput(notes, 300)}</p>` : ''}
        </div>
        `
      ).catch((err) => console.error('Admin notification error (manual payment):', err));

      return res.json({
        success: true,
        payment,
        message:
          'Payment submitted successfully! Our Moroccan verification team will review your receipt and activate your Pro plan shortly.',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  /* ---------------- ADMIN VERIFICATION WORKFLOW ---------------- */

  // Admin Middleware (Strictly enforces role === 'admin')
  const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin privileges required.',
      });
    }
    next();
  };

  // Admin Moroccan Bank Accounts Management (stored in data/settings.json)
  const handleAdminGetBanks = (_req: AuthRequest, res: Response) => {
    try {
      const banks = getBankAccounts(false);
      return res.json({ success: true, banks });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  const handleAdminSaveBanks = (req: AuthRequest, res: Response) => {
    try {
      if (Array.isArray(req.body?.banks)) {
        const saved = saveBankAccounts(req.body.banks);
        if (!saved) {
          return res.status(500).json({
            success: false,
            error: 'فشل حفظ الحسابات البنكية في data/settings.json',
          });
        }
        const updatedBanks = getBankAccounts(false);
        return res.json({
          success: true,
          banks: updatedBanks,
          message: 'تم حفظ قائمة الحسابات البنكية المغربية بنجاح!',
        });
      }
      if (
        req.body &&
        typeof req.body === 'object' &&
        (req.body.name !== undefined || req.body.bankName !== undefined || req.body.bank)
      ) {
        const bankPayload = req.body.bank || req.body;
        const { success, bank } = upsertBankAccount(bankPayload);
        if (!success) {
          return res.status(500).json({
            success: false,
            error: 'فشل حفظ الحساب البنكي في data/settings.json',
          });
        }
        const allBanks = getBankAccounts(false);
        return res.json({
          ...bank,
          success: true,
          bank,
          banks: allBanks,
          message: `تم حفظ حساب ${bank.name || bank.bankName} بنجاح!`,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'يرجى تمرير مصفوفة الحسابات البنكية (banks) أو بيانات الحساب البنكي.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  const handleAdminUpdateBankById = (req: AuthRequest, res: Response) => {
    try {
      const bankId = (req.params.id || '').trim();
      if (!bankId) {
        return res.status(400).json({ success: false, error: 'معرف الحساب البنكي مطلوب.' });
      }

      const currentBanks = getBankAccounts(false);
      const existingIndex = currentBanks.findIndex((b) => b.id === bankId);
      const bankPayload = req.body?.bank || req.body || {};
      const now = new Date().toISOString();

      let updatedBank;
      if (existingIndex >= 0) {
        const existing = currentBanks[existingIndex];
        updatedBank = {
          ...existing,
          ...bankPayload,
          id: bankId,
          name: bankPayload.name !== undefined ? String(bankPayload.name).trim() : existing.name,
          bankName:
            bankPayload.bankName !== undefined
              ? String(bankPayload.bankName).trim()
              : existing.bankName,
          subtitle:
            bankPayload.subtitle !== undefined
              ? String(bankPayload.subtitle).trim()
              : existing.subtitle,
          badge: bankPayload.badge !== undefined ? String(bankPayload.badge).trim() : existing.badge,
          rib: bankPayload.rib !== undefined ? String(bankPayload.rib).trim() : existing.rib,
          beneficiary:
            bankPayload.beneficiary !== undefined
              ? String(bankPayload.beneficiary).trim()
              : existing.beneficiary,
          cin:
            bankPayload.cin !== undefined
              ? String(bankPayload.cin).trim() || undefined
              : existing.cin,
          phone:
            bankPayload.phone !== undefined
              ? String(bankPayload.phone).trim() || undefined
              : existing.phone,
          instructions:
            bankPayload.instructions !== undefined
              ? String(bankPayload.instructions).trim()
              : existing.instructions,
          isActive:
            bankPayload.isActive !== undefined ? Boolean(bankPayload.isActive) : existing.isActive,
          updatedAt: now,
        };
        currentBanks[existingIndex] = updatedBank;
      } else {
        updatedBank = {
          id: bankId,
          methodId: bankPayload.methodId || 'CIH',
          name: String(bankPayload.name ?? '').trim(),
          bankName: String(bankPayload.bankName ?? bankPayload.name ?? '').trim(),
          subtitle: String(bankPayload.subtitle ?? '').trim(),
          badge: String(bankPayload.badge ?? '').trim(),
          rib: String(bankPayload.rib ?? '').trim(),
          beneficiary: String(bankPayload.beneficiary ?? '').trim(),
          cin: bankPayload.cin ? String(bankPayload.cin).trim() : undefined,
          phone: bankPayload.phone ? String(bankPayload.phone).trim() : undefined,
          instructions: String(bankPayload.instructions ?? '').trim(),
          isActive: bankPayload.isActive !== false,
          updatedAt: now,
        };
        currentBanks.push(updatedBank);
      }

      const saved = saveBankAccounts(currentBanks);
      if (!saved) {
        return res.status(500).json({
          success: false,
          error: 'فشل حفظ التعديلات في ملف data/settings.json',
        });
      }

      const freshBanks = getBankAccounts(false);
      const persistedBank = freshBanks.find((b) => b.id === bankId) || updatedBank;

      return res.json({
        ...persistedBank,
        success: true,
        bank: persistedBank,
        banks: freshBanks,
        message: `تم حفظ تعديلات الحساب البنكي (${persistedBank.name || persistedBank.bankName}) بنجاح!`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  const handleAdminDeleteBank = (req: AuthRequest, res: Response) => {
    try {
      const deleted = deleteBankAccount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'الحساب البنكي غير موجود.' });
      }
      return res.json({
        success: true,
        banks: getBankAccounts(false),
        message: 'تم حذف الحساب البنكي بنجاح.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/admin/settings/banks', authMiddleware, adminMiddleware, handleAdminGetBanks);
  app.get('/api/admin/banks', authMiddleware, adminMiddleware, handleAdminGetBanks);
  app.put('/api/admin/settings/banks', authMiddleware, adminMiddleware, handleAdminSaveBanks);
  app.put('/api/admin/banks', authMiddleware, adminMiddleware, handleAdminSaveBanks);
  app.put('/api/admin/settings/banks/:id', authMiddleware, adminMiddleware, handleAdminUpdateBankById);
  app.put('/api/admin/banks/:id', authMiddleware, adminMiddleware, handleAdminUpdateBankById);
  app.post('/api/admin/settings/banks', authMiddleware, adminMiddleware, handleAdminSaveBanks);
  app.post('/api/admin/banks', authMiddleware, adminMiddleware, handleAdminSaveBanks);
  app.delete('/api/admin/settings/banks/:id', authMiddleware, adminMiddleware, handleAdminDeleteBank);
  app.delete('/api/admin/banks/:id', authMiddleware, adminMiddleware, handleAdminDeleteBank);

  // Get all payment submissions for verification
  app.get('/api/admin/payments', authMiddleware, adminMiddleware, (_req: AuthRequest, res: Response) => {
    const all = getAllManualPayments();
    return res.json({ success: true, payments: all });
  });

  // Approve payment and activate Pro
  app.post('/api/admin/payments/:id/approve', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const { payment, user } = approveManualPayment(req.params.id);
      return res.json({
        success: true,
        payment,
        user,
        message: `Payment #${payment.id} approved! Pro membership activated for ${payment.userName}.`,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Reject payment
  app.post('/api/admin/payments/:id/reject', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const payment = rejectManualPayment(req.params.id);
      return res.json({
        success: true,
        payment,
        message: `Payment #${payment.id} marked as rejected.`,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 1. Get all platform users & merchants with live funnels/orders metrics
  app.get('/api/admin/users', authMiddleware, adminMiddleware, (_req: AuthRequest, res: Response) => {
    try {
      const allUsers = getAllUsers();
      return res.json({ success: true, users: allUsers });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Direct Admin subscription plan change
  app.post('/api/admin/users/:id/plan', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const { planId } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: 'planId is required' });
      const updated = updateUserPlan(req.params.id, planId);
      return res.json({
        success: true,
        user: updated,
        message: `تم تحديث باقة التاجر ${updated.full_name} إلى ${planId.toUpperCase()} بنجاح!`,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. Approve / Suspend / Activate user account (supports both POST and PUT)
  const handleAdminUpdateUserStatus = (req: AuthRequest, res: Response) => {
    try {
      const status = (req.body?.status || 'active') as 'active' | 'pending' | 'suspended';
      if (!['active', 'pending', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Valid status (active|pending|suspended) is required' });
      }
      const updated = updateUserAccountStatus(req.params.id, status);
      return res.json({
        success: true,
        user: updated,
        message:
          status === 'suspended'
            ? 'تم تجميد حساب التاجر مؤقتاً.'
            : status === 'pending'
            ? 'تم وضع الحساب قيد المراجعة.'
            : 'تم تفعيل الحساب بنجاح!',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  };

  app.post('/api/admin/users/:id/status', authMiddleware, adminMiddleware, handleAdminUpdateUserStatus);
  app.put('/api/admin/users/:id/status', authMiddleware, adminMiddleware, handleAdminUpdateUserStatus);

  // 4. Delete user account
  app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const deleted = deleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: 'User not found' });
      return res.json({ success: true, message: 'تم حذف حساب التاجر بنجاح.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Admin creates new user account
  app.post('/api/admin/users', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const { email, fullName, storeName, phone, city, role, planId, password } = req.body;
      if (!email || !fullName) {
        return res.status(400).json({ success: false, error: 'Email and full name are required' });
      }
      const created = createAdminUser({ email, fullName, storeName, phone, city, role, planId, password });
      return res.json({
        success: true,
        user: toSafeProfile(created),
        message: `تم إنشاء حساب التاجر ${created.full_name} بنجاح!`,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 6. Live Account Impersonation ("Login as User")
  app.post('/api/admin/impersonate', authMiddleware, adminMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ success: false, error: 'targetUserId is required' });
      }
      const targetUser = findUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'Target user account not found.' });
      }

      // Generate a temporary impersonation session token
      const token = createSession(targetUser.id);
      return res.json({
        success: true,
        token,
        user: toSafeProfile(targetUser),
        realAdminUser: req.user,
        message: `أنت الآن تتحكم في حساب التاجر (${targetUser.full_name} - ${targetUser.store_name || targetUser.email})`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Global Platform Overview & KPIs
  app.get('/api/admin/overview', authMiddleware, adminMiddleware, (_req: AuthRequest, res: Response) => {
    try {
      const stats = getGlobalPlatformStats();
      return res.json({ success: true, stats });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Global Funnels & Landing Pages Monitor
  app.get('/api/admin/funnels', authMiddleware, adminMiddleware, (_req: AuthRequest, res: Response) => {
    try {
      const allPages = getAllPagesAdmin();
      return res.json({ success: true, pages: allPages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Global Orders Monitor across all merchants
  app.get('/api/admin/orders', authMiddleware, adminMiddleware, (_req: AuthRequest, res: Response) => {
    try {
      const allOrders = getAllOrders();
      return res.json({ success: true, orders: allOrders });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ---------------- USER PAGES / FUNNELS MANAGEMENT ---------------- */

  // Get all landing pages belonging to current user
  app.get('/api/pages', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const userPages = getUserPages(req.user!.id);
      return res.json({ success: true, pages: userPages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get specific page by ID (Strictly enforces req.user.id ownership)
  app.get('/api/pages/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const page = getUserPageById(req.user!.id, req.params.id);
    if (!page || page.userId !== req.user!.id) {
      return res.status(404).json({ success: false, error: 'Page not found or access denied.' });
    }
    return res.json({ success: true, page });
  });

  // Save or update a landing page in the cloud (Strictly uses req.user.id, never body.userId)
  app.post('/api/pages/save', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const { id, title, slug, data } = req.body;
      const user = req.user!;
      const isPro = user.subscription_status === 'active';

      // Check if updating an existing page the user already owns
      const existingPage = id ? getUserPageById(user.id, id) : null;

      // If creating a brand new page, check free tier limits
      if (!existingPage) {
        if (!isPro && user.pages_created_count >= 2) {
          return res.status(403).json({
            success: false,
            code: 'LIMIT_REACHED',
            error: 'Free tier limit reached (2/2 pages). Upgrade to CodWorth Pro for unlimited pages.',
          });
        }
      }

      const { page, isNew } = saveUserPage(user.id, { id, title, slug, data });

      let currentCount = user.pages_created_count;
      if (isNew) {
        const usageRes = incrementUserUsage(user.id);
        currentCount = usageRes.user.pages_created_count;
      }

      return res.json({
        success: true,
        page,
        isNew,
        pagesCreatedCount: currentCount,
        message: isNew
          ? 'Landing page created and saved to your cloud account!'
          : 'Page changes saved successfully to cloud!',
      });
    } catch (err: any) {
      const status = err.message?.startsWith('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }
  });

  // Update a specific landing page by ID (Strictly verifies req.user.id ownership)
  app.put('/api/pages/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const existingPage = getUserPageById(user.id, req.params.id);
      if (!existingPage || existingPage.userId !== user.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this page.' });
      }
      const { title, slug, data } = req.body;
      const { page } = saveUserPage(user.id, { id: req.params.id, title, slug, data });
      return res.json({ success: true, page, message: 'Page updated successfully.' });
    } catch (err: any) {
      const status = err.message?.startsWith('Forbidden') ? 403 : 400;
      return res.status(status).json({ success: false, error: err.message });
    }
  });

  // Delete a landing page (Strictly verifies req.user.id ownership)
  app.delete('/api/pages/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const deleted = deleteUserPage(req.user!.id, req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Page not found or permission denied.' });
      }
      return res.json({ success: true, message: 'Landing page deleted successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Duplicate a landing page
  app.post('/api/pages/:id/duplicate', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isPro = user.subscription_status === 'active';

      if (!isPro && user.pages_created_count >= 2) {
        return res.status(403).json({
          success: false,
          code: 'LIMIT_REACHED',
          error: 'Free tier limit reached (2/2 pages). Upgrade to Pro to duplicate and build unlimited pages.',
        });
      }

      const duplicated = duplicateUserPage(user.id, req.params.id);
      if (!duplicated) {
        return res.status(404).json({ success: false, error: 'Source page not found.' });
      }

      const usageRes = incrementUserUsage(user.id);

      return res.json({
        success: true,
        page: duplicated,
        pagesCreatedCount: usageRes.user.pages_created_count,
        message: 'Page duplicated successfully!',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ---------------- 1-CLICK PUBLISHING & LIVE DOMAIN HOSTING ---------------- */

  // Check if a slug is available for publishing
  app.get('/api/pages/check-slug', (req: Request, res: Response) => {
    const slug = ((req.query.slug as string) || '').trim();
    const excludePageId = ((req.query.excludeId as string) || '').trim();
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Slug is required.' });
    }
    const available = isSlugAvailable(slug, excludePageId || undefined);
    return res.json({ success: true, slug, available });
  });

  // Publish a landing page live
  app.post('/api/pages/:id/publish', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const pageId = req.params.id;
      const { slug, customDomain, compiledHtml } = req.body;

      if (!slug || !slug.trim()) {
        return res.status(400).json({ success: false, error: 'A live URL slug is required for publishing.' });
      }

      // Verify page ownership
      const existingPage = getUserPageById(user.id, pageId);
      if (!existingPage) {
        return res.status(404).json({ success: false, error: 'Page not found or permission denied.' });
      }

      // Check user quota (if user on free plan and exceeded 2 pages)
      const isPro = user.subscription_status === 'active';
      if (!isPro && user.pages_created_count > 2) {
        return res.status(403).json({
          success: false,
          code: 'LIMIT_REACHED',
          error: 'Free plan limit reached (2 pages). Upgrade to Pro to publish live funnels.',
        });
      }

      // Check slug uniqueness
      if (!isSlugAvailable(slug, pageId)) {
        return res.status(400).json({
          success: false,
          code: 'SLUG_TAKEN',
          error: `The slug "${slug}" is already taken by another live funnel. Please try another slug.`,
        });
      }

      // Generate clean standalone HTML if not provided
      let finalHtml = compiledHtml;
      if (!finalHtml && existingPage.data) {
        finalHtml = generateStandaloneHtml({
          ...existingPage.data,
          slug: slug.trim(),
        });
      }

      const published = publishPage(
        user.id,
        pageId,
        slug.trim(),
        customDomain ? customDomain.trim() : undefined,
        finalHtml
      );

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const liveUrl = `${protocol}://${host}/p/${published.slug}`;

      void sendAdminNotificationEmail(
        `🚀 نشر صفحة هبوط جديدة: ${published.title}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">قام تاجر بنشر صفحة هبوط مباشرة على المنصة!</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>👤 التاجر:</strong> ${user.full_name} (<span dir="ltr">${user.email}</span>)</p>
          <p style="margin: 6px 0;"><strong>📄 عنوان الصفحة:</strong> ${published.title}</p>
          <p style="margin: 6px 0;"><strong>🔗 الرابط المباشر:</strong> <a href="${liveUrl}" style="color: #10b981;" dir="ltr">${liveUrl}</a></p>
          ${published.customDomain ? `<p style="margin: 6px 0;"><strong>🌐 الدومين المخصص:</strong> <span dir="ltr">${published.customDomain}</span></p>` : ''}
        </div>
        `
      ).catch((err) => console.error('Admin notification error (publish page):', err));

      return res.json({
        success: true,
        page: published,
        liveUrl,
        message: 'Landing page published live successfully!',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Unpublish a landing page
  app.post('/api/pages/:id/unpublish', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const pageId = req.params.id;
      const unpublished = unpublishPage(user.id, pageId);
      return res.json({
        success: true,
        page: unpublished,
        message: 'Landing page unpublished successfully.',
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Get publishing status and orders for a page
  app.get('/api/pages/:id/publish-status', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const page = getUserPageById(user.id, req.params.id);
      if (!page) {
        return res.status(404).json({ success: false, error: 'Page not found.' });
      }

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const liveUrl = page.isPublished ? `${protocol}://${host}/p/${page.slug}` : null;
      const orders = page.slug ? getPageOrders(page.slug) : [];

      return res.json({
        success: true,
        isPublished: !!page.isPublished,
        slug: page.slug,
        customDomain: page.customDomain,
        liveUrl,
        viewsCount: page.viewsCount || 0,
        ordersCount: page.ordersCount || 0,
        publishedAt: page.publishedAt,
        orders,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Custom domain check endpoint
  app.get('/p-domain-check', (req: Request, res: Response) => {
    const domain = ((req.query.domain as string) || '').trim().toLowerCase();
    const host = req.headers.host || '';
    const targetDomain = domain || host;

    const page = getPublishedPageByDomain(targetDomain);
    return res.json({
      success: true,
      domain: targetDomain,
      connected: !!page,
      targetCNAME: 'cname.funnelcraft.ma',
      status: page ? 'ACTIVE_SSL_CONNECTED' : 'PENDING_DNS_VERIFICATION',
      pageTitle: page?.title || null,
      message: page
        ? 'Domain successfully linked and live!'
        : 'Domain verified. Ensure your CNAME record points to cname.funnelcraft.ma.',
    });
  });

  /* ---------------- COD ORDERS & SALES CRM REST ENDPOINTS ---------------- */

  // GET /api/orders: Strictly requires authentication and scopes orders to req.user.id (Prevents IDOR)
  app.get('/api/orders', authMiddleware, (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isPlatformAdmin = user.role === 'admin';
      const wantAll = req.query.all === 'true';

      // Only verified platform admins can explicitly request all platform orders
      if (isPlatformAdmin && wantAll) {
        const allOrders = getAllOrders();
        return res.json({ success: true, orders: allOrders });
      }

      // NEVER trust req.query.userId from clients — always enforce req.user.id from token
      const userOrders = getOrdersForUser(user.id, false);
      return res.json({ success: true, orders: userOrders });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/orders: Receives new order submissions from COD forms or PayPal Checkout (Sanitized & owner-resolved via pageSlug/funnelId or req.user.id)
  app.post('/api/orders', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const {
        customerName,
        phone,
        customerPhone,
        city,
        customerCity,
        address,
        customerAddress,
        productName,
        price,
        quantity,
        funnelId,
        pageSlug,
        notes,
        paymentMethod,
        status,
        currency,
        paypalOrderId,
        recaptchaToken,
        turnstileToken,
        captchaToken,
      } = req.body;

      const isPayPal = paymentMethod === 'paypal';

      // Verify Google reCAPTCHA v3 / Cloudflare Turnstile CAPTCHA for public COD checkout submissions
      if (!isPayPal) {
        const isCaptchaValid = await verifyCaptchaToken({
          recaptchaToken: recaptchaToken || req.body['g-recaptcha-response'],
          turnstileToken: turnstileToken || req.body['cf-turnstile-response'],
          captchaToken,
          remoteIp: extractClientIp(req),
          expectedAction: 'cod_checkout',
        });
        if (!isCaptchaValid) {
          return res.status(400).json({
            success: false,
            error: 'يرجى إتمام التحقق الأمني (CAPTCHA) قبل تأكيد الطلب.',
          });
        }
      }

      const effectivePhone = sanitizeInput(phone || customerPhone || (isPayPal ? 'PayPal' : ''), 30);
      if (!effectivePhone && !isPayPal) {
        return res.status(400).json({ success: false, error: 'Phone number is required for Cash on Delivery.' });
      }

      // Never trust client-provided req.body.userId; resolve owner from pageSlug/funnelId in db, or fallback to authenticated req.user.id
      const order = recordCodOrder({
        customerName: sanitizeInput(customerName || (isPayPal ? 'زبون PayPal' : 'زبون'), 100) || 'زبون',
        phone: effectivePhone,
        city: sanitizeInput(city || customerCity || 'الدار البيضاء', 80) || 'الدار البيضاء',
        address: sanitizeInput(address || customerAddress || '', 250),
        productName: sanitizeInput(productName || 'منتج مميز', 160) || 'منتج مميز',
        price: price || 299,
        quantity: Math.max(1, Math.min(99, Number(quantity) || 1)),
        funnelId: typeof funnelId === 'string' ? funnelId.trim() : undefined,
        pageSlug: typeof pageSlug === 'string' ? pageSlug.trim() : undefined,
        userId: req.user?.id,
        notes: sanitizeInput(notes || '', 500),
        paymentMethod: isPayPal ? 'paypal' : 'cod',
        status: isPayPal && (!status || status === 'paid') ? 'paid' : status,
        currency: typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'MAD',
        paypalOrderId: typeof paypalOrderId === 'string' ? sanitizeInput(paypalOrderId, 80) : undefined,
      });

      void sendAdminNotificationEmail(
        `🛒 طلب جديد (${order.id}) - ${order.productName}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">تم تسجيل طلب جديد عبر صفحات CodWorth!</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>🆔 رقم الطلب:</strong> <span dir="ltr">${order.id}</span></p>
          <p style="margin: 6px 0;"><strong>📦 المنتج:</strong> ${order.productName} (الكمية: ${order.quantity})</p>
          <p style="margin: 6px 0;"><strong>💵 السعر الإجمالي:</strong> ${order.price} ${order.currency}</p>
          <p style="margin: 6px 0;"><strong>💳 طريقة الدفع:</strong> ${order.paymentMethod === 'paypal' ? 'PayPal (مدفوع)' : 'الدفع عند الاستلام (COD)'}</p>
          <p style="margin: 6px 0;"><strong>👤 اسم الزبون:</strong> ${order.customerName}</p>
          <p style="margin: 6px 0;"><strong>📱 هاتف الزبون:</strong> <span dir="ltr">${order.customerPhone}</span></p>
          <p style="margin: 6px 0;"><strong>🏙️ المدينة / العنوان:</strong> ${order.customerCity}${order.customerAddress ? ` - ${order.customerAddress}` : ''}</p>
          ${order.storeName || order.userEmail ? `<p style="margin: 6px 0;"><strong>🏪 المتجر / التاجر:</strong> ${order.storeName || ''} ${order.userEmail ? `(${order.userEmail})` : ''}</p>` : ''}
        </div>
        `
      ).catch((err) => console.error('Admin notification error (new order):', err));

      return res.json({
        success: true,
        order,
        orderId: order.id,
        message: 'Order created successfully!',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /* ---------------- PAYPAL CHECKOUT (ONE-TIME PAYMENTS) REST ENDPOINTS ---------------- */

  // Supported ISO-4217 currencies by PayPal Checkout REST API v2
  const PAYPAL_SUPPORTED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK',
    'PLN', 'CZK', 'HUF', 'ILS', 'MXN', 'BRL', 'MYR', 'PHP', 'TWD', 'THB',
    'SGD', 'HKD', 'NZD', 'RUB',
  ]);

  // Trusted server-side subscription plan prices in MAD
  const PLANS: Record<string, { id: string; name: string; monthlyPriceMAD: number; yearlyPriceMAD: number }> = {
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      monthlyPriceMAD: 99,
      yearlyPriceMAD: Math.round(99 * 0.8) * 12, // 948 MAD
    },
    pro: {
      id: 'pro',
      name: 'Pro Plan',
      monthlyPriceMAD: 179,
      yearlyPriceMAD: Math.round(179 * 0.8) * 12, // 1716 MAD
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise Plan',
      monthlyPriceMAD: 349,
      yearlyPriceMAD: Math.round(349 * 0.8) * 12, // 3348 MAD
    },
    starter_monthly: { id: 'starter', name: 'Starter Plan (Monthly)', monthlyPriceMAD: 99, yearlyPriceMAD: 99 },
    starter_yearly: { id: 'starter', name: 'Starter Plan (Yearly)', monthlyPriceMAD: 948, yearlyPriceMAD: 948 },
    pro_monthly: { id: 'pro', name: 'Pro Plan (Monthly)', monthlyPriceMAD: 179, yearlyPriceMAD: 179 },
    pro_yearly: { id: 'pro', name: 'Pro Plan (Yearly)', monthlyPriceMAD: 1716, yearlyPriceMAD: 1716 },
    enterprise_monthly: { id: 'enterprise', name: 'Enterprise Plan (Monthly)', monthlyPriceMAD: 349, yearlyPriceMAD: 349 },
    enterprise_yearly: { id: 'enterprise', name: 'Enterprise Plan (Yearly)', monthlyPriceMAD: 3348, yearlyPriceMAD: 3348 },
  };

  // Server-side registry of expected PayPal order amounts (OrderId -> Expected Amount & Metadata)
  const expectedPayPalOrders = new Map<
    string,
    {
      expectedAmount: string;
      expectedCurrency: string;
      priceMAD: number;
      identifier: string;
      sourceType: 'plan' | 'landing_page';
      createdAt: number;
    }
  >();

  // Helper to resolve trusted server-side price (never trusts req.body.amount)
  const resolveTrustedPayPalOrderPrice = (payload: {
    identifier?: unknown;
    planId?: unknown;
    billingCycle?: unknown;
    pageSlug?: unknown;
    funnelId?: unknown;
    bundleIndex?: unknown;
    bundleQuantity?: unknown;
  }): {
    priceMAD: number;
    amountUSD: number;
    formattedValue: string;
    currencyCode: string;
    identifier: string;
    sourceType: 'plan' | 'landing_page';
  } | null => {
    const activeRates = exchangeRatesCache?.rates || DEFAULT_EXCHANGE_RATES;
    const rawPlanId = typeof payload.planId === 'string' ? payload.planId.trim().toLowerCase() : '';
    const rawIdentifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
    const rawPageSlug = typeof payload.pageSlug === 'string' ? payload.pageSlug.trim() : '';
    const rawFunnelId = typeof payload.funnelId === 'string' ? payload.funnelId.trim() : '';
    const billingCycle = payload.billingCycle === 'yearly' ? 'yearly' : 'monthly';

    // 1. Check if this is a Subscription Plan checkout
    const candidatePlanKey = rawPlanId || (PLANS[rawIdentifier.toLowerCase()] ? rawIdentifier.toLowerCase() : '');
    if (candidatePlanKey && PLANS[candidatePlanKey]) {
      const plan = PLANS[candidatePlanKey];
      const isExplicitCycleKey = candidatePlanKey.endsWith('_monthly') || candidatePlanKey.endsWith('_yearly');
      const priceMAD = isExplicitCycleKey
        ? plan.monthlyPriceMAD
        : billingCycle === 'yearly'
          ? plan.yearlyPriceMAD
          : plan.monthlyPriceMAD;

      if (!Number.isFinite(priceMAD) || priceMAD <= 0) {
        return null;
      }

      const settlement = calculatePayPalUsdSettlement(priceMAD, activeRates);
      if (!Number.isFinite(settlement.amount) || settlement.amount <= 0) {
        return null;
      }

      return {
        priceMAD,
        amountUSD: settlement.amount,
        formattedValue: settlement.amount.toFixed(2),
        currencyCode: 'USD',
        identifier: `plan:${plan.id}:${billingCycle}`,
        sourceType: 'plan',
      };
    }

    // 2. Otherwise resolve as a Landing Page product checkout by pageSlug / funnelId / identifier
    const lookupKeys = [rawPageSlug, rawFunnelId, rawIdentifier].filter(Boolean);
    let resolvedPage: ReturnType<typeof getPublishedPageBySlug> = null;
    let matchedKey = '';

    for (const key of lookupKeys) {
      const found = getPublishedPageBySlug(key);
      if (found) {
        resolvedPage = found;
        matchedKey = key;
        break;
      }
    }

    if (!resolvedPage || !resolvedPage.data) {
      return null;
    }

    const pageData = resolvedPage.data as Record<string, any>;
    const scrapedData = (pageData.scrapedData || {}) as Record<string, any>;
    const requestedBundleIndex =
      payload.bundleIndex !== undefined && payload.bundleIndex !== null && payload.bundleIndex !== ''
        ? Number(payload.bundleIndex)
        : undefined;
    const requestedBundleQuantity =
      payload.bundleQuantity !== undefined && payload.bundleQuantity !== null && payload.bundleQuantity !== ''
        ? Number(payload.bundleQuantity)
        : undefined;

    let priceMAD = 0;

    // Collect bundles from scrapedData.bundles, pageData.bundles, or cod-form block in pageData.blocks
    let bundles: Array<{ price?: number; quantity?: number }> = [];
    if (Array.isArray(scrapedData.bundles) && scrapedData.bundles.length > 0) {
      bundles = scrapedData.bundles;
    } else if (Array.isArray(pageData.bundles) && pageData.bundles.length > 0) {
      bundles = pageData.bundles;
    } else if (Array.isArray(pageData.blocks)) {
      const codBlock = pageData.blocks.find(
        (b: any) => b && b.type === 'cod-form' && b.content && Array.isArray(b.content.bundles)
      );
      if (codBlock?.content?.bundles?.length > 0) {
        bundles = codBlock.content.bundles;
      }
    }

    if (bundles.length > 0) {
      let selectedBundle = bundles[0];
      if (
        typeof requestedBundleIndex === 'number' &&
        Number.isInteger(requestedBundleIndex) &&
        requestedBundleIndex >= 0 &&
        requestedBundleIndex < bundles.length
      ) {
        selectedBundle = bundles[requestedBundleIndex];
      } else if (
        typeof requestedBundleQuantity === 'number' &&
        Number.isFinite(requestedBundleQuantity) &&
        requestedBundleQuantity > 0
      ) {
        const byQty = bundles.find((b) => Number(b?.quantity) === requestedBundleQuantity);
        if (byQty) {
          selectedBundle = byQty;
        }
      }
      priceMAD = Number(selectedBundle?.price);
    }

    // Fallback to base product price if bundles had no valid price
    if (!Number.isFinite(priceMAD) || priceMAD <= 0) {
      const rawBasePrice =
        scrapedData.price ??
        pageData.price ??
        pageData.productPrice ??
        (Array.isArray(pageData.blocks)
          ? pageData.blocks.find((b: any) => b?.type === 'cod-form')?.content?.productPrice
          : undefined);
      const basePrice = Number(String(rawBasePrice ?? '').replace(/[^\d.]/g, ''));

      if (Number.isFinite(basePrice) && basePrice > 0) {
        if (requestedBundleQuantity === 2) {
          priceMAD = Math.round(basePrice * 2 * 0.85);
        } else if (requestedBundleQuantity === 3) {
          priceMAD = Math.round(basePrice * 3 * 0.75);
        } else {
          priceMAD = basePrice;
        }
      }
    }

    if (!Number.isFinite(priceMAD) || priceMAD <= 0) {
      return null;
    }

    const settlement = calculatePayPalUsdSettlement(priceMAD, activeRates);
    if (!Number.isFinite(settlement.amount) || settlement.amount <= 0) {
      return null;
    }

    return {
      priceMAD,
      amountUSD: settlement.amount,
      formattedValue: settlement.amount.toFixed(2),
      currencyCode: 'USD',
      identifier: `page:${resolvedPage.slug || matchedKey}`,
      sourceType: 'landing_page',
    };
  };

  // POST /api/paypal/create-order: Creates a PayPal order using ONLY server-verified database/plan prices
  app.post('/api/paypal/create-order', async (req: Request, res: Response) => {
    try {
      // Strictly ignore any client-supplied amount/currency to prevent price tampering
      const {
        identifier,
        planId,
        billingCycle,
        pageSlug,
        funnelId,
        bundleIndex,
        bundleQuantity,
      } = req.body || {};

      const resolvedOrder = resolveTrustedPayPalOrderPrice({
        identifier,
        planId,
        billingCycle,
        pageSlug,
        funnelId,
        bundleIndex,
        bundleQuantity,
      });

      if (!resolvedOrder || !Number.isFinite(resolvedOrder.amountUSD) || resolvedOrder.amountUSD <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or unknown product/plan identifier. Unable to resolve a valid server-side price.',
        });
      }

      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        return res.status(500).json({
          success: false,
          error: 'PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured on the server.',
        });
      }

      const normalizedCurrency = PAYPAL_SUPPORTED_CURRENCIES.has(resolvedOrder.currencyCode)
        ? resolvedOrder.currencyCode
        : 'USD';

      const formattedValue = resolvedOrder.formattedValue;

      const { result, statusCode } = await paypalOrdersController.createOrder({
        body: {
          intent: CheckoutPaymentIntent.Capture,
          purchaseUnits: [
            {
              customId: JSON.stringify({
                id: resolvedOrder.identifier,
                amt: formattedValue,
                cur: normalizedCurrency,
              }),
              amount: {
                currencyCode: normalizedCurrency,
                value: formattedValue,
              },
            },
          ],
        },
        prefer: 'return=minimal',
      });

      if (!result || !result.id) {
        return res.status(statusCode || 500).json({
          success: false,
          error: 'Failed to create PayPal order: Missing order ID in response.',
        });
      }

      // Record expected order amount on the server for verification during capture
      expectedPayPalOrders.set(result.id, {
        expectedAmount: formattedValue,
        expectedCurrency: normalizedCurrency,
        priceMAD: resolvedOrder.priceMAD,
        identifier: resolvedOrder.identifier,
        sourceType: resolvedOrder.sourceType,
        createdAt: Date.now(),
      });

      return res.status(201).json({
        id: result.id,
        status: result.status,
        amount: resolvedOrder.amountUSD,
        currency: normalizedCurrency,
      });
    } catch (err: any) {
      console.error('PayPal Create Order Error:', err);
      const statusCode = err instanceof PayPalApiError ? err.statusCode : 500;
      return res.status(statusCode || 500).json({
        success: false,
        error: err?.result?.message || err?.message || 'Failed to create PayPal order.',
      });
    }
  });

  // POST /api/paypal/capture-order/:orderId: Captures an approved PayPal order and verifies COMPLETED status & expected amount
  app.post('/api/paypal/capture-order/:orderId', async (req: Request, res: Response) => {
    try {
      const orderId = (req.params.orderId || '').trim();
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: 'Order ID parameter is required.',
        });
      }

      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        return res.status(500).json({
          success: false,
          error: 'PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured on the server.',
        });
      }

      const { result, statusCode } = await paypalOrdersController.captureOrder({
        id: orderId,
        prefer: 'return=representation',
      });

      const captureStatus =
        result?.status ||
        result?.purchaseUnits?.[0]?.payments?.captures?.[0]?.status;

      if (captureStatus !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          status: captureStatus || 'UNKNOWN',
          error: `PayPal order capture status is ${captureStatus || 'incomplete'}, expected COMPLETED.`,
          details: result,
        });
      }

      // Extract the actual captured amount and currency returned by PayPal
      const captureObj = result?.purchaseUnits?.[0]?.payments?.captures?.[0];
      const capturedAmountValue =
        captureObj?.amount?.value ?? result?.purchaseUnits?.[0]?.amount?.value;
      const capturedCurrencyCode =
        captureObj?.amount?.currencyCode ?? result?.purchaseUnits?.[0]?.amount?.currencyCode ?? 'USD';

      // Resolve expected server-side amount from:
      // 1) In-memory expectedPayPalOrders map
      // 2) Re-evaluating identifier/pageSlug/planId from request body
      // 3) Embedded customId metadata on the PayPal purchaseUnit
      const storedOrder = expectedPayPalOrders.get(orderId);
      const reEvaluatedOrder = resolveTrustedPayPalOrderPrice(req.body || {});
      let customIdMeta: { id?: string; amt?: string; cur?: string } | null = null;
      const rawCustomId =
        captureObj?.customId || result?.purchaseUnits?.[0]?.customId;
      if (typeof rawCustomId === 'string' && rawCustomId.startsWith('{')) {
        try {
          customIdMeta = JSON.parse(rawCustomId);
        } catch (_e) {
          customIdMeta = null;
        }
      }

      const expectedAmountStr =
        storedOrder?.expectedAmount ||
        reEvaluatedOrder?.formattedValue ||
        customIdMeta?.amt;
      const expectedCurrencyStr =
        storedOrder?.expectedCurrency ||
        reEvaluatedOrder?.currencyCode ||
        customIdMeta?.cur ||
        'USD';

      const numericCaptured = Number(capturedAmountValue);
      const numericExpected = Number(expectedAmountStr);

      if (
        !Number.isFinite(numericCaptured) ||
        numericCaptured <= 0 ||
        !Number.isFinite(numericExpected) ||
        numericExpected <= 0 ||
        numericCaptured.toFixed(2) !== numericExpected.toFixed(2) ||
        String(capturedCurrencyCode).toUpperCase() !== String(expectedCurrencyStr).toUpperCase()
      ) {
        console.error('[SECURITY] PayPal Capture Price Mismatch Detected:', {
          orderId,
          capturedAmountValue,
          capturedCurrencyCode,
          expectedAmountStr,
          expectedCurrencyStr,
        });
        return res.status(400).json({
          success: false,
          code: 'PRICE_TAMPERING_DETECTED',
          error: 'Security verification failed: Captured amount does not match the expected server-side price.',
        });
      }

      // Clean up stored order after successful verification
      expectedPayPalOrders.delete(orderId);

      return res.status(statusCode || 200).json({
        success: true,
        id: result.id,
        status: result.status,
        capturedAmount: Number(numericCaptured.toFixed(2)),
        capturedCurrency: expectedCurrencyStr,
        payer: result.payer,
        purchaseUnits: result.purchaseUnits,
        order: result,
      });
    } catch (err: any) {
      console.error('PayPal Capture Order Error:', err);
      const statusCode = err instanceof PayPalApiError ? err.statusCode : 500;
      return res.status(statusCode || 500).json({
        success: false,
        error: err?.result?.message || err?.message || 'Failed to capture PayPal order.',
      });
    }
  });

  // POST /api/paypal/webhook: Handles PayPal Webhook events (e.g., PAYMENT.CAPTURE.COMPLETED)
  app.post('/api/paypal/webhook', async (req: Request, res: Response) => {
    try {
      const transmissionId = req.header('paypal-transmission-id');
      const transmissionTime = req.header('paypal-transmission-time');
      const transmissionSig = req.header('paypal-transmission-sig');
      const certUrl = req.header('paypal-cert-url');
      const authAlgo = req.header('paypal-auth-algo');
      const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';

      const event = req.body;
      if (!event || !event.event_type) {
        return res.status(400).json({ success: false, error: 'Invalid PayPal webhook payload.' });
      }

      // If PAYPAL_WEBHOOK_ID is configured, verify the webhook signature via PayPal REST API
      if (
        webhookId &&
        PAYPAL_CLIENT_ID &&
        PAYPAL_CLIENT_SECRET &&
        transmissionId &&
        transmissionTime &&
        transmissionSig &&
        certUrl &&
        authAlgo
      ) {
        const baseUrl =
          paypalEnvironment === PayPalEnvironment.Production
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        const basicAuth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });

        if (tokenRes.ok) {
          const tokenData = (await tokenRes.json()) as { access_token?: string };
          if (tokenData.access_token) {
            const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                auth_algo: authAlgo,
                cert_url: certUrl,
                transmission_id: transmissionId,
                transmission_sig: transmissionSig,
                transmission_time: transmissionTime,
                webhook_id: webhookId,
                webhook_event: event,
              }),
            });

            const verifyData = (await verifyRes.json()) as { verification_status?: string };
            if (verifyData.verification_status !== 'SUCCESS') {
              return res.status(400).json({
                success: false,
                error: 'PayPal webhook signature verification failed.',
              });
            }
          }
        }
      }

      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const resource = event.resource || {};
        const paypalOrderId =
          resource?.supplementary_data?.related_ids?.order_id || resource?.id;
        console.log(`✅ PayPal Webhook: PAYMENT.CAPTURE.COMPLETED for order ${paypalOrderId}`);
      }

      return res.status(200).json({ received: true, eventType: event.event_type });
    } catch (err: any) {
      console.error('PayPal Webhook Error:', err);
      return res.status(400).json({
        success: false,
        error: err?.message || 'Webhook processing failed.',
      });
    }
  });

  // PATCH & PUT /api/orders/:id: Strictly requires authentication & verifies order ownership (Prevents IDOR)
  const handleUpdateOrder = (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const user = req.user!;
      const isPlatformAdmin = user.role === 'admin';

      if (!status && notes === undefined) {
        return res.status(400).json({ success: false, error: 'Status or notes is required for update.' });
      }

      const sanitizedNotes = notes !== undefined ? sanitizeInput(notes, 500) : undefined;
      const updated = updateOrderStatus(id, status, sanitizedNotes, user.id, isPlatformAdmin);
      if (!updated) {
        return res.status(404).json({ success: false, error: `Order ${id} not found.` });
      }

      return res.json({
        success: true,
        order: updated,
        message: `Order ${id} updated to status: ${status}`,
      });
    } catch (err: any) {
      const statusCode = err.message?.startsWith('Forbidden') ? 403 : 500;
      return res.status(statusCode).json({ success: false, error: err.message });
    }
  };

  app.patch('/api/orders/:id', authMiddleware, handleUpdateOrder);
  app.put('/api/orders/:id', authMiddleware, handleUpdateOrder);

  // Public COD order submission legacy alias endpoint
  app.post('/api/orders/submit', (req: Request, res: Response) => {
    try {
      const {
        pageSlug,
        pageTitle,
        customerName,
        customerPhone,
        customerCity,
        customerAddress,
        customerNotes,
        bundleName,
        bundlePrice,
      } = req.body;

      if (!customerPhone || !customerPhone.trim()) {
        return res.status(400).json({ success: false, error: 'Phone number is required.' });
      }

      const result = recordPageOrder({
        pageSlug: (pageSlug || '').trim(),
        pageTitle,
        customerName: (customerName || 'Customer').trim(),
        customerPhone: customerPhone.trim(),
        customerCity: customerCity?.trim(),
        customerAddress: customerAddress?.trim(),
        customerNotes: customerNotes?.trim(),
        bundleName,
        bundlePrice,
      });

      void sendAdminNotificationEmail(
        `🛒 طلب COD جديد (${result.orderId}) - ${pageTitle || bundleName || 'منتج'}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">تم تسجيل طلب دفع عند الاستلام جديد!</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>🆔 رقم الطلب:</strong> <span dir="ltr">${result.orderId}</span></p>
          <p style="margin: 6px 0;"><strong>📦 العرض / المنتج:</strong> ${bundleName || pageTitle || 'منتج CodWorth'}</p>
          <p style="margin: 6px 0;"><strong>💵 السعر:</strong> ${bundlePrice || 299} MAD</p>
          <p style="margin: 6px 0;"><strong>👤 الزبون:</strong> ${(customerName || 'Customer').trim()}</p>
          <p style="margin: 6px 0;"><strong>📱 الهاتف:</strong> <span dir="ltr">${customerPhone.trim()}</span></p>
          <p style="margin: 6px 0;"><strong>🏙️ المدينة:</strong> ${customerCity || 'غير محدد'}</p>
        </div>
        `
      ).catch((err) => console.error('Admin notification error (submit order):', err));

      return res.json({
        success: true,
        orderId: result.orderId,
        message: 'Order received! Confirmation sent to seller.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public Contact Form Submission -> Sends Admin Notification Email
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const fullName = sanitizeInput(req.body?.fullName, 120);
      const email = sanitizeInput(req.body?.email, 160);
      const subject = sanitizeInput(req.body?.subject || 'استفسار عام', 120);
      const message = sanitizeInput(req.body?.message, 2000);

      if (!fullName || !email || !message) {
        return res.status(400).json({
          success: false,
          error: 'يرجى ملء جميع الحقول المطلوبة.',
        });
      }

      void sendAdminNotificationEmail(
        `📩 رسالة دعم فني جديدة من: ${fullName}`,
        `
        <h3 style="margin: 0 0 14px 0; color: #10b981; font-size: 18px;">رسالة جديدة من صفحة "تواصل معنا"</h3>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 18px;">
          <p style="margin: 6px 0;"><strong>👤 المرسل:</strong> ${fullName}</p>
          <p style="margin: 6px 0;"><strong>📧 البريد الإلكتروني:</strong> <span dir="ltr">${email}</span></p>
          <p style="margin: 6px 0;"><strong>📌 الموضوع:</strong> ${subject}</p>
          <p style="margin: 10px 0 4px 0;"><strong>💬 نص الرسالة:</strong></p>
          <div style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 14px; color: #cbd5e1; white-space: pre-wrap;">${message}</div>
        </div>
        `
      ).catch((err) => console.error('Admin notification error (contact):', err));

      return res.json({
        success: true,
        message: 'تم إرسال رسالتك بنجاح! سيتواصل معك فريق الدعم خلال 24 ساعة.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Public JSON API for live funnel page: GET /api/public/pages/:slug
  app.get('/api/public/pages/:slug', (req: Request, res: Response) => {
    let rawSlug = (req.params.slug || '').trim();
    try {
      rawSlug = decodeURIComponent(rawSlug);
    } catch {
      // Keep rawSlug if URI decoding fails
    }
    const slug = rawSlug.toLowerCase();
    const page = getPublishedPageBySlug(slug);

    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
      });
    }

    incrementPageViews(page.slug || slug);

    const pageData =
      page.data && typeof page.data === 'object'
        ? {
            ...(page.data as Record<string, unknown>),
            id: page.id,
            title: page.title || (page.data as Record<string, unknown>).title || 'Landing Page',
            slug: page.slug,
          }
        : {
            id: page.id,
            title: page.title || 'Landing Page',
            slug: page.slug,
            blocks: [],
          };

    return res.json({
      success: true,
      page,
      data: pageData,
      ...pageData,
      userId: page.userId,
    });
  });

  // Public route /p/:slug: delegate HTML requests to the React SPA so App.tsx renders CustomerLandingPage / CanvasRenderer
  app.get('/p/:slug', (_req: Request, _res: Response, next) => {
    return next();
  });

  /* ---------------- AI LANDING PAGE GENERATION ---------------- */

  app.post('/api/generate-page', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    // If authenticated and on free tier, verify limit
    if (req.user && req.user.subscription_status !== 'active') {
      if (req.user.pages_created_count >= 2) {
        return res.status(403).json({
          success: false,
          error: 'LIMIT_REACHED',
          message: 'Free tier limit reached (2/2 pages used). Upgrade to Pro to generate unlimited pages with AI.',
        });
      }
    }

    const {
      productName = 'Smart Gadget',
      niche = 'Electronics',
      language = 'en',
      targetAudience = 'General consumers',
      offerAngle = '50% Off Flash Sale + Free Cash on Delivery',
    } = req.body;

    const isRtl = language === 'ar';
    const isFrench = language === 'fr';

    try {
      if (process.env.GEMINI_API_KEY) {
        const prompt = `You are a world-class conversion rate optimization (CRO) copywriter and landing page architect specializing in high-converting e-commerce and Cash on Delivery (COD) sales funnels (similar to top stores on Lightfunnels, Framer, and Shopify).

Create a complete landing page JSON schema for this product:
Product Name: "${productName}"
Niche/Category: "${niche}"
Target Language: "${language}" (${isRtl ? 'Moroccan Darija / Arabic RTL' : isFrench ? 'French' : 'English'})
Target Audience: "${targetAudience}"
Offer Angle: "${offerAngle}"

Return ONLY a valid JSON object with: id, title, language, direction, theme, blocks (promo-bar, hero, problem-solution, features, social-proof, cod-form, faq, floating-cta).`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const textOutput = response.text?.trim() || '';
        const parsed = JSON.parse(textOutput) as LandingPageData;
        return res.json({ success: true, data: parsed });
      }
    } catch (err) {
      console.warn('Gemini API call warning, falling back to smart dynamic generator:', err);
    }

    // High quality intelligent template generator fallback
    const fallbackData = createDynamicFallback(productName, niche, language, targetAudience);
    return res.json({ success: true, data: fallbackData });
  });

  /* ---------------- MULTI-LAYER DEEP PRODUCT SCRAPER ENDPOINT ---------------- */

  app.post('/api/scrape-product', async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'Product URL is required.' });
    }

    try {
      const productData = await scrapeProductData(url.trim());
      return res.status(200).json({
        ...productData,
        success: true,
        product: productData,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape product data.';
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  /* ---------------- IMPORT PRODUCT FROM URL (AliExpress, Alibaba, Shopify, YouCan) ---------------- */

  app.post('/api/ai/import-from-url', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
    // If authenticated and on free tier, verify limit
    if (req.user && req.user.subscription_status !== 'active') {
      if (req.user.pages_created_count >= 2) {
        return res.status(403).json({
          success: false,
          error: 'LIMIT_REACHED',
          message: 'Free tier limit reached (2/2 pages used). Upgrade to Pro to import products and generate funnels with AI.',
        });
      }
    }

    const {
      productUrl,
      rawProductData,
      language = 'en',
      offerAngle = '50% OFF Flash Sale + Free Cash on Delivery Worldwide',
    } = req.body;

    if (!productUrl && !rawProductData) {
      return res.status(400).json({ success: false, error: 'Product URL or raw product data is required.' });
    }

    if (productUrl) {
      const urlCheck = validateProductUrl(productUrl);
      if (!urlCheck.isValid) {
        return res.status(400).json({ success: false, error: urlCheck.error });
      }
    }

    try {
      // 1. Scrape product data or construct from raw text
      let scraped: ScrapedProduct;
      if (productUrl) {
        scraped = await scrapeProductFromUrl(productUrl);
      } else {
        const rawText = String(rawProductData || '').trim();
        scraped = {
          platform: 'E-Commerce Store',
          title: rawText.slice(0, 80).replace(/[\r\n]+/g, ' ') || 'Smart Tech Product',
          description: rawText.slice(0, 500),
          price: 249,
          originalPrice: 399,
          currency: language.startsWith('ar') ? 'MAD' : '$',
          images: [
            'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&auto=format&fit=crop&q=80',
          ],
          features: [
            'Precision engineered for durability and high-performance daily use',
            'Instant setup with plug-and-play smart compatibility',
            'Backed by a 1-year replacement warranty and 24/7 support',
          ],
          specifications: [
            { label: 'Technology', value: 'High-Speed Wireless Processing' },
            { label: 'Material', value: 'Aircraft-Grade Anodized Alloy' },
            { label: 'Battery Life', value: 'Up to 12 Hours Runtime' },
          ],
          niche: 'Smart Tech & Electronics',
          rawUrl: 'https://store.com/item/demo',
        };
      }

      const isAr = language === 'ar' || language === 'ar-ma';
      const isFrench = language === 'fr';
      const unitPrice = scraped.price ?? 249;
      const origPrice = scraped.originalPrice ?? Math.round(unitPrice * 1.6);
      const currency = language === 'ar-ma' || language === 'ar' ? 'MAD' : '$';

      // 2. Feed extracted details into Gemini Pro using Master COD Funnel Architect Prompt
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Act as an expert E-commerce Product Analyst, Master Copywriter, and High-Converting COD (Cash on Delivery) Funnel Architect for the Moroccan and Global market.

You are given raw product details, HTML metadata, or text scraped from a product URL. Your task is to deeply analyze this product and generate a complete, structured JSON landing page tree optimized for high conversion rates.

---
### INPUT DATA RECEIVED:
- Product URL/Raw Source: "${scraped.rawUrl}"
- Platform: "${scraped.platform}"
- Scraped Title: "${scraped.title}"
- Scraped Niche: "${scraped.niche}"
- Scraped Description: "${scraped.description}"
- Scraped Specifications: ${JSON.stringify(scraped.specifications)}
- Scraped Features: ${JSON.stringify(scraped.features)}
- Extracted Selling Price: "${unitPrice} ${currency}"
- Extracted Original Price: "${origPrice} ${currency}"
- High-Resolution Images: ${JSON.stringify(scraped.images)}
- Target Language: "${language}" (Options: 'ar-ma' for Moroccan Darija with Arabic script, 'ar' for Classical Arabic, 'fr' for French, 'en' for English)
- Niche/Angle: "${offerAngle || '50% OFF Flash Sale + Free Cash on Delivery'}"

---
### OUTPUT REQUIREMENTS:
Return ONLY a valid JSON object matching this exact schema (no markdown outside JSON, no extra text):
{
  "productName": "Optimized catchy sales title for the product",
  "tagline": "A powerful hook or subheadline addressing customer pain points",
  "heroImages": [
    "Array of extracted or high-resolution product image URLs found in the raw data, plus relevant Unsplash fallback images if needed"
  ],
  "badge": "Urgency badge text (e.g., 'Free Cash on Delivery + 50% Off' or 'توصيل مجاني + الدفع عند الاستلام')",
  "price": {
    "originalPrice": "${origPrice} ${currency}",
    "sellingPrice": "${unitPrice} ${currency}",
    "currency": "${currency}"
  },
  "features": [
    {
      "title": "Feature 1 Title",
      "description": "Detailed explanation of feature 1 and its direct benefit to the buyer",
      "icon": "Zap"
    },
    {
      "title": "Feature 2 Title",
      "description": "Detailed explanation of feature 2 and its direct benefit to the buyer",
      "icon": "Shield"
    },
    {
      "title": "Feature 3 Title",
      "description": "Detailed explanation of feature 3 and its direct benefit to the buyer",
      "icon": "Truck"
    }
  ],
  "problemSolution": {
    "problem": "The main daily pain point the customer faces without this product",
    "solution": "How this product acts as an instant, magical solution"
  },
  "specifications": [
    {
      "label": "Material / Size / Color / Specs",
      "value": "Extracted exact value from product data"
    }
  ],
  "faq": [
    {
      "question": "Common objection or question (e.g., shipping time, inspection before payment, guarantee)",
      "answer": "Reassuring, trust-building answer optimized for COD buyers"
    }
  ],
  "codFormConfig": {
    "title": "Claim Your Discount & Pay on Delivery",
    "buttonText": "Confirm Order (Cash on Delivery)"
  }
}

---
### CRITICAL INSTRUCTIONS:
1. Deeply extract all specifications, dimensions, materials, and technical specs mentioned in the raw source.
2. If specific images are sparse, include high-res context-aware image URLs from the scraped images array.
3. Generate a rich FAQ section containing at least 4 objections commonly raised by COD buyers (shipping time, payment on delivery assurance, quality guarantee, warranty/returns).
4. Ensure the copy is persuasive, highly engaging, and tailored to the chosen language (${language}).`;

          let response;
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.1-pro-preview',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            });
          } catch (modelErr) {
            console.warn('gemini-3.1-pro-preview unavailable, falling back to gemini-3.8-flash:', modelErr);
            response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            });
          }

          const textOutput = response.text?.trim() || '';
          const analystData = JSON.parse(textOutput) as CodArchitectAnalysis;

          // Translate into FunnelCraft's canvas block schema
          const pageData = mapAnalystToLandingPageData(analystData, language, scraped);
          return res.json({
            success: true,
            data: pageData,
            architectAnalysis: analystData,
            extractedMeta: scraped,
          });
        } catch (aiErr) {
          console.warn('Gemini architect call warning, using intelligent adapter fallback:', aiErr);
        }
      }

      // 3. Fallback: Generate intelligent default architect analysis and map to page tree
      const fallbackAnalyst = buildDefaultArchitectAnalysis(scraped, language, unitPrice, origPrice, currency);
      const fallbackPageData = mapAnalystToLandingPageData(fallbackAnalyst, language, scraped);

      return res.json({
        success: true,
        data: fallbackPageData,
        architectAnalysis: fallbackAnalyst,
        extractedMeta: scraped,
      });
    } catch (err: any) {
      console.error('Import from URL error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to import and parse product from URL. Please verify the URL.',
      });
    }
  });

  // Custom Domain Routing Middleware (Checks mapped custom domains for live funnels)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawHost = (req.headers.host || '').split(':')[0].toLowerCase();
    const ignoredHosts = ['localhost', '127.0.0.1', '0.0.0.0', 'funnelcraft.ma', 'codworth.me', 'www.codworth.me'];
    const isSpecialHost = ignoredHosts.includes(rawHost) || rawHost.includes('ais-') || rawHost.includes('.run.app');

    if (!isSpecialHost && req.path === '/') {
      const page = getPublishedPageByDomain(rawHost);
      if (page && page.isPublished) {
        incrementPageViews(page.slug);
        let htmlContent = page.compiledHtml;
        if (!htmlContent && page.data) {
          htmlContent = generateStandaloneHtml({
            ...page.data,
            slug: page.slug,
          });
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);
      }
    }
    next();
  });

  // Serve with Vite in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  ensureDataFiles();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodWorth Builder & Billing Server running on http://0.0.0.0:${PORT}`);
  });
}

function createDynamicFallback(
  productName: string,
  niche: string,
  lang: string,
  _audience: string
): LandingPageData {
  const isAr = lang === 'ar';
  const isFr = lang === 'fr';

  if (isAr) {
    return {
      id: `ai-gen-${Date.now()}`,
      title: `${productName} - العرض الخاص والدفع عند الاستلام`,
      language: 'ar',
      direction: 'rtl',
      theme: {
        primaryColor: '#059669',
        secondaryColor: '#a7f3d0',
        accentColor: '#d97706',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        fontFamily: 'Cairo',
        fontSize: 'base',
        borderRadius: 'lg',
        sectionSpacing: 'normal',
      },
      blocks: [
        {
          id: 'p-1',
          type: 'promo-bar',
          text: `🔥 عرض التخفيض الحصري لمنتج ${productName}: خصم 50% والشحن مجاني حتى باب منزلك!`,
          countdownMinutes: 15,
          showTimer: true,
          stockWarning: 'سارع بالطلب، لم يتبق سوى 7 قطع في المخزون!',
          bgColor: '#064e3b',
          textColor: '#ffffff',
          isSticky: true,
        },
        {
          id: 'h-1',
          type: 'hero',
          badge: '⭐ المنتج الأكثر طلباً وتقييماً لعام 2026',
          headline: `الحل النهائي والفعال: احصل على ${productName} بجودة فائقة ونتائج مضمونة`,
          subheadline: `وداعاً للمنتجات المقلدة والوعود الزائفة. اطلب الآن واستلم طردك خلال 24-48 ساعة، ولن تدفع أي درهم حتى تتأكد من سلامة المنتج بنفسك!`,
          priceOriginal: 499,
          priceDiscounted: 249,
          currency: 'MAD',
          ctaText: 'اطلب الآن - الدفع نقداً عند الاستلام',
          ctaSubtext: '📦 شحن سريع ومجاني • 💵 الدفع عند الباب • 🛡️ ضمان الرضا 30 يوماً',
          images: [
            'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
          ],
          rating: 4.9,
          reviewCount: 3120,
          trustPoints: [
            'جودة أصلية ومصنعة وفق أعلى المعايير العالمية',
            'نتائج سريعة وملموسة من الأيام الأولى للاستخدام',
            'ضمان استرجاع الأموال واستبدال فوري في حال أي عيب',
          ],
        },
        {
          id: 'ps-1',
          type: 'problem-solution',
          title: `لماذا يعتبر ${productName} خيارك الأمثل؟`,
          subtitle: 'مقارنة حقيقية بين الطرق القديمة والحل الذكي الجديد',
          problemTitle: 'الحلول التقليدية في السوق',
          problemItems: [
            'تكلفة مادية مرتفعة مع نتائج غير دائمة',
            'صعوبة في الاستخدام وإهدار الكثير من الوقت والجهد',
            'مخاطرة الدفع الإلكتروني المسبق بالبطاقة البنكية',
          ],
          solutionTitle: `مع ${productName}`,
          solutionItems: [
            'تصميم عصري متطور وسهل الاستخدام للجميع',
            'نتائج احترافية في وقت قياسي وموفر للمال',
            'الدفع كاش عند الاستلام والمعاينة التامة للمنتج',
          ],
          highlightBadge: 'أكثر من 15,000 عميل راضٍ',
        },
        {
          id: 'cod-1',
          type: 'cod-form',
          title: 'استمارة تأكيد الطلب السريع (الدفع عند الاستلام)',
          subtitle: 'أدخل معلوماتك بدقة، وسيتصل بك فريقنا لتأكيد موعد التسليم.',
          currency: 'MAD',
          shippingCost: 0,
          guaranteeText: 'الدفع عند المعاينة والاستلام مع الموزع.',
          buttonText: 'تأكيد طلبي الآن (الدفع عند الاستلام)',
          bundles: [
            {
              id: 'b-1',
              name: 'قطعة واحدة (عرض البداية)',
              quantity: 1,
              price: 249,
              originalPrice: 499,
              badge: 'خصم 50%',
              popular: false,
            },
            {
              id: 'b-2',
              name: 'قطعتين (العرض الأكثر توفيراً)',
              quantity: 2,
              price: 399,
              originalPrice: 998,
              badge: 'الأكثر طلباً - وفر 600 درهم',
              popular: true,
            },
          ],
          fields: {
            requireAddress: true,
            requireCity: true,
            requireNote: true,
            defaultCities: ['الدار البيضاء', 'الرباط', 'مراكش', 'طنجة', 'فاس', 'أكادير'],
          },
        },
        {
          id: 'fl-1',
          type: 'floating-cta',
          title: productName,
          priceText: '249 درهم (خصم 50%)',
          buttonText: 'اطلب الآن (الدفع عند الاستلام)',
          timerText: '14:59',
          showOnMobileOnly: true,
        },
      ],
    };
  }

  if (isFr) {
    return {
      id: `ai-gen-${Date.now()}`,
      title: `${productName} - Offre Spéciale COD`,
      language: 'fr',
      direction: 'ltr',
      theme: {
        primaryColor: '#0284c7',
        secondaryColor: '#bae6fd',
        accentColor: '#10b981',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        fontFamily: 'Inter',
        fontSize: 'base',
        borderRadius: 'md',
        sectionSpacing: 'normal',
      },
      blocks: [
        {
          id: 'p-fr-1',
          type: 'promo-bar',
          text: `⚡ PROMOTION FLASH : -50% SUR ${productName.toUpperCase()} + LIVRAISON GRATUITE & PAIEMENT À LA LIVRAISON !`,
          countdownMinutes: 15,
          showTimer: true,
          stockWarning: 'Stock limité : 6 unités restantes !',
          bgColor: '#0f172a',
          textColor: '#ffffff',
          isSticky: true,
        },
        {
          id: 'h-fr-1',
          type: 'hero',
          badge: '🏆 #1 CHOIX DES EXPERTS EN 2026',
          headline: `Découvrez la puissance et l'efficacité de ${productName}`,
          subheadline: `La solution incontournable pour votre quotidien dans le domaine ${niche}. Ne payez rien d'avance : vous réglez en espèces à la livraison après avoir inspecté votre colis.`,
          priceOriginal: 89.99,
          priceDiscounted: 44.99,
          currency: 'EUR',
          ctaText: 'Commander (Paiement à la Livraison)',
          ctaSubtext: '🚚 Livraison express 24/48h • 📦 Paiement à la réception • 🛡️ Garantie 30 jours',
          images: [
            'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
          ],
          rating: 4.9,
          reviewCount: 1840,
          trustPoints: [
            'Technologie innovante et ergonomique',
            'Résultats immédiats et durables',
            'Paiement sécurisé en espèces à votre porte',
          ],
        },
        {
          id: 'cod-fr-1',
          type: 'cod-form',
          title: 'Formulaire de Commande Express (Paiement à la Livraison)',
          subtitle: 'Remplissez vos coordonnées pour recevoir votre colis.',
          currency: 'EUR',
          shippingCost: 0,
          guaranteeText: 'Paiement en espèces à réception. Zéro risque.',
          buttonText: 'CONFIRMER MA COMMANDE (PAYER AU LIVREUR)',
          bundles: [
            {
              id: 'b-fr-1',
              name: `1x ${productName}`,
              quantity: 1,
              price: 44.99,
              originalPrice: 89.99,
              badge: 'Économisez 50%',
              popular: false,
            },
            {
              id: 'b-fr-2',
              name: `2x ${productName} (Duo Pack)`,
              quantity: 2,
              price: 69.99,
              originalPrice: 179.98,
              badge: 'LE PLUS VENDU',
              popular: true,
            },
          ],
          fields: {
            requireAddress: true,
            requireCity: true,
            requireNote: true,
            defaultCities: ['Paris', 'Lyon', 'Marseille', 'Bruxelles', 'Genève'],
          },
        },
        {
          id: 'fl-fr-1',
          type: 'floating-cta',
          title: productName,
          priceText: '44,99 € (-50%)',
          buttonText: 'Commander (Paiement à la Livraison)',
          timerText: '14:59',
          showOnMobileOnly: true,
        },
      ],
    };
  }

  // English default
  return {
    id: `ai-gen-${Date.now()}`,
    title: `${productName} - High Performance Flash Sale`,
    language: 'en',
    direction: 'ltr',
    theme: {
      primaryColor: '#10b981',
      secondaryColor: '#d1fae5',
      accentColor: '#f59e0b',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      fontFamily: 'Poppins',
      fontSize: 'base',
      borderRadius: 'md',
      sectionSpacing: 'normal',
    },
    blocks: [
      {
        id: 'p-en-1',
        type: 'promo-bar',
        text: `🔥 FLASH SALE: 50% OFF ON ${productName.toUpperCase()} + FREE CASH ON DELIVERY!`,
        countdownMinutes: 15,
        showTimer: true,
        stockWarning: '⚡ Only 8 units left in warehouse stock!',
        bgColor: '#111827',
        textColor: '#ffffff',
        isSticky: true,
      },
      {
        id: 'h-en-1',
        type: 'hero',
        badge: '🏆 #1 RATED INNOVATION 2026',
        headline: `Experience the Ultimate Upgrade with ${productName}`,
        subheadline: `Engineered specifically for superior ${niche} performance. No credit card required: pay in cash only when your order arrives at your door!`,
        priceOriginal: 99.99,
        priceDiscounted: 49.99,
        currency: 'USD',
        ctaText: 'Claim 50% Off & Pay on Delivery',
        ctaSubtext: '🚚 Free Express Shipping • 📦 Cash on Delivery • 🛡️ 30-Day Money Back',
        images: [
          'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
        ],
        rating: 4.9,
        reviewCount: 2840,
        trustPoints: [
          'Premium commercial-grade build quality',
          'Fast visible results with zero hassle',
          '100% Cash on Delivery protection',
        ],
      },
      {
        id: 'ps-en-1',
        type: 'problem-solution',
        title: `Why Traditional Alternatives Fail You`,
        subtitle: `See how ${productName} outperforms older generic alternatives`,
        problemTitle: 'Standard Market Solutions',
        problemItems: [
          'High prices with subpar performance and low durability',
          'Requires upfront card payments with suspicious recurring fees',
          'Complicated to use and lacks dedicated customer support',
        ],
        solutionTitle: `With ${productName}`,
        solutionItems: [
          'Precision engineered with top-tier materials',
          '100% Cash on Delivery payment option at your doorstep',
          '30-day money-back guarantee with zero return hassle',
        ],
        highlightBadge: 'Trusted by over 20,000 customers',
      },
      {
        id: 'cod-en-1',
        type: 'cod-form',
        title: 'Fast Cash on Delivery Checkout',
        subtitle: 'Fill out your shipping information. Our agent will verify your order before dispatch.',
        currency: 'USD',
        shippingCost: 0,
        guaranteeText: 'Zero risk: inspect your order prior to payment.',
        buttonText: 'CONFIRM MY ORDER (PAY ON ARRIVAL)',
        bundles: [
          {
            id: 'b-en-1',
            name: `1x ${productName}`,
            quantity: 1,
            price: 49.99,
            originalPrice: 99.99,
            badge: '50% OFF',
            popular: false,
          },
          {
            id: 'b-en-2',
            name: `2x ${productName} (Popular Value Pack)`,
            quantity: 2,
            price: 79.99,
            originalPrice: 199.98,
            badge: 'BUY 1 GET 2ND 40% OFF - MOST POPULAR',
            popular: true,
          },
        ],
        fields: {
          requireAddress: true,
          requireCity: true,
          requireNote: true,
          defaultCities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
        },
      },
      {
        id: 'fl-en-1',
        type: 'floating-cta',
        title: productName,
        priceText: '$49.99 (Save 50%)',
        buttonText: 'Order Now (Pay on Delivery)',
        timerText: '14:59',
        showOnMobileOnly: true,
      },
    ],
  };
}

export interface CodArchitectAnalysis {
  productName: string;
  tagline: string;
  heroImages: string[];
  badge: string;
  price: {
    originalPrice: string | number;
    sellingPrice: string | number;
    currency: string;
  };
  features: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  problemSolution: {
    problem: string;
    solution: string;
  };
  specifications: Array<{
    label: string;
    value: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  codFormConfig?: {
    title: string;
    buttonText: string;
  };
}

export function mapAnalystToLandingPageData(
  analyst: CodArchitectAnalysis,
  language: string,
  scraped: ScrapedProduct
): LandingPageData {
  const isRtl = language === 'ar' || language === 'ar-ma';
  const cleanSellingPrice =
    typeof analyst.price?.sellingPrice === 'number'
      ? analyst.price.sellingPrice
      : parseInt(String(analyst.price?.sellingPrice || '').replace(/[^\d]/g, ''), 10) || scraped.price || 249;
  const cleanOrigPrice =
    typeof analyst.price?.originalPrice === 'number'
      ? analyst.price.originalPrice
      : parseInt(String(analyst.price?.originalPrice || '').replace(/[^\d]/g, ''), 10) ||
        scraped.originalPrice ||
        Math.round(cleanSellingPrice * 1.6);
  const currency = analyst.price?.currency || (isRtl ? 'MAD' : '$');

  const images =
    analyst.heroImages && analyst.heroImages.length > 0
      ? analyst.heroImages
      : scraped.images && scraped.images.length > 0
      ? scraped.images
      : [
          'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
        ];

  const features =
    analyst.features && analyst.features.length > 0
      ? analyst.features.map((f) => ({
          icon: f.icon || 'Sparkles',
          title: f.title,
          description: f.description,
        }))
      : [
          {
            icon: 'Zap',
            title: isRtl ? 'أداء فائق ونتائج فورية' : 'High Performance',
            description: isRtl ? 'تقنية متطورة تمنحك النتائج من أول استعمال' : 'Engineered for instant, reliable daily use',
          },
          {
            icon: 'Shield',
            title: isRtl ? 'جودة أصلية وضمان كامل' : 'Certified Quality',
            description: isRtl ? 'منتج أصلي مع ضمان استبدال مجاني' : 'Backed by an official replacement warranty',
          },
          {
            icon: 'Truck',
            title: isRtl ? 'شحن سريع ودفع عند الاستلام' : 'Fast COD Delivery',
            description: isRtl ? 'توصيل لباب منزلك مع فحص الطرد قبل الدفع' : 'Inspect your package before payment',
          },
        ];

  const faqs =
    analyst.faq && analyst.faq.length > 0
      ? analyst.faq.map((item, idx) => ({
          id: `faq-${idx + 1}`,
          question: item.question,
          answer: item.answer,
        }))
      : [
          {
            id: 'faq-1',
            question: isRtl ? 'متى سأستلم طلبي؟' : 'When will I receive my order?',
            answer: isRtl ? 'التوصيل يتم خلال 24 إلى 48 ساعة لباب منزلك.' : 'Fast delivery within 24 to 48 hours to your doorstep.',
          },
          {
            id: 'faq-2',
            question: isRtl ? 'كيف يتم الدفع؟' : 'How does payment work?',
            answer: isRtl ? 'الدفع نقداً عند الاستلام بعد معاينة الطرد والتأكد من الجودة.' : 'You pay cash upon delivery only after inspecting your item.',
          },
          {
            id: 'faq-3',
            question: isRtl ? 'هل يوجد ضمان؟' : 'Is there a warranty?',
            answer: isRtl ? 'نعم، ضمان كامل لمدة 12 شهراً مع استبدال مجاني في حال وجود عيب.' : 'Full 12-month replacement warranty included.',
          },
        ];

  return {
    id: `funnel-${Date.now()}`,
    title: analyst.productName || scraped.title || 'Product Funnel',
    language: isRtl ? 'ar' : language === 'fr' ? 'fr' : 'en',
    direction: isRtl ? 'rtl' : 'ltr',
    theme: {
      primaryColor: '#059669',
      secondaryColor: '#a7f3d0',
      accentColor: '#d97706',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      fontFamily: isRtl ? 'Cairo' : 'Inter',
      fontSize: 'base',
      borderRadius: 'lg',
      sectionSpacing: 'normal',
    },
    blocks: [
      {
        id: 'p-1',
        type: 'promo-bar',
        text: isRtl
          ? `🔥 عرض خاص: خصم 50% + الشحن مجاني والدفع عند الاستلام!`
          : `🔥 Flash Sale: 50% OFF + Free Cash on Delivery Nationwide!`,
        countdownMinutes: 15,
        showTimer: true,
        stockWarning: isRtl ? 'الكمية المتبقية في المستودع محدودة!' : 'Hurry! Limited stock remaining in warehouse.',
        bgColor: '#064e3b',
        textColor: '#ffffff',
        isSticky: true,
      },
      {
        id: 'h-1',
        type: 'hero',
        badge: analyst.badge || (isRtl ? '⭐ المنتج الأكثر طلباً وتقييماً' : '⭐ Best Seller 2026'),
        headline: analyst.productName || scraped.title,
        subheadline:
          analyst.tagline ||
          (isRtl
            ? 'اطلب الآن واستفد من التوصيل المجاني والدفع عند الاستلام'
            : 'Order now with free doorstep cash-on-delivery and money-back guarantee'),
        priceOriginal: cleanOrigPrice,
        priceDiscounted: cleanSellingPrice,
        currency,
        images,
        ctaText: isRtl ? 'اضغط هنا للطلب والدفع عند الاستلام 🚚' : 'Claim Offer & Pay on Delivery 🚚',
        ctaSubtext: isRtl ? 'توصيل مجاني وسريع لجميع المدن' : 'Free inspection before payment',
        rating: 4.9,
        reviewCount: 420,
        trustPoints: isRtl
          ? ['دفع عند الاستلام', 'معاينة قبل الأداء', 'ضمان 12 شهر']
          : ['Pay on Delivery', 'Inspect Before Paying', '1-Year Warranty'],
      },
      {
        id: 'ps-1',
        type: 'problem-solution',
        title: isRtl ? 'لماذا تحتاج هذا المنتج؟' : 'Why You Need This Product',
        subtitle: isRtl ? 'الحل الجذري للمشاكل اليومية' : 'The ultimate solution to common daily frustrations',
        problemTitle: isRtl ? 'المعاناة والعيوب السابقة' : 'Common Frustrations',
        problemItems: analyst.problemSolution?.problem
          ? [analyst.problemSolution.problem]
          : [
              isRtl ? 'منتجات مقلدة وسريعة التلف' : 'Low quality knock-offs that break easily',
              isRtl ? 'أسعار باهظة بدون أي ضمان فعلي' : 'Overpriced products without genuine warranties',
            ],
        solutionTitle: isRtl ? 'الحل الحقيقي والمثالي' : 'The Smart Solution',
        solutionItems: analyst.problemSolution?.solution
          ? [analyst.problemSolution.solution]
          : [
              isRtl ? 'جودة ممتازة تم اختبارها بعناية' : 'Durable, tested commercial-grade engineering',
              isRtl ? 'توفير فوري للمال والوقت والجهد' : 'Saves hours of time and daily hassle',
            ],
        highlightBadge: isRtl ? 'حل مجرب ومضمون' : 'Proven Breakthrough',
      },
      {
        id: 'f-1',
        type: 'features',
        title: isRtl ? 'المميزات والمواصفات المبتكرة' : 'Key Features & Capabilities',
        subtitle: isRtl ? 'صمم خصيصاً لراحتك واستخدامك اليومي' : 'Engineered for exceptional daily reliability',
        layout: 'grid-3',
        items: features,
      },
      {
        id: 'c-1',
        type: 'cod-form',
        title:
          analyst.codFormConfig?.title ||
          (isRtl ? 'أدخل معلوماتك وتأكيد الطلب الآن' : 'Enter Shipping Details & Confirm Order'),
        subtitle: isRtl ? 'الدفع لا يتم إلا عند استلام الطرد وفحصه بنفسك' : 'Cash on delivery — pay only after you inspect your parcel',
        currency,
        shippingCost: 0,
        guaranteeText: isRtl ? 'ضمان 14 يوماً مع إمكانية المعاينة قبل الدفع' : '14-Day Money-Back Guarantee & Free Inspection',
        buttonText:
          analyst.codFormConfig?.buttonText ||
          (isRtl ? 'تأكيد الطلب والدفع عند الاستلام ➔' : 'Confirm Order & Pay on Delivery ➔'),
        fields: {
          requireAddress: true,
          requireCity: true,
          requireNote: false,
          defaultCities: isRtl
            ? ['الدار البيضاء', 'الرباط', 'مراكش', 'طنجة', 'فاس', 'أكادير']
            : ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
        },
        bundles: [
          {
            id: 'b-1',
            name: isRtl ? 'قطعة واحدة (عرض قياسي)' : '1 Unit (Standard Edition)',
            quantity: 1,
            price: cleanSellingPrice,
            originalPrice: cleanOrigPrice,
            popular: false,
          },
          {
            id: 'b-2',
            name: isRtl ? 'قطعتين (خصم 15% + شحن مجاني)' : '2 Units (Save 15% + Free Shipping)',
            quantity: 2,
            price: Math.round(cleanSellingPrice * 1.7),
            originalPrice: Math.round(cleanOrigPrice * 2),
            popular: true,
            badge: isRtl ? 'الأكثر طلباً' : 'Best Value',
          },
          {
            id: 'b-3',
            name: isRtl ? '3 قطع (باقة العائلة - خصم 25%)' : '3 Units (Family Pack - Save 25%)',
            quantity: 3,
            price: Math.round(cleanSellingPrice * 2.3),
            originalPrice: Math.round(cleanOrigPrice * 3),
            popular: false,
          },
        ],
      },
      {
        id: 'faq-1',
        type: 'faq',
        title: isRtl ? 'الأسئلة الشائعة حول الطلب والتوصيل' : 'Frequently Asked Questions',
        subtitle: isRtl ? 'كل ما تحتاج لمعرفته قبل إتمام الطلب' : 'Everything you need to know about delivery and payment',
        items: faqs,
      },
      {
        id: 'cta-float',
        type: 'floating-cta',
        title: isRtl ? `🔥 اطلب الآن والدفع عند الاستلام` : `🔥 Order Now & Pay on Delivery`,
        priceText: `${cleanSellingPrice} ${currency}`,
        buttonText: isRtl ? 'اطلب الآن' : 'Order Now',
        timerText: isRtl ? 'ينتهي العرض قريباً' : 'Special Offer Ends Soon',
        showOnMobileOnly: true,
      },
    ],
  };
}

export function buildDefaultArchitectAnalysis(
  scraped: ScrapedProduct,
  language: string,
  unitPrice: number,
  origPrice: number,
  currency: string
): CodArchitectAnalysis {
  const isRtl = language === 'ar' || language === 'ar-ma';
  return {
    productName: scraped.title,
    tagline: isRtl
      ? 'الحل المتكامل لراحتك اليومية بجودة ممتازة وضمان استبدال'
      : 'High-performance engineering designed for effortless everyday use',
    heroImages: scraped.images,
    badge: isRtl ? 'توصيل مجاني + الدفع عند الاستلام' : 'Free Doorstep Delivery + Pay on Arrival',
    price: {
      originalPrice: `${origPrice} ${currency}`,
      sellingPrice: `${unitPrice} ${currency}`,
      currency,
    },
    features: (scraped.features || []).map((f, i) => ({
      title: isRtl ? `ميزة استثنائية ${i + 1}` : `Key Advantage ${i + 1}`,
      description: f,
      icon: i === 0 ? 'Zap' : i === 1 ? 'Shield' : 'Truck',
    })),
    problemSolution: {
      problem: isRtl
        ? 'المعاناة من المنتجات الرديئة والمشاكل المتكررة دون نتائج حقيقية'
        : 'Dealing with fragile, unreliable alternatives that fail when you need them most',
      solution: isRtl
        ? 'تصميم مطور يقدم حلاً فورياً ودائماً بكفاءة عالية'
        : 'Engineered with premium materials for instant, dependable performance',
    },
    specifications: scraped.specifications || [],
    faq: [
      {
        question: isRtl ? 'واش كاين توصيل لجميع المدن؟' : 'Do you ship to all locations?',
        answer: isRtl ? 'نعم، التوصيل مجاني لجميع المدن والقرى خلال 24-48 ساعة.' : 'Yes, free express shipping is provided nationwide within 24-48 hours.',
      },
      {
        question: isRtl ? 'كيفاش كنتأكد من الجودة قبل ما نخلص؟' : 'How does Cash on Delivery work?',
        answer: isRtl ? 'الموزع يمنحك حق فتح ومعاينة الطرد بنفسك قبل دفع أي درهم.' : 'The delivery courier lets you inspect the parcel before paying.',
      },
      {
        question: isRtl ? 'واش كاين ضمان في حال وجود مشكل؟' : 'What is the return & warranty policy?',
        answer: isRtl ? 'نعم، ضمان استبدال مجاني كامل لمدة 12 شهراً.' : 'We include a full 12-month replacement guarantee.',
      },
      {
        question: isRtl ? 'كيفاش نطلب؟' : 'How do I place an order?',
        answer: isRtl ? 'فقط املأ استمارة الطلب برقم هاتفك وعنوانك وسنتصل بك للتأكيد.' : 'Simply submit the short form below and our logistics team will call to confirm.',
      },
    ],
    codFormConfig: {
      title: isRtl ? 'اطلب الآن واستفد من التوصيل المجاني' : 'Claim Your Discount & Pay on Delivery',
      buttonText: isRtl ? 'أكد طلبك الآن (الدفع عند الاستلام)' : 'Confirm Order (Cash on Delivery)',
    },
  };
}

startServer();
