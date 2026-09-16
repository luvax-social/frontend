import axiosInstance from './axiosInstance';

const REPORT_API_PATH = '/reports';

/**
 * REPORT_TYPES
 *
 * The `reportType` values the backend accepts, exactly as `ReportType` serialises them.
 * Verified against the live OpenAPI document at /api-docs, which lists the enum as
 * post, comment, user, story, and message.
 *
 * Only the three used by this application are exposed here. Story and message reporting
 * have no entry point yet, so naming them would imply a capability that does not exist.
 */
export const REPORT_TYPES = {
  POST: 'post',
  COMMENT: 'comment',
  USER: 'user',
};

/**
 * REPORT_REASONS
 *
 * The wire identifier plus the display copy for each reason the backend accepts.
 *
 * `id` is the `reportReason` value sent to the server. All eight come from the backend
 * `ReportReason` enum and were confirmed against /api-docs; nothing here is invented.
 * `label` and `desc` are the design export's copy, which the design uses for the reason list.
 * `chipLabel` is the design's shorter form, used on the details step.
 *
 * Where the design's wording and the backend identifier differ, the design supplies the
 * words shown to the reader and the backend supplies the value put on the wire.
 */
export const REPORT_REASONS = [
  {
    id: 'spam',
    label: 'Spam',
    chipLabel: 'Spam',
    desc: 'Fake engagement, scams, repetitive posts',
  },
  {
    id: 'nudity',
    label: 'Nudity or sexual content',
    chipLabel: 'Nudity',
    desc: 'Explicit or suggestive material',
  },
  {
    id: 'violence',
    label: 'Violence or threats',
    chipLabel: 'Violence',
    desc: 'Graphic, dangerous, or threatening content',
  },
  {
    id: 'hate_speech',
    label: 'Hate speech',
    chipLabel: 'Hate Speech',
    desc: 'Promotes discrimination or hostility',
  },
  {
    id: 'harassment',
    label: 'Harassment or bullying',
    chipLabel: 'Harassment',
    desc: 'Targeting or intimidating individuals',
  },
  {
    id: 'false_information',
    label: 'False information',
    chipLabel: 'False Information',
    desc: 'Misleading or unverified claims',
  },
  {
    id: 'scam',
    label: 'Scam or fraud',
    chipLabel: 'Scam or Fraud',
    desc: 'Deceptive schemes or financial fraud',
  },
  {
    id: 'other',
    label: 'Something else',
    chipLabel: 'Other',
    desc: "Doesn't fit the above categories",
  },
];

/**
 * REPORT_DESCRIPTION_MAX_LENGTH
 *
 * The server's own limit, from `@Size(max = 2000)` on `CreateReportRequest.description`.
 * Confirmed by submission: 2000 characters is accepted, 2001 is rejected with
 * VALIDATION_ERROR and the message "size must be between 0 and 2000".
 *
 * The design export caps its textarea at 500. That is a stricter limit than the server
 * enforces, so it is not used here; the client must not invent a limit of its own.
 */
export const REPORT_DESCRIPTION_MAX_LENGTH = 2000;

/**
 * Submits a report and returns the unwrapped ApiResponse envelope.
 *
 * `description` is optional on the server. It is omitted from the payload entirely when
 * blank rather than sent as an empty string, so a reporter who skips the details step
 * stores a null description instead of "".
 */
export const submitReport = async ({
  reportType,
  reportReason,
  entityId,
  description,
  turnstileToken,
}) => {
  const payload = { reportType, reportReason, entityId, turnstileToken };
  const trimmed = typeof description === 'string' ? description.trim() : '';
  if (trimmed) {
    payload.description = trimmed;
  }

  const response = await axiosInstance.post(REPORT_API_PATH, payload);
  return response.data;
};
