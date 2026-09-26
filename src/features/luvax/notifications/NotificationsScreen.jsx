import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { extractPageContent } from '@/utils/helpers';
import {
  useDebouncedAdvanceSeen,
  useLiveNotifications,
  useMarkAllRead,
  useNotificationList,
  useNotificationState,
} from '../hooks/useNotifications';
import { NotificationRow } from './NotificationRow';
import { FollowRequestsEntry } from './FollowRequestsEntry';
import { FollowRequestsView } from './FollowRequestsView';
import { SECTION_ORDER, sectionFor } from './notificationSections';

const CHIPS = ['all', 'unread', 'comments', 'mentions', 'follows', 'system', 'verified'];

const SECTION_LABEL = {
  new: 'new',
  today: 'today',
  'this week': 'this week',
  'this month': 'this month',
  earlier: 'earlier',
};

const EMPTY_COPY = {
  all: 'No notifications yet.',
  unread: 'No unread notifications.',
  comments: 'No comment notifications.',
  mentions: 'No mentions yet.',
  follows: 'No follow notifications.',
  system: 'No system notifications.',
  verified: 'No notifications from verified accounts.',
};

function GroupHeading({ label }) {
  return (
    <div
      style={{
        fontFamily: v.fontMono,
        fontSize: 10,
        color: v.ink3,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '16px 16px 8px',
      }}
    >
      {label}
    </div>
  );
}

/**
 * The notifications screen. Owns the seen flow (page-0 all-filter advances immediately,
 * a rendered live upserted advances again debounced 2s - never on any other filter, and
 * never from a read endpoint), the pinned follow-requests entry/sub-view toggle, and the
 * per-chip infinite lists.
 */
export function NotificationsScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const seenAdvancedRef = useRef(false);

  const { data: state } = useNotificationState();
  useLiveNotifications();
  const advanceSeen = useDebouncedAdvanceSeen();
  const markAllRead = useMarkAllRead();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotificationList(filter);
  const items = useMemo(
    () => data?.pages?.flatMap((page) => extractPageContent(page)) ?? [],
    [data]
  );
  const firstPage = data?.pages?.[0];
  const pageHead = firstPage?.head ?? firstPage?.data?.head ?? null;

  // Advances seen once, on the first successful page-0 render of the all filter only -
  // never on any other chip, and never again from this effect (the debounced live path
  // below is the only other trigger).
  useEffect(() => {
    if (filter !== 'all' || seenAdvancedRef.current || !pageHead) return;
    seenAdvancedRef.current = true;
    advanceSeen(pageHead, { immediate: true });
  }, [filter, pageHead, advanceSeen]);

  // A rendered live upserted item while the screen is visible advances seen again,
  // debounced. Detected as "the newest item in the all-filter cache changed after the
  // initial advance", rather than reading the live envelope directly here, so this stays
  // one code path regardless of which chip is open when the push arrives.
  const newestAllId = filter === 'all' ? items[0]?.id : null;
  const newestAllTuple = useMemo(
    () =>
      filter === 'all' && items[0] ? { activityAt: items[0].activityAt, id: items[0].id } : null,
    [filter, items]
  );
  useEffect(() => {
    if (filter !== 'all' || !seenAdvancedRef.current || !newestAllTuple) return;
    if (document.visibilityState !== 'visible') return;
    if (newestAllTuple.id === pageHead?.id) return;
    advanceSeen(newestAllTuple);
  }, [filter, newestAllId, newestAllTuple, pageHead, advanceSeen]);

  const sections = useMemo(() => {
    const now = new Date();
    const grouped = new Map(SECTION_ORDER.map((key) => [key, []]));
    items.forEach((item) => grouped.get(sectionFor(item, now)).push(item));
    return SECTION_ORDER.map((key) => [key, grouped.get(key)]).filter(
      ([, rows]) => rows.length > 0
    );
  }, [items]);

  if (view === 'requests') {
    return <FollowRequestsView onBack={() => setView('list')} />;
  }

  return (
    <div style={{ width: '100%', maxWidth: 'var(--width-feed)', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${v.border}`,
          position: 'sticky',
          top: 0,
          background: v.base,
          zIndex: 5,
        }}
      >
        <span style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 600, color: v.ink }}>
          notifications
        </span>
        <button
          type="button"
          onClick={() => pageHead && markAllRead.mutate(pageHead)}
          disabled={!pageHead}
          style={{
            background: 'none',
            border: 'none',
            cursor: pageHead ? 'pointer' : 'default',
            fontFamily: v.fontBody,
            fontSize: 12,
            color: pageHead ? v.accentText : v.ink3,
          }}
        >
          mark all as read
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '10px 16px',
          scrollbarWidth: 'none',
        }}
      >
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setFilter(chip)}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: filter === chip ? v.accentDim : v.surface,
              color: filter === chip ? v.accentText : v.ink2,
              fontFamily: v.fontBody,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      <FollowRequestsEntry state={state} onOpen={() => setView('requests')} />

      <div
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (
            hasNextPage &&
            !isFetchingNextPage &&
            el.scrollHeight - el.scrollTop - el.clientHeight < 200
          ) {
            fetchNextPage();
          }
        }}
      >
        {isLoading ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink3,
            }}
          >
            {EMPTY_COPY[filter]}
          </div>
        ) : (
          sections.map(([key, rows]) => (
            <div key={key}>
              <GroupHeading label={SECTION_LABEL[key]} />
              {rows.map((item) => (
                <NotificationRow key={item.id} item={item} navigate={navigate} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
