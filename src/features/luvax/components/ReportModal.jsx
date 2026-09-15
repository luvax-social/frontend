import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { TurnstileWidget } from '@/components/common/TurnstileWidget';
import { useTurnstile } from '@/hooks/useTurnstile';
import { CAPTCHA_FAILURE_MESSAGE, isCaptchaFailure } from '@/utils/captchaErrors';
import { LxAvatar } from '@/components/ui/lx-avatar';
import { REPORT_REASONS, REPORT_DESCRIPTION_MAX_LENGTH } from '@/services/report.service';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  useSubmitReport,
  describeReportError,
  getReportErrorCode,
  REPORT_ERROR_CODES,
} from '../hooks/useReports';
import { toast } from './Toast';

const STEP_REASON = 1;
const STEP_DETAILS = 2;
const STEP_DONE = 3;

/**
 * The noun shown to the reader for each target type.
 *
 * The design derives this the same way and uses "account" rather than "user" for a
 * profile report, so that word is kept.
 */
const ENTITY_LABELS = {
  post: 'post',
  comment: 'comment',
  user: 'account',
};

/**
 * ReportModal
 *
 * One modal for every target type. The only things that vary by target are the type
 * sent on the wire, the identifier, and the noun in the copy.
 *
 * Steps follow the design export: choose a reason, add optional details, then a
 * terminal state. The terminal state is reached both by a successful submission and by
 * a duplicate, because in both cases the report already exists and there is nothing
 * further for the reader to do.
 *
 * @param {object} target - `{ entityType, entityId, author, text, avatarUrl }`. `author`,
 *   `text` and `avatarUrl` are optional and only feed the preview card; nothing is
 *   invented when they are absent. A null target closes the modal.
 * @param {Function} onClose - called to dismiss. Dismissal is by overlay click or an
 *   explicit control, matching the modals already in this application.
 */
