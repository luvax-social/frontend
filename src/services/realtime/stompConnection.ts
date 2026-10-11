import type { StompSubscription } from '@stomp/stompjs';
import type { ApiResponse } from '@/types/api';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { axiosClient } from '@/api/axiosClient';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * The one STOMP connection the application holds.
 *
 * Subscriptions are reference counted by destination. The socket opens when the
 * first subscriber arrives and closes when the last one leaves, so a viewer who
 * never opens a post never opens a socket.
 *
 * Every failure path here is silent and non-throwing. Live updates are additive:
 * if the socket never connects, the screen that asked for it must behave exactly
 * as it did before, so nothing in this module may surface an error to a caller.
 */

// SockJS is mandatory. The server registers both endpoints with withSockJS() and
// refuses a raw WebSocket upgrade with 400, before the auth interceptor runs.
// See docs/realtime/realtime-contract.md section 1.
export const COMMENT_ENDPOINT = '/ws/comments';
export const MESSAGE_ENDPOINT = '/ws/messages';
export const NOTIFICATION_ENDPOINT = '/ws/notifications';

// Browsers cannot set an Authorization header on a WebSocket upgrade, so a credential has to ride
// in the URL. It is a single-use ticket rather than the access token: query strings are logged by
// default by proxies and CDNs, and a token left there outlives its own expiry in log storage. The
// ticket is redeemed server-side, expires in 30 seconds, and cannot be replayed.
const TICKET_PARAM = 'ticket';
const TICKET_PATH = '/auth/ws-ticket';

/**
 * Obtains a handshake ticket, or null when one cannot be had.
 *
 * Silent on failure like everything else in this module: a live tier that cannot start must leave
 * the screen exactly as it was.
 */
const fetchTicket = async () => {
  try {
    const response = await axiosClient.post<ApiResponse<{ ticket: string }>>(TICKET_PATH);
    return response?.data?.data?.ticket ?? null;
  } catch {
    return null;
  }
};

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * One connection record per SockJS endpoint.
 *
 * The server registers each live endpoint behind its own flag, so a single shared client would tie
 * one feature's delivery to another feature's configuration: turning comment live delivery off
 * would silently stop messages. Each endpoint therefore owns its client, its handler registry, and
 * its own backoff.
 */
interface Connection {
  endpointPath: string;
  client: Client | null;
  handlers: Map<string, Set<(payload: unknown) => void>>;
  subscriptions: Map<string, StompSubscription>;
  reconnectDelay: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  consecutiveHandshakeFailures: number;
}
const connections = new Map<string, Connection>();

const connectionFor = (endpointPath: string) => {
  if (!connections.has(endpointPath)) {
    connections.set(endpointPath, {
      endpointPath,
      client: null,
      /** destination -> Set of handler functions */
      handlers: new Map(),
      /** destination -> the live StompSubscription, present only while connected */
      subscriptions: new Map(),
      reconnectDelay: INITIAL_RECONNECT_DELAY_MS,
      reconnectTimer: null,
      consecutiveHandshakeFailures: 0,
    });
  }
  return connections.get(endpointPath)!;
};

// Failures here stay silent by design, which is right for a flaky network and wrong for an endpoint
// that is not registered at all. Production ran for some time with the comment live flag off, so
// this module retried forever against a 404 and nothing on either side said so. A development-only
// warning after a few consecutive failures makes that visible during integration without changing
// the silent contract that shipped code relies on.
const HANDSHAKE_WARN_THRESHOLD = 3;

const noteHandshakeFailure = (conn: Connection) => {
  conn.consecutiveHandshakeFailures += 1;
  if (import.meta.env.DEV && conn.consecutiveHandshakeFailures === HANDSHAKE_WARN_THRESHOLD) {
    console.warn(
      `[realtime] ${HANDSHAKE_WARN_THRESHOLD} consecutive handshake failures against ` +
        `${conn.endpointPath}. Check that the matching live flag is enabled on the backend.`
    );
  }
};

const noteHandshakeSuccess = (conn: Connection) => {
  conn.consecutiveHandshakeFailures = 0;
};

