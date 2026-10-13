import type { ConversationResponse } from '@/types/domain';
import type { VerifiedUser } from './support/identity.ts';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_BASE, api, assertStackReachable, unwrap } from './support/client.ts';
import { createVerifiedUser } from './support/identity.ts';

let alice: VerifiedUser;
let bob: VerifiedUser;
let conversationId: string;
const openClients: Client[] = [];

beforeAll(async () => {
  await assertStackReachable();
  alice = await createVerifiedUser();
  bob = await createVerifiedUser();
  conversationId = unwrap(
    await api<ConversationResponse>('/conversations', {
      method: 'POST',
      token: alice.accessToken,
      body: { targetUserId: bob.user.id },
    })
  ).id;
}, 90000);

afterAll(() => {
  for (const client of openClients) {
    try {
      client.deactivate();
    } catch {
      // Best effort; the run is ending either way.
    }
  }
});

const ticketFor = async (user: VerifiedUser) =>
  unwrap(
    await api<{ ticket: string }>('/auth/ws-ticket', { method: 'POST', token: user.accessToken })
  ).ticket;

/**
 * Opens a STOMP client over the given endpoint.
 *
 * Returns the client plus a promise that settles once the outcome is known. Deliberately not
 * silent, unlike the browser module this mirrors: a test that cannot connect must fail loudly
 * rather than degrade.
 */
const openClient = (endpoint: string, ticket: string, timeoutMs = 10000) => {
  const client = new Client({
    webSocketFactory: () => new SockJS(`${API_BASE}${endpoint}?ticket=${ticket}`),
    reconnectDelay: 0,
    debug: () => {},
  });
  openClients.push(client);

  const connected = new Promise<Client>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no connect within ${timeoutMs}ms`)),
      timeoutMs
    );
    const fail = (why: string) => {
      clearTimeout(timer);
      reject(new Error(why));
    };
    client.onConnect = () => {
      clearTimeout(timer);
      resolve(client);
    };
    client.onStompError = (frame) => fail(`stomp error: ${frame.headers?.message ?? 'unknown'}`);
    client.onWebSocketError = () => fail(`websocket refused for ${endpoint}`);
    client.onWebSocketClose = () => fail(`websocket closed before connect on ${endpoint}`);
  });

  client.activate();
  return { client, connected };
};

/** Subscribes and resolves with the first frame received on the destination. */
const firstFrame = (client: Client, destination: string, timeoutMs = 15000) =>
  new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no frame on ${destination} within ${timeoutMs}ms`)),
      timeoutMs
    );
    client.subscribe(destination, (message) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(message.body));
      } catch {
        resolve({ raw: message.body });
      }
    });
  });

describe('message realtime transport', () => {
  it('completes a STOMP handshake on the message endpoint', async () => {
    // /ws/comments sits in the CSRF ignore set and /ws/messages does not, so the handshake is
    // worth asserting on its own rather than only as a precondition of delivery.
    const { connected } = openClient('/ws/messages', await ticketFor(alice));
    await expect(connected).resolves.toBeTruthy();
  }, 20000);

  it('refuses a handshake with no ticket', async () => {
    const { connected } = openClient('/ws/messages', '', 8000);
    await expect(connected).rejects.toThrow();
  }, 20000);

  it('refuses to redeem the same ticket twice', async () => {
    // Single use is the entire reason this is a ticket rather than the access token: a replayable
    // credential sitting in a query string is what the design set out to avoid.
    const ticket = await ticketFor(alice);
    await expect(openClient('/ws/messages', ticket).connected).resolves.toBeTruthy();
    await expect(openClient('/ws/messages', ticket, 8000).connected).rejects.toThrow();
  }, 30000);

  it('delivers a sent message to a subscriber of the conversation topic', async () => {
    const { client } = openClient('/ws/messages', await ticketFor(bob));
    const subscriber = await openClient('/ws/messages', await ticketFor(bob)).connected;
    client.deactivate();

    const frame = firstFrame(subscriber, `/topic/conversations.${conversationId}.messages`);
    // The SUBSCRIBE frame is written synchronously but the broker registers it asynchronously.
    // Publishing before that lands is the classic way to make this test flaky.
    await new Promise((resolve) => setTimeout(resolve, 500));

    await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: alice.accessToken,
      body: { messageType: 'text', content: 'live frame please' },
    });

    expect(JSON.stringify(await frame)).toContain('live frame please');
  }, 40000);

  it('does not leak a conversation to a non-participant', async () => {
    const stranger = await createVerifiedUser();
    const subscriber = await openClient('/ws/messages', await ticketFor(stranger)).connected;

    let received: string | null = null;
    subscriber.subscribe(`/topic/conversations.${conversationId}.messages`, (message) => {
      received = message.body;
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: alice.accessToken,
      body: { messageType: 'text', content: 'not for strangers' },
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(received).toBeNull();
  }, 60000);
});
