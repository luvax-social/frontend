/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_GOOGLE_AUTH_URL?: string;
  readonly VITE_GOOGLE_REDIRECT_PATH?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_SEO_INDEXABLE?: string;
}
