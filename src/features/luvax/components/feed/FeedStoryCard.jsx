import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';

import { useOverlayNavigate } from '../../hooks/useOverlayNavigate';
import { FeedInjectedCard } from './FeedInjectedCard';

const TILE_W = 80;
const TILE_H = 120;

/**
 * Stories from accounts the viewer does not follow, embedded between posts.
 *
 * The requirement this component exists to satisfy is that it cannot be mistaken for a post. Four
 * signals carry that, strongest first:
 *
 * 1. The segmented progress bar. It is the story viewer's own chrome and nothing else in Luvax uses
 *    it, so it is the only signal here that is unique rather than merely different. It also says
 *    how many stories are inside, which no other treatment does for free.
 * 2. A 2:3 portrait tile on a dark fill, against post media that is square or landscape on the
 *    light surface. Opposite proportion, opposite value.
 * 3. The gold ring on the avatar, carried over from LxAvatar's `hasStory` rather than invented, so
 *    it means the same thing here as at the top of the feed.
 * 4. The 24h pill: ephemerality stated outright, which is the plainest way to mark what a post is
 *    not.
 *
 * The header copy is deliberately not one of the four. Copy is the first thing a scrolling eye
 * skips.
 *
 * @param {Array<Object>} entries - Tray entries from `useStoryDiscovery`.
 * @param {string} [viewport] - `mobile` tightens the horizontal padding.
 * @param {Function} onDismiss - Removes the whole card for this session.
 */
export function FeedStoryCard({ entries = [], viewport = 'desktop', onDismiss }) {
  const openOverlay = useOverlayNavigate();
  const isMobile = viewport === 'mobile';

  // Nothing to show means nothing rendered, not a skeleton. An empty shell between two real posts
  // is worse than the card simply not being there, and it shifts content under the reader's thumb
  // when it resolves.
  if (entries.length === 0) return null;

  return (
    <FeedInjectedCard
      eyebrow="stories"
      accentEyebrow="people you may know"
      onDismiss={onDismiss}
      dismissLabel="Dismiss story suggestions"
      viewport={viewport}
      trailing={
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 10,
            letterSpacing: '0.06em',
            color: v.accentText,
            background: v.accentDim,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          24h
        </span>
      }
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '0 0 4px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {entries.map((entry) => {
          const first = entry.stories?.[0];
          if (!first) return null;
          const cover = first.media?.cdnUrl ?? null;
          const name = entry.userDisplayName || entry.username;
          const target = routeTo.storyView(first.id);
          return (
            <a
              key={entry.userId}
              href={target}
              onClick={(event) => {
                event.preventDefault();
                openOverlay(target);
              }}
              aria-label={`${name}, ${entry.stories.length} stories`}
              style={{
                width: TILE_W,
                height: TILE_H,
                borderRadius: 10,
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
                display: 'block',
                textDecoration: 'none',
                background: cover ? `url(${cover}) center/cover no-repeat` : v.surfaceSunken,
              }}
            >
              <span
                data-testid={`story-segments-${entry.userId}`}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  right: 6,
                  display: 'flex',
                  gap: 3,
                  zIndex: 2,
                }}
              >
                {entry.stories.map((story, index) => (
                  <i
                    key={story.id}
                    style={{
                      flex: 1,
                      height: 2,
                      borderRadius: 2,
                      background: index === 0 && !entry.hasUnseen ? v.white : v.white45,
                    }}
                  />
                ))}
              </span>
              {/* A legibility scrim, not decoration: the name sits on someone else's photograph and
                  has to hold 4.5:1 against whatever is behind it. Approved as the one functional
                  exception to the gradient ban in DESIGN.md section 4. */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                  background:
                    'linear-gradient(to top, rgba(26,24,22,0.68) 34%, rgba(26,24,22,0) 68%)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 7,
                  right: 7,
                  bottom: 7,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: 21,
                    height: 21,
                    borderRadius: '50%',
                    padding: 1.5,
                    boxSizing: 'border-box',
                    background: v.accent,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: entry.userAvatarUrl
                        ? `url(${entry.userAvatarUrl}) center/cover no-repeat`
                        : v.surfaceSunken,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 9,
                    fontWeight: 600,
                    color: v.white,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </FeedInjectedCard>
  );
}

export default FeedStoryCard;
