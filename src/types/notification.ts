import type {
  NotificationItemResponse,
  NotificationKeyResponse,
  NotificationStateResponse,
} from './domain';

export type NotificationFilter =
  | 'all'
  | 'unread'
  | 'comments'
  | 'mentions'
  | 'follows'
  | 'system'
  | 'verified';
export type NotificationLiveEnvelope = { state: NotificationStateResponse } & (
  | { event: 'upserted'; item: NotificationItemResponse }
  | { event: 'deleted'; ids: string[] }
  | {
      event: 'read-state';
      ids?: string[];
      upTo?: NotificationKeyResponse | null;
      readAt?: string | null;
    }
  | { event: 'seen' | 'requests' }
);
