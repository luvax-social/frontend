interface MailSummary {
  ID: string;
  Subject?: string;
  To?: { Address?: string }[];
}
export interface MailMessage {
  id: string;
  subject: string;
  text: string;
  html: string;
}
type MailOptions = { timeoutMs?: number };
import { MAILPIT_BASE } from './client.ts';

const POLL_INTERVAL_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const addressedTo = (message: MailSummary, address: string) =>
  (message.To || []).some(
    (recipient) => (recipient.Address || '').toLowerCase() === address.toLowerCase()
  );

async function loadMessage(summary: MailSummary) {
  const detailResponse = await fetch(`${MAILPIT_BASE}/api/v1/message/${summary.ID}`);
  const detail: { Subject?: string; Text?: string; HTML?: string } = await detailResponse.json();
  return {
    id: summary.ID,
    subject: summary.Subject || detail.Subject || '',
    text: detail.Text || '',
    html: detail.HTML || '',
  };
}

/** Returns every message currently addressed to `address`, bodies loaded, newest first. */
async function fetchMessagesTo(address: string) {
  const listResponse = await fetch(`${MAILPIT_BASE}/api/v1/messages?limit=50`);
  const list: { messages?: MailSummary[] } = await listResponse.json();
  const summaries = (list.messages || []).filter((message) => addressedTo(message, address));
  return Promise.all(summaries.map(loadMessage));
}

/**
 * Polls until a message addressed to `address` satisfies `predicate`, then returns it.
 *
 * Registration emits two emails, a welcome and a verification request, and their delivery
 * order is not guaranteed because both travel through the outbox and the same queue. Taking
 * the first message to arrive therefore picks the wrong one roughly half the time, so
 * callers select by content instead of by position.
 */
export async function waitForMailTo(
  address: string,
  predicate: (mail: MailMessage) => boolean = () => true,
  { timeoutMs = 20000 }: MailOptions = {}
) {
  const deadline = Date.now() + timeoutMs;
  let seen: MailMessage[] = [];

  while (Date.now() < deadline) {
    seen = await fetchMessagesTo(address);
    const match = seen.find(predicate);
    if (match) {
      return match;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const subjects = seen.map((mail) => `"${mail.subject}"`).join(', ') || 'none';
  throw new Error(
    `No matching Mailpit message for ${address} within ${timeoutMs}ms. Saw: ${subjects}`
  );
}

/** Polls until a message addressed to `address` contains a token link, then returns it. */
export function waitForMailWithToken(address: string, options?: MailOptions) {
  return waitForMailTo(address, (mail) => tokenFromMail(mail) !== null, options);
}

/**
 * Returns the `token` query parameter from the first URL in the message that carries one,
 * or null when the message has none. The mail templates link to the frontend, so the token
 * is pulled out and replayed against the API directly rather than followed in a browser.
 */
export function tokenFromMail(mail: MailMessage) {
  const haystack = `${mail.text}\n${mail.html}`;
  const matches = haystack.match(/https?:\/\/[^\s"'<>)]+/g) || [];

  for (const candidate of matches) {
    const cleaned = candidate.replace(/&amp;/g, '&');
    try {
      const token = new URL(cleaned).searchParams.get('token');
      if (token) {
        return token;
      }
    } catch {
      // Not a parseable URL; try the next candidate.
    }
  }

  return null;
}

/** Same as {@link tokenFromMail} but throws instead of returning null, for call sites that require one. */
export function extractTokenFromMail(mail: MailMessage) {
  const token = tokenFromMail(mail);
  if (token === null) {
    throw new Error(`No token link found in mail "${mail.subject}"`);
  }
  return token;
}

/** Deletes every message, so a test asserting on mail volume starts from a known state. */
export async function purgeMailbox() {
  await fetch(`${MAILPIT_BASE}/api/v1/messages`, { method: 'DELETE' });
}
