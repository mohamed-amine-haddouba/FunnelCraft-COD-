import { useCallback } from 'react';
import { useNavigate, NavigateOptions, To } from 'react-router-dom';
import { useLanguage } from '../i18n/translations';
import { isReservedRootPath, isValidLanguage, DEFAULT_LANGUAGE, type Language } from '../i18n/config';

export function isExternalUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:|\/\/)/i.test(url);
}

export function localizePath(to: string, currentLang: Language = DEFAULT_LANGUAGE): string {
  if (!to) return `/${currentLang}`;

  // If external URL, return as-is
  if (isExternalUrl(to)) {
    return to;
  }

  // If anchor hash only, return as-is
  if (to.startsWith('#')) {
    return to;
  }

  // Split query and hash if present
  const [pathnameAndQuery, hash] = to.split('#');
  const [pathname, search] = pathnameAndQuery.split('?');
  const searchPart = search !== undefined ? `?${search}` : '';
  const hashPart = hash !== undefined ? `#${hash}` : '';

  // If pathname starts with reserved root paths (/dashboard, /sandbox, /p/, /api, /reset, /_), return as-is
  if (isReservedRootPath(pathname)) {
    return to;
  }

  // Check if pathname already has a language prefix
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isValidLanguage(segments[0])) {
    return to; // already prefixed
  }

  // Normalize leading slash
  const cleanPath = pathname === '' || pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;

  return `/${currentLang}${cleanPath}${searchPart}${hashPart}`;
}

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }

      if (typeof to === 'string') {
        const localized = localizePath(to, language);
        if (isExternalUrl(localized)) {
          window.location.href = localized;
          return;
        }
        navigate(localized, options);
        return;
      }

      if (typeof to === 'object' && to.pathname) {
        navigate(
          {
            ...to,
            pathname: localizePath(to.pathname, language),
          },
          options
        );
        return;
      }

      navigate(to, options);
    },
    [navigate, language]
  );
}

export default useLocalizedNavigate;
