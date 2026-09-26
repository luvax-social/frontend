import { z } from 'zod';

/**
 * Every rule here mirrors a jakarta.validation annotation on the matching
 * backend request record. The backend is the source of truth: these schemas
 * must not reject a value the server accepts, nor accept one the server
 * rejects.
 *
 * Sizes come from `CreateSupportTicketRequest`, `PublicSupportTicketRequest`,
 * `SignedAppealRequest` and `CreateVerificationRequest`.
 */

const SUBJECT_MAX = 200;
const BODY_MAX = 5000;
const EMAIL_MAX = 255;
const CLAIMED_NAME_MAX = 100;
const EVIDENCE_MAX = 2000;

/**
 * The number of evidence fields a verification request must carry.
 *
 * The server enforces the same floor independently and answers
 * `VERIFICATION_INSUFFICIENT_EVIDENCE`. It is mirrored here so the requirement
 * is visible while the form is being filled in rather than arriving as a
 * rejection after submission.
 */
export const MIN_EVIDENCE_FIELDS = 3;

/**
 * The seven evidence fields, in the order the form presents them.
 *
 * Every `name` is a field `CreateVerificationRequest` declares. That is not a
 * convention, it is the contract: the endpoint rejects an undeclared body field
 * outright, so a name that exists only on the form fails the whole submission
 * with `MALFORMED_REQUEST_BODY` rather than being quietly dropped. Two names
 * here did exactly that - `evidenceAward` and `evidenceOther`, against a record
 * that declares `evidenceOfficialListing` and `evidenceNote` - and because the
 * form initialises every field to an empty string, both reached the wire on
 * every request whether or not the requester typed in them. No verification
 * request submitted from this form could ever succeed.
 */
export const EVIDENCE_FIELDS = [
  { name: 'evidenceWebsite', label: 'Official website' },
  { name: 'evidenceOtherProfile', label: 'A verified profile elsewhere' },
  { name: 'evidenceEmailDomain', label: 'An organisational email domain' },
  { name: 'evidencePublishedWork', label: 'Published work' },
  { name: 'evidencePress', label: 'Press coverage' },
  { name: 'evidenceOfficialListing', label: 'An official organisational listing' },
  // The one field that invites prose rather than a link, so it is the one field
  // rendered as a textarea. The server allows the same 2000 characters here as
  // everywhere else.
  { name: 'evidenceNote', label: 'A note to the moderator', multiline: true },
];

const subjectField = z
  .string()
  .trim()
  .min(1, 'Give your request a short summary.')
  .max(SUBJECT_MAX, `Keep the summary to ${SUBJECT_MAX} characters or fewer.`);

const bodyField = z
  .string()
  .trim()
  .min(1, 'Tell us what happened.')
  .max(BODY_MAX, `Keep the message to ${BODY_MAX} characters or fewer.`);

const evidenceField = z
  .string()
  .trim()
  .max(EVIDENCE_MAX, `Keep each piece of evidence to ${EVIDENCE_MAX} characters or fewer.`)
  .optional()
  .or(z.literal(''));

/** The authenticated ticket form, for every category except verification. */
export const ticketSchema = z.object({
  category: z.string().trim().min(1, 'Choose what this is about.'),
  subject: subjectField,
  body: bodyField,
});

/**
 * The anonymous public form.
 *
 * Carries the address the confirmation link is sent to. The Turnstile token is
 * validated separately rather than as a schema field, so a failed challenge
 * reads as its own state instead of as a form validation error.
 */
export const publicTicketSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .min(1, 'We need an address to reply to.')
    .max(EMAIL_MAX, `Keep the address to ${EMAIL_MAX} characters or fewer.`)
    .email('That does not look like an email.'),
  category: z.string().trim().min(1, 'Choose what this is about.'),
  subject: subjectField,
  body: bodyField,
});

/**
 * The appeal form reached from a signed link.
 *
 * The category is not a field. It is taken from the token server-side, so a
 * submitter cannot appeal something the link did not authorise.
 */
export const appealSchema = z.object({
  subject: subjectField,
  body: bodyField,
});

/**
 * The lost-link recovery form.
 *
 * One field. It deliberately does not ask which decision is being appealed:
 * the whole premise is that the reader has lost the only message that named
 * one, and the server picks the most recent un-appealed decision itself.
 *
 * The Turnstile token is validated separately rather than as a schema field,
 * following the public form, so a failed challenge reads as its own state
 * rather than as a validation error on a field the reader filled in correctly.
 */
export const appealResendSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .min(1, 'Enter the address the email was sent to.')
    .max(EMAIL_MAX, `Keep the address to ${EMAIL_MAX} characters or fewer.`)
    .email('That does not look like an email.'),
});

/**
 * The in-product appeal, opened from a session against a decision the caller
 * owns.
 *
 * Mirrors `InProductAppealRequest`. The same subject and body rules as the
 * signed-link form, plus the identifier of the decision. That identifier is not
 * a credential and is never trusted: the server re-reads the audit row and
 * compares its target against the caller, so a client that sends someone
 * else's gets the same answer it gets for one that does not exist.
 */
export const inProductAppealSchema = z.object({
  adminActionId: z.string().trim().min(1, 'We could not tell which decision this is.'),
  subject: subjectField,
  body: bodyField,
});

/**
 * The verification request.
 *
 * The evidence floor is expressed as a whole-object refinement rather than a
 * per-field rule, because no single field is required: what is required is that
 * at least three of the seven carry something.
 */
export const verificationSchema = z
  .object({
    categoryKey: z.string().trim().min(1, 'Choose the category you are known in.'),
    claimedName: z
      .string()
      .trim()
      .min(1, 'Tell us the name you are known by.')
      .max(CLAIMED_NAME_MAX, `Keep the name to ${CLAIMED_NAME_MAX} characters or fewer.`),
    evidenceWebsite: evidenceField,
    evidenceOtherProfile: evidenceField,
    evidenceEmailDomain: evidenceField,
    evidencePublishedWork: evidenceField,
    evidencePress: evidenceField,
    evidenceOfficialListing: evidenceField,
    evidenceNote: evidenceField,
  })
  .superRefine((values, ctx) => {
    if (countEvidence(values) < MIN_EVIDENCE_FIELDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceWebsite'],
        message: `Fill at least ${MIN_EVIDENCE_FIELDS} evidence fields.`,
      });
    }
  });

/**
 * How many of the seven evidence fields carry a non-blank value.
 *
 * Exported so the form can show the running count live while it is being filled
 * in, which is what makes the requirement visible before submission.
 *
 * @param {Object} values the verification form's current values
 * @returns {number} the count of filled evidence fields
 */
export const countEvidence = (values = {}) =>
  EVIDENCE_FIELDS.filter((field) => (values[field.name] ?? '').trim().length > 0).length;
