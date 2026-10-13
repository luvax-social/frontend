import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';

const ONE_HOUR = 60 * 60 * 1000;

const toSortedByOrder = <T extends { key: string; sortOrder?: number }>(list: T[] = []) =>
  [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const toLabelMap = <T extends { key: string }>(list: T[] = []) => {
  const map = new Map<string, T>();
  for (const entry of list) {
    map.set(entry.key, entry);
  }
  return map;
};

/**
 * The vocabulary lists, fetched once per session after authentication and
 * cached for an hour. It changes only when an operator edits a configuration
 * table.
 *
 * A lookup map is built from the full list, including disabled entries, and
 * used to render labels everywhere; a historical report may reference a reason
 * key that has since been disabled, and it must still render its display name
 * rather than a raw key.
 */
export function useVocabularies() {
  const query = useQuery({
    queryKey: ['admin', 'vocabularies'],
    queryFn: () => adminApi.getVocabularies(),
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    retry: 1,
  });

  const data = query.data;

  return useMemo(() => {
    // Every reason is offered, for every report type. A reason carries an
    // `appliesTo` list, and an **empty** one means every type rather than none
    // — `spam`, `harassment`, `scam`, and `other` all carry an empty list
    // (`uptake-contract-verification.md` §6). Filtering this list by the type
    // being reported and treating empty as "matches nothing" would silently
    // drop those four, which is why no such filter exists here.
    const reportReasons = toSortedByOrder(data?.reportReasons ?? []);
    const moderationActions = toSortedByOrder(data?.moderationActions ?? []);
    const reasonMap = toLabelMap(data?.reportReasons ?? []);
    const actionMap = toLabelMap(data?.moderationActions ?? []);

    return {
      isLoading: query.isLoading,
      isError: query.isError,
      reportReasons,
      moderationActions,
      // Renders a reason key as its display name, falling back to the raw key
      // only if the vocabulary has not loaded or the key is unknown.
      reasonLabel: (key: string) => reasonMap.get(key)?.displayName ?? key,
      // Whether a reason key is currently enabled; a disabled entry is rendered
      // as unavailable and unselectable rather than hidden.
      reasonEnabled: (key: string) => reasonMap.get(key)?.isEnabled ?? true,
      actionLabel: (key: string) => actionMap.get(key)?.displayName ?? key,
      // Whether an action type exists in the moderation-action vocabulary. An
      // observed type absent from it renders as its raw key with a marker rather
      // than blank, and is recorded as a finding. Reported as unknown only once
      // the vocabulary has actually loaded, so a slow fetch never mislabels a
      // known type.
      actionKnown: (key: string) => (query.isSuccess ? actionMap.has(key) : true),
    };
  }, [data, query.isLoading, query.isError]);
}
