import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';

import { useActionDetail } from '../hooks/useActions';
import { useVocabularies } from '../hooks/useVocabularies';
import { getErrorCode } from '../lib/errors';
import { PageHeader, PanelCard } from './PanelPage';
import { Field, FieldGrid, NoteBlock, detailLabel } from './DetailPrimitives';
import { LocalTime } from './LocalTime';
import { ReporterName } from './ReporterName';
import { FailedState, LoadingState } from './ListStates';
import { NotAvailable } from './NotAvailable';

/**
 * One moderation action, filling the log's right region.
 *
 * Opening a row is the only thing that fetches an action's detail; the list
 * never carries `metadata`. This was a modal drawer over a scrim until it was
 * made to match the report, account and support consoles: every other list in
 * the panel opens its record beside the list rather than on top of it, and a
 * scrim that hides the log is a poor fit for a screen whose whole purpose is
 * reading one row in the context of the rows around it.
 *
 * The metadata object's shape depends on the action type. Each shape enumerated
 * in the contract verification is rendered deliberately by recognising its keys;
 * any key not recognised falls through to a readable generic key/value line, so
 * an unenumerated shape renders legibly rather than blank or broken. A null
 * metadata renders as an explicit "no additional detail" rather than an empty
 * region.
 */
const FIELD_LABEL = {
  reasonKey: 'reason',
  strikeNumber: 'strike number',
  resultingStatus: 'resulting status',
  consequenceApplied: 'consequence applied',
  // Renamed from `strippedHashtags`, and the label changed with it because the
  // meaning did: it is the banned tags the caption still carries after the
  // restore — the post's state — not what that call removed.
  remainingBannedHashtags: 'banned hashtags still in the caption',
  warningIds: 'warnings rolled up',
  triggeredByModeratorId: 'triggered by',
};

const humanize = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

/** Renders one metadata value, recognising the enumerated shapes' keys. */
function MetaValue({ fieldKey, value, reasonLabel }) {
  if (fieldKey === 'reasonKey') {
    return <>{reasonLabel(value)}</>;
  }
  if (fieldKey === 'consequenceApplied') {
    return <>{value ? 'yes' : 'no'}</>;
  }
  if (fieldKey === 'triggeredByModeratorId') {
    return <ReporterName userId={value} prefix="@" />;
  }
  if (fieldKey === 'remainingBannedHashtags' || fieldKey === 'warningIds') {
    if (!Array.isArray(value) || value.length === 0) {
      return <span style={{ color: v.ink2 }}>none</span>;
    }
    if (fieldKey === 'remainingBannedHashtags') {
      return <>{value.map((tag) => `#${tag}`).join(', ')}</>;
    }
    return (
      <>
        {value.length} warning{value.length === 1 ? '' : 's'}
      </>
    );
  }
  if (value === null || value === undefined) {
    return <span style={{ color: v.ink2 }}>none</span>;
  }
  if (typeof value === 'object') {
    return (
      <code style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value, null, 2)}
      </code>
    );
  }
  return <>{String(value)}</>;
}

function ActionMetadata({ metadata, reasonLabel }) {
  if (
    metadata === null ||
    metadata === undefined ||
    (typeof metadata === 'object' && Object.keys(metadata).length === 0)
  ) {
    return (
      <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        no additional detail recorded.
      </span>
    );
  }
  if (typeof metadata !== 'object') {
    return (
      <span style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink }}>{String(metadata)}</span>
    );
  }
  return (
    <FieldGrid>
      {Object.entries(metadata).map(([key, value]) => (
        <Field key={key} label={FIELD_LABEL[key] ?? humanize(key)}>
          <MetaValue fieldKey={key} value={value} reasonLabel={reasonLabel} />
        </Field>
      ))}
    </FieldGrid>
  );
}

export function ActionDetailPanel({ actionId }) {
  const { action, isLoading, isError, error } = useActionDetail(actionId);
  const { actionLabel, actionKnown, reasonLabel } = useVocabularies();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="action" />
        <PanelCard>
          <LoadingState rows={3} />
        </PanelCard>
      </div>
    );
  }

  if (isError && getErrorCode(error) === 'ADMIN_ACTION_NOT_FOUND') {
    return (
      <div>
        <PageHeader title="action" />
        <NotAvailable
          title="action not available"
          message="this action was not found, or it was performed by someone else and is not visible to you."
        />
      </div>
    );
  }

  if (isError || !action) {
    return (
      <div>
        <PageHeader title="action" />
        <PanelCard>
          <FailedState message={error?.message} />
        </PanelCard>
      </div>
    );
  }

  const known = actionKnown(action.actionType);

  return (
    <div>
      <PageHeader
        title={
          <>
            action <span style={{ color: v.ink2, fontWeight: 500 }}>{action.id?.slice(0, 8)}</span>
          </>
        }
      />

      <PanelCard title="details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 600, color: v.ink }}>
              {known ? actionLabel(action.actionType) : action.actionType}
            </span>
            {!known ? (
              <span
                title="this action type is not in the moderation-action vocabulary"
                style={{
                  fontFamily: v.fontMono,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: v.warningText,
                  background: v.warningDim,
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                unknown type
              </span>
            ) : null}
          </div>

          <FieldGrid>
            <Field label="performed by">
              {action.adminId ? (
                <ReporterName userId={action.adminId} prefix="@" />
              ) : (
                <span style={{ color: v.ink2, fontStyle: 'italic' }}>system</span>
              )}
            </Field>

            {action.targetUserId ? (
              <Field label="target account">
                <Link
                  to={routeTo.adminUser(action.targetUserId)}
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: v.accentText,
                  }}
                >
                  <ReporterName userId={action.targetUserId} prefix="@" />
                  <LxIcon name="chevronRight" size={13} color={v.accentText} />
                </Link>
              </Field>
            ) : (
              <Field label="target">
                {action.targetEntityType}
                {action.targetEntityId ? (
                  <span
                    style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2, marginLeft: 8 }}
                  >
                    {action.targetEntityId.slice(0, 8)}
                  </span>
                ) : null}
              </Field>
            )}

            <Field label="when">
              <LocalTime value={action.createdAt} />
            </Field>

            {/* The originating report is shown for every action that has one,
                but an `escalate_report` row deliberately does not link.
                Following your own escalations was the job this link was doing
                before a dedicated endpoint existed, and "my escalations" does
                it now — with the outcome, which a link to one report at a time
                never gave. Two routes to one job is the defect that removed, so
                the id stays as the record and the route is the screen. */}
            {action.reportId ? (
              <Field label="originating report">
                {action.actionType === 'escalate_report' ? (
                  <span style={{ fontFamily: v.fontMono, fontSize: 13, color: v.ink2 }}>
                    {action.reportId.slice(0, 8)} — listed under “my escalations”, with what became
                    of it
                  </span>
                ) : (
                  <Link
                    to={routeTo.adminReportDetail(action.reportId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: v.accentText,
                      textDecoration: 'none',
                    }}
                  >
                    <LxIcon name="external" size={14} color={v.accentText} />
                    open report {action.reportId.slice(0, 8)}
                  </Link>
                )}
              </Field>
            ) : null}
          </FieldGrid>

          {action.reason ? (
            <NoteBlock label="reason">{action.reason}</NoteBlock>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={detailLabel}>reason</span>
              <span style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2 }}>
                none recorded
              </span>
            </div>
          )}
        </div>
      </PanelCard>

      <PanelCard title="metadata">
        <ActionMetadata metadata={action.metadata} reasonLabel={reasonLabel} />
      </PanelCard>
    </div>
  );
}
