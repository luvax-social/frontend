import { useState } from 'react';

import { v } from '@/config/tokens';
import { useAuthStore } from '@/store/useAuthStore';
import { LxBtn } from '@/features/luvax/components/primitives';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { Field, FieldGrid, NoteBlock, detailLabel } from '../components/DetailPrimitives';
import { LocalTime } from '../components/LocalTime';
import { StatusBadge } from '../components/StatusBadge';
import { ReporterName } from '../components/ReporterName';
import { FailedState, LoadingState } from '../components/ListStates';
import {
  useSupportTicket,
  useSupportTicketActions,
  useVerificationRequest,
} from '../hooks/useSupportQueue';
import * as styles from './supportDetailStyles';
import { blockedReasonLabel, isAppealTicket, ticketCapabilities } from '../lib/supportTicketSchema';

const VERIFICATION_CATEGORY = 'VERIFICATION_REQUEST';

// Keyed by the field names `VerificationQueueItemResponse` actually returns. The
// last two were `evidenceAward` and `evidenceOther`, which that record does not
// carry, so the two pieces of evidence a requester is most likely to write prose
// into were read as undefined and never shown to the reviewer deciding on them.
const EVIDENCE_ROWS = [
  ['evidenceWebsite', 'official website'],
  ['evidenceOtherProfile', 'verified profile elsewhere'],
  ['evidenceEmailDomain', 'organisational email domain'],
  ['evidencePublishedWork', 'published work'],
  ['evidencePress', 'press coverage'],
  ['evidenceOfficialListing', 'official organisational listing'],
  ['evidenceNote', 'note to the moderator'],
];

const lower = (value) => (value ?? '').toLowerCase().replace(/_/g, ' ');

/**
 * One labelled control in the actions card.
 *
 * The hint sits under the label rather than inside the field as placeholder
 * text: a placeholder disappears the moment someone starts typing, which is
 * exactly when "this one reaches the requester, this one never does" matters
 * most.
 */