/**
 * Derives the server origin from the configured API base URL.
 *
 * The WebSocket endpoints sit outside `/api/v1` and the Vite dev proxy only
 * forwards `/api`, so the socket is opened against the backend origin directly.
 * The origin is never hardcoded; it comes from VITE_API_URL like every other
 * server address in the application.
 */
const resolveEndpoint = (endpointPath: string) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
  try {
    return new URL(endpointPath, new URL(apiUrl).origin).toString();
  } catch {
    return null;
  }
};

const currentToken = () => useAuthStore.getState().accessToken;

const cancelReconnect = (conn: Connection) => {
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
  }
};

const bindSubscription = (conn: Connection, destination: string) => {
  if (!conn.client?.connected || conn.subscriptions.has(destination)) {
    return;
  }
  const subscription = conn.client.subscribe(destination, (message) => {
    let payload: unknown;
    try {
      payload = JSON.parse(message.body);
    } catch {
      // A frame we cannot parse is dropped rather than propagated. REST remains
      // the source of truth, so a lost frame costs freshness and nothing else.
      return;
    }
    for (const handler of conn.handlers.get(destination) ?? []) {
      try {
        handler(payload);
      } catch {
        // One misbehaving handler must not stop the others or kill the socket.
      }
    }
  });
  conn.subscriptions.set(destination, subscription);
};

/** Drops the current client without touching the handler registry. */
const teardownClient = (conn: Connection) => {
  conn.subscriptions.clear();
  if (!conn.client) {
    return;
  }
  const stale = conn.client;
  conn.client = null;
  try {
    stale.deactivate();
  } catch {
    // Already gone with the socket.
  }
};

/**
 * Queues another connection attempt, doubling the wait each time up to a cap.
 *
 * A server that is down, a live tier that is switched off, and a network that
 * has gone away all produce the same close loop. Backing off keeps a screen that
 * stays open for an hour from making thousands of failing handshakes, while
 * still recovering quickly from a brief drop.
 *
 * The client is rebuilt rather than reactivated. A stompjs client that still
 * considers itself active ignores activate(), so reusing the instance retries
 * once and then silently stops.
 */
