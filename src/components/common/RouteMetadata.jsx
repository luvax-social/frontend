import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { createSeoConfig, getPageMetadata, metadataEntries } from '@/config/seo';

const defaultConfig = createSeoConfig(import.meta.env);
const titles = {
  [ROUTES.LOGIN]: 'Log in',
  [ROUTES.REGISTER]: 'Create an account',
  [ROUTES.FORGOT_PASSWORD]: 'Reset your password',
  [ROUTES.RESET_PASSWORD]: 'Choose a new password',
  [ROUTES.VERIFY_EMAIL]: 'Verify your email',
  [ROUTES.VERIFY_EMAIL_NOTICE]: 'Check your inbox',
  [ROUTES.OAUTH_CALLBACK]: 'Signing in',
  [ROUTES.SUPPORT_PUBLIC]: 'Contact support',
  [ROUTES.SUPPORT_APPEAL]: 'Appeal a decision',
  [ROUTES.SUPPORT_CONFIRM]: 'Confirm your request',
  [ROUTES.SUPPORT_APPEAL_STATUS]: 'Appeal status',
  [ROUTES.SUPPORT_APPEAL_RESEND]: 'Request an appeal link',
};

export default function RouteMetadata({ config = defaultConfig, error = false }) {
  const { pathname, search } = useLocation();
  useLayoutEffect(() => {
    const title = error
      ? 'Page unavailable'
      : titles[pathname] ||
        (pathname.startsWith(ROUTES.ADMIN)
          ? 'Moderation'
          : pathname.startsWith(ROUTES.APP) || pathname === ROUTES.DASHBOARD
            ? 'Your account'
            : pathname === ROUTES.HOME
              ? 'Log in'
              : 'Page not found');
    const metadata = getPageMetadata(
      error ? { ...config, indexable: false } : config,
      pathname,
      search,
      `${title} | Luvax`
    );
    if (error) metadata.title = `${title} | Luvax`;
    // Also replaces the unmarked development-template entries. The neutral SPA
    // document must never retain the homepage's canonical or identity graph.
    document.head
      .querySelectorAll('title, meta[name="description"], meta[name="robots"], [data-lx-seo]')
      .forEach((node) => node.remove());
    for (const entry of metadataEntries(metadata)) {
      const node = document.createElement(entry.tag);
      node.setAttribute('data-lx-seo', '');
      for (const [key, value] of Object.entries(entry.attrs || {})) {
        node.setAttribute(key, value);
      }
      if (entry.text) node.textContent = entry.text;
      document.head.appendChild(node);
    }
  }, [config, error, pathname, search]);
  return null;
}
