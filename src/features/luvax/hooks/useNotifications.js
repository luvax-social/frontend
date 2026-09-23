import { useCallback, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notifService from '@/services/notification.service';
import {
  itemMatchesFilter,
  markRead,
  markReadUpTo,
  markUnread,
  removeItems,
  upsertItem,
} from '../notifications/notificationCache';
import { NOTIFICATION_ENDPOINT, subscribeTopic } from '@/services/realtime/stompConnection';
import { useAuthStore } from '@/store/useAuthStore';
import { getNextCursor } from '@/utils/helpers';

export const notifKeys = {
  all: ['notifications'],
  list: (filter) => [...notifKeys.all, 'list', filter],
  state: () => [...notifKeys.all, 'state'],
};

const FILTERS = ['all', 'unread', 'comments', 'mentions', 'follows', 'system', 'verified'];

/**
 * One infinite query per chip. Each filter's cache lives under its own key so switching
 * chips keeps the others' scroll position and data (P0 section 9.5).
 * @param {string} filter
 */
export const useNotificationList = (filter) => {
  return useInfiniteQuery({
    queryKey: notifKeys.list(filter),
    queryFn: ({ pageParam = null, signal }) =>
      notifService.getNotifications({ filter, cursor: pageParam, limit: 20, signal }),
    getNextPageParam: getNextCursor,
  });
};

/**
 * Replaces useUnreadCount. The badge and every pinned-entry count come from here or from
 * a live envelope's own `state` block - never computed or adjusted client-side.
 */
export const useNotificationState = () => {
  return useQuery({
    queryKey: notifKeys.state(),
    queryFn: ({ signal }) => notifService.getState(signal),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
};

export const useAdvanceSeen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // Wrapped rather than passed by reference: TanStack forwards its own internal mutation
    // context as a second argument to a bare function reference, which a caller asserting
    // the exact call args (or a real backend strict about extra body fields) would see.
    mutationFn: (tuple) => notifService.advanceSeen(tuple),
    onSuccess: (state) => {
      queryClient.setQueryData(notifKeys.state(), state);
    },
  });
};

/**
 * Debounces useAdvanceSeen to one call per 2 seconds while the screen is visible, per the
 * locked seen flow: the first page-0 all-filter load advances immediately, and each
 * subsequently rendered live `upserted` item advances again on this debounce.
 */
export const useDebouncedAdvanceSeen = () => {
  const advanceSeen = useAdvanceSeen();
  const timerRef = useRef(null);
  const pendingRef = useRef(null);

  const advance = useCallback(
    (tuple, { immediate = false } = {}) => {
      pendingRef.current = tuple;
      if (immediate) {
        if (timerRef.current) clearTimeout(timerRef.current);
        advanceSeen.mutate(pendingRef.current);
        pendingRef.current = null;
        return;
      }
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current) {
          advanceSeen.mutate(pendingRef.current);
          pendingRef.current = null;
        }
      }, 2000);
    },
    [advanceSeen]
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return advance;
};

/**
 * Snapshots every cached notification query (every filter's list, plus state) for an
 * optimistic mutation's rollback, restored in full on error.
 */
const snapshotCaches = (queryClient) => {
  const listSnapshots = FILTERS.map((filter) => [filter, queryClient.getQueryData(notifKeys.list(filter))]);
  const stateSnapshot = queryClient.getQueryData(notifKeys.state());
  return { listSnapshots, stateSnapshot };
};

const restoreCaches = (queryClient, { listSnapshots, stateSnapshot }) => {
  listSnapshots.forEach(([filter, data]) => {
    if (data !== undefined) queryClient.setQueryData(notifKeys.list(filter), data);
  });
  if (stateSnapshot !== undefined) queryClient.setQueryData(notifKeys.state(), stateSnapshot);
};

/** Applies a filter-agnostic `reducer` to the item list of every cached filter's data. */
const patchAllLists = (queryClient, reducer) => {
  FILTERS.forEach((filter) => {
    queryClient.setQueryData(notifKeys.list(filter), (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({ ...page, content: reducer(page.content ?? []) })),
      };
    });
  });
};

