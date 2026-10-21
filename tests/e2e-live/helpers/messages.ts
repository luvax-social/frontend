import type { Browser, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Api } from './session';
import {
  ALL_WIDTHS,
  apiSession,
  capture,
  DESKTOP,
  expectNoHorizontalScroll,
  itemsOf,
  walk,
} from './session';

export type Folder = 'primary' | 'requests' | 'hidden_requests';
export const FOLDERS: Folder[] = ['primary', 'requests', 'hidden_requests'];

export interface Reaction {
  id: string;
  userId: string;
  emoji: string;
}

export interface ReplyPreview {
  messageId: string;
  senderId: string | null;
  messageType: string | null;
  snippet: string | null;
  unavailable: boolean;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string | null;
  messageType: string;
  content: string | null;
  replyToId: string | null;
  replyTo: ReplyPreview | null;
  isDeleted: boolean;
  reactions: Reaction[];
}

export interface ConversationRow {
  id: string;
  participants: { userId: string; username: string; displayName: string | null }[];
  unreadCount: number;
  requestStatus: 'accepted' | 'pending';
  isRequestRecipient: boolean;
  requestHidden: boolean;
  sendRestriction: 'none' | 'awaiting_acceptance';
  lastMessage: MessageRow | null;
  lastReaction: { emoji: string; messageId: string; userId: string } | null;
}

/**
 * Accounts that start with no conversation and no special privacy settings in a fresh seed.
 * Every conversation a spec starts survives the run, so a pair is claimed only while the two have
 * never talked, and a second run lands on pairs the first did not use.
 */
const ACCOUNT_POOL = [
  'aoife.commentsonly2',
  'arjun.silent2',
  'bianca.onlycomments2',
  'cormac.replies3',
  'dario.onlycomments',
  'emil.shortreplies',
  'felix.quiet4',
  'henrik.quietreply2',
  'ilse.readsmostly2',
  'kade.onstream',
  'leo.embedded',
  'mariam.reader2',
  'matteo.replies2',
  'maya.visualdesign',
  'nina.privatelife',
  'noemi.shortfilm',
  'noor.commentsonly3',
  'omar.browses2',
  'petra.nopost2',
  'priya.commentsonly',
  'stella.watches',
  'theo.sixstring',
  'tobias.notpublic',
];

export type Account = Api & { dispose: () => Promise<void> };

export interface Pair {
  sender: Account;
  recipient: Account;
  dispose: () => Promise<void>;
}

/** Every conversation of one folder, for the account `api` is signed in as. */
export async function conversationsIn(api: Api, folder: Folder): Promise<ConversationRow[]> {
  return walk<ConversationRow>(api, `/conversations?folder=${folder}&limit=50`, 4);
}

async function partnersOf(api: Api): Promise<Set<string>> {
  const partners = new Set<string>();
  for (const folder of FOLDERS) {
    for (const row of await conversationsIn(api, folder)) {
      row.participants.forEach((p) => partners.add(p.username));
    }
  }
  return partners;
}

/**
 * Claims `count` disjoint sender and recipient pairs that have never exchanged a message and
 * makes the recipient a stranger to the sender, which is what routes a first message to Requests.
 */
export async function claimPairs(
  browser: Browser,
  count: number,
  options: { recipients?: string[]; exclude?: string[] } = {}
): Promise<Pair[]> {
  const recipientPool = options.recipients ?? ACCOUNT_POOL;
  const opened = new Map<string, Account>();
  const partners = new Map<string, Set<string>>();
  const used = new Set<string>(options.exclude ?? []);
  const open = async (username: string) => {
    if (!opened.has(username)) {
      const account = await apiSession(browser, username);
      opened.set(username, account);
      partners.set(username, await partnersOf(account));
    }
    return opened.get(username)!;
  };

  const pairs: Pair[] = [];
  for (const senderName of ACCOUNT_POOL) {
    if (pairs.length === count) break;
    if (used.has(senderName)) continue;
    const sender = await open(senderName);
    for (const recipientName of recipientPool) {
      if (recipientName === senderName || used.has(recipientName)) continue;
      if (partners.get(senderName)!.has(recipientName)) continue;
      const recipient = await open(recipientName);
      if (partners.get(recipientName)!.has(senderName)) continue;
      // The seeded graph is dense; a recipient who follows the sender would skip Requests.
      await recipient.call('DELETE', `/social/follow/${sender.user.id}`);
      used.add(senderName);
      used.add(recipientName);
      pairs.push({ sender, recipient, dispose: async () => {} });
      break;
    }
  }
  expect(pairs, `fresh account pairs in the seeded pool`).toHaveLength(count);

  const disposeAll = async () => {
    await Promise.all([...opened.values()].map((account) => account.dispose()));
  };
  pairs.forEach((pair) => (pair.dispose = disposeAll));
  return pairs;
}

/**
 * Claims one more fresh sender for a recipient that is already claimed, so a test can send a
 * second request to the same account. The caller disposes the returned account.
 */
export async function claimSenderFor(
  browser: Browser,
  recipient: Api,
  exclude: string[]
): Promise<Account> {
  const known = await partnersOf(recipient);
  for (const username of ACCOUNT_POOL) {
    if (username === recipient.username || exclude.includes(username) || known.has(username)) {
      continue;
    }
    const candidate = await apiSession(browser, username);
    if ((await partnersOf(candidate)).has(recipient.username)) {
      await candidate.dispose();
      continue;
    }
    await recipient.call('DELETE', `/social/follow/${candidate.user.id}`);
    await candidate.call('DELETE', `/social/follow/${recipient.user.id}`);
    return candidate;
  }
  throw new Error(`no fresh sender left in the pool for ${recipient.username}`);
}

