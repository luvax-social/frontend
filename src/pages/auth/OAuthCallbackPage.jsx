import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '@/api/authApi';
import PageLoader from '@/components/common/PageLoader';
import { ROUTES } from '@/config/constants';
import { AuthNotice } from '@/features/auth/components/AuthNotice';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Handles the return from a Google sign-in.
 *
 * Security invariants enforced here:
 * 1. The URL hash is NEVER parsed for access_token / id_token. The implicit
 *    flow is retired; only the backend-driven authorization-code flow is
 *    supported. Hash tokens fail closed.
 * 2. CSRF `state` validation belongs to the backend's signed HttpOnly cookie
 *    repository, so the frontend does not persist or validate it.
 * 3. The backend redirects here with a short-lived `?code=` that is exchanged
 *    at `/auth/oauth2/exchange` for a real session.
 *
 * WHAT THIS PAGE CANNOT REACH.
 *
 * A cancelled Google sign-in never arrives here. Google returns to the
 * backend's own callback with `?error=access_denied`, and the backend answers
 * that request itself and does not redirect anywhere. Verified in a browser:
 * the person ends on `localhost:8080/api/v1/auth/oauth2/callback/google` with
 * HTTP 500 and a Spring whitelabel page carrying a Java stack trace. There is
 * no redirect for this page to intercept and no parameter for it to read.
 * See `docs/user-settings-and-auth-errors/settings-contract-verification.md`
 * and the backend request item raised alongside it.
 *
 * The `?error=` branch below is therefore kept for a return that carries one,
 * rather than removed: the route is directly addressable, and an error the
 * backend does not currently send must still not be printed raw if it ever is.
 */

/**
 * Turns a failure into a sentence written for a person.
 *
 * The mapping is exhaustive by construction: anything unrecognised falls
 * through to the generic case, so a backend code, a raw message or an
 * exception can never be rendered.
 */
const describeFailure = (error) => {
  const code = error?.response?.data?.code;

  if (code === 'AUTH_OAUTH2_EXCHANGE_CODE_INVALID') {
    return {
      tone: 'problem',
      icon: 'clock',
      title: 'That sign-in link had expired',
      message:
        'The link Google sent us is only good for a couple of minutes, and this one had already been used or run out of time. Starting again takes a moment.',
    };
  }

  if (code === 'AUTH_ACCOUNT_INACTIVE') {
    return {
      tone: 'problem',
      icon: 'lock',
      title: 'This account is not available',
      message:
        'We cannot sign you in to this account at the moment. If you think that is wrong, get in touch and we will look into it.',
    };
  }

  if (code === 'VALIDATION_ERROR') {
    return {
      tone: 'problem',
      icon: 'alert',
      title: 'That sign-in did not come through',
      message:
        'The return from Google was missing something we needed. Signing in again should sort it.',
    };
  }

  return {
    tone: 'problem',
    icon: 'alert',
    title: 'We could not finish signing you in',
    message:
      'Something went wrong between Google and us. It was not anything you did. Trying again usually works.',
  };
};

/** The reason Google itself reported, where a return ever carries one. */
const describeCallbackError = (raw) => {
  if (raw === 'access_denied') {
    return {
      tone: 'calm',
      icon: 'back',
      title: 'You did not finish signing in',
      message:
        'no problem — nothing was shared and no account was created. you can try google again, or sign in with your email and password.',
    };
  }

  return {
    tone: 'problem',
    icon: 'alert',
    title: 'Google could not sign you in',
    message:
      'Google stopped the sign-in before it finished. Trying again, or using your email and password, will get you in.',
  };
};

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const [outcome, setOutcome] = useState(null);
  const didRun = useRef(false);

  const callbackError = searchParams.get('error') || '';

  // Derived during render rather than inside the effect, exactly as the error
  // parameter is. The fragment is browser state that is already there on the
  // first paint, and reading it here means the decision cannot depend on when
  // the effect happens to run.
  const hasHashToken = (() => {
    const rawHash = typeof window === 'undefined' ? '' : window.location.hash;
    if (!rawHash) return false;
    const hashParams = new URLSearchParams(rawHash.replace(/^#/, ''));
    return Boolean(hashParams.get('access_token') || hashParams.get('id_token'));
  })();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (callbackError) return;

    // Fail closed on the retired implicit flow, and take the tokens out of the
    // address bar rather than leaving them in history.
    if (hasHashToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const finishOAuth = async () => {
      try {
        const code = searchParams.get('code');
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!code) {
          setOutcome({
            tone: 'problem',
            icon: 'alert',
            title: 'That sign-in did not come through',
            message:
              'The return from Google was missing something we needed. Signing in again should sort it.',
          });
          return;
        }

        const exchange = await authApi.exchangeOAuthCode(code);
        if (!exchange?.accessToken) throw new Error('No session');

        const profile = exchange.user ?? (await authApi.getCurrentUser());
        if (!profile) throw new Error('No profile');

        setAuth({
          accessToken: exchange.accessToken,
          refreshToken: exchange.refreshToken ?? null,
          user: profile,
        });

        navigate(ROUTES.APP, { replace: true });
      } catch (oauthError) {
        logout();
        setOutcome(describeFailure(oauthError));
      }
    };

    finishOAuth();
  }, [callbackError, hasHashToken, logout, navigate, searchParams, setAuth]);

  const shown = callbackError
    ? describeCallbackError(callbackError)
    : hasHashToken
      ? {
          tone: 'problem',
          icon: 'lock',
          title: 'We could not finish signing you in',
          message:
            'This sign-in arrived in a form we no longer accept, for security reasons. Signing in again from the start will work.',
        }
      : outcome;

  if (shown) {
    return (
      <AuthNotice
        tone={shown.tone}
        icon={shown.icon}
        title={shown.title}
        message={shown.message}
        actions={[
          { label: 'Try Google again', to: ROUTES.LOGIN, primary: true },
          { label: 'Sign in another way', to: ROUTES.LOGIN },
        ]}
      />
    );
  }

  return <PageLoader label="Finishing your Google sign-in" />;
}
