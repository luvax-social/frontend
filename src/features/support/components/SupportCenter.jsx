import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import {
  useCreateInProductAppeal,
  useCreateTicket,
  useCreateVerificationRequest,
  useOwnTickets,
  useSupportCategories,
  useVerificationCategories,
  useVerificationState,
} from '../hooks/useSupport';
import {
  EVIDENCE_FIELDS,
  MIN_EVIDENCE_FIELDS,
  countEvidence,
  inProductAppealSchema,
  ticketSchema,
  verificationSchema,
} from '../utils/supportSchemas';
import {
  describeSupportError,
  isAlreadyOpen,
  isAppealActionNotFound,
  isAppealAlreadyFiled,
  isAppealNotAppealable,
} from '../utils/supportErrors';
import {
  VERIFICATION_CATEGORY,
  findBlockingTicket,
  findPendingVerification,
  statusLabel,
} from '../utils/ticketStatus';
import { Eyebrow, Field, Notice, PrimaryButton, StatusChip } from './SupportPrimitives';
import { SUPPORT_CSS } from './supportStyles';

const VERIFICATION_KEY = 'verification_request';

// Built from EVIDENCE_FIELDS rather than repeated, so a field cannot exist on
// the form under a name the initial state has never heard of.
const EMPTY_VERIFICATION = {
  categoryKey: '',
  claimedName: '',
  ...Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field.name, ''])),
};

/**
 * Support: one door in, and it is a settings category.
 *
 * This body used to be a screen of its own at `/app/support`, which nothing in
 * the product linked to. Every navigation surface was enumerated - side rail,
 * mobile app bar, bottom nav, settings list, profile - and not one entry
 * reached it, so the only support-shaped thing a user could find was a
 * verification form inside account settings that asked for a badge and nothing
 * else. The address still resolves, as a redirect here, so an existing link or
 * bookmark is not broken by moving the door.
 *
 * The heading and the description belong to the settings category region, which
 * draws them for every category from `settingsCatalog`. Drawing a second one
 * here would stack two titles.
 *
 * Verification lives here as a category rather than on its own screen. It is a
 * support request like any other, and it previously sat on a surface the user
 * had no other route into, so a badge request and a ban appeal were reached in
 * two unrelated ways.
 *
 * The one-open-ticket rule is a first-class state, not an error. An account
 * already holding a live request sees that request instead of a form, because
 * the server would refuse a second one and a form that cannot be submitted is
 * worse than no form.
 *
 * A pending verification request is deliberately not treated as blocking. The
 * backend excludes that category from the one-open-ticket index so a badge
 * request cannot stop the same account opening a ban appeal, and this mirrors
 * it: both are shown, and the form stays available for the other.
 */