export function ReportModal({ target, onClose }) {
  const [step, setStep] = useState(STEP_REASON);
  const [reason, setReason] = useState(null);
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  const submitReport = useSubmitReport();

  // Plain state rather than a form value: this dialog is not a react-hook-form
  // form, so there is nothing for a Zod schema to read it out of.
  const setChallengeToken = useCallback((token) => setTurnstileToken(token ?? ''), []);
  const challenge = useTurnstile(setChallengeToken);

  useEscapeKey(Boolean(target), onClose);

  // Each newly opened target starts a fresh report. Without this the previous target's
  // reason and text would still be selected when the modal reopens.
  useEffect(() => {
    if (target) {
      // Resets the form and the mutation object when a new report target opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(STEP_REASON);
      setReason(null);
      setDescription('');
      setOutcome(null);
      setTurnstileToken('');
      submitReport.reset();
    }
    // submitReport is a stable mutation object from react-query; including it would
    // re-run this on every render and wipe the reader's input mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.entityType, target?.entityId]);

  if (!target) return null;

  const entityLabel = ENTITY_LABELS[target.entityType] ?? 'post';
  const selectedReason = REPORT_REASONS.find((r) => r.id === reason) ?? null;
  // A refused challenge is its own state: the report is filled in correctly and
  // the thing that refused is the bot control, so the generic "couldn't be sent"
  // copy would send the reader looking for a mistake that is not there.
  const failure = submitReport.isError
    ? isCaptchaFailure(submitReport.error)
      ? {
          tone: 'error',
          title: 'the challenge was not accepted',
          message: CAPTCHA_FAILURE_MESSAGE,
        }
      : describeReportError(submitReport.error)
    : null;
  const isDuplicate =
    submitReport.isError && getReportErrorCode(submitReport.error) === REPORT_ERROR_CODES.DUPLICATE;
  const submitDisabled = submitReport.isPending || !turnstileToken;

  const handleSubmit = () => {
    if (!reason || submitReport.isPending || !turnstileToken) return;
    submitReport.mutate(
      {
        reportType: target.entityType,
        reportReason: reason,
        entityId: target.entityId,
        description,
        turnstileToken,
      },
      {
        onSuccess: () => {
          toast('report submitted');
          onClose?.();
        },
        onError: (error) => {
          // A challenge token is single-use, so every failure re-arms it, not
          // only a refused challenge. A duplicate closes the dialog anyway, and
          // resetting a widget that is about to unmount is harmless.
          challenge.reset();
          // A duplicate is not a failure the reader can act on: the report they wanted
          // already exists, so close the modal and confirm the state.
          if (getReportErrorCode(error) === REPORT_ERROR_CODES.DUPLICATE) {
            toast('you already reported this');
            onClose?.();
          }
        },
      }
    );
  };

  const previewCard = (
    <div
      style={{
        background: v.surface,
        border: `1px solid ${v.border}`,
        borderRadius: 12,
        padding: '13px 15px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: target.text ? 10 : 0,
        }}
      >
        <LxAvatar size={30} src={target.avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {target.author ? (
            <div style={{ fontFamily: v.fontBody, fontSize: 13, fontWeight: 600, color: v.ink }}>
              {target.author}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: v.fontMono,
              fontSize: 10,
              color: v.ink3,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {entityLabel}
          </div>
        </div>
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 10,
            color: 'var(--lx-warning-text)',
            background: 'var(--lx-warning-dim)',
            borderRadius: 999,
            padding: '3px 9px',
          }}
        >
          reporting
        </span>
      </div>
      {target.text ? (
        <p
          style={{
            margin: 0,
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {target.text}
        </p>
      ) : null}
    </div>
  );

  let body;

  if (step === STEP_REASON) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${v.borderSubtle}` }}>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: v.ink,
            }}
          >
            report {entityLabel}
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3, marginTop: 2 }}>
            why are you reporting this?
          </div>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {REPORT_REASONS.map((r) => {
            const selected = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setReason(r.id)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '13px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  borderBottom: `1px solid ${v.borderSubtle}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: selected ? `2px solid ${v.accent}` : `2px solid ${v.borderStrong}`,
                    background: selected ? v.accentDim : 'transparent',
                  }}
                >
                  {selected ? (
                    <div
                      style={{ width: 10, height: 10, borderRadius: '50%', background: v.accent }}
                    />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: v.fontBody,
                      fontSize: 14,
                      fontWeight: 500,
                      color: v.ink,
                      lineHeight: 1.3,
                    }}
                  >
                    {r.label}
                  </div>
                  <div
                    style={{
                      fontFamily: v.fontBody,
                      fontSize: 12,
                      color: v.ink3,
                      marginTop: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {r.desc}
                  </div>
                </div>
                <LxIcon name="chevronRight" size={13} color={v.borderStrong} />
              </button>
            );
          })}
        </div>
        <div style={{ padding: '14px 20px' }}>
          <button
            type="button"
            disabled={!reason}
            onClick={() => setStep(STEP_DETAILS)}
            style={{
              width: '100%',
              fontFamily: v.fontBody,
              fontSize: 15,
              fontWeight: 500,
              padding: '13px 20px',
              borderRadius: 999,
              border: 'none',
              cursor: reason ? 'pointer' : 'default',
              background: reason ? v.accent : v.surfaceRaised,
              color: reason ? v.inkInverse : v.ink3,
              letterSpacing: '-0.01em',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  } else if (step === STEP_DETAILS) {
    // The counter warns as the limit approaches rather than only once it is
    // exceeded. The textarea clamps input at the limit, so a strictly greater
    // than check could never fire and the colour change was dead. The design
    // warns at ninety percent (450 of 500); the same ratio applies to the
    // backend's 2000. See docs/layout-overhaul/changes-applied.md.
    const nearLimit = description.length > REPORT_DESCRIPTION_MAX_LENGTH * 0.9;
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${v.borderSubtle}`,
          }}
        >
          <button
            type="button"
            aria-label="Back"
            onClick={() => setStep(STEP_REASON)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              color: v.ink2,
              padding: 2,
              cursor: 'pointer',
            }}
          >
            <LxIcon name="back" size={18} color={v.ink2} />
          </button>
          <div>
            <div
              style={{
                fontFamily: v.fontDisplay,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: v.ink,
              }}
            >
              add details
            </div>
            <div style={{ fontFamily: v.fontBody, fontSize: 11, color: v.ink3 }}>
              optional - helps our team review faster
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: v.fontMono,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: v.ink3,
                marginBottom: 6,
              }}
            >
              Selected reason
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontFamily: v.fontBody,
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 999,
                background: v.accentDim,
                color: v.accentText,
                padding: '4px 12px',
              }}
            >
              {selectedReason ? selectedReason.chipLabel : ''}
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: v.fontMono,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: v.ink3,
                marginBottom: 6,
              }}
            >
              Additional context
            </div>
            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value.slice(0, REPORT_DESCRIPTION_MAX_LENGTH))
              }
              placeholder="Describe what you're seeing…"
              style={{
                width: '100%',
                minHeight: 96,
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink,
                background: v.surfaceSunken,
                border: `1px solid ${v.border}`,
                borderRadius: 10,
                padding: '11px 13px',
                outline: 'none',
                lineHeight: 1.5,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                textAlign: 'right',
                fontFamily: v.fontMono,
                fontSize: 10,
                color: nearLimit ? v.errorText : v.ink3,
                marginTop: 4,
              }}
            >
              {description.length}/{REPORT_DESCRIPTION_MAX_LENGTH}
            </div>
          </div>

          {failure && !isDuplicate ? (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: '10px 13px',
                borderRadius: 10,
                background: v.errorDim,
                color: v.errorText,
                fontFamily: v.fontBody,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{failure.title}</div>
              <div>{failure.message}</div>
            </div>
          ) : null}
        </div>
        <div
          style={{
            padding: '12px 20px 16px',
            borderTop: `1px solid ${v.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Sits immediately above the two submit controls rather than beside
              the textarea, so the reader never solves a challenge at the top of
              a scrolled dialog and then has to hunt downward for the button. */}
          <TurnstileWidget {...challenge.widgetProps} />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            style={{
              width: '100%',
              fontFamily: v.fontBody,
              fontSize: 15,
              fontWeight: 500,
              padding: '13px 20px',
              borderRadius: 999,
              border: 'none',
              background: v.accent,
              color: v.inkInverse,
              letterSpacing: '-0.01em',
              cursor: submitDisabled ? 'default' : 'pointer',
              opacity: submitDisabled ? 0.7 : 1,
            }}
          >
            {submitReport.isPending ? 'Sending...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDescription('');
              handleSubmit();
            }}
            disabled={submitDisabled}
            style={{
              width: '100%',
              fontFamily: v.fontBody,
              fontSize: 13,
              padding: '8px 20px',
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: v.ink3,
              cursor: submitDisabled ? 'default' : 'pointer',
              opacity: submitDisabled ? 0.7 : 1,
            }}
          >
            skip and submit without details
          </button>
          {/* A disabled control always says why: an inert button with no
              explanation reads as a broken dialog. */}
          {challenge.ready && !turnstileToken && !challenge.unavailable ? (
            <div
              aria-live="polite"
              style={{
                fontFamily: v.fontBody,
                fontSize: 12,
                color: v.ink3,
                textAlign: 'center',
              }}
            >
              Complete the challenge above to send.
            </div>
          ) : null}
        </div>
      </div>
    );
  } else {
    const duplicate = outcome === 'duplicate';
    body = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 24px 36px',
          textAlign: 'center',
          gap: 18,
          animation: 'fadeSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: duplicate ? 'var(--lx-warning-dim)' : 'var(--lx-success-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'checkPop 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <LxIcon
            name={duplicate ? 'flag' : 'check'}
            size={28}
            color={duplicate ? 'var(--lx-warning-text)' : 'var(--lx-success-text)'}
            stroke={2.2}
          />
        </div>
        <div>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: v.ink,
              marginBottom: 8,
            }}
          >
            {duplicate ? 'you already reported this' : 'report submitted'}
          </div>
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink3,
              lineHeight: 1.55,
              maxWidth: 300,
              margin: '0 auto',
            }}
          >
            {duplicate
              ? 'This is already with our review team, so there is nothing more to send.'
              : "We'll review this content and take action if it violates our community guidelines."}
          </div>
        </div>
        <div
          style={{
            fontFamily: v.fontMono,
            fontSize: 11,
            color: v.ink3,
            background: v.surface,
            borderRadius: 8,
            padding: '10px 14px',
            lineHeight: 1.6,
            maxWidth: 340,
            textAlign: 'left',
          }}
        >
          {duplicate
            ? 'A report covers the whole item, so it cannot be sent again under a different reason.'
            : "You won't be notified of the outcome. Misuse of reporting may result in account restrictions."}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: v.fontBody,
            fontSize: 14,
            fontWeight: 500,
            padding: '10px 32px',
            borderRadius: 999,
            border: `1px solid ${v.border}`,
            background: 'transparent',
            color: v.ink,
            marginTop: 4,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    );
  }

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Report ${entityLabel}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: v.scrim }} />
      <div
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {step !== STEP_DONE ? previewCard : null}
        <div
          style={{
            background: v.base,
            border: `1px solid ${v.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
