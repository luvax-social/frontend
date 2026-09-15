import { useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { useCreatePublicTicket, usePublicSupportCategories } from '../hooks/useSupport';
import { publicTicketSchema } from '../utils/supportSchemas';
import { describeSupportError, isCaptchaFailure, isRateLimited } from '../utils/supportErrors';
import { Field, Notice, PrimaryButton, SupportPage } from './SupportPrimitives';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';

/**
 * The anonymous support form, for someone with no account or no session.
 *
 * Two independent controls stand behind it, both server-side: Turnstile, and an
 * email confirmation step. The ticket is written in `pending_confirmation` and
 * is invisible to every staff query until the confirmation link is followed, so
 * submitting here is not the same as being heard - the success copy says so
 * rather than implying the request is already in a queue.
 *
 * Appeal categories are refused on this path, and so is verification. Both are
 * excluded by the `allowsPublicForm` flag the endpoint filters on, so the
 * selector cannot offer one.
 */
export function PublicSupportFormScreen() {
  const categoriesQuery = usePublicSupportCategories();
  const submit = useCreatePublicTicket();
  const [values, setValues] = useState({
    contactEmail: '',
    category: '',
    subject: '',
    body: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [challengeUnavailable, setChallengeUnavailable] = useState('');
  // Whether the challenge has actually drawn. The hint below tells the reader to
  // complete something "above", so it must not appear while the widget is still
  // loading and there is nothing above to complete.
  const [challengeReady, setChallengeReady] = useState(false);
  const [sent, setSent] = useState(false);
  const turnstileRef = useRef(null);

  const categories = categoriesQuery.data ?? [];

  if (sent) {
    return (
      <SupportPage
        title="Check your email"
        intro="We have sent a link to the address you gave. Your request reaches our staff once you follow it."
      >
        <Notice tone="good" role="status">
          Until then it is not visible to anyone. If the email does not arrive, check your spam
          folder before sending another.
        </Notice>
      </SupportPage>
    );
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsed = publicTicketSchema.safeParse(values);
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0]] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    submit.mutate(
      { ...parsed.data, turnstileToken },
      {
        onSuccess: () => setSent(true),
        // A token is single-use whatever refused the submission, so every
        // failure has to re-arm the challenge before a retry can succeed.
        onError: () => turnstileRef.current?.reset(),
      }
    );
  };

  // A failed challenge is its own state, not a validation error: the form is
  // filled in correctly and the thing that refused is the bot control, so
  // saying "check your answers" would send the user hunting for a mistake that
  // is not there.
  const captchaRefused = isCaptchaFailure(submit.error);
  const rateLimited = isRateLimited(submit.error);
  const otherFailure =
    submit.isError && !captchaRefused && !rateLimited ? describeSupportError(submit.error) : '';

  return (
    <SupportPage
      title="Contact support"
      intro="Tell us what has happened and we will reply by email. One request, one reply."
    >
      {captchaRefused ? (
        <Notice tone="bad" role="alert">
          The challenge below was not accepted, so nothing was sent. Complete it again and resend.
          Your message is still here.
        </Notice>
      ) : null}

      {rateLimited ? (
        <Notice tone="warn" role="alert">
          Too many requests have come from here recently. Wait a while before sending another.
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
          htmlFor="public-email"
          error={fieldErrors.contactEmail}
          hint="We send a confirmation link here first, then our reply."
        >
          <input
            id="public-email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            value={values.contactEmail}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, contactEmail: event.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.contactEmail)}
            aria-describedby={fieldErrors.contactEmail ? 'public-email-error' : 'public-email-hint'}
          />
        </Field>

        <Field label="What is this about" htmlFor="public-category" error={fieldErrors.category}>
          <select
            id="public-category"
            required
            aria-required="true"
            value={values.category}
            onChange={(event) => setValues((prev) => ({ ...prev, category: event.target.value }))}
            disabled={categoriesQuery.isLoading}
            aria-invalid={Boolean(fieldErrors.category)}
          >
            <option value="">Choose one</option>
            {categories.map((category) => (
              <option key={category.categoryKey} value={category.categoryKey}>
                {category.displayName}
              </option>
            ))}
          </select>
          {categoriesQuery.isError ? (
            <div
              role="alert"
              style={{ fontFamily: v.fontBody, fontSize: 12, color: v.errorText, marginTop: 5 }}
            >
              We could not load the list of topics. Reload the page.
            </div>
          ) : null}
        </Field>

        <Field label="Summary" htmlFor="public-subject" error={fieldErrors.subject}>
          <input
            id="public-subject"
            required
            aria-required="true"
            value={values.subject}
            onChange={(event) => setValues((prev) => ({ ...prev, subject: event.target.value }))}
            aria-invalid={Boolean(fieldErrors.subject)}
          />
        </Field>

        <Field
          label="What happened"
          htmlFor="public-body"
          error={fieldErrors.body}
          hint="There is no back and forth, so include everything now."
        >
          <textarea
            id="public-body"
            rows={8}
            required
            aria-required="true"
            value={values.body}
            onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? 'public-body-error' : 'public-body-hint'}
          />
        </Field>

        <TurnstileWidget
          ref={turnstileRef}
          onToken={setTurnstileToken}
          onUnavailable={setChallengeUnavailable}
          onReady={() => setChallengeReady(true)}
          // The server fails closed on this form alone, so the sentence points
          // at the one route that still works during an outage. It stays here
          // rather than in the shared widget because it is true of nothing else.
          unavailableMessage="The challenge is unavailable, so this form cannot be submitted right now. If you were sent a link in an email about a decision on your account, use that link instead."
        />

        <PrimaryButton
          disabled={submit.isPending || !turnstileToken || Boolean(challengeUnavailable)}
        >
          {submit.isPending ? 'sending' : 'Send request'}
        </PrimaryButton>

        {challengeReady && !turnstileToken && !challengeUnavailable ? (
          <div
            style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 8 }}
            aria-live="polite"
          >
            Complete the challenge above to send.
          </div>
        ) : null}
      </form>
    </SupportPage>
  );
}

export default PublicSupportFormScreen;