const scheduleReconnect = (conn: Connection) => {
  cancelReconnect(conn);
  // Nothing to reconnect for once the last subscriber has gone, and nothing to
  // reconnect with once the session has ended.
  if (conn.handlers.size === 0 || !currentToken()) {
    return;
  }
  const delay = conn.reconnectDelay;
  conn.reconnectDelay = Math.min(conn.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  conn.reconnectTimer = setTimeout(() => {
    conn.reconnectTimer = null;
    if (conn.handlers.size === 0 || !currentToken()) {
      return;
    }
    teardownClient(conn);
    void openClient(conn);
  }, delay);
};

const openClient = async (conn: Connection) => {
  if (conn.client) {
    return conn.client;
  }
  const endpoint = resolveEndpoint(conn.endpointPath);
  if (!endpoint) {
    return null;
  }

  // Fetched before the client is built, because webSocketFactory is synchronous and a ticket is
  // single-use: one ticket per client, and scheduleReconnect builds a fresh client each attempt.
  const ticket = await fetchTicket();
  if (!ticket) {
    noteHandshakeFailure(conn);
    scheduleReconnect(conn);
    return null;
  }

  const created = new Client({
    // One ticket per client. A reconnect tears the client down and builds another, which fetches
    // its own ticket, so a redeemed ticket is never replayed at a second handshake.
    webSocketFactory: () => new SockJS(`${endpoint}?${TICKET_PARAM}=${encodeURIComponent(ticket)}`),
    // stompjs's own reconnect is a fixed delay with no backoff, and mutating
    // reconnectDelay from inside onWebSocketClose does not change the retry it
    // has already scheduled. Observed against a server with the live tier
    // disabled, that produced a steady one-per-second run of failing handshakes.
    // Reconnection is scheduled by scheduleReconnect instead.
    reconnectDelay: 0,
    // The server advertises heart-beat:0,0 and does not send STOMP heartbeats;
    // SockJS sends its own. Asking for STOMP heartbeats here would only add a
    // second liveness mechanism that the server ignores.
    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,
    onConnect: () => {
      conn.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      noteHandshakeSuccess(conn);
      for (const destination of conn.handlers.keys()) {
        bindSubscription(conn, destination);
      }
    },
    onWebSocketClose: () => {
      // A close from a client we have already replaced must not queue a second
      // reconnect alongside the one its replacement is running.
      if (conn.client !== created) {
        return;
      }
      conn.subscriptions.clear();
      noteHandshakeFailure(conn);
      scheduleReconnect(conn);
    },
    // stompjs surfaces protocol and socket errors here. They are swallowed: the
    // live tier degrades, the screen does not.
    onStompError: () => {},
    onWebSocketError: () => {},
  });

  conn.client = created;
  created.activate();
  return created;
};

/**
 * Subscribes to a STOMP destination.
 *
 * The endpoint is the transport; the destination is what the server authorizes. They are separate
 * arguments because each live endpoint is registered behind its own backend flag, so a feature
 * must open the transport its own flag controls rather than borrow another feature's.
 *
 * @param {string} destination fully qualified topic, e.g. `/topic/comments.{id}.events`
 * @param {(payload: {eventType: string, data: object}) => void} handler
 * @param {{endpoint?: string}} [options] SockJS endpoint path; defaults to the comment tier
 * @returns {() => void} unsubscribe; releases the connection when it was the last subscriber
 */
export const subscribeTopic = <T = unknown>(
  destination: string,
  handler: (payload: T) => void,
  { endpoint = COMMENT_ENDPOINT }: { endpoint?: string } = {}
) => {
  if (!destination || typeof handler !== 'function' || !currentToken()) {
    return () => {};
  }

  // The subscriber supplies the DTO type for its destination; malformed frames still fall back to REST.
  const dispatch = (payload: unknown) => handler(payload as T);
  const conn = connectionFor(endpoint);

  if (!conn.handlers.has(destination)) {
    conn.handlers.set(destination, new Set());
  }
  conn.handlers.get(destination)!.add(dispatch);

  void openClient(conn);
  bindSubscription(conn, destination);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    const set = conn.handlers.get(destination);
    set?.delete(dispatch);
    if (set && set.size === 0) {
      conn.handlers.delete(destination);
      try {
        conn.subscriptions.get(destination)?.unsubscribe();
      } catch {
        // The socket may already be gone; the registry entry still goes.
      }
      conn.subscriptions.delete(destination);
    }
    if (conn.handlers.size === 0) {
      closeConnection(endpoint);
    }
  };
};

/**
 * Tears connections down unconditionally.
 *
 * Called on sign-out: a signed-out browser must not hold a live authenticated socket, and the
 * server would otherwise keep it until the revocation sweep notices, up to 30 seconds later.
 * With no argument every endpoint is closed, which is what sign-out wants.
 *
 * @param {string} [endpoint] close only this endpoint; omit to close all
 */
export const closeConnection = (endpoint?: string) => {
  const targets = endpoint
    ? [connections.get(endpoint)].filter((conn): conn is Connection => Boolean(conn))
    : [...connections.values()];

  for (const conn of targets) {
    cancelReconnect(conn);
    conn.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    conn.consecutiveHandshakeFailures = 0;
    for (const subscription of conn.subscriptions.values()) {
      try {
        subscription.unsubscribe();
      } catch {
        // The socket may already be gone; the registry entry still goes.
      }
    }
    conn.subscriptions.clear();
    conn.handlers.clear();
    teardownClient(conn);
  }
};

// A signed-out browser must not keep an authenticated socket open, and until now nothing called
// closeConnection despite its documentation claiming otherwise. The teardown is driven from here
// rather than from the store's logout action because this module already depends on the store, and
// the reverse edge would be an import cycle.
useAuthStore.subscribe((state, previous) => {
  if (previous?.isAuthenticated && !state.isAuthenticated) {
    closeConnection();
  }
});
