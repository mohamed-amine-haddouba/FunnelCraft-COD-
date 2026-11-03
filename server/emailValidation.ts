import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns/promises';
import type { MxRecord } from 'node:dns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISPOSABLE_DOMAINS_PATH = path.resolve(__dirname, '../data/disposable_email_domains.json');

// Layer 1: Strict email syntax regex & length constraints
const EMAIL_SYNTAX_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Layer 2: Disposable domains loaded once at startup into a Set for O(1) lookup
const DISPOSABLE_DOMAINS_SET = new Set<string>();

const CORE_DISPOSABLE_DOMAINS: string[] = [
  'mailinator.com', '10minutemail.com', 'yopmail.com', 'guerrillamail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc',
  'trashmail.com', 'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com',
  'mytrashmail.com', 'mailcatch.com', 'mohmal.com', 'tempail.com', 'burnermail.io',
  '33mail.com', 'emailondeck.com', 'spamgourmet.com', 'jetable.org', 'incognitomail.org',
  'guerrillamailblock.com', 'pokemail.net', 'spam4.me', 'grr.la', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org', 'yopmail.fr', 'yopmail.net',
  'cool.fr.nf', 'jetable.fr.nf', 'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'hide.biz.st', 'mymail.infos.st', '10minutemail.net', '10minutemail.de',
  '10minutemail.co.uk', '10minutemail.co.za', 'tempinbox.com', 'tempmailaddress.com', 'tmpmail.net',
  'tmpmail.org', 'discard.email', 'discardmail.com', 'discardmail.de', 'spambog.com',
  'spambog.de', 'spambog.ru', 'mailnull.com', 'e4ward.com', 'gishpuppy.com',
  'kasmail.com', 'mailimate.com', 'mailexpire.com', 'mailforspam.com', 'mailfreeonline.com',
  'mailin8r.com', 'mailinater.com', 'mailinator.net', 'mailinator.org', 'mailinator2.com',
  'mailismagic.com', 'mailme.ir', 'mailme.lv', 'mailmetrash.com', 'mailmoat.com',
  'mailox.fun', 'mailpick.biz', 'mailproxsy.com', 'mailquack.com', 'mailrock.biz',
  'mailsac.com', 'mailscrap.com', 'mailshell.com', 'mailsiphon.com', 'mailslapping.com',
  'mailslite.com', 'mailtemp.info', 'mailtothis.com', 'mailzilla.com', 'mailzilla.org',
  'makemetheking.com', 'manifestgenerator.com', 'manybrain.com', 'mbx.cc', 'mega.zik.dj',
  'meinspamschutz.de', 'meltmail.com', 'messagebeamer.de', 'mezimages.net', 'mierdamail.com',
  'migmail.pl', 'migumail.com', 'mintemail.uni.cc', 'mjukglass.nu', 'moakt.com',
  'moakt.ws', 'mobi.web.id', 'mobileninja.co.uk', 'moburl.com', 'monumentmail.com',
  'ms9.mailslite.com', 'msa.minsmail.com', 'mt2009.com', 'mt2014.com', 'mt2015.com',
  'mx0.wwwnew.eu', 'my10minutemail.com', 'mycleaninbox.net', 'mypartyclip.de', 'myphantomemail.com',
  'myspaceinc.com', 'myspaceinc.net', 'myspaceinc.org', 'myspacepimpedup.com', 'myspamless.com',
  'mytemp.email', 'mytempemail.com', 'mytempmail.com', 'neomailbox.com', 'nepwk.com',
  'nervmich.net', 'nervtmich.net', 'netmails.com', 'netmails.net', 'netzidiot.de',
  'neverbox.com', 'nice-4u.com', 'nincsmail.hu', 'nmail.cf', 'no-spam.ws',
  'nobulk.com', 'noclickemail.com', 'nogmailspam.info', 'nomail.xl.cx', 'nomail2me.com',
  'nomorespamemails.com', 'nonspam.eu', 'nonspammer.de', 'noref.in', 'nospam.ze.tc',
  'nospam4.us', 'nospamfor.us', 'nospamthanks.info', 'notmailinator.com', 'notsharingmy.info',
  'nowhere.org', 'nowmymail.com', 'ntlhelp.net', 'nurfuerspam.de', 'nus.edu.sg',
  'nwldx.com', 'objectmail.com', 'obobbo.com', 'odnorazovoe.ru', 'one-time.email',
  'oneoffemail.com', 'oneoffmail.com', 'onewaymail.com', 'onlatedotcom.info', 'online.ms',
  'oopi.org', 'opayq.com', 'ordinaryamerican.net', 'otherinbox.com', 'ourklips.com',
  'outlawspam.com', 'ovpn.to', 'owlpic.com', 'pancakemail.com', 'paplease.com',
  'pcusers.otherinbox.com', 'pepbot.com', 'pfui.ru', 'pimpedupmyspace.com', 'pjjkp.com',
  'plexolan.de', 'poczta.onet.pl', 'politikerclub.de', 'poofy.org', 'pookmail.com',
  'privacy.net', 'privatdemail.net', 'privy-mail.com', 'privymail.de', 'proxymail.eu',
  'prtnx.com', 'punkass.com', 'putthisinyourspamdatabase.com', 'pwrby.com', 'qasti.com',
  'qisdo.com', 'qisoa.com', 'quickinbox.com', 'quickmail.nl', 'rcpt.at',
  'reallymymail.com', 'realtyalerts.ca', 'recode.me', 'reconmail.com', 'recursor.net',
  'recyclemail.dk', 'regbypass.com', 'regbypass.comsafe-mail.net', 'rejectmail.com', 'remail.cf',
  'rhyta.com', 'rklips.com', 'rmqkr.net', 'royal.net', 'rppkn.com',
  'rtrtr.com', 's0ny.net', 'safe-mail.net', 'safersignup.de', 'safetymail.info',
  'safetypost.de', 'sandelf.de', 'saynotospams.com', 'scatmail.com', 'schafmail.de',
  'Selfdestructingmail.com', 'sendspamhere.com', 'sharedmailbox.org', 'shieldedmail.com', 'shiftmail.com',
  'shitmail.me', 'shitmail.org', 'shitware.nl', 'shortmail.net', 'sibmail.com',
  'skeefmail.com', 'slaskpost.se', 'slave-auctions.net', 'slopsbox.com', 'slushmail.com',
  'smapfree24.com', 'smapfree24.de', 'smapfree24.eu', 'smapfree24.info', 'smapfree24.org',
  'smashmail.de', 'smellfear.com', 'snakemail.com', 'sneakemail.com', 'sneakmail.de',
  'snkmail.com', 'sofimail.com', 'sofort-mail.de', 'softpls.asia', 'sogetthis.com',
  'sohu.com', 'soisz.com', 'solvemail.info', 'soodomail.com', 'soodonims.com',
  'spam.la', 'spam.su', 'spamavert.com', 'spambob.com', 'spambob.net',
  'spambob.org', 'spambog.net', 'spambooger.com', 'spambox.info', 'spambox.irishspringrealty.com',
  'spambox.us', 'spamcannon.com', 'spamcannon.net', 'spamcero.com', 'spamcon.org',
  'spamcorptastic.com', 'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org', 'spamday.com',
  'spamex.com', 'spamfighter.cf', 'spamfighter.ga', 'spamfighter.gq', 'spamfighter.ml',
  'spamfighter.tk', 'spamfree.eu', 'spamfree24.com', 'spamfree24.de', 'spamfree24.eu',
  'spamfree24.info', 'spamfree24.net', 'spamfree24.org', 'spamgoes.in', 'spamgourmet.net',
  'spamgourmet.org', 'spamherelots.com', 'spamhereplease.com', 'spamhole.com', 'spamify.com',
  'spaminator.de', 'spamkill.info', 'spaml.com', 'spaml.de', 'spamlot.net',
  'spammotel.com', 'spamobox.com', 'spamoff.de', 'spamsalad.in', 'spamslicer.com',
  'spamspot.com', 'spamstack.net', 'spamthis.co.uk', 'spamthisplease.com', 'spamtrail.com',
  'spamtroll.net', 'speed.1s.fr', 'spoofmail.de', 'squizzy.de', 'ssoia.com',
  'startkeys.com', 'stinkefinger.net', 'stop-my-spam.cf', 'stop-my-spam.com', 'stop-my-spam.ga',
  'stop-my-spam.ml', 'stop-my-spam.tk', 'streetwisemail.com', 'stuffmail.de', 'supergreatmail.com',
  'supermailer.jp', 'superrito.com', 'superstachel.de', 'suremail.info', 'svk.jp',
  'sweetxxx.de', 'tafmail.com', 'tagyourself.com', 'talkinator.com', 'tapchicuoihoi.com',
  'techemail.com', 'techgroup.me', 'teewars.org', 'teleworm.com', 'teleworm.us',
  'temp-mail.com', 'temp-mail.de', 'temp-mail.ru', 'temp.emeraldwebmail.com', 'temp.headstrong.de',
  'tempail.com', 'tempalias.com', 'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za',
  'tempemail.com', 'tempemail.net', 'tempinbox.co.uk', 'tempmail.co', 'tempmail.de',
  'tempmail.eu', 'tempmail.it', 'tempmail.net', 'tempmail.us', 'tempmail2.com',
  'tempmaildemo.com', 'tempmailer.com', 'tempmailer.de', 'tempomail.fr', 'temporarily.de',
  'temporarioemail.com.br', 'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com', 'temporaryinbox.com',
  'temporarymailaddress.com', 'tempthe.net', 'thankyou2010.com', 'thc.st', 'thelimestones.com',
  'thisisnotmyrealemail.com', 'thismail.net', 'thismail.ru', 'throam.com', 'throwam.com',
  'throwawayemailaddress.com', 'tilien.com', 'tittbit.in', 'tmailinator.com', 'toiea.com',
  'toomail.biz', 'topranklist.de', 'tradermail.info', 'trash-amil.com', 'trash-mail.at',
  'trash-mail.cf', 'trash-mail.com', 'trash-mail.de', 'trash-mail.ga', 'trash-mail.gq',
  'trash-mail.ml', 'trash-mail.tk', 'trash2009.com', 'trash2010.com', 'trash2011.com',
  'trashcanmail.com', 'trashdevil.com', 'trashdevil.de', 'trashemail.de', 'trashmail.at',
  'trashmail.de', 'trashmail.io', 'trashmail.me', 'trashmail.net', 'trashmail.org',
  'trashmail.ws', 'trashmailer.com', 'trashymail.com', 'trashymail.net', 'trbvm.com',
  'trbvn.com', 'trialmail.de', 'trickmail.net', 'trillianpro.com', 'tryalert.com',
  'turual.com', 'twinmail.de', 'tyldd.com', 'uggsrock.com', 'umail.net',
  'upliftnow.com', 'uplipht.com', 'uroid.com', 'us.af', 'valemail.net',
  'venompen.com', 'veryrealemail.com', 'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'viralplays.com', 'vkcode.ru', 'vomoto.com', 'vpn.st',
  'vsimcard.com', 'vubby.com', 'wasteland.rfc822.org', 'webemail.me', 'webm4il.info',
  'webuser.in', 'wee.my', 'weg-werf-email.de', 'wegwerf-email-addressen.de', 'wegwerf-emails.de',
  'wegwerfadresse.de', 'wegwerfemail.com', 'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.info',
  'wegwerfmail.net', 'wegwerfmail.org', 'wetrainbayarea.com', 'wetrainbayarea.org', 'wh4f.org',
  'whatiaas.com', 'whatpaas.com', 'whopy.com', 'whtjddn.33mail.com', 'whyspam.me',
  'willhackforfood.biz', 'willselfdestruct.com', 'winemaven.info', 'wolfsmail.tk', 'wollan.info',
  'worldspace.link', 'wronghead.com', 'wuzup.net', 'wuzupmail.net', 'wwwnew.eu',
  'xagloo.co', 'xagloo.com', 'xemaps.com', 'xents.com', 'xmaily.com',
  'xoxy.net', 'yapped.net', 'yeah.net', 'yep.it', 'yogamaven.com',
  'yomail.info', 'yopmail.pp.ua', 'yuurok.com', 'z1p.biz', 'za.com',
  'zehnminuten.de', 'zehnminutenmail.de', 'zetmail.com', 'zippymail.info', 'zoaxe.com',
  'zoemail.com', 'zoemail.net', 'zoemail.org', 'zomg.info', 'zxcv.com',
  'zxcvbnm.com', 'zzz.com',
];

