import type { ReactNode } from 'react';

import type { AdminUserSessionResponse, AdminUserReportResponse } from '@/types/admin';
import type { Column } from './RecordTable';
import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';

import { RecordTable } from './RecordTable';
import { LocalTime } from './LocalTime';
import { StatusBadge } from './StatusBadge';
import { shortId } from '../hooks/useResolveUsername';

/**
 * The live sessions of an account, and the reports filed against it.
 *
 * Both arrive inside the account detail payload rather than from an endpoint of
 * their own, so both are bounded sets with no cursor behind them. That is stated
 * rather than implied, because a list that looks paginated and is not invites a
 * reviewer to believe they have seen everything.
 *
 * **A session record is rendered as exactly what it carries.** The payload holds
 * a refresh-token row id, an optional opaque device id, the user agent string
 * recorded when the session was issued, the client address recorded at the same
 * moment, and two timestamps. It does not hold a location, a city, a resolved
 * device name, or a marker for which session is the reader's own. An address
 * shown as a place, or a user agent shown as "iPhone 15", would be the interface
 * inventing a fact from a string — and an address in particular is the kind of
 * invented fact a reviewer would then act on.
 *
 * **A session is ended one at a time, or all at once.** Both exist and they do
 * different jobs, so both are offered and each is named for what it does:
 * revoking one row ends that session and leaves the rest signed in, while the
 * account-wide action ends every session the account holds.
 *
 * **The reader's own row is marked by correlation, not by invention.** The
 * payload carries no "this is you" field. `POST /api/v1/auth/session` names the
 * caller's session and that id is matched against `row.id`. When the server
 * cannot determine it — which it reports as a null id, not an error — no row is
 * marked and the list says the determination was not possible, because an
 * unmarked list would otherwise read as "none of these is yours".
 *
 * **A revoked session cannot be un-revoked.** Nothing here implies otherwise:
 * the row leaves the list on the next read and the person signs in again, which
 * is the whole recovery path.
 */

