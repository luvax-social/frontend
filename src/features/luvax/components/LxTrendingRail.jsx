import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { formatPostCount } from '@/utils/helpers';

import { LxIcon } from './primitives';
import { useTrendingHashtags } from '../hooks/useHashtag';

/**
 * The two surfaces answer the same shape, so this is one list with two data sources rather than
 * two components.
 *
 * "for you" is the default and is safe as one: the backend falls back to the platform list for a
 * caller with no computed affinity, so this tab is never empty. The client cannot cheaply know
 * whether a caller has affinity data, and asking would cost a request to find out something the
 * answer already encodes.
 */
const TABS = [
  { id: 'for-you', label: 'for you' },
  { id: 'platform', label: 'trending' },
];

function RailSkeleton({ compact }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div
            className="lx-skeleton"
            style={{ height: 11, width: `${68 - index * 6}%`, borderRadius: 3 }}
          />
          <div className="lx-skeleton" style={{ height: 9, width: '34%', borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

export function LxTrendingRail({ compact = false }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('for-you');
  const size = compact ? 6 : 8;
  const query = useTrendingHashtags(tab, size);
  const entries = query.data?.data?.content || [];

  return (
    <section aria-label="trending hashtags">
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          borderBottom: `1px solid ${v.border}`,
        }}
      >
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={active}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? v.ink1 : 'transparent'}`,
                padding: compact ? '0 0 7px' : '0 2px 8px',
                marginRight: compact ? 10 : 14,
                cursor: 'pointer',
                fontFamily: v.fontMono,
                fontSize: compact ? 10 : 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: active ? v.ink1 : v.ink3,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <RailSkeleton compact={compact} />
      ) : entries.length === 0 ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>
          nothing trending yet
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entries.map((entry) => (
            <li key={entry.hashtagId}>
              <button
                type="button"
                onClick={() => navigate(routeTo.hashtag(entry.name))}
                style={{
                  appearance: 'none',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  padding: compact ? '6px 0' : '7px 0',
                  cursor: 'pointer',
                  display: 'block',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    minWidth: 0,
                  }}
                >
                  <span
                    title={`#${entry.name}`}
                    style={{
                      fontFamily: v.fontBody,
                      fontSize: compact ? 12 : 13,
                      color: v.ink1,
                      // A long tag truncates rather than wrapping onto a second line, which would
                      // make the rows unequal heights and break the rhythm of the list.
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    #{entry.name}
                  </span>
                  {entry.pinned ? (
                    <span
                      title="Pinned by an administrator"
                      style={{ display: 'inline-flex', flexShrink: 0 }}
                    >
                      <LxIcon name="pin" size={11} color={v.accent} />
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontFamily: v.fontMono,
                    fontSize: 10,
                    color: v.ink3,
                    marginTop: 2,
                  }}
                >
                  {/*
                    postCount is null for a hashtag the current snapshot does not contain, which
                    the personalised tab returns routinely. Null is not zero and not a hidden
                    count: it means this hashtag has no count for this window, and the backend
                    deliberately withholds the lifetime total rather than mixing two different
                    measurements in one column. formatCount renders an en dash, which reads as a
                    count the viewer is not allowed to see, so it is wrong here.
                  */}
                  {typeof entry.postCount === 'number' ? formatPostCount(entry.postCount) : 'new'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LxTrendingRail;
