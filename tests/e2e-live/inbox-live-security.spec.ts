import { expect, test } from '@playwright/test';
import type { Pair } from './helpers/messages';
import { claimPairs, startRequest } from './helpers/messages';
import type { StompSession } from './helpers/stomp';
import { openStomp } from './helpers/stomp';

/**
 * The inbox live topic on the real broker (P1-B2-R8 and the wildcard subscription guard): an
 * account receives only its own `/topic/inbox.{userId}` frames, a pattern subscription is refused
 * and delivers nothing, and a frame carries the event, the conversation and the folder and never
 * any message content.
 */
let pairs: Pair[] = [];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  pairs = await claimPairs(browser, 2);
});

test.afterAll(async () => {
  await pairs[0]?.dispose();
});

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('P1-B2-R8 a user receives its own inbox frames, which name the event, the conversation and the folder only', async () => {
  const { sender, recipient } = pairs[0];
  const live = await openStomp(recipient);
  try {
    expect(await live.subscribe(`/topic/inbox.${recipient.user.id}`)).toBe(true);

    const secret = `private words that must not travel ${Date.now()}`;
    const { conversationId, message } = await startRequest(sender, recipient, secret);
    await expect.poll(() => live.frames.length, { timeout: 15_000 }).toBeGreaterThan(0);

    const frame = live.frames.find(
      (candidate) => candidate.json?.conversationId === conversationId
    );
    expect(frame, 'a frame for the new request').toBeTruthy();
    expect(frame!.destination).toBe(`/topic/inbox.${recipient.user.id}`);
    expect(Object.keys(frame!.json!).sort()).toEqual(['conversationId', 'eventType', 'folder']);
    expect(frame!.json!.folder).toBe('requests');
    for (const received of live.frames) {
      expect(received.body).not.toContain(secret);
      expect(received.body).not.toContain(message.id);
      expect(Object.keys(received.json ?? {})).not.toContain('content');
    }

    // The recipient is the reactor here, so the frame goes to the sender and nothing new
    // reaches the recipient's own topic.
    const accepted = await recipient.call('POST', `/conversations/${conversationId}/accept`);
    expect(accepted.status).toBeLessThan(300);
    await settle(1000);
    const before = live.frames.length;
    const reacted = await recipient.call(
      'PUT',
      `/conversations/${conversationId}/messages/${message.id}/reaction`,
      { emoji: '👍' }
    );
    expect(reacted.status).toBe(200);
    await settle(1500);
    expect(live.frames.length).toBe(before);
  } finally {
    await live.close();
  }
});

test('P1-B2-R8 a subscription to another account inbox is refused and delivers nothing', async () => {
  const { sender, recipient } = pairs[1];
  const attacker = await openStomp(sender);
  try {
    const confirmed = await attacker.subscribe(`/topic/inbox.${recipient.user.id}`);
    expect(confirmed, 'subscribing to someone else inbox').toBe(false);
    await expect.poll(() => attacker.errors.length > 0 || attacker.closed()).toBe(true);

    await startRequest(sender, recipient, `a request the attacker could not read ${Date.now()}`);
    await settle(2000);
    expect(attacker.frames).toEqual([]);
  } finally {
    await attacker.close();
  }
});

const PATTERNS = [
  '/topic/inbox.*',
  '/topic/inbox.#',
  '/topic/inbox.?',
  '/topic/inbox.{id}',
  '/topic/inbox.*.*',
  '/topic/inbox.**',
  '/topic/*',
  '/topic/#',
  '/topic/conversations.*.messages',
  '/topic/conversations.#',
  '*',
  '#',
];

test('P1-B2-R8 every wildcard subscription is refused and no other account frame is delivered', async () => {
  const { sender, recipient } = pairs[1];
  const probes: { pattern: string; session: StompSession; accepted: boolean }[] = [];

  try {
    for (const pattern of PATTERNS) {
      const session = await openStomp(sender);
      probes.push({ pattern, session, accepted: await session.subscribe(pattern) });
    }
    expect(
      probes.filter((probe) => probe.accepted).map((probe) => probe.pattern),
      'no pattern subscription may be accepted'
    ).toEqual([]);

    // A pattern that slipped through would see the recipient's frames now; this proves it stays quiet.
    const victim = await openStomp(recipient);
    try {
      expect(await victim.subscribe(`/topic/inbox.${recipient.user.id}`)).toBe(true);
      await startRequest(pairs[0].sender, recipient, `watched ${Date.now()}`);
      await expect.poll(() => victim.frames.length, { timeout: 15_000 }).toBeGreaterThan(0);
    } finally {
      await victim.close();
    }
    await settle(1500);
    for (const probe of probes) {
      expect(probe.session.frames, `frames on ${probe.pattern}`).toEqual([]);
    }
  } finally {
    await Promise.all(probes.map((probe) => probe.session.close()));
  }
});

test('P1-B2-R8 a wildcard on the notification endpoint is refused as well', async () => {
  const { sender } = pairs[1];
  for (const pattern of ['/topic/notifications.*', '/topic/*']) {
    const probe = await openStomp(sender, '/ws/notifications');
    try {
      expect(await probe.subscribe(pattern), pattern).toBe(false);
    } finally {
      await probe.close();
    }
  }
});
