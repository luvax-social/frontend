import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '@/api/authApi';
import '@/features/auth/components/AuthPage.css';
import { ROUTES } from '@/config/constants';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/store/useAuthStore';

const RESEND_SECONDS = 60;

export default function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const tokenFromUrl = searchParams.get('token') || '';
  const [resendState, setResendState] = useState({ error: '', success: '' });
  const [tokenError, setTokenError] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const {
    secondsLeft: countdown,
    isComplete: canResend,
    start: restartCountdown,
  } = useCountdown(RESEND_SECONDS);

  const calledRef = useRef(false);

  useEffect(() => {
    if (!tokenFromUrl || calledRef.current) {
      return;
    }
    calledRef.current = true;

    const verifyFromUrl = async () => {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + (email ? `?email=${encodeURIComponent(email)}` : '')
      );

      try {
        const sessionData = await authApi.verifyEmail({ token: tokenFromUrl });

        if (sessionData?.accessToken) {
          setAuth({
            accessToken: sessionData.accessToken,
            refreshToken: sessionData.refreshToken ?? null,
            user: sessionData.user ?? null,
          });
          navigate(ROUTES.APP, { replace: true });
        } else {
          navigate(ROUTES.LOGIN, {
            replace: true,
            state: { verificationSuccess: 'Your email has been verified. Sign in to continue.' },
          });
        }
      } catch {
        // The backend distinguishes nothing useful here - an expired link, a
        // replayed one and a malformed one all answer AUTH_VERIFY_TOKEN_INVALID
        // - and its own sentence is written in a voice this surface does not
        // use. The outcome is stated below in the product's words instead.
        setTokenError(true);
      }
    };

    verifyFromUrl();
  }, [navigate, tokenFromUrl, email, setAuth]);

  const handleResend = async () => {
    if (!canResend || !email) {
      return;
    }

    setResendState({ error: '', success: '' });

    try {
      await authApi.resendVerification({ email });
      restartCountdown();
      setResendState({
        error: '',
        success: 'A new verification link is on its way.',
      });
    } catch {
      setResendState({
        error: "we couldn't send that email just now. try again in a moment.",
        success: '',
      });
    }
  };

  return (
    <div className="lx-shell">
      <div className="lx-col lx-enter">
        <div className="lx-card">
          <div className="lx-head">
            <h1 className="lx-h2">{tokenError ? 'That link has expired' : 'Verify your email.'}</h1>
            <p className="lx-sub">
              {tokenError
                ? 'Verification links stop working after a while, and each one can only be used once. Send yourself a fresh one and it will work.'
                : email
                  ? `we sent a verification link to ${email}.`
                  : 'Check your inbox for a verification link.'}
            </p>
          </div>
          {resendState.error ? (
            <p style={{ color: 'var(--lx-error-text)', fontSize: '14px', margin: 0 }}>
              {resendState.error}
            </p>
          ) : null}
          {resendState.success ? (
            <p style={{ color: 'var(--lx-success-text)', fontSize: '14px', margin: 0 }}>
              {resendState.success}
            </p>
          ) : null}

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}
          >
            <p style={{ fontSize: '14px', color: 'var(--lx-ink-2)', margin: 0 }}>
              Didn&apos;t receive the email?
            </p>
            <button
              type="button"
              className="lx-btn-primary"
              onClick={handleResend}
              disabled={!canResend || !email}
            >
              {canResend ? 'Resend email' : `resend in ${countdown}s`}
            </button>
          </div>

          <Link className="lx-linkbtn" to={ROUTES.LOGIN}>
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
}
