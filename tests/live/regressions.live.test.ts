import type { VerifiedUser } from './support/identity.ts';
import { beforeAll, describe, expect, it } from 'vitest';
import { API_BASE, api, assertStackReachable, unwrap } from './support/client.ts';
import { createVerifiedUser } from './support/identity.ts';

let user: VerifiedUser;

beforeAll(async () => {
  await assertStackReachable();
  user = await createVerifiedUser();
}, 40000);

describe('BE-STA-02: metrics are exposed for scraping', () => {
  it('serves prometheus metrics on 8080 without authentication', async () => {
    const response = await fetch(`${API_BASE}/actuator/prometheus`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/^# (HELP|TYPE) /m);
  });

  it('keeps health on the same port', async () => {
    const response = await fetch(`${API_BASE}/actuator/health`);
    expect(response.status).toBe(200);
  });

  it('still refuses other actuator endpoints to an anonymous caller', async () => {
    // Exposure widened deliberately to prometheus only. The ADMIN gate on the rest of
    // /actuator/** must survive that change.
    const response = await fetch(`${API_BASE}/actuator/env`);
    expect([401, 403, 404]).toContain(response.status);
  });
});

describe('BE-STA-01: the comment websocket endpoint is registered', () => {
  it('answers the SockJS info handshake', async () => {
    const response = await fetch(`${API_BASE}/ws/comments/info`);
    expect(response.status).toBe(200);
  });
});

describe('BE-SEC-05: handshakes authenticate with a single-use ticket', () => {
  const issueTicket = async () =>
    unwrap(
      await api<{ ticket: string }>('/auth/ws-ticket', { method: 'POST', token: user.accessToken })
    ).ticket;

  it('issues a ticket to an authenticated caller', async () => {
    expect(await issueTicket()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to issue a ticket without a token', async () => {
    const result = await api<{ ticket: string }>('/auth/ws-ticket', { method: 'POST' });
    expect(result.status).toBe(401);
  });

  it('issues a distinct ticket each time', async () => {
    expect(await issueTicket()).not.toBe(await issueTicket());
  });

  // Redemption itself is asserted in the backend suite, not here. A SockJS transport URL answers
  // 404 for a malformed or already-used session before the handshake interceptor is consulted, and
  // /info is served without running interceptors at all, so neither one can distinguish "ticket
  // rejected" from "wrong URL" over plain HTTP. JwtHandshakeInterceptorTest covers a valid ticket
  // redeeming to the raw token and a used or unknown ticket being refused;
  // WebSocketTicketServiceImplTest covers single-use redemption. Both are deterministic.
  it('does not leave the comment endpoint open to an unauthenticated upgrade', async () => {
    const response = await fetch(`${API_BASE}/ws/comments/websocket`);
    expect(response.status).not.toBe(101);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
