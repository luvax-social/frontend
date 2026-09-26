import { useCallback, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';

import { TurnstileWidget } from '@/components/common/TurnstileWidget';
import { useTurnstile } from '@/hooks/useTurnstile';
import { CAPTCHA_FAILURE_MESSAGE, isCaptchaFailure } from '@/utils/captchaErrors';
import Field from '@/features/auth/components/AuthField';
import '@/features/auth/components/AuthPage.css';
import { ROUTES } from '@/config/constants';
import authService from '@/features/auth/services/authService';
import { emailSchema } from '@/features/auth/utils/authSchemas';

export default function VerifyEmailNoticePage() {
  const location = useLocation();
  const emailFromState = location.state?.email || '';
  const [successMessage, setSuccessMessage] = useState('');
  const resendMutation = useMutation({
    mutationFn: (data) => authService.resendVerification(data),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: emailFromState, turnstileToken: '' },
  });

  // Held in the form's own values so the Zod schema decides whether a
  // submission may go out, rather than a second piece of state beside it.
  const setChallengeToken = useCallback(
    (challengeToken) => setValue('turnstileToken', challengeToken ?? '', { shouldValidate: false }),
    [setValue]
  );
  const challenge = useTurnstile(setChallengeToken);
  const turnstileToken = useWatch({ control, name: 'turnstileToken' });

  const onSubmit = (values) => {
    setSuccessMessage('');
    resendMutation.mutate(values, {
      onSuccess: () => {
        setSuccessMessage('If this email is registered, a new verification link has been sent.');
      },
      // Single-use token: re-armed on every failure, not only a refused
      // challenge, so the next attempt carries a fresh one.
      onError: () => challenge.reset(),
    });
  };

  return (
    <div className="lx-shell">
      <div className="lx-col lx-enter">
        <div className="lx-card">
          <div className="lx-head">
            <h1 className="lx-h2">Check your inbox.</h1>
            <p className="lx-sub">
              We sent a verification link to your email address. Click the link to activate your
              account.
            </p>
          </div>

          <form
            style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Field
              id="ven-email"
              label="Email address"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              register={register('email')}
            />

            <TurnstileWidget {...challenge.widgetProps} />

            {resendMutation.error ? (
              <p style={{ color: 'var(--lx-error-text)', fontSize: '14px', margin: 0 }}>
                {isCaptchaFailure(resendMutation.error)
                  ? CAPTCHA_FAILURE_MESSAGE
                  : resendMutation.error.message}
              </p>
            ) : null}
            {successMessage ? (
              <p style={{ color: 'var(--lx-success-text)', fontSize: '14px', margin: 0 }}>
                {successMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="lx-btn-primary"
              disabled={isSubmitting || resendMutation.isPending || !turnstileToken}
            >
              Resend verification email
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

          <div className="lx-foot-block">
            Already verified? <Link to={ROUTES.LOGIN}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
