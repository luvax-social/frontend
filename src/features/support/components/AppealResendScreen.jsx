import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { v } from '@/config/tokens';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';
import { useResendAppealLink } from '../hooks/useSupport';
import { appealResendSchema } from '../utils/supportSchemas';
import { describeSupportError, isCaptchaFailure, isRateLimited } from '../utils/supportErrors';
import { Field, Notice, PrimaryButton, SupportPage } from './SupportPrimitives';

/**
 * Asks for a replacement appeal link when the moderation notice never arrived.
 *
 * The gap this closes: the link contesting a specific decision existed only
 * inside one email. A bounced, filtered or deleted notice therefore removed the
 * account's only route to contest that decision, permanently - and a banned or
 * suspended account cannot reach any authenticated surface to recover it. This
 * screen is anonymous for exactly that reason, reads nothing from the auth
 * store, and sits outside `ProtectedRoute` like the other support entries.
 *
 * It asks only for an address. It deliberately does not ask which decision is
 * being appealed: the whole premise is that the reader has lost the message
 * that named one, and the server picks the most recent un-appealed decision
 * itself.
 *
 * The confirmation is shown whether or not the address matched an account, and
 * that is not a convenience - the server answers identically either way, in
 * body, in status and in elapsed time, so there is nothing here that could
 * distinguish them. Copy that promised an email only "if we found you" would
 * imply a signal the response does not carry.
 */
export function AppealResendScreen() {
  const resend = useResendAppealLink();
  const [contactEmail, setContactEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [challengeUnavailable, setChallengeUnavailable] = useState('');
  // Whether the challenge has actually drawn. The hint below tells the reader to
  // complete something "above", so it must not appear while the widget is still
  // loading and there is nothing above to complete.
  const [challengeReady, setChallengeReady] = useState(false);
  const [sent, setSent] = useState(false);
  const turnstileRef = useRef(null);

  if (sent) {
    return (
      <SupportPage
        title="Check your email"
        intro="If that address belongs to an account with a decision that has not been contested, the link is on its way to it."
      >
        <Notice tone="good" role="status">
          We send the link to the address held on the account, which may not be the one you typed.
          Check your spam folder before asking again.
        </Notice>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.6 }}>
          The email carries a link and nothing else. It does not say what the decision was, because
          anyone who knows an address can ask for it to be sent there.
        </div>
      </SupportPage>
    );
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsed = appealResendSchema.safeParse({ contactEmail });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0]] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    resend.mutate(
      { contactEmail: parsed.data.contactEmail, turnstileToken },
      {
        // One state for both outcomes, because the server gives us one answer
        // for both. There is nothing to branch on.
        onSuccess: () => setSent(true),
        // A Turnstile token is single-use whatever refused the request, so every
        // failure has to re-arm the challenge before a retry can succeed.
        onError: () => turnstileRef.current?.reset(),
      }
    );
  };

  // A refused challenge is its own state, not a validation error: the address is
  // filled in correctly and the thing that refused is the bot control, so
  // "check your answers" would send the reader hunting for a mistake that is
  // not there.
  const captchaRefused = isCaptchaFailure(resend.error);
  const rateLimited = isRateLimited(resend.error);
  const otherFailure =
    resend.isError && !captchaRefused && !rateLimited ? describeSupportError(resend.error) : '';

  return (
    <SupportPage
      title="Send me my appeal link again"
      intro="If the email about a decision on your account never arrived, we can send the link again."
    >
      {captchaRefused ? (
        <Notice tone="bad" role="alert">
          The challenge below was not accepted, so nothing was sent. Complete it again and resend.
        </Notice>
      ) : null}

      {rateLimited ? (
        <Notice tone="warn" role="alert">
          Too many requests have come from here recently. Wait a while before asking again.
        </Notice>
      ) : null}

      {otherFailure ? (
        <Notice tone="bad" role="alert">
          {otherFailure}
        </Notice>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Your email"
          htmlFor="resend-email"
          error={fieldErrors.contactEmail}
          hint="The address the original email was sent to."
        >
          <input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.contactEmail)}
            aria-describedby={fieldErrors.contactEmail ? 'resend-email-error' : 'resend-email-hint'}
          />
        </Field>

        <div style={{ marginBottom: 20 }}>
          <TurnstileWidget
            ref={turnstileRef}
            onToken={setTurnstileToken}
            onReady={() => setChallengeReady(true)}
            onUnavailable={setChallengeUnavailable}
            // The server fails closed on this route, so an unavailable challenge
            // means the request genuinely cannot be sent. Saying so is more
            // useful than letting the reader submit into a refusal.
            unavailableMessage="The challenge cannot load, so we cannot send the link right now. Reload the page and try again."
          />
          {challengeUnavailable ? (
            <Notice tone="bad" role="alert">
              {challengeUnavailable}
            </Notice>
          ) : null}
          {challengeReady && !turnstileToken ? (
            <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3, marginTop: 8 }}>
              Complete the challenge above to continue.
            </div>
          ) : null}
        </div>

        <PrimaryButton disabled={resend.isPending || !turnstileToken}>
          {resend.isPending ? 'sending' : 'Send the link'}
        </PrimaryButton>
      </form>

      <div
        style={{
          fontFamily: v.fontBody,
          fontSize: 13,
          color: v.ink3,
          lineHeight: 1.6,
          marginTop: 24,
        }}
      >
        If you never had an email about a decision, use the{' '}
        <Link to={ROUTES.SUPPORT_PUBLIC} style={{ color: v.accentText }}>
          public support form
        </Link>{' '}
        instead.
      </div>
    </SupportPage>
  );
}

export default AppealResendScreen;