function FormField({ id, label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={detailLabel}>
        {label}
      </label>
      {hint ? (
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>{hint}</span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * One support ticket, and whatever this reviewer is actually allowed to do with
 * it.
 *
 * Laid out as the report detail is — a titled card per region, facts above
 * written text, every control in one actions card at the foot — because a
 * reviewer moves between the two queues all day and the two screens answering
 * the same questions in different shapes is a cost paid on every switch.
 *
 * The controls mirror the server's rules rather than merely hiding what looks
 * inapplicable. Two refusals are only knowable from the server and are
 * therefore surfaced from the failure rather than predicted: the
 * conflict-of-interest rule, which depends on `admin_actions.admin_id` that the
 * ticket does not carry, and the claim race, which is decided in an update
 * predicate. Both get their own sentence; neither is shown as a generic 403.
 */
export function SupportTicketDetailScreen({ ticketId, onClaimed }) {
  const viewerId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.role);
  const { data: ticket, isLoading, isError, refetch } = useSupportTicket(ticketId);
  const isVerification = ticket?.category === VERIFICATION_CATEGORY;
  const { data: verificationRequest } = useVerificationRequest(ticketId, isVerification);
  const actions = useSupportTicketActions(ticketId);

  const [staffResponse, setStaffResponse] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [refusal, setRefusal] = useState('');
  // Announced politely rather than shown: the outcome is already visible in the
  // ticket, so this exists for the operator who cannot see it change.
  const [announcement, setAnnouncement] = useState('');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="ticket" />
        <PanelCard>
          <LoadingState rows={3} />
        </PanelCard>
      </div>
    );
  }
  if (isError || !ticket) {
    return (
      <div>
        <PageHeader title="ticket" />
        <PanelCard>
          <FailedState message="that ticket could not be loaded." onRetry={() => refetch()} />
        </PanelCard>
      </div>
    );
  }

  const caps = ticketCapabilities(ticket, { id: viewerId, role });
  const blocked = blockedReasonLabel(caps.blockedReason, ticket);

  const handleFailure = (error) => {
    const code = error?.response?.data?.code;
    if (code === 'SUPPORT_CONFLICT_OF_INTEREST') {
      setRefusal(
        'you took the action this ticket is appealing, so you cannot act on it. hand it to another reviewer.'
      );
      return;
    }
    if (code === 'SUPPORT_APPEAL_REQUIRES_ADMIN') {
      setRefusal(
        'only an administrator can answer an appeal. escalate it and an administrator will pick it up.'
      );
      return;
    }
    if (code === 'SUPPORT_TICKET_ALREADY_CLAIMED') {
      setRefusal('another reviewer claimed this first. the ticket has been reloaded.');
      refetch();
      return;
    }
    if (code === 'SUPPORT_TICKET_NOT_CLAIMED') {
      setRefusal('claim this ticket before acting on it.');
      refetch();
      return;
    }
    if (code === 'SUPPORT_TICKET_INVALID_TRANSITION') {
      setRefusal('this ticket has already been decided. the ticket has been reloaded.');
      refetch();
      return;
    }
    setRefusal(error?.message || 'that did not work.');
  };

  const runAction = (mutation, payload, onDone, announcement) => {
    setRefusal('');
    setAnnouncement('');
    mutation.mutate(payload, {
      onError: handleFailure,
      onSuccess: (result) => {
        setStaffResponse('');
        setInternalNote('');
        setEscalationReason('');
        // Every one of these actions changes the ticket in place: the buttons
        // swap, the status badge changes, the queue refetches. None of that is
        // announced, so an operator using a screen reader had no confirmation
        // that a claim had succeeded or a decision been recorded.
        if (announcement) {
          setAnnouncement(announcement);
        }
        onDone?.(result);
      },
    });
  };

  const respondDisabled = !caps.canRespond || !staffResponse.trim() || actions.respond.isPending;

  // The appeal rule and the blocked reason would otherwise both say the same
  // thing in two sentences directly above each other. The blocked reason is the
  // more specific of the two, so it is the one that survives.
  const showAppealNotice = caps.isAppeal && caps.blockedReason !== 'appeal-requires-admin';

  const anyControl = caps.canClaim || caps.canRespond || caps.canEscalate;

  return (
    <div>
      <PageHeader title={ticket.subject} />

      {/*
        The console announced nothing at all: a claim, a decision and a refresh
        all changed the screen silently, so an operator using a screen reader had
        no confirmation that anything had happened. Polite rather than assertive,
        because none of these interrupts anything the operator is doing, and
        always mounted so the region exists before the text arrives - a live
        region added at the same moment as its content is not reliably announced.
      */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      >
        {announcement}
      </div>

      {refusal ? (
        <p style={styles.notice('bad')} role="alert">
          {refusal}
        </p>
      ) : null}

      {caps.claimedBySomeoneElse ? (
        <p style={styles.notice('warn')} role="status">
          another reviewer holds this ticket. you can read it, but not act on it.
        </p>
      ) : null}

      {showAppealNotice ? (
        <p style={styles.notice()} role="status">
          this is an appeal. only an administrator can answer or close it.
        </p>
      ) : null}

      <PanelCard title="details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status leads, as it does on the report detail: it is the one fact
              here shaped like a badge everywhere else in the panel. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <StatusBadge status={lower(ticket.status)} />
            {isAppealTicket(ticket) ? <StatusBadge status="appeal" size="sm" /> : null}
            <span
              style={{
                fontFamily: v.fontMono,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: v.ink2,
              }}
            >
              {lower(ticket.category)}
            </span>
          </div>

          <FieldGrid>
            <Field label="opened">
              <LocalTime value={ticket.createdAt} />
            </Field>
            <Field label="arrived as">{lower(ticket.source)}</Field>
            {ticket.assignedTo ? (
              <Field label="claimed by">
                <ReporterName userId={ticket.assignedTo} prefix="@" />
              </Field>
            ) : null}
            {ticket.contactEmail ? (
              <Field label="reply address">{ticket.contactEmail}</Field>
            ) : null}
          </FieldGrid>
        </div>
      </PanelCard>

      <PanelCard title="what they wrote">
        <NoteBlock>{ticket.body}</NoteBlock>
      </PanelCard>

      {isVerification && verificationRequest ? (
        <PanelCard title="the claim">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldGrid>
              <Field label="claimed name">{verificationRequest.claimedName}</Field>
              <Field label="category">{lower(verificationRequest.categoryKey)}</Field>
            </FieldGrid>
            {EVIDENCE_ROWS.map(([field, label]) =>
              verificationRequest[field] ? (
                <NoteBlock key={field} label={label}>
                  {verificationRequest[field]}
                </NoteBlock>
              ) : null
            )}
          </div>
        </PanelCard>
      ) : null}

      {ticket.staffResponse ? (
        <PanelCard title="the reply that was sent">
          <NoteBlock>{ticket.staffResponse}</NoteBlock>
        </PanelCard>
      ) : null}

      {ticket.internalNote ? (
        // Staff-only. Absent from the owner-facing DTO and from the mail
        // metadata map, so it cannot reach the requester from anywhere.
        <PanelCard title="internal note (never sent)">
          <NoteBlock tone="muted">{ticket.internalNote}</NoteBlock>
        </PanelCard>
      ) : null}

      {anyControl || blocked ? (
        <PanelCard title="actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {blocked ? (
              <p style={{ ...styles.notice(), margin: 0 }} role="status">
                {blocked}
              </p>
            ) : null}

            {caps.canClaim ? (
              <div>
                <LxBtn
                  variant="primary"
                  size="sm"
                  disabled={actions.claim.isPending}
                  // Claiming moves the ticket to in_progress, which is a
                  // different status than the queue was almost certainly
                  // filtered by. The parent follows it rather than letting it
                  // vanish from under the reviewer who claimed it precisely in
                  // order to decide it.
                  onClick={() =>
                    runAction(
                      actions.claim,
                      undefined,
                      () => onClaimed?.(),
                      'ticket claimed. you can now reply, reject or escalate it.'
                    )
                  }
                >
                  {actions.claim.isPending ? 'claiming' : 'claim to review'}
                </LxBtn>
              </div>
            ) : null}

            {caps.canRespond ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <FormField
                  id="support-staff-response"
                  label={isVerification ? 'reason' : 'your reply'}
                  hint={
                    isVerification
                      ? 'this reaches the requester with the decision.'
                      : 'this is sent to the requester and closes the ticket.'
                  }
                >
                  <textarea
                    id="support-staff-response"
                    style={styles.textarea()}
                    rows={6}
                    value={staffResponse}
                    onChange={(event) => setStaffResponse(event.target.value)}
                  />
                </FormField>

                <FormField
                  id="support-internal-note"
                  label="internal note"
                  hint="kept on the ticket for other staff. never sent."
                >
                  <textarea
                    id="support-internal-note"
                    style={styles.textarea()}
                    rows={3}
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                  />
                </FormField>

                <div style={styles.actionRow}>
                  {isVerification ? (
                    <>
                      <LxBtn
                        variant="primary"
                        size="sm"
                        disabled={respondDisabled}
                        onClick={() =>
                          runAction(
                            actions.approveVerification,
                            {
                              reason: staffResponse,
                              internalNote: internalNote || undefined,
                            },
                            undefined,
                            'verification approved. the ticket is closed and the requester has been told.'
                          )
                        }
                      >
                        approve
                      </LxBtn>
                      <LxBtn
                        variant="ghost"
                        size="sm"
                        disabled={respondDisabled}
                        onClick={() =>
                          runAction(
                            actions.rejectVerification,
                            {
                              reason: staffResponse,
                              internalNote: internalNote || undefined,
                            },
                            undefined,
                            'verification rejected. the ticket is closed and the requester has been told.'
                          )
                        }
                      >
                        reject
                      </LxBtn>
                    </>
                  ) : (
                    <>
                      <LxBtn
                        variant="primary"
                        size="sm"
                        disabled={respondDisabled}
                        onClick={() =>
                          runAction(
                            actions.respond,
                            {
                              staffResponse,
                              internalNote: internalNote || undefined,
                              reject: false,
                            },
                            undefined,
                            'reply sent. the ticket is closed.'
                          )
                        }
                      >
                        answer and close
                      </LxBtn>
                      <LxBtn
                        variant="ghost"
                        size="sm"
                        disabled={respondDisabled}
                        onClick={() =>
                          runAction(
                            actions.respond,
                            {
                              staffResponse,
                              internalNote: internalNote || undefined,
                              reject: true,
                            },
                            undefined,
                            'ticket closed as declined. the requester has been told.'
                          )
                        }
                      >
                        close as rejected
                      </LxBtn>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {caps.canEscalate ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  borderTop: caps.canRespond ? `1px solid ${v.borderSubtle}` : 'none',
                  paddingTop: caps.canRespond ? 18 : 0,
                }}
              >
                <FormField
                  id="support-escalation-reason"
                  label="escalate"
                  hint="say why this needs an administrator. the ticket leaves your queue."
                >
                  <textarea
                    id="support-escalation-reason"
                    style={styles.textarea()}
                    rows={3}
                    value={escalationReason}
                    onChange={(event) => setEscalationReason(event.target.value)}
                  />
                </FormField>
                <div style={styles.actionRow}>
                  <LxBtn
                    variant="secondary"
                    size="sm"
                    disabled={!escalationReason.trim() || actions.escalate.isPending}
                    onClick={() =>
                      runAction(
                        actions.escalate,
                        { reason: escalationReason },
                        undefined,
                        'ticket escalated to an administrator.'
                      )
                    }
                  >
                    {actions.escalate.isPending ? 'escalating' : 'escalate'}
                  </LxBtn>
                </div>
              </div>
            ) : null}
          </div>
        </PanelCard>
      ) : null}
    </div>
  );
}

export default SupportTicketDetailScreen;
