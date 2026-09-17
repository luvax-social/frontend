import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { copyToClipboard } from '@/utils/helpers';
import { v } from '@/config/tokens';
import { useCreateAppeal, useValidateAppealLink } from '../hooks/useSupport';
import { appealSchema } from '../utils/supportSchemas';
import { describeSupportError, isRateLimited, isTokenInvalid } from '../utils/supportErrors';
import { Eyebrow, Field, Notice, PrimaryButton, SupportPage } from './SupportPrimitives';

const SUBJECT_KEY = 'lx-appeal-subject';
const BODY_KEY = 'lx-appeal-body';

/**
 * Reads one value the tab kept across a reload.
 *
 * Guarded because sessionStorage throws outright in some privacy modes rather
 * than returning nothing, and this screen has to render for a banned user on
 * whatever browser they happen to hold.
 *
 * @param {string} key the storage key
 * @returns {string} the stored value, or an empty string
 */
const readStored = (key) => {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

/**
 * Writes one value for the tab to keep across a reload.
 *
 * @param {string} key the storage key
 * @param {string} value the value to keep
 */
const writeStored = (key, value) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // A browser refusing storage costs the reader their draft on reload, which
    // is the state this screen was already in. It must not cost them the form.
  }
};

/** Drops the draft once the appeal has been accepted, or the link is spent. */
const clearStored = () => {
  for (const key of [SUBJECT_KEY, BODY_KEY]) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // As above: nothing here is worth failing the screen for.
    }
  }
};

/**
 * The appeal form reached from the signed link in a moderation notice.
 *
 * This screen must work for a signed-out, banned account. It therefore reads
 * nothing from the auth store, calls no authenticated endpoint, and sits
 * outside `ProtectedRoute`. The account it is submitted for cannot authenticate
 * at all - `TokenPrincipalResolverImpl` admits only ACTIVE - which is the whole
 * reason this path exists.
 *
 * Redeeming the token creates exactly one ticket and mints no session: no
 * access token, no refresh token, no refresh_tokens row. Nothing here writes to
 * the auth store, so there is no client-side path to one either.
 *
 * The appealed category is carried by the token and resolved server-side. It is
 * deliberately not a field: a client-supplied category would let a submitter
 * appeal something the link never authorised.
 */
