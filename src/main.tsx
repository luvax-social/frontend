import { getErrorResponse, getErrorMessage } from '@/utils/errors';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import GlobalErrorBoundary from '@/components/common/ErrorBoundary';
import { initImpressionQueue } from '@/services/impressionQueue';
import router from './routes/index';
import './index.css';

/**
 * applyTheme
 *
 * Applies data-theme synchronously, before React mounts, so first paint never
 * flashes the wrong theme for users with a manual override or a dark OS preference.
 *
 * `lxDarkManual` is a flag recording only that a choice was made; the chosen
 * value lives in `lxDark`. Reading the flag as though it carried the value
 * resolved every manual choice to light, which flashed the wrong theme in the
 * user-facing application and left the panel — where nothing mounts to correct
 * it afterwards — permanently light. Both keys are read here exactly as the
 * application writes them.
 */
function applyTheme() {
  const manual = window.localStorage.getItem('lxDarkManual');
  if (manual !== null) {
    const stored = window.localStorage.getItem('lxDark');
    document.documentElement.setAttribute('data-theme', stored === 'true' ? 'dark' : 'light');
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

initImpressionQueue();

/**
 * normalizeQueryError
 *
 * Centralized error handler for all TanStack Query cache events.
 * Runs for every failed query and mutation before the error reaches
 * individual hooks — the single place to:
 *  - Log to an error reporter (Sentry, DataDog, etc.)
 *  - Emit global UI notifications (toast system, etc.)
 *  - Suppress known/expected errors (401s are handled by the Axios interceptor)
 *
 * Security: raw backend messages are logged only to the console here.
 * UI-facing messages are the responsibility of each hook/component.
 */
const handleQueryError = (error: unknown) => {
  const status = getErrorResponse(error)?.status;

  // 401s are handled by the Axios refresh interceptor and clearAuthAndRedirect.
  // Do not double-handle them here.
  if (status === 401) {
    return;
  }

  // Replace with your error-reporting SDK call (e.g. Sentry.captureException(error))
  if (import.meta.env.DEV) {
    console.error('[QueryClient]', getErrorMessage(error, String(error)));
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleQueryError,
  }),
  mutationCache: new MutationCache({
    onError: handleQueryError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