export function SupportCenter() {
  const ticketsQuery = useOwnTickets();
  const categoriesQuery = useSupportCategories();
  const verificationCategoriesQuery = useVerificationCategories();
  const verificationStateQuery = useVerificationState();
  const createTicket = useCreateTicket();
  const createVerification = useCreateVerificationRequest();
  const createAppeal = useCreateInProductAppeal();

  // An appeal is opened against one decision, and the address carries which.
  // Reached from a warning on the settings screen and from a content-removal
  // notification, both of which know the audit row and neither of which has
  // room for a form. The identifier is not a credential: the server re-reads
  // the audit row and compares its target against the caller.
  const [searchParams, setSearchParams] = useSearchParams();
  const appealActionId = searchParams.get('appeal') ?? '';
  const isAppeal = Boolean(appealActionId);

  const [category, setCategory] = useState('');
  const [values, setValues] = useState({ subject: '', body: '' });
  const [verification, setVerification] = useState(EMPTY_VERIFICATION);
  const [fieldErrors, setFieldErrors] = useState({});

  // Memoised so the two derivations below depend on a stable reference. Without
  // it the ?? [] produces a fresh array on every render and both memos recompute
  // every time regardless.
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const blocking = useMemo(() => findBlockingTicket(tickets), [tickets]);
  const pendingVerification = useMemo(() => findPendingVerification(tickets), [tickets]);
  const isVerification = category === VERIFICATION_KEY;
  const verificationState = verificationStateQuery.data;

  const filledEvidence = countEvidence(verification);
  const evidenceRemaining = Math.max(0, MIN_EVIDENCE_FIELDS - filledEvidence);

  const submitting =
    createTicket.isPending || createVerification.isPending || createAppeal.isPending;
  const failure = createTicket.error || createVerification.error || createAppeal.error;

  // Whether this decision can still be appealed at all, answered by the server
  // rather than guessed here. The client cannot know whether an appeal already
  // exists - the warning and the notification both carry the audit row and
  // nothing about tickets opened against it - so the form is offered, and the
  // refusal is what closes it. All three codes are terminal for this decision:
  // a second appeal, an unknown or foreign audit row, and an action type with no
  // appeal route are none of them retryable, so leaving the control live would
  // only invite the same refusal again.
  const appealClosed =
    isAppeal &&
    Boolean(failure) &&
    (isAppealAlreadyFiled(failure) ||
      isAppealActionNotFound(failure) ||
      isAppealNotAppealable(failure));

  const resetForm = () => {
    setCategory('');
    setValues({ subject: '', body: '' });
    setVerification(EMPTY_VERIFICATION);
    setFieldErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isAppeal) {
      // The category is not sent and is not a field. It follows from the action
      // the audit row records, and is derived server-side for the same reason
      // the signed-link path takes it from the token: a client-supplied
      // category would let somebody appeal something they were never entitled
      // to appeal.
      const parsed = inProductAppealSchema.safeParse({ ...values, adminActionId: appealActionId });
      if (!parsed.success) {
        const next = {};
        for (const issue of parsed.error.issues) {
          next[issue.path[0]] = issue.message;
        }
        setFieldErrors(next);
        return;
      }
      setFieldErrors({});
      createAppeal.mutate(parsed.data, {
        onSuccess: () => {
          resetForm();
          // Drops ?appeal= so a reload does not re-offer a form for a decision
          // that has now been appealed, which the server would refuse anyway.
          setSearchParams({}, { replace: true });
          ticketsQuery.refetch();
        },
      });
      return;
    }

    if (isVerification) {
      const parsed = verificationSchema.safeParse(verification);
      if (!parsed.success) {
        const next = {};
        for (const issue of parsed.error.issues) {
          next[issue.path[0]] = issue.message;
        }
        setFieldErrors(next);
        return;
      }
      setFieldErrors({});
      createVerification.mutate(parsed.data, {
        onSuccess: () => {
          resetForm();
          ticketsQuery.refetch();
        },
      });
      return;
    }

    const parsed = ticketSchema.safeParse({ ...values, category });
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0]] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    createTicket.mutate(parsed.data, {
      onSuccess: () => {
        resetForm();
        ticketsQuery.refetch();
      },
    });
  };

  const categories = categoriesQuery.data ?? [];
  const verificationCategories = verificationCategoriesQuery.data ?? [];

  return (
    <div style={{ maxWidth: 680, width: '100%' }}>
      {/* This body renders inside the settings region rather than inside SupportPage,
          so it carries the slice's stylesheet itself. */}
      <style>{SUPPORT_CSS}</style>
      {ticketsQuery.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="lx-skeleton" style={{ height: 16, width: '40%', borderRadius: 4 }} />
          <div className="lx-skeleton" style={{ height: 92, borderRadius: 12 }} />
        </div>
      ) : null}

      {ticketsQuery.isError ? (
        <Notice tone="bad" role="alert">
          We could not load your requests. Reload the page.
        </Notice>
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError ? (
        <>
          {verificationState?.verified ? (
            <Notice tone="good">
              Your account is verified in {(verificationState.categoryKey ?? '').replace(/_/g, ' ')}
              .
            </Notice>
          ) : null}

          {pendingVerification ? (
            <TicketSummary
              ticket={pendingVerification}
              heading="Your verification request"
              to={routeTo.supportTicket(pendingVerification.id)}
            />
          ) : null}

          {blocking ? (
            <>
              <TicketSummary
                ticket={blocking}
                heading="Your open request"
                to={routeTo.supportTicket(blocking.id)}
              />
              <Notice>
                You can hold one open request at a time. We will reply to this one before you can
                send another.
                {pendingVerification
                  ? ' your verification request sits alongside it and does not count towards this.'
                  : ''}
              </Notice>
            </>
          ) : (
            <TicketForm
              isAppeal={isAppeal}
              appealClosed={appealClosed}
              category={category}
              setCategory={(next) => {
                setCategory(next);
                setFieldErrors({});
              }}
              values={values}
              setValues={setValues}
              verification={verification}
              setVerification={setVerification}
              verificationCategories={verificationCategories}
              categories={categories}
              categoriesLoading={categoriesQuery.isLoading}
              categoriesError={categoriesQuery.isError}
              isVerification={isVerification}
              pendingVerification={pendingVerification}
              alreadyVerified={Boolean(verificationState?.verified)}
              lastDecision={verificationState?.decisionReason}
              fieldErrors={fieldErrors}
              filledEvidence={filledEvidence}
              evidenceRemaining={evidenceRemaining}
              submitting={submitting}
              onSubmit={handleSubmit}
              failureMessage={
                failure
                  ? isAlreadyOpen(failure)
                    ? 'You already have an open request.'
                    : describeSupportError(failure)
                  : ''
              }
            />
          )}

          <PastTickets
            tickets={tickets}
            blockingId={blocking?.id}
            pendingVerificationId={pendingVerification?.id}
          />
        </>
      ) : null}
    </div>
  );
}

