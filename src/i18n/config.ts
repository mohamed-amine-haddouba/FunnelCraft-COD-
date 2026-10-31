export const SUPPORTED_LANGUAGES = [
  { code: 'ar', label: 'AR', dir: 'rtl', name: 'العربية', flag: '🇲🇦' },
  { code: 'fr', label: 'FR', dir: 'ltr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'EN', dir: 'ltr', name: 'English', flag: '🇺🇸' },
] as const;

export type Language = typeof SUPPORTED_LANGUAGES[number]['code'];
export const DEFAULT_LANGUAGE: Language = 'ar';

export const RESERVED_ROOT_PATHS = [
  '/dashboard',
  '/sandbox',
  '/p/',
  '/api',
  '/reset',
  '/_',
] as const;

export function isReservedRootPath(pathname: string): boolean {
  return RESERVED_ROOT_PATHS.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || pathname === prefix
  );
}

export function isValidLanguage(code: string): code is Language {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
}

export function getLanguageConfig(code: Language) {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code) || SUPPORTED_LANGUAGES[0];
}

export function extractLangFromPath(pathname: string): Language | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isValidLanguage(segments[0])) {
    return segments[0];
  }
  return null;
}