export function AppealLandingScreen() {
  const [searchParams] = useSearchParams();
  // Read from the address and nowhere else. This is a single-use credential that
  // authorises opening an appeal, and no credential is copied into
  // sessionStorage, localStorage or a cookie - the same rule that keeps access
  // tokens out of browser storage, applied to a token that is strictly more
  // powerful than the read-only status link this screen hands back.
  //
  // It is therefore also not stripped from the address: without a stored copy,
  // stripping it would make a reload or a restored tab destructive, and the copy
  // is the part that is forbidden. The draft below is form text rather than a
  // credential, and is still kept.
  const [linkSpent, setLinkSpent] = useState(false);
  const token = linkSpent ? '' : (searchParams.get('token') ?? '');
  const [values, setValues] = useState(() => ({
    subject: readStored(SUBJECT_KEY),
    body: readStored(BODY_KEY),
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Handed back by the redemption that spends the appeal token. It is the
  // only thing this reader will hold afterwards: they have no session, and
  // the credential they arrived with has just been destroyed.
  const [statusToken, setStatusToken] = useState('');
  // Confirms the copy happened. The clipboard write is silent otherwise, and
  // a reader told this is their only way back needs to see that it worked.
  const [statusCopied, setStatusCopied] = useState(false);
  const appeal = useCreateAppeal();
  // Checked before the form is offered. Presence of a token string is not
  // validity: any string at all used to render the whole form with an enabled
  // button, and the reader learned the link was dead only on submit, with what
  // they had written lost. This read never redeems the token.
  const link = useValidateAppealLink(token);

  // Kept in step as the reader types, so a reload mid-appeal loses nothing.
  useEffect(() => {
    writeStored(SUBJECT_KEY, values.subject);
    writeStored(BODY_KEY, values.body);
  }, [values]);

  if (!token) {
    return (
      <SupportPage
        title="This link is not complete"
        intro="The address is missing its token, so we cannot tell which decision you are appealing."
      >
        <Notice tone="bad" role="alert">
          Open the link from the email again, in full. If you no longer have it, you can still reach
          us through the public form.
        </Notice>
        <a
          href={ROUTES.SUPPORT_PUBLIC}
          style={{ fontFamily: v.fontBody, fontSize: 14, color: v.accentText }}
        >
          Use the public form
        </a>
      </SupportPage>
    );
  }

  // Checked before the form, not after it. A dead link that only announces
  // itself on submit costs the reader everything they wrote.
  if (link.isPending) {
    return (
      <SupportPage title="Checking your link" intro="One moment.">
        <div
          className="lx-skeleton"
          style={{ height: 56, borderRadius: 12 }}
          role="status"
          aria-label="Checking your link"
        />
      </SupportPage>
    );
  }

  if (link.isError && isTokenInvalid(link.error)) {
    return (
      <SupportPage
        title="This link has already been used"
        intro="Each appeal link works once, and expires if it is left too long."
      >
        <Notice tone="bad" role="alert">
          If you already sent an appeal, it is with us and you do not need to send another. If you
          did not, you can still reach us through the public form.
        </Notice>
        <a
          href={ROUTES.SUPPORT_PUBLIC}
          style={{ fontFamily: v.fontBody, fontSize: 14, color: v.accentText }}
        >
          Use the public form
        </a>
      </SupportPage>
    );
  }

  if (link.isError) {
    return (
      <SupportPage
        title="We could not check your link just now"
        intro="This looks like a connection problem rather than a problem with your link."
      >
        <Notice tone="bad" role="alert">
          Reload this page to try again. Your link has not been used.
        </Notice>
      </SupportPage>
    );
  }

  if (submitted) {
    const statusUrl = statusToken
      ? `${window.location.origin}${ROUTES.SUPPORT_APPEAL_STATUS}?token=${encodeURIComponent(statusToken)}`
      : '';
    return (
      <SupportPage
        title="Your appeal is with us"
        intro="A member of staff will review it and reply to the address we hold for your account."
      >
        <Notice tone="good" role="status">
          This link has now been used and will not work again. You do not need to send it a second
          time.
        </Notice>

        {statusUrl ? (
          <div
            style={{
              background: v.surface,
              border: `1px solid ${v.border}`,
              borderRadius: 12,
              padding: '14px 16px',
              marginTop: 20,
            }}
          >
            <Eyebrow>Keep this link</Eyebrow>
            <div
              style={{
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink2,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              It is how you check your appeal later. You have no account to sign in to while this is
              being decided, so this address is the only way back to it. We will not show it again.
            </div>
            <div
              style={{
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink2,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              We have also emailed it to the address your original notice went to.
            </div>
            {/* A real anchor rather than a router Link: the reader is being
                asked to copy or bookmark the address, so it has to be a
                complete one they can right-click, not an in-app transition. */}
            <a
              href={statusUrl}
              style={{
                fontFamily: v.fontMono,
                fontSize: 13,
                color: v.accentText,
                wordBreak: 'break-all',
                lineHeight: 1.6,
              }}
            >
              {statusUrl}
            </a>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={async () => {
                  await copyToClipboard(statusUrl, 'copy your appeal status link');
                  setStatusCopied(true);
                }}
                style={{
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  color: v.ink,
                  background: v.bg,
                  border: `1px solid ${v.border}`,
                  borderRadius: 999,
                  padding: '9px 16px',
                  minHeight: 44,
                  cursor: 'pointer',
                }}
              >
                {statusCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        ) : null}
      </SupportPage>
    );
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    setFailure('');
    const parsed = appealSchema.safeParse(values);
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0]] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    appeal.mutate(
      { token, subject: parsed.data.subject, body: parsed.data.body },
      {
        onSuccess: (result) => {
          // The credential is spent and the appeal is delivered, so neither the
          // token nor the draft has any further use. Left behind, the draft
          // would reappear in the form on a later visit.
          clearStored();
          // Deliberately held in component state and never written to storage.
          // It reads the appeal for ninety days, so it is a credential in its
          // own right; the reader is given the address and asked to keep it
          // where they choose rather than having it persisted for them.
          setStatusToken(result?.statusToken ?? '');
          setSubmitted(true);
        },
        onError: (error) => {
          if (isTokenInvalid(error)) {
            // Terminal. Clearing the token drops the form and shows the spent
            // state, rather than inviting a retry that can only fail again.
            clearStored();
            setLinkSpent(true);
            setFailure('');
            return;
          }
          // Every other refusal leaves the token intact - the backend now runs
          // its checks before redeeming - so the draft stays where it is and
          // the reader can act on the reason without retyping anything.
          setFailure(describeSupportError(error));
        },
      }
    );
  };

  const spent = isTokenInvalid(appeal.error);

  return (
    <SupportPage
      title="Appeal a decision"
      intro="Tell us why you think the decision on your account should be looked at again. One request, one reply."
    >
      {spent ? (
        <Notice tone="bad" role="alert">
          This link has already been used, or it has expired. Each appeal link works once.
        </Notice>
      ) : null}

      {failure ? (
        <Notice tone="bad" role="alert">
          {failure}
        </Notice>
      ) : null}

      {isRateLimited(appeal.error) ? (
        <Notice tone="warn" role="alert">
          Too many attempts from here. Wait a little and try again.
        </Notice>
      ) : null}

      <div
        style={{
          background: v.surface,
          border: `1px solid ${v.border}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        <Eyebrow>What you are appealing</Eyebrow>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.5 }}>
          The decision named in the email you followed this link from. We have matched it to that
          decision already, so you do not need to describe which one it was.
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Summary" htmlFor="appeal-subject" error={fieldErrors.subject}>
          <input
            id="appeal-subject"
            required
            aria-required="true"
            value={values.subject}
            onChange={(event) => setValues((prev) => ({ ...prev, subject: event.target.value }))}
            aria-invalid={Boolean(fieldErrors.subject)}
            aria-describedby={fieldErrors.subject ? 'appeal-subject-error' : undefined}
          />
        </Field>

        <Field
          label="Why should this be reviewed"
          htmlFor="appeal-body"
          error={fieldErrors.body}
          hint="One request and one reply. There is no back and forth, so include everything now."
        >
          <textarea
            id="appeal-body"
            rows={8}
            required
            aria-required="true"
            value={values.body}
            onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? 'appeal-body-error' : 'appeal-body-hint'}
          />
        </Field>

        <PrimaryButton disabled={appeal.isPending}>
          {appeal.isPending ? 'sending' : 'Send appeal'}
        </PrimaryButton>
      </form>
    </SupportPage>
  );
}

export default AppealLandingScreen;
