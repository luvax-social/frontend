import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { ROUTES } from '@/config/constants';
import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';
import { toast } from '@/features/luvax/components/Toast';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { Field, FieldGrid, NoteBlock } from '../components/DetailPrimitives';
import { AdminMediaGrid } from '../components/AdminMediaViewer';
import { StatusBadge } from '../components/StatusBadge';
import { LocalTime } from '../components/LocalTime';
import { ReporterName } from '../components/ReporterName';
import { ReasonConfirmDialog } from '../components/ReasonConfirmDialog';
import { AccountDisciplinePanel } from '../components/AccountDisciplinePanel';
import { FailedState, LoadingState } from '../components/ListStates';
import { NotAvailable } from '../components/NotAvailable';
import { useReportDetail, useReportTarget } from '../hooks/useReportDetail';
import { useReportActions } from '../hooks/useReportActions';
import { useVocabularies } from '../hooks/useVocabularies';
import { describeError, getErrorCode } from '../lib/errors';
import { ACTIONABLE_TARGET_TYPES } from '../lib/reportSchema';
import {
  removeConfirmDescription,
  removeSuccessMessage,
  restoreConfirmDescription,
  restoreSuccessMessage,
} from '../lib/contentModeration';

function TargetRegion({ target, isLoading, isError }) {
  if (isLoading) {
    return (
      <div style={{ color: v.ink2, fontFamily: v.fontBody, fontSize: 13 }}>loading content...</div>
    );
  }
  if (isError || !target) {
    return (
      <div style={{ color: v.ink2, fontFamily: v.fontBody, fontSize: 13 }}>
        the reported content could not be loaded.
      </div>
    );
  }

  const isUser = target.reportType === 'user';
  const hasText = typeof target.text === 'string' && target.text.length > 0;
  const media = Array.isArray(target.mediaUrls) ? target.mediaUrls : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: v.ink2,
          }}
        >
          {target.reportType}
        </span>
        {target.status ? <StatusBadge status={target.status} size="sm" /> : null}
        {/* The removed flag is always rendered, but only as its own badge when
            the lifecycle status does not already convey it, so a removed post
            does not show "removed" twice. */}
        {target.removed && target.status !== 'removed' ? (
          <StatusBadge status="removed" size="sm" />
        ) : null}
      </div>

      <Field label="owner">
        {target.ownerUsername ? (
          `@${target.ownerUsername}`
        ) : (
          <span style={{ fontFamily: v.fontMono, color: v.ink2 }} title={target.ownerId ?? ''}>
            {target.ownerId ? target.ownerId.slice(0, 8) : 'unknown'}
          </span>
        )}
      </Field>

      {/* A user target has no text; render no empty content block where text would be. */}
      {!isUser && hasText ? <NoteBlock label="reported text">{target.text}</NoteBlock> : null}

      <AdminMediaGrid urls={media} label="reported media" />
    </div>
  );
}

/**
 * Rendered two ways from one implementation. On its own route it is the whole
 * screen and reads the report from the path. Inside the queue's right region it
 * is handed the id and drops its own "back to reports" link, because the split
 * carries the way back. Neither form changes what is fetched.
 */
