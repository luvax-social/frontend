import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { Api } from './session';

const BACKEND = 'http://localhost:8080';

export interface Frame {
  destination: string;
  body: string;
  json: Record<string, unknown> | null;
}

export interface StompSession {
  frames: Frame[];
  /** Broker or protocol errors reported by the server, such as a refused subscription. */
  errors: string[];
  closed: () => boolean;
  /** Subscribes and resolves true when the broker kept the session, false when it refused. */
  subscribe: (destination: string) => Promise<boolean>;
  close: () => Promise<void>;
}

/**
 * Opens a STOMP session on one live endpoint the way the browser does: a single-use handshake
 * ticket from the API in the query string, then SockJS. Every frame the server delivers is kept,
 * which is what lets a spec prove that a refused or foreign subscription received nothing.
 */
export async function openStomp(api: Api, endpoint = '/ws/messages'): Promise<StompSession> {
  const ticket = await api.call<{ ticket: string }>('POST', '/auth/ws-ticket');
  if (!ticket.data?.ticket) throw new Error(`no ticket for ${api.username}: ${ticket.status}`);

  const frames: Frame[] = [];
  const errors: string[] = [];
  let closed = false;

  const client = new Client({
    webSocketFactory: () =>
      new SockJS(`${BACKEND}${endpoint}?ticket=${encodeURIComponent(ticket.data.ticket)}`),
    reconnectDelay: 0,
    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,
    onStompError: (frame) => errors.push(frame.headers.message ?? frame.body ?? 'error'),
    onWebSocketClose: () => {
      closed = true;
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('STOMP connect timed out')), 15_000);
    client.onConnect = () => {
      clearTimeout(timer);
      resolve();
    };
    client.activate();
  });

  const record = (destination: string) => (message: IMessage) => {
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(message.body) as Record<string, unknown>;
    } catch {
      json = null;
    }
    frames.push({ destination, body: message.body, json });
  };

  return {
    frames,
    errors,
    closed: () => closed,
    subscribe: async (destination) => {
      const errorsBefore = errors.length;
      try {
        client.subscribe(destination, record(destination));
      } catch {
        return false;
      }
      // The broker sends no receipt for a subscription. A refused one answers with an ERROR frame
      // and ends the session, so a quiet moment with the session still open means it was accepted.
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        if (errors.length > errorsBefore || closed) return false;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return !closed && errors.length === errorsBefore;
    },
    close: async () => {
      await client.deactivate();
    },
  };
}