export function SessionList({
  sessions,
  isSelf,
  onRevokeAll,
  onRevokeSession,
  currentSessionId,
  currentSessionKnown,
}: {
  sessions?: AdminUserSessionResponse[];
  isSelf: boolean;
  onRevokeAll?: () => void;
  onRevokeSession?: (row: AdminUserSessionResponse) => void;
  currentSessionId?: string | null;
  currentSessionKnown?: boolean;
}) {
  const rows = sessions ?? [];

  const columns: Column<AdminUserSessionResponse>[] = [
    {
      key: 'createdAt',
      header: 'signed in',
      width: '22%',
      nowrap: true,
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <LocalTime value={row.createdAt} showZone={false} />
          {/* Marked only when the server named the caller's session and it is
              this row. Never inferred from anything else. */}
          {currentSessionKnown && row.id === currentSessionId ? (
            <span
              style={{
                fontFamily: v.fontMono,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: v.accentText,
                border: `1px solid ${v.accentText}`,
                borderRadius: 'var(--radius-sm)',
                padding: '1px 5px',
                whiteSpace: 'nowrap',
              }}
            >
              this session
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      header: 'expires',
      width: '16%',
      nowrap: true,
      render: (row) => <LocalTime value={row.expiresAt} showZone={false} />,
    },
    {
      key: 'userAgent',
      header: 'user agent, as recorded',
      render: (row) =>
        row.userAgent ? (
          <span
            style={{
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink2,
              wordBreak: 'break-word',
            }}
          >
            {row.userAgent}
          </span>
        ) : (
          <Muted>none recorded</Muted>
        ),
    },
    {
      key: 'ipAddress',
      header: 'address, as recorded',
      width: '18%',
      render: (row) =>
        row.ipAddress ? (
          <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2 }}>
            {row.ipAddress}
          </span>
        ) : (
          <Muted>none recorded</Muted>
        ),
    },
    {
      key: 'deviceId',
      header: 'device id',
      width: '12%',
      nowrap: true,
      render: (row) =>
        row.deviceId ? (
          <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2 }}>
            {shortId(row.deviceId)}
          </span>
        ) : (
          <Muted>not supplied</Muted>
        ),
    },
  ];

  // Rendered only where the caller may actually revoke. An administrator-only
  // action is not drawn for a moderator and then refused.
  if (onRevokeSession) {
    columns.push({
      key: 'revoke',
      header: 'end',
      width: '11%',
      nowrap: true,
      render: (row) => (
        <LxBtn
          variant="ghost"
          size="sm"
          onClick={() => onRevokeSession(row)}
          aria-label={`end the session signed in on ${row.userAgent || 'an unrecorded client'}`}
        >
          end
        </LxBtn>
      ),
    });
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SubHeading
        icon="lock"
        title={`live sessions — ${rows.length}`}
        note="a session is live while its refresh token is neither revoked nor expired. the token itself is never exposed."
      />

      <RecordTable
        columns={columns}
        rows={rows}
        emptyIcon="lock"
        emptyTitle="no live sessions"
        emptyHint="this account is not signed in anywhere. either it has never signed in, or every session has been revoked or has expired."
      />

      <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
        the address and the user agent are the strings recorded when each session was issued. they
        are shown as they are: the record does not say where the person was or what device they
        held, and this panel does not guess.
      </p>

      {/* Said only when the reader is looking at their own account and the
          server could not name which row is theirs, so an unmarked list is not
          read as "none of these is mine". */}
      {rows.length > 0 && isSelf && !currentSessionKnown ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          which of these is the session you are reading this in could not be determined, so none is
          marked. ending any one of them may sign you out.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: isSelf ? v.warningDim : v.surface,
          }}
        >
          <LxIcon name="alert" size={14} color={isSelf ? v.warningText : v.ink2} />
          <span
            style={{
              fontFamily: v.fontBody,
              fontSize: 12,
              color: isSelf ? v.warningText : v.ink2,
              flex: '1 1 260px',
              minWidth: 0,
            }}
          >
            {isSelf
              ? 'these are your own sessions, and one of them is the session you are reading this in. ending them all ends that one too and signs you out immediately.'
              : 'ending one session leaves this account signed in everywhere else. the action below ends every session it holds, at once.'}
          </span>
          {onRevokeAll ? (
            <LxBtn variant="secondary" size="sm" onClick={onRevokeAll}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LxIcon name="logout" size={13} color={v.ink2} />
                {isSelf ? 'sign out all my sessions' : 'end all sessions'}
              </span>
            </LxBtn>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The reports filed against this account.
 *
 * The payload calls this "the most recent reports filed against this account",
 * and there is no cursor and no total behind it, so it is a bounded recent set
 * and the panel says so instead of implying completeness. Each entry carries a
 * report id, so each row opens the report it names.
 */
export function ReportsAgainstList({ reports }: { reports?: AdminUserReportResponse[] }) {
  const rows = reports ?? [];

  const columns: Column<AdminUserReportResponse>[] = [
    {
      key: 'createdAt',
      header: 'filed',
      width: '24%',
      nowrap: true,
      render: (row) => <LocalTime value={row.createdAt} showZone={false} />,
    },
    {
      key: 'reportReason',
      header: 'reason',
      width: '24%',
      nowrap: true,
      render: (row) => (
        <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
          {String(row.reportReason ?? '').replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'status',
      width: '20%',
      nowrap: true,
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'id',
      header: 'report',
      render: (row) => (
        <Link
          to={routeTo.adminReportDetail(row.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: v.accentText,
            textDecoration: 'none',
            fontFamily: v.fontMono,
            fontSize: 12,
          }}
        >
          {shortId(row.id)}
          <LxIcon name="chevronRight" size={12} color={v.accentText} />
        </Link>
      ),
    },
  ];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SubHeading
        icon="flag"
        title={`reports against this account — ${rows.length}`}
        note="the most recent reports naming this account as the target."
      />

      <RecordTable
        columns={columns}
        rows={rows}
        emptyIcon="check"
        emptyTitle="no reports against this account"
        emptyHint="nobody has reported this account. this is the healthy case."
      />

      {rows.length > 0 ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          this is the recent set the account detail carries, not a full history — there is no
          paginated list of reports against one account, so an older report may exist without
          appearing here.
        </p>
      ) : null}
    </section>
  );
}

function SubHeading({ icon, title, note }: { icon: string; title: string; note?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        <LxIcon name={icon} size={12} color={v.ink2} />
        {title}
      </span>
      <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>{note}</span>
    </div>
  );
}

const Muted = ({ children }: { label?: ReactNode; children?: ReactNode }) => (
  <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>{children}</span>
);