export function ReportDetailScreen({ reportId: reportIdProp, embedded = false }) {
  const params = useParams();
  const reportId = reportIdProp ?? params.reportId;
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const { reasonLabel } = useVocabularies();

  const { report, isLoading, isError, error, refetch } = useReportDetail(reportId);
  const { target, isLoading: targetLoading, isError: targetError } = useReportTarget(reportId);
  const actions = useReportActions(reportId);

  const [activeAction, setActiveAction] = useState(null);
  const [serverError, setServerError] = useState(null);

  const closeDialog = () => {
    setActiveAction(null);
    setServerError(null);
  };

  const handleActionError = (err, { keepOpenOnField = true } = {}) => {
    const described = describeError(err);
    if (described.isConflict) {
      toast('another reviewer already handled this. refreshing.');
      refetch();
      closeDialog();
      return;
    }
    if (described.kind === 'field' && keepOpenOnField) {
      setServerError(described.fields?.reason || described.message);
      return;
    }
    if (described.kind === 'page') {
      toast(described.message);
      refetch();
      closeDialog();
      return;
    }
    if (described.kind !== 'silent') {
      toast(described.message);
    }
    closeDialog();
  };

  // Report load states. A 404 for a moderator on a closed report, or after
  // another reviewer resolved it, renders as a calm not-found rather than an
  // error dialogue.
  if (isLoading) {
    return (
      <div>
        <PageHeader title="report" />
        <PanelCard>
          <LoadingState rows={3} />
        </PanelCard>
      </div>
    );
  }
  if (isError && getErrorCode(error) === 'REPORT_NOT_FOUND') {
    return (
      <div>
        <PageHeader title="report" />
        <NotAvailable
          title="report not available"
          message="this report was not found, or it has been closed and is no longer open for review."
        />
      </div>
    );
  }
  if (isError || !report) {
    return (
      <div>
        <PageHeader title="report" />
        <PanelCard>
          <FailedState message={error?.message} onRetry={refetch} />
        </PanelCard>
      </div>
    );
  }

  const status = report.status;
  const targetType = target?.reportType;
  const isActionableTarget = target && ACTIONABLE_TARGET_TYPES.has(targetType);

  // Conditional controls: render, never disable-and-403.
  const canMarkReviewing = status === 'pending';
  const canEscalate = status === 'pending' || status === 'reviewing';
  const canResolveDismiss = status !== 'escalated' || isAdmin;
  const canRemove = isActionableTarget && target.removed === false;
  const canRestore = isActionableTarget && target.removed === true;

  const anyControl =
    canMarkReviewing || canEscalate || canResolveDismiss || canRemove || canRestore;

  const openReason = (config) => {
    setServerError(null);
    setActiveAction(config);
  };

  const dialogBusy = activeAction?.mutation?.isPending ?? false;

  const runMarkReviewing = () => {
    actions.markReviewing.mutate(undefined, {
      onSuccess: () => toast('marked as reviewing'),
      onError: (err) => handleActionError(err, { keepOpenOnField: false }),
    });
  };

  const contentActionInFlight = actions.removeContent.isPending || actions.restoreContent.isPending;

  return (
    <div>
      <PageHeader
        title={
          <>
            report <span style={{ color: v.ink2, fontWeight: 500 }}>{reportId?.slice(0, 8)}</span>
          </>
        }
        right={
          embedded ? null : (
            <Link
              to={ROUTES.ADMIN_REPORTS}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: v.fontBody,
                fontSize: 13,
                color: v.ink2,
                textDecoration: 'none',
              }}
            >
              <LxIcon name="chevronLeft" size={14} color={v.ink2} />
              back to reports
            </Link>
          )
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0 }}>
        <PanelCard title="details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status is the one field on this card shaped like a badge
                everywhere else in the panel, so it leads here too — the same
                hierarchy the account screen uses: state up top as a pill,
                supporting facts below in the grid. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge status={report.status} />
              <span
                style={{
                  fontFamily: v.fontMono,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: v.ink2,
                }}
              >
                {report.reportType}
              </span>
            </div>

            <FieldGrid>
              <Field label="reason">{reasonLabel(report.reportReason)}</Field>
              <Field label="reporter">
                <ReporterName userId={report.reporterId} prefix="@" />
              </Field>
              <Field label="reported">
                <LocalTime value={report.createdAt} />
              </Field>
              {report.reviewedAt ? (
                <Field label="reviewed">
                  <LocalTime value={report.reviewedAt} />
                </Field>
              ) : null}
            </FieldGrid>

            {report.description ? (
              <NoteBlock label="reporter note">{report.description}</NoteBlock>
            ) : null}
            {report.resolutionNote ? (
              <NoteBlock label="resolution note">{report.resolutionNote}</NoteBlock>
            ) : null}
          </div>
        </PanelCard>

        <PanelCard title="reported content">
          <TargetRegion target={target} isLoading={targetLoading} isError={targetError} />
        </PanelCard>

        {anyControl ? (
          <PanelCard title="actions">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {canMarkReviewing ? (
                <LxBtn
                  variant="secondary"
                  onClick={runMarkReviewing}
                  disabled={actions.markReviewing.isPending}
                >
                  mark as reviewing
                </LxBtn>
              ) : null}

              {canEscalate ? (
                <LxBtn
                  variant="secondary"
                  onClick={() =>
                    openReason({
                      key: 'escalate',
                      title: 'escalate report',
                      description: 'this report will be handed to an administrator to close.',
                      confirmLabel: 'escalate',
                      tone: 'primary',
                      mutation: actions.escalate,
                      run: (reason) =>
                        actions.escalate.mutate(reason, {
                          onSuccess: () => {
                            toast('report escalated');
                            closeDialog();
                          },
                          onError: handleActionError,
                        }),
                    })
                  }
                >
                  escalate
                </LxBtn>
              ) : null}

              {canResolveDismiss ? (
                <>
                  <LxBtn
                    variant="primary"
                    onClick={() =>
                      openReason({
                        key: 'resolve',
                        title: 'resolve report',
                        description: 'mark this report as resolved. the reason is recorded.',
                        confirmLabel: 'resolve',
                        tone: 'primary',
                        mutation: actions.resolve,
                        run: (reason) =>
                          actions.resolve.mutate(reason, {
                            onSuccess: () => {
                              toast('report resolved');
                              closeDialog();
                            },
                            onError: handleActionError,
                          }),
                      })
                    }
                  >
                    resolve
                  </LxBtn>
                  <LxBtn
                    variant="ghost"
                    onClick={() =>
                      openReason({
                        key: 'dismiss',
                        title: 'dismiss report',
                        description: 'dismiss this report as no violation. the reason is recorded.',
                        confirmLabel: 'dismiss',
                        tone: 'primary',
                        mutation: actions.dismiss,
                        run: (reason) =>
                          actions.dismiss.mutate(reason, {
                            onSuccess: () => {
                              toast('report dismissed');
                              closeDialog();
                            },
                            onError: handleActionError,
                          }),
                      })
                    }
                  >
                    dismiss
                  </LxBtn>
                </>
              ) : null}

              {canRemove ? (
                <LxBtn
                  variant="danger"
                  disabled={contentActionInFlight}
                  onClick={() =>
                    openReason({
                      key: 'remove',
                      title: `remove ${targetType}`,
                      description: removeConfirmDescription(targetType),
                      confirmLabel: 'remove',
                      tone: 'danger',
                      mutation: actions.removeContent,
                      run: (reason) =>
                        actions.removeContent.mutate(
                          { targetType, entityId: target.entityId, reason },
                          {
                            onSuccess: () => {
                              toast(removeSuccessMessage(targetType));
                              closeDialog();
                            },
                            onError: handleActionError,
                          }
                        ),
                    })
                  }
                >
                  remove {targetType}
                </LxBtn>
              ) : null}

              {canRestore ? (
                <LxBtn
                  variant="secondary"
                  disabled={contentActionInFlight}
                  onClick={() =>
                    openReason({
                      key: 'restore',
                      title: `restore ${targetType}`,
                      description: restoreConfirmDescription(targetType),
                      confirmLabel: 'restore',
                      tone: 'primary',
                      mutation: actions.restoreContent,
                      run: (reason) =>
                        actions.restoreContent.mutate(
                          { targetType, entityId: target.entityId, reason },
                          {
                            onSuccess: (data) => {
                              toast(restoreSuccessMessage(targetType, data));
                              closeDialog();
                            },
                            onError: handleActionError,
                          }
                        ),
                    })
                  }
                >
                  restore {targetType}
                </LxBtn>
              ) : null}
            </div>
          </PanelCard>
        ) : null}

        {/* The content owner's discipline history, in its own region. It loads
            after the report and the target through its own query and never
            blocks either. It is rendered only when the target carries an owner
            id; for a target type with no owner id it is absent rather than an
            empty panel. */}
        {target?.ownerId ? (
          <PanelCard title="account history">
            <AccountDisciplinePanel userId={target.ownerId} />
          </PanelCard>
        ) : null}
      </div>

      <ReasonConfirmDialog
        open={Boolean(activeAction)}
        title={activeAction?.title}
        description={activeAction?.description}
        confirmLabel={activeAction?.confirmLabel}
        tone={activeAction?.tone}
        busy={dialogBusy}
        serverError={serverError}
        onConfirm={(reason) => activeAction?.run(reason)}
        onClose={closeDialog}
      />
    </div>
  );
}
