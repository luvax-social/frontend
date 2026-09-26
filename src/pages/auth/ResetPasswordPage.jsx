import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '@/api/authApi';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';
import { useTurnstile } from '@/hooks/useTurnstile';
import { CAPTCHA_FAILURE_MESSAGE, isCaptchaFailure } from '@/utils/captchaErrors';
import Field from '@/features/auth/components/AuthField';
import '@/features/auth/components/AuthPage.css';
import { ROUTES } from '@/config/constants';
import { resetPasswordSchema } from '@/features/auth/utils/authSchemas';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [showPw, setShowPw] = useState(false);
  const [serverState, setServerState] = useState({ error: '', success: '' });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
      turnstileToken: '',
    },
  });

  // Held in the form's own values so the Zod schema decides whether a
  // submission may go out, rather than a second piece of state beside it.
  // Named `challengeToken` rather than `token`: `token` above is the reset link's
  // one-time token, and the two are unrelated.
  const setChallengeToken = useCallback(
    (challengeToken) => setValue('turnstileToken', challengeToken ?? '', { shouldValidate: false }),
    [setValue]
  );
  const challenge = useTurnstile(setChallengeToken);
  const turnstileToken = useWatch({ control, name: 'turnstileToken' });

  // Scrub the token query parameter from the URL immediately after the token
  // has been captured into the local const. useLayoutEffect runs synchronously
  // before paint so the token never appears in the rendered address bar.
  useLayoutEffect(() => {
    if (token) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!serverState.success) {
      return undefined;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: {
          resetSuccess:
            'Your password has been reset successfully. Sign in with your new password.',
        },
      });
    }, 1200);

    return () => window.clearTimeout(redirectTimer);
  }, [navigate, serverState.success]);

  const onSubmit = async (values) => {
    setServerState({ error: '', success: '' });

    if (!token) {
      setServerState({
        error: 'This link has expired. Request a new one to continue.',
        success: '',
      });
      return;
    }

    try {
      await authApi.resetPassword({
        token,
        newPassword: values.password,
        turnstileToken: values.turnstileToken,
      });

      setServerState({
        error: '',
        success: 'Your password is changed. Taking you to sign in.',
      });
    } catch (error) {
      // Single-use challenge token: re-armed on every failure, not only a
      // refused challenge, so a second attempt does not send a spent one.
      challenge.reset();

      // A reset token that is expired, already used or malformed all answer
      // AUTH_RESET_TOKEN_INVALID, and that is the one case worth telling apart
      // here because the way out differs: a new link rather than another go.
      // A refused challenge leaves the reset link itself unspent, so the way
      // out there is simply to solve it again.
      const code = error?.response?.data?.code;
      let message = "we couldn't change your password just now. try again in a moment.";
      if (isCaptchaFailure(error)) {
        message = CAPTCHA_FAILURE_MESSAGE;
      } else if (code === 'AUTH_RESET_TOKEN_INVALID') {
        message =
          'This link has expired or has already been used. Request a new one and it will work.';
      }
      setServerState({ error: message, success: '' });
    }
  };

  if (!token) {
    return (
      <div className="lx-shell">
        <div className="lx-col lx-enter">
          <div className="lx-card">
            <div className="lx-head">
              <h1 className="lx-h2">Link expired.</h1>
              <p className="lx-sub">
                Reset links stop working after fifteen minutes, and each one can only be used once.
                Requesting a new one takes a moment.
              </p>
            </div>
            <div className="lx-foot-block">
              <Link to={ROUTES.FORGOT_PASSWORD}>Request a new reset link</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lx-shell">
      <div className="lx-col lx-enter">
        <div className="lx-card">
          <div className="lx-head">
            <h1 className="lx-h2">Choose a new password.</h1>
            <p className="lx-sub">Create a strong password for your Luvax account.</p>
          </div>

          <form
            style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Field
              id="rp-pw"
              label="New password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              error={errors.password?.message}
              register={register('password')}
              className="lx-field--pw"
              rightSlot={
                <button
                  type="button"
                  className="lx-pwtoggle"
                  onClick={() => setShowPw((shown) => !shown)}
                >
                  {showPw ? 'hide' : 'show'}
                </button>
              }
            />

            <Field
              id="rp-confirm-pw"
              label="Confirm new password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              register={register('confirmPassword')}
            />

            <TurnstileWidget {...challenge.widgetProps} />

            {serverState.error ? (
              <p style={{ color: 'var(--lx-error-text)', fontSize: '14px', margin: 0 }}>
                {serverState.error}
              </p>
            ) : null}
            {serverState.success ? (
              <p style={{ color: 'var(--lx-success-text)', fontSize: '14px', margin: 0 }}>
                {serverState.success}
              </p>
            ) : null}

            <button
              type="submit"
              className="lx-btn-primary"
              disabled={isSubmitting || !turnstileToken}
            >
              Reset password
            </button>
            {challenge.ready && !turnstileToken && !challenge.unavailable ? (
              <p
                style={{ color: 'var(--lx-ink-2)', fontSize: '13px', margin: 0 }}
                aria-live="polite"
              >
                Complete the challenge above to continue.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