/** Applies a per-filter reducer (filter) => (items) => items to every cached list. */
const patchAllListsByFilter = (queryClient, reducerFor) => {
  FILTERS.forEach((filter) => {
    queryClient.setQueryData(notifKeys.list(filter), (data) => {
      if (!data) return data;
      const reducer = reducerFor(filter);
      return {
        ...data,
        pages: data.pages.map((page) => ({ ...page, content: reducer(page.content ?? []) })),
      };
    });
  });
};

export const useMarkRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => notifService.markRead(id),
    onMutate: async (id) => {
      const snapshot = snapshotCaches(queryClient);
      patchAllLists(queryClient, (items) => markRead(items, [id], new Date().toISOString()));
      return snapshot;
    },
    // Rolls back to the snapshot taken in onMutate; the badge is server-derived only, so a
    // failed read must not leave any cached list ahead of confirmed server state.
    onError: (_error, _id, snapshot) => snapshot && restoreCaches(queryClient, snapshot),
  });
};

export const useMarkUnread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => notifService.markUnread(id),
    onMutate: async (id) => {
      const snapshot = snapshotCaches(queryClient);
      patchAllLists(queryClient, (items) => markUnread(items, [id]));
      return snapshot;
    },
    onError: (_error, _id, snapshot) => snapshot && restoreCaches(queryClient, snapshot),
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => notifService.deleteNotification(id),
    onMutate: async (id) => {
      const snapshot = snapshotCaches(queryClient);
      patchAllLists(queryClient, (items) => removeItems(items, [id]));
      return snapshot;
    },
    onError: (_error, _id, snapshot) => snapshot && restoreCaches(queryClient, snapshot),
  });
};

/**
 * Sends `upTo` = the newest row actually rendered (the head of the most recently fetched
 * page 0), never the client's own idea of "now" - rows that arrive after that fetch stay
 * unread, per the locked mark-all-read behaviour.
 */
export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (upTo) => notifService.markAllRead(upTo),
    onMutate: async (upTo) => {
      const snapshot = snapshotCaches(queryClient);
      patchAllLists(queryClient, (items) => markReadUpTo(items, upTo, new Date().toISOString()));
      return snapshot;
    },
    onError: (_error, _upTo, snapshot) => snapshot && restoreCaches(queryClient, snapshot),
  });
};

/**
 * Subscribes to /topic/notifications.{userId} and dispatches each typed envelope into
 * every cached filter list it matches (notificationCache.itemMatchesFilter) plus the
 * state cache, which every envelope carries and which is the badge's only source. This
 * never invalidates broadly, unlike the previous implementation, because P1 section 4
 * gives enough fields on the item itself to route it precisely.
 */
export const useLiveNotifications = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) return undefined;

    return subscribeTopic(
      `/topic/notifications.${userId}`,
      (envelope) => {
        if (envelope.state) {
          queryClient.setQueryData(notifKeys.state(), envelope.state);
        }
        switch (envelope.event) {
          case 'upserted':
            patchAllListsByFilter(queryClient, (filter) => (items) =>
              itemMatchesFilter(envelope.item, filter)
                ? upsertItem(items, envelope.item)
                : removeItems(items, [envelope.item.id])
            );
            break;
          case 'deleted':
            patchAllLists(queryClient, (items) => removeItems(items, envelope.ids));
            break;
          case 'read-state':
            patchAllLists(queryClient, (items) =>
              envelope.upTo
                ? markReadUpTo(items, envelope.upTo, envelope.readAt)
                : envelope.readAt
                  ? markRead(items, envelope.ids, envelope.readAt)
                  : markUnread(items, envelope.ids)
            );
            break;
          case 'seen':
          case 'requests':
            // state was already replaced above; these two events carry nothing else to apply.
            break;
          default:
            break;
        }
      },
      { endpoint: NOTIFICATION_ENDPOINT }
    );
  }, [queryClient, userId]);
};
