import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import { v } from '@/config/tokens';
import { useAppealStatus } from '../hooks/useSupport';
import { isRateLimited, isTokenInvalid } from '../utils/supportErrors';
import { Eyebrow, Notice, SupportPage } from './SupportPrimitives';
import { staffResponseHeading, statusLabel } from '../utils/ticketStatus';

const TOKEN_KEY = 'lx-appeal-status-token';

/**
 * Reads the token the tab kept across a reload.
 *
 * Guarded because sessionStorage throws outright in some privacy modes rather
 * than returning nothing, and this screen has to render for a banned user on
 * whatever browser they happen to hold.
 */
const readStored = () => {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeStored = (value) => {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Losing it costs the reader a reload, not the page. They still hold the
    // link itself, which is the durable copy.
  }
};

/**
 * Formats a timestamp in the reader's own timezone.
 *
 * Never assumes UTC for display. The value arrives as an ISO instant and is
 * rendered where the reader is.
 */
const formatWhen = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
};

/**
 * The appeal an appellant with no session can still read.
 *
 * The appeal token is spent by the submission that created the ticket, and this
 * reader holds no session - that is the premise of the whole signed path. Before
 * this screen they walked away from filing with nothing, and could never learn
 * whether anyone had read it.
 *
 * Read-only in both directions. The call never consumes its token, so the link
 * survives being followed repeatedly, and there is nothing on this screen that
 * writes anything. It reads nothing from the auth store and sits outside
 * `ProtectedRoute`, like the three anonymous screens beside it.
 *
 * What it shows is the owner-facing shape, the same record the account's own
 * ticket screen renders. That record has no field for the staff-only note, the
 * assignee or the escalation reason, so there is nothing here to filter.
 */
export function AppealStatusScreen() {
  const [searchParams] = useSearchParams();
  // Seeded from the address bar, then from the tab's own store, following the
  // appeal screen exactly. Stripping the token from the URL is right against
  // referrer and history leakage, but on its own it makes an ordinary reload
  // destructive.
  const [token] = useState(() => searchParams.get('token') ?? readStored());
  const status = useAppealStatus(token);

  useEffect(() => {
    const fromUrl = searchParams.get('token');
    if (fromUrl) {
      writeStored(fromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  if (!token) {
    return (
      <SupportPage
        title="This link is not complete"
        intro="The address is missing its token, so we cannot tell which appeal to show you."
      >
        <Notice tone="bad" role="alert">
          Open the link again, in full. If you no longer have it, you can ask us to send your appeal
          link again.
        </Notice>
        <Link
          to={ROUTES.SUPPORT_APPEAL_RESEND}
          style={{ fontFamily: v.fontBody, fontSize: 14, color: v.accentText }}
        >
          Send me my link again
        </Link>
      </SupportPage>
    );
  }

  if (status.isPending) {
    return (
      <SupportPage title="Finding your appeal" intro="One moment.">
        <div
          className="lx-skeleton"
          style={{ height: 96, borderRadius: 12 }}
          role="status"
          aria-label="Finding your appeal"
        />
      </SupportPage>
    );
  }

  if (status.isError && isRateLimited(status.error)) {
    return (
      <SupportPage
        title="Too many checks from here"
        intro="Your appeal is safe. This is only a limit on how often the page can be reloaded."
      >
        <Notice tone="warn" role="alert">
          Wait a little and reload. Nothing about your appeal has changed.
        </Notice>
      </SupportPage>
    );
  }

  // One state for every negative answer, which is what the server gives us: an
  // unknown token, an expired one and one naming an appeal that no longer
  // exists are deliberately indistinguishable, so the copy must not guess which
  // of the three happened.
  if (status.isError) {
    const expected = isTokenInvalid(status.error);
    return (
      <SupportPage
        title={expected ? 'We cannot open this link' : 'We could not check your appeal just now'}
        intro={
          expected
            ? 'Status links expire, and each one belongs to a single appeal.'
            : 'This looks like a connection problem rather than a problem with your link.'
        }
      >
        <Notice tone="bad" role="alert">
          {expected
            ? 'If you filed an appeal it is still with us, and this link expiring does not affect it. We reply by email either way.'
            : 'Reload this page to try again.'}
        </Notice>
        {expected ? (
          <Link
            to={ROUTES.SUPPORT_APPEAL_RESEND}
            style={{ fontFamily: v.fontBody, fontSize: 14, color: v.accentText }}
          >
            Send me my link again
          </Link>
        ) : null}
      </SupportPage>
    );
  }

  const ticket = status.data ?? {};
  const answered = Boolean(ticket.staffResponse);

  return (
    <SupportPage
      title="Your appeal"
      intro="This link stays valid while your appeal is open. You can come back to it at any time."
    >
      <div
        style={{
          background: v.surface,
          border: `1px solid ${v.border}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Eyebrow>Status</Eyebrow>
          <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.5 }}>
            {statusLabel(ticket.status)}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Eyebrow>What you sent</Eyebrow>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 15,
            color: v.ink,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          {ticket.subject}
        </div>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink2,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {ticket.body}
        </div>
        {ticket.createdAt ? (
          <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3, marginTop: 8 }}>
            Sent {formatWhen(ticket.createdAt)}
          </div>
        ) : null}
      </div>

      {answered ? (
        <div>
          <Eyebrow>{staffResponseHeading(ticket.status)}</Eyebrow>
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              background: v.surface,
              border: `1px solid ${v.border}`,
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            {ticket.staffResponse}
          </div>
          {ticket.respondedAt ? (
            <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3, marginTop: 8 }}>
              Replied {formatWhen(ticket.respondedAt)}
            </div>
          ) : null}
        </div>
      ) : (
        <Notice tone="neutral" role="status">
          No reply yet. We will email the address on the account when there is one, and this page
          will show it too.
        </Notice>
      )}
    </SupportPage>
  );
}

export default AppealStatusScreen;