export async function startConversation(sender: Api, recipient: Api): Promise<string> {
  const created = await sender.call<{ id: string }>('POST', '/conversations', {
    targetUserId: recipient.user.id,
  });
  expect(created.status, 'start a conversation').toBe(201);
  return created.data.id;
}

export async function sendText(
  api: Api,
  conversationId: string,
  content: string,
  extra: Record<string, unknown> = {},
  headers?: Record<string, string>
) {
  return api.call<MessageRow>(
    'POST',
    `/conversations/${conversationId}/messages`,
    { messageType: 'text', content, ...extra },
    headers
  );
}

/** Starts a request from `sender` to `recipient` and returns the conversation and first message. */
export async function startRequest(sender: Api, recipient: Api, text: string) {
  const conversationId = await startConversation(sender, recipient);
  const sent = await sendText(sender, conversationId, text);
  expect(sent.status, 'first request message').toBe(201);
  return { conversationId, message: sent.data };
}

/** Starts a request and accepts it, which leaves an ordinary two-way conversation. */
export async function startAcceptedConversation(sender: Api, recipient: Api, text: string) {
  const started = await startRequest(sender, recipient, text);
  const accepted = await recipient.call('POST', `/conversations/${started.conversationId}/accept`);
  expect(accepted.status, 'accept the request').toBeLessThan(300);
  return started;
}

/** The newest 50 messages of a conversation as `api` sees them, newest first. */
export async function historyOf(api: Api, conversationId: string): Promise<MessageRow[]> {
  const result = await api.call('GET', `/conversations/${conversationId}/messages?limit=50`);
  expect(result.status, 'message history').toBe(200);
  return itemsOf<MessageRow>(result.data);
}

export async function counts(api: Api) {
  const result = await api.call<{ unreadCount: number; requestCount: number }>(
    'GET',
    '/conversations/unread-count'
  );
  expect(result.status).toBe(200);
  return result.data;
}

export async function rowIn(api: Api, folder: Folder, conversationId: string) {
  return (await conversationsIn(api, folder)).find((row) => row.id === conversationId);
}

export async function folderOfConversation(api: Api, conversationId: string) {
  for (const folder of FOLDERS) {
    if (await rowIn(api, folder, conversationId)) return folder;
  }
  return null;
}

export async function openMessages(page: Page) {
  await page.goto('/app/messages');
  await expect(page.getByRole('tablist', { name: 'inbox folders' })).toBeVisible();
}

export function inboxTab(page: Page, name: 'primary' | 'requests') {
  return page.getByRole('tab', { name: new RegExp(`^${name}`) });
}

/** The conversation row whose name is the other account's display name. */
export function conversationRow(page: Page, displayName: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${displayName}`) }).first();
}

export function bubbleText(page: Page, text: string): Locator {
  // The composer's textarea carries an unsent draft as text too, and a reply's own text sits in a
  // span under its quote, so only a div or a span counts as a bubble.
  const quoted = JSON.stringify(text);
  return page.locator(`div:text-is(${quoted}), span:text-is(${quoted})`).last();
}

export function nameOf(account: Api): string {
  return (account.user.displayName as string) || account.username;
}

/** Reaction chips on the thread are buttons labelled with their emoji. */
export function chip(page: Page, emoji: string): Locator {
  return page.getByRole('button', { name: `${emoji} reaction` });
}

/**
 * Hovers the message bubble that carries `text` so its action buttons appear, and returns the
 * bubble's row for further lookups.
 */
export async function revealActions(page: Page, text: string) {
  const bubble = bubbleText(page, text);
  await bubble.scrollIntoViewIfNeeded();
  await bubble.hover();
  return bubble;
}

/**
 * Captures the messages screen at every width. Each width loads the screen afresh, because the
 * screen picks its single-column or two-column layout when it mounts and a signed-in tab is
 * never resized by a real visitor mid-conversation. `prepare` puts the screen in the state to
 * photograph, and the screen must not scroll sideways at 390.
 */
export async function captureMessagesAtAllWidths(
  page: Page,
  requirementId: string,
  prepare: () => Promise<void>
) {
  for (const size of ALL_WIDTHS) {
    await page.setViewportSize(size);
    await openMessages(page);
    await prepare();
    await capture(page, requirementId, size.width);
    if (size.width === 390) await expectNoHorizontalScroll(page);
  }
  await page.setViewportSize(DESKTOP);
}

/**
 * Resolves once the page has asked the live tier for a topic that starts with `prefix`.
 *
 * Register it before the page navigates. A frame sent before the subscription exists is never
 * replayed, because delivery is best effort and the REST read is the authority, so a spec that
 * expects a live update has to wait for the subscription before it acts.
 */
export function liveSubscribed(page: Page, prefix: string): Promise<void> {
  return new Promise((resolve) => {
    page.on('websocket', (socket) => {
      socket.on('framesent', (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : '';
        if (payload.includes('SUBSCRIBE') && payload.includes(`destination:${prefix}`)) resolve();
      });
    });
  });
}