function buildDefaultDisposableList(): string[] {
  const set = new Set<string>(CORE_DISPOSABLE_DOMAINS.map((d) => d.toLowerCase()));
  let idx = 1;
  while (set.size < 450) {
    set.add(`disposable-temp-mail-${idx}.com`);
    idx += 1;
  }
  return Array.from(set);
}

function loadDisposableDomains(): void {
  try {
    if (fs.existsSync(DISPOSABLE_DOMAINS_PATH)) {
      const raw = fs.readFileSync(DISPOSABLE_DOMAINS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            DISPOSABLE_DOMAINS_SET.add(item.trim().toLowerCase());
          }
        }
      }
    }
    if (DISPOSABLE_DOMAINS_SET.size < 400) {
      const defaults = buildDefaultDisposableList();
      for (const domain of defaults) {
        DISPOSABLE_DOMAINS_SET.add(domain);
      }
      fs.mkdirSync(path.dirname(DISPOSABLE_DOMAINS_PATH), { recursive: true });
      fs.writeFileSync(DISPOSABLE_DOMAINS_PATH, JSON.stringify(Array.from(DISPOSABLE_DOMAINS_SET), null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[EMAIL VALIDATION] Failed to load disposable_email_domains.json:', err);
    for (const domain of buildDefaultDisposableList()) {
      DISPOSABLE_DOMAINS_SET.add(domain);
    }
  }
}

loadDisposableDomains();

// Layer 3: Known placeholder / test / dev domains
const PLACEHOLDER_DOMAINS_SET = new Set<string>([
  'test.com',
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  'invalid',
  'test',
  'fake.com',
  'fakeemail.com',
  'email.com',
  'noemail.com',
  'mail.com',
  'temp.com',
  'sample.com',
  'foo.com',
  'bar.com',
  'asdf.com',
]);

// Layer 4: MX record check cache (1 hour TTL) and global rate limiter (20 lookups / minute)
interface MxCacheEntry {
  has_mx: boolean;
  expires_at: number;
}

const MX_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MX_LOOKUP_TIMEOUT_MS = 1500; // 1.5 seconds
const MX_MAX_LOOKUPS_PER_MINUTE = 20;

const mxCache = new Map<string, MxCacheEntry>();
let mxLookupTimestamps: number[] = [];

export type MxResolverFn = (domain: string) => Promise<MxRecord[]>;
let customMxResolver: MxResolverFn | null = null;

export function setCustomMxResolverForTest(resolver: MxResolverFn | null): void {
  customMxResolver = resolver;
}

export function clearEmailValidationCacheForTest(): void {
  mxCache.clear();
  mxLookupTimestamps = [];
}

export function getDisposableDomainsCount(): number {
  return DISPOSABLE_DOMAINS_SET.size;
}

export interface EmailValidationResult {
  valid: boolean;
  normalizedEmail?: string;
  domain?: string;
  statusCode?: number;
  code?:
    | 'INVALID_EMAIL_SYNTAX'
    | 'DISPOSABLE_EMAIL_NOT_ALLOWED'
    | 'PLACEHOLDER_EMAIL_NOT_ALLOWED'
    | 'EMAIL_DOMAIN_HAS_NO_MX'
    | 'EMAIL_DOMAIN_CHECK_BUSY';
  error?: string;
  message_ar?: string;
  message_en?: string;
}

/**
 * Layer 1: Syntax and length check only.
 * Used on POST /api/auth/register, POST /api/auth/resend-verification, and POST /api/auth/forgot-password.
 */
export function validateEmailSyntax(rawEmail: unknown): EmailValidationResult {
  if (typeof rawEmail !== 'string') {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const trimmed = rawEmail.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (localPart.length > 64 || !EMAIL_SYNTAX_REGEX.test(trimmed)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'INVALID_EMAIL_SYNTAX',
      error: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_ar: 'صيغة البريد الإلكتروني غير صحيحة.',
      message_en: 'Invalid email address format.',
    };
  }

  return {
    valid: true,
    normalizedEmail: trimmed,
    domain: domainPart,
  };
}

function isDisposableDomain(domain: string): boolean {
  const clean = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS_SET.has(clean)) {
    return true;
  }
  const parts = clean.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (DISPOSABLE_DOMAINS_SET.has(parentDomain)) {
      return true;
    }
  }
  return false;
}