function TicketSummary({ ticket, heading, to }) {
  return (
    <div
      style={{
        background: v.surface,
        border: `1px solid ${v.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 16,
      }}
    >
      <Eyebrow>{heading}</Eyebrow>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontFamily: v.fontBody, fontSize: 15, color: v.ink, fontWeight: 500 }}>
          {ticket.subject}
        </div>
        <StatusChip label={statusLabel(ticket.status)} />
      </div>
      {/* Also a link, for the same reason, and with the same 44px target. */}
      <Link
        to={to}
        style={{
          marginTop: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
          fontFamily: v.fontBody,
          fontSize: 14,
          color: v.accentText,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        <span>Read it</span>
        <LxIcon name="chevronRight" size={14} color={v.accentText} />
      </Link>
    </div>
  );
}

function PastTickets({ tickets, blockingId, pendingVerificationId }) {
  const past = tickets.filter(
    (ticket) => ticket.id !== blockingId && ticket.id !== pendingVerificationId
  );
  if (past.length === 0) {
    return null;
  }
  return (
    <section style={{ marginTop: 30 }}>
      <Eyebrow>Everything you have sent</Eyebrow>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {past.map((ticket) => (
          <li
            key={ticket.id}
            style={{
              borderBottom: `1px solid ${v.borderSubtle}`,
              padding: '12px 0',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/*
              A link, not a button. These rows navigate to a real route, so a
              ticket had no address: it could not be opened in a new tab, copied,
              bookmarked or reached by anything that looks for one. They also
              carried no affordance at all - no chevron, no underline, no icon -
              so on a touch screen, where there is no cursor to change, nothing
              said they were interactive.

              The minimum height is on the link rather than the row because the
              link is the target: measured at 390, a one-line row was 145x24 and
              a two-line row 245x48, so whether the control met the 44px minimum
              depended on how long its subject happened to be.
            */}
            <Link
              to={routeTo.supportTicket(ticket.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                textAlign: 'left',
              }}
            >
              <span>{ticket.subject}</span>
              <LxIcon name="chevronRight" size={14} color={v.ink3} />
            </Link>
            <StatusChip label={statusLabel(ticket.status)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketForm({
  isAppeal,
  appealClosed,
  category,
  setCategory,
  values,
  setValues,
  verification,
  setVerification,
  verificationCategories,
  categories,
  categoriesLoading,
  categoriesError,
  isVerification,
  pendingVerification,
  alreadyVerified,
  lastDecision,
  fieldErrors,
  filledEvidence,
  evidenceRemaining,
  submitting,
  onSubmit,
  failureMessage,
}) {
  // Verification has its own slot, so it is offered only when that slot is free.
  const verificationBlocked = Boolean(pendingVerification) || alreadyVerified;
  // Appeal mode has no category selector, because the category is derived from
  // the decision server-side. The write fields keyed off `category` alone, which
  // left the appeal form showing its heading and nothing to type into or submit.
  const canWrite = (isAppeal || Boolean(category)) && !appealClosed;
  const selectable = categories.filter(
    (row) => row.categoryKey !== VERIFICATION_KEY || !verificationBlocked
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      {failureMessage ? (
        <Notice tone="bad" role="alert">
          {failureMessage}
        </Notice>
      ) : null}

      {isAppeal ? (
        /* No category selector. The category follows from the decision being
           appealed and is derived server-side, so offering a choice here would
           imply the submitter has one. */
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
            The decision you opened this from. We have matched it already, so you do not need to
            describe which one it was. One appeal for each decision.
          </div>
        </div>
      ) : (
        <Field label="What is this about" htmlFor="support-category" error={fieldErrors.category}>
          <select
            id="support-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={categoriesLoading}
            aria-invalid={Boolean(fieldErrors.category)}
          >
            <option value="">Choose one</option>
            {selectable.map((row) => (
              <option key={row.categoryKey} value={row.categoryKey}>
                {row.displayName}
              </option>
            ))}
          </select>
          {categoriesError ? (
            <div
              role="alert"
              style={{ fontFamily: v.fontBody, fontSize: 12, color: v.errorText, marginTop: 5 }}
            >
              We could not load the list of topics. Reload the page.
            </div>
          ) : null}
        </Field>
      )}

      {!isAppeal && category ? (
        <p
          style={{
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink2,
            margin: '-8px 0 16px',
            lineHeight: 1.5,
          }}
        >
          {categories.find((row) => row.categoryKey === category)?.description}
        </p>
      ) : null}

      {isVerification ? (
        <VerificationFields
          verification={verification}
          setVerification={setVerification}
          verificationCategories={verificationCategories}
          lastDecision={lastDecision}
          fieldErrors={fieldErrors}
          filledEvidence={filledEvidence}
          evidenceRemaining={evidenceRemaining}
        />
      ) : null}

      {canWrite && !isVerification ? (
        <>
          <Field label="Summary" htmlFor="support-subject" error={fieldErrors.subject}>
            <input
              id="support-subject"
              value={values.subject}
              onChange={(event) => setValues((prev) => ({ ...prev, subject: event.target.value }))}
              aria-invalid={Boolean(fieldErrors.subject)}
            />
          </Field>

          <Field
            label="Tell us more"
            htmlFor="support-body"
            error={fieldErrors.body}
            hint="One request and one reply, so include everything now."
          >
            <textarea
              id="support-body"
              rows={8}
              value={values.body}
              onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
              aria-invalid={Boolean(fieldErrors.body)}
            />
          </Field>
        </>
      ) : null}

      {canWrite ? (
        <PrimaryButton disabled={submitting || (isVerification && evidenceRemaining > 0)}>
          {submitting ? 'sending' : isAppeal ? 'Send appeal' : 'Send request'}
        </PrimaryButton>
      ) : null}
    </form>
  );
}

function VerificationFields({
  verification,
  setVerification,
  verificationCategories,
  lastDecision,
  fieldErrors,
  filledEvidence,
  evidenceRemaining,
}) {
  const set = (name) => (event) =>
    setVerification((prev) => ({ ...prev, [name]: event.target.value }));

  return (
    <>
      {/*
        Why the previous request was refused, shown while the next one is being
        written rather than only on the old ticket. Somebody asking a second
        time is the one reader who needs it, and without it the obvious move is
        to resubmit the same evidence and be refused for the same reason. It is
        the staff response, never the internal note - the server decides which,
        and sends only one of them.
      */}
      {lastDecision ? (
        <div
          style={{
            background: v.surface,
            border: `1px solid ${v.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <Eyebrow>What we said last time</Eyebrow>
          <p
            style={{
              fontFamily: v.fontBody,
              fontSize: 14,
              lineHeight: 1.5,
              color: v.ink2,
              margin: 0,
            }}
          >
            {lastDecision}
          </p>
        </div>
      ) : null}

      <Field
        label="The category you are known in"
        htmlFor="verification-category"
        error={fieldErrors.categoryKey}
      >
        <select
          id="verification-category"
          value={verification.categoryKey}
          onChange={set('categoryKey')}
          aria-invalid={Boolean(fieldErrors.categoryKey)}
        >
          <option value="">Choose one</option>
          {verificationCategories.map((row) => (
            <option key={row.categoryKey} value={row.categoryKey}>
              {row.displayName}
            </option>
          ))}
        </select>
        {verification.categoryKey ? (
          <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 5 }}>
            {
              verificationCategories.find((row) => row.categoryKey === verification.categoryKey)
                ?.covers
            }
          </div>
        ) : null}
      </Field>

      <Field
        label="The name you are known by"
        htmlFor="verification-name"
        error={fieldErrors.claimedName}
      >
        <input
          id="verification-name"
          value={verification.claimedName}
          onChange={set('claimedName')}
          aria-invalid={Boolean(fieldErrors.claimedName)}
        />
      </Field>

      <div
        style={{
          background: v.surface,
          border: `1px solid ${v.border}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
        }}
      >
        <Eyebrow>Evidence</Eyebrow>
        <p style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, margin: '0 0 12px' }}>
          Fill at least {MIN_EVIDENCE_FIELDS} of these. the more you give, the faster a reviewer can
          decide.
        </p>

        {/* The requirement is stated before submission and counts down live, so a
            reviewer's floor is never discovered as a rejection afterwards. */}
        <div
          aria-live="polite"
          style={{
            fontFamily: v.fontBody,
            fontSize: 13,
            color: evidenceRemaining === 0 ? v.successText : v.ink2,
            marginBottom: 14,
          }}
        >
          {evidenceRemaining === 0
            ? `Ready to send (${filledEvidence} of ${MIN_EVIDENCE_FIELDS})`
            : `Fill ${evidenceRemaining} more evidence ${
                evidenceRemaining === 1 ? 'field' : 'fields'
              } to submit (${filledEvidence} of ${MIN_EVIDENCE_FIELDS})`}
        </div>

        {EVIDENCE_FIELDS.map((field) => (
          <Field key={field.name} label={field.label} htmlFor={`verification-${field.name}`}>
            {field.multiline ? (
              <textarea
                id={`verification-${field.name}`}
                rows={4}
                value={verification[field.name]}
                onChange={set(field.name)}
              />
            ) : (
              <input
                id={`verification-${field.name}`}
                value={verification[field.name]}
                onChange={set(field.name)}
              />
            )}
          </Field>
        ))}

        {fieldErrors.evidenceWebsite ? (
          <div role="alert" style={{ fontFamily: v.fontBody, fontSize: 12, color: v.errorText }}>
            {fieldErrors.evidenceWebsite}
          </div>
        ) : null}
      </div>
    </>
  );
}

export { VERIFICATION_CATEGORY };
export default SupportCenter;
