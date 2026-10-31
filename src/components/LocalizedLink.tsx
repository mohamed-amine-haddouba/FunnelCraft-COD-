import React from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { useLanguage } from '../i18n/translations';
import { localizePath, isExternalUrl } from '../hooks/useLocalizedNavigate';

export interface LocalizedLinkProps extends LinkProps {
  to: string | { pathname?: string; search?: string; hash?: string };
}

export const LocalizedLink: React.FC<LocalizedLinkProps> = ({ to, children, ...rest }) => {
  const { language } = useLanguage();

  if (typeof to === 'string') {
    if (isExternalUrl(to)) {
      return (
        <a href={to} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    }
    const localizedTo = localizePath(to, language);
    return (
      <Link to={localizedTo} {...rest}>
        {children}
      </Link>
    );
  }

  if (typeof to === 'object' && to.pathname) {
    const localizedTo = {
      ...to,
      pathname: localizePath(to.pathname, language),
    };
    return (
      <Link to={localizedTo} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
};

export default LocalizedLink;