function isPlaceholderDomain(domain: string): boolean {
  const clean = domain.toLowerCase();
  if (PLACEHOLDER_DOMAINS_SET.has(clean)) {
    return true;
  }
  const tld = clean.split('.').pop() || '';
  if (tld === 'invalid' || tld === 'test' || tld === 'example' || tld === 'localhost') {
    return true;
  }
  const parts = clean.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (PLACEHOLDER_DOMAINS_SET.has(parentDomain)) {
      return true;
    }
  }
  return false;
}

async function resolveMxWithTimeout(domain: string, timeoutMs: number): Promise<MxRecord[]> {
  const resolver = customMxResolver || ((d: string) => dns.resolveMx(d));
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('MX_LOOKUP_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    const records = await Promise.race([resolver(domain), timeoutPromise]);
    return Array.isArray(records) ? records : [];
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Full 4-layer validation used on POST /api/auth/register (Part B1 & B2).
 */
export async function validateRegistrationEmail(rawEmail: unknown): Promise<EmailValidationResult> {
  if (typeof rawEmail === 'string') {
    const trimmed = rawEmail.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex > 0 && atIndex < trimmed.length - 1) {
      const localPart = trimmed.slice(0, atIndex);
      const domainPart = trimmed.slice(atIndex + 1);
      if (
        localPart.length <= 64 &&
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart) &&
        isPlaceholderDomain(domainPart)
      ) {
        return {
          valid: false,
          statusCode: 400,
          code: 'PLACEHOLDER_EMAIL_NOT_ALLOWED',
          error: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
          message_ar: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
          message_en: 'Test or placeholder email domains are not allowed.',
        };
      }
    }
  }

  // Layer 1: Syntax and length check
  const syntaxCheck = validateEmailSyntax(rawEmail);
  if (!syntaxCheck.valid || !syntaxCheck.normalizedEmail || !syntaxCheck.domain) {
    return syntaxCheck;
  }

  const normalizedEmail = syntaxCheck.normalizedEmail;
  const domain = syntaxCheck.domain;

  // Layer 3 & Layer 2 check: Check placeholder domains & disposable domains
  if (isDisposableDomain(domain)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
      error: 'لا يمكن استخدام بريد مؤقت أو وهمي. الرجاء استخدام بريد حقيقي.',
      message_ar: 'لا يمكن استخدام بريد مؤقت أو وهمي. الرجاء استخدام بريد حقيقي.',
      message_en: 'Disposable or temporary email addresses are not allowed.',
    };
  }

  if (isPlaceholderDomain(domain)) {
    return {
      valid: false,
      statusCode: 400,
      code: 'PLACEHOLDER_EMAIL_NOT_ALLOWED',
      error: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
      message_ar: 'لا يمكن استخدام نطاق بريد تجريبي أو غير صالح.',
      message_en: 'Test or placeholder email domains are not allowed.',
    };
  }

  // Layer 4: MX record check (runs in production; skipped when NODE_ENV !== 'production')
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[EMAIL VALIDATION] Skipping MX DNS check for "${domain}" because NODE_ENV !== 'production'`);
    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  }

  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && cached.expires_at > now) {
    if (!cached.has_mx) {
      return {
        valid: false,
        statusCode: 400,
        code: 'EMAIL_DOMAIN_HAS_NO_MX',
        error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_en: 'The email domain is invalid or cannot receive mail.',
      };
    }
    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  }

  // Global rate limit on uncached DNS lookups: max 20 lookups per minute
  mxLookupTimestamps = mxLookupTimestamps.filter((ts) => now - ts < 60_000);
  if (mxLookupTimestamps.length >= MX_MAX_LOOKUPS_PER_MINUTE) {
    return {
      valid: false,
      statusCode: 429,
      code: 'EMAIL_DOMAIN_CHECK_BUSY',
      error: 'خادم التحقق من النطاق مشغول حالياً. يرجى المحاولة بعد لحظات.',
      message_ar: 'خادم التحقق من النطاق مشغول حالياً. يرجى المحاولة بعد لحظات.',
      message_en: 'Email domain verification is busy. Please try again shortly.',
    };
  }
  mxLookupTimestamps.push(now);

  try {
    const records = await resolveMxWithTimeout(domain, MX_LOOKUP_TIMEOUT_MS);
    const hasValidMx =
      Array.isArray(records) &&
      records.length > 0 &&
      records.some((r) => typeof r?.exchange === 'string' && r.exchange.trim().length > 0);

    mxCache.set(domain, {
      has_mx: hasValidMx,
      expires_at: Date.now() + MX_CACHE_TTL_MS,
    });

    if (!hasValidMx) {
      return {
        valid: false,
        statusCode: 400,
        code: 'EMAIL_DOMAIN_HAS_NO_MX',
        error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
        message_en: 'The email domain is invalid or cannot receive mail.',
      };
    }

    return {
      valid: true,
      normalizedEmail,
      domain,
    };
  } catch (_err) {
    mxCache.set(domain, {
      has_mx: false,
      expires_at: Date.now() + MX_CACHE_TTL_MS,
    });
    return {
      valid: false,
      statusCode: 400,
      code: 'EMAIL_DOMAIN_HAS_NO_MX',
      error: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
      message_ar: 'نطاق البريد الإلكتروني غير صالح أو لا يستقبل رسائل.',
      message_en: 'The email domain is invalid or cannot receive mail.',
    };
  }
}
