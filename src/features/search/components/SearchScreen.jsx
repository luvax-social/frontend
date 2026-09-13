import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

import { v } from '@/config/tokens';
import { ROUTES, routeTo, CHAR_LIMITS } from '@/config/constants';
import {
  canViewerSeePost,
  extractPageContent,
  formatPostCount,
  getUserSummary,
  isPageDegraded,
} from '@/utils/helpers';
import { LxIcon } from '@/features/luvax/components/primitives';
import { UserCard } from '@/features/luvax/components/UserCard';
import { useOverlayNavigate } from '@/features/luvax/hooks/useOverlayNavigate';
import { useViewport } from '@/features/luvax/hooks/useViewport';
import { RecommendedPostsGrid } from '@/features/luvax/components/RecommendedPostsGrid';

import {
  getUserSearchTerms,
  useHashtagSearch,
  usePostSearch,
  useUserSearch,
} from '../hooks/useSearch';
import {
  SearchDegraded,
  SearchEmpty,
  SearchFailed,
  SearchLoading,
  SearchPrompt,
} from './SearchResultsEmpty';

const TABS = [
  { id: 'all', label: 'all' },
  { id: 'posts', label: 'posts' },
  { id: 'people', label: 'people' },
  { id: 'tags', label: 'tags' },
];

/**
 * How long the field waits after the last keystroke before the term reaches the
 * address bar and a request is issued.
 *
 * 300ms sits inside the gap between keystrokes for an average typing cadence,
 * so a word is searched once rather than once per letter, while staying below
 * the point where the pause reads as lag.
 */
const DEBOUNCE_MS = 300;

/**
 * Renders one half of the results, choosing between the four states every
 * surface in this phase is required to have.
 */
function ResultsSection({ query, label, result, renderRows }) {
  const { ref, inView } = useInView();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = result;

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!query) return <SearchPrompt />;
  if (isLoading) return <SearchLoading label={label} />;
  if (isError) return <SearchFailed label={label} />;

  const rows = data?.pages?.flatMap((page) => extractPageContent(page)) || [];
  if (rows.length === 0) {
    // The server distinguishes "nothing matched" from "the search backend is
    // down and this page is not an answer". Reading the flag off any page is
    // enough, because a degraded search returns no rows at all.
    const degraded = (data?.pages || []).some((page) => isPageDegraded(page));
    return degraded ? (
      <SearchDegraded label={label} />
    ) : (
      <SearchEmpty label={label} query={query} />
    );
  }

  return (
    <>
      {renderRows(rows)}
      {/* Infinite scroll trigger. Each half owns its own, so one running out of
          pages does not stop the others. */}
      <div
        ref={ref}
        style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        {isFetchingNextPage && (
          <span style={{ color: v.ink3, fontSize: 12, fontFamily: v.fontBody }}>
            loading more...
          </span>
        )}
      </div>
    </>
  );
}

function SuggestedHashtags({ hashtags, navigate }) {
  return (
    <section style={{ margin: '18px 16px 24px' }}>
      <div
        style={{
          fontFamily: v.fontMono,
          fontSize: 10,
          color: v.ink3,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}
      >
        suggested hashtags
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {hashtags.slice(0, 8).map((tag) => (
          <button
            key={tag.id || tag.name}
            type="button"
            onClick={() => navigate(routeTo.hashtag(tag.name))}
            style={{
              border: `1px solid ${v.border}`,
              background: v.surface,
              color: v.ink2,
              borderRadius: 999,
              padding: '7px 11px',
              fontFamily: v.fontBody,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            #{tag.name}
          </button>
        ))}
        {hashtags.length === 0 ? (
          <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>
            no hashtags found
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function SearchScreen() {
  const navigate = useNavigate();
  const openOverlay = useOverlayNavigate();
  const viewport = useViewport();
  const cols = viewport === 'desktop' ? 3 : 2;
  const stackedSearchLayout = viewport === 'mobile';

  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const rawTab = searchParams.get('type') || 'all';
  const tab = TABS.some((item) => item.id === rawTab) ? rawTab : 'all';

  const [input, setInput] = useState(searchParams.get('q') || '');

  // The address is the source of truth for what was searched, so a search can
  // be shared and survives a reload. Typing writes to it on a delay, and
  // replaces rather than pushes so back leaves the search instead of walking
  // through every prefix that was typed on the way to it.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = input.trim();
      if (next === query) return;
      const params = new URLSearchParams(searchParams);
      if (next) params.set('q', next);
      else params.delete('q');
      setSearchParams(params, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query, searchParams, setSearchParams]);

  // An address opened cold or edited by hand is authoritative over the field. Adjusted during
  // render rather than in an effect, so the field is correct in the first pass instead of after a
  // second commit. The trim comparison is preserved: it stops a trailing space the user just typed
  // from being wiped by the debounced address update it triggered.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setInput((current) => (current.trim() === query ? current : query));
  }

  const selectTab = (id) => {
    const params = new URLSearchParams(searchParams);
    params.set('type', id);
    setSearchParams(params, { replace: true });
  };

  const postResult = usePostSearch(query);
  const userSearchTerms = getUserSearchTerms(query);
  const primaryUserResult = useUserSearch(userSearchTerms[0] || '');
  const secondaryUserResult = useUserSearch(userSearchTerms[1] || '');
  const tertiaryUserResult = useUserSearch(userSearchTerms[2] || '');
  const userResults = [primaryUserResult, secondaryUserResult, tertiaryUserResult].filter(
    (_, index) => Boolean(userSearchTerms[index])
  );
  const userResult = {
    data: {
      pages: userResults.flatMap((result) => result.data?.pages || []),
    },
    isLoading: userResults.some((result) => result.isLoading),
    isError: userResults.length > 0 && userResults.every((result) => result.isError),
    fetchNextPage: () =>
      userResults.forEach((result) => {
        if (result.hasNextPage) result.fetchNextPage();
      }),
    hasNextPage: userResults.some((result) => result.hasNextPage),
    isFetchingNextPage: userResults.some((result) => result.isFetchingNextPage),
  };
  const hashtagQuery = query || 'a';
  const hashtagResult = useHashtagSearch(hashtagQuery);
  const postRows = (
    postResult.data?.pages?.flatMap((page) => extractPageContent(page)) || []
  ).filter(canViewerSeePost);
  const userRows = userResult.data?.pages?.flatMap((page) => extractPageContent(page)) || [];
  const dedupedUserRows = userRows.filter((item, index, allRows) => {
    const rowUser = getUserSummary(item, 'user');
    return (
      rowUser.id &&
      allRows.findIndex((row) => getUserSummary(row, 'user').id === rowUser.id) === index
    );
  });
  const hashtagRows = hashtagResult.data?.pages?.flatMap((page) => extractPageContent(page)) || [];
  const sidePostRows = postRows.slice(0, 4);
  const lowerPostRows = postRows.slice(4);
  const allLoading =
    query && (postResult.isLoading || userResult.isLoading || hashtagResult.isLoading);
  const allError = postResult.isError && userResult.isError && hashtagResult.isError;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: v.base }}>
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${v.border}`,
          background: v.surface,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <form
          onSubmit={(event) => event.preventDefault()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 38,
            padding: '0 14px',
            border: `1px solid ${v.borderSubtle}`,
            borderRadius: 999,
            background: v.base,
          }}
        >
          <LxIcon name="explore" size={15} color={v.ink3} />
          <input
            type="search"
            value={input}
            maxLength={CHAR_LIMITS.search}
            autoFocus
            aria-label="search posts, people, and tags"
            placeholder="search"
            onChange={(event) => setInput(event.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: v.ink,
              fontFamily: v.fontBody,
              fontSize: 14,
            }}
          />
        </form>

        <div style={{ display: 'flex', marginTop: 14, marginBottom: -17 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              style={{
                flex: 1,
                fontFamily: v.fontBody,
                fontSize: 13,
                fontWeight: 500,
                color: tab === t.id ? v.ink : v.ink3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '13px 0 14px',
                borderBottom: tab === t.id ? '2px solid var(--lx-ink)' : '2px solid transparent',
                letterSpacing: '0.01em',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'all' &&
          (query ? (
            allLoading ? (
              <SearchLoading label="results" />
            ) : allError ? (
              <SearchFailed label="results" />
            ) : (
              <div
                style={{
                  padding: stackedSearchLayout ? 12 : 16,
                  width: '100%',
                  maxWidth: stackedSearchLayout ? '100%' : 1120,
                  margin: '0 auto',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: stackedSearchLayout
                      ? '1fr'
                      : 'minmax(300px, 0.92fr) minmax(0, 1.58fr)',
                    gap: stackedSearchLayout ? 18 : 28,
                    alignItems: 'start',
                  }}
                >
                  <section style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 10,
                        color: v.ink3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 8,
                      }}
                    >
                      people
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        maxHeight: 520,
                        overflowY: dedupedUserRows.length > 10 ? 'auto' : 'visible',
                        paddingRight: dedupedUserRows.length > 10 ? 6 : 0,
                      }}
                    >
                      {dedupedUserRows.map((item) => {
                        const rowUser = getUserSummary(item, 'user');
                        return (
                          <UserCard
                            key={rowUser.id}
                            user={{
                              ...rowUser,
                              followerCount:
                                item.followerCount ??
                                item.followersCount ??
                                item.user?.followerCount ??
                                item.user?.followersCount ??
                                rowUser.followerCount ??
                                rowUser.followersCount,
                              viewerState: item.viewerState ?? rowUser.viewerState,
                              isPrivate: rowUser.isPrivate ?? item.user?.isPrivate,
                            }}
                            initiallyFollowing={
                              item.viewerState?.isFollowing ??
                              item.viewerState?.isFollowedByViewer ??
                              false
                            }
                            initiallyRequested={item.viewerState?.isFollowRequested ?? false}
                            onAvatarClick={(u) => navigate(routeTo.userProfile(u.id))}
                            showFollowButton={false}
                          />
                        );
                      })}
                    </div>
                    {dedupedUserRows.length === 0 ? (
                      <SearchEmpty label="people" query={query} />
                    ) : null}
                    <SuggestedHashtags hashtags={hashtagRows} navigate={navigate} />
                  </section>

                  <section style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 10,
                        color: v.ink3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 8,
                      }}
                    >
                      posts
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${stackedSearchLayout ? cols : 2}, 1fr)`,
                        gap: 12,
                        height: stackedSearchLayout ? 410 : 390,
                        gridAutoRows: 'minmax(0, 1fr)',
                        alignItems: 'stretch',
                        overflowY: postRows.length > 4 ? 'auto' : 'hidden',
                        paddingRight: postRows.length > 4 ? 6 : 0,
                      }}
                    >
                      {sidePostRows.map((post) => {
                        const mediaUrl =
                          post.media && post.media.length > 0 ? post.media[0].cdnUrl : null;
                        return (
                          <div
                            key={post.id}
                            onClick={() => openOverlay(routeTo.postDetail(post.id))}
                            style={{
                              background: mediaUrl
                                ? `url(${mediaUrl}) center/cover no-repeat`
                                : 'color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)',
                              borderRadius: 12,
                              border: `1px solid ${v.borderSubtle}`,
                              minHeight: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 10,
                              boxSizing: 'border-box',
                            }}
                          >
                            {!mediaUrl && post.caption ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: v.fontBody,
                                  color: v.ink3,
                                  textAlign: 'center',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {post.caption}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {postRows.length === 0 ? <SearchEmpty label="posts" query={query} /> : null}
                  </section>
                </div>
                {lowerPostRows.length > 0 ? (
                  <section style={{ marginTop: 20 }}>
                    <div
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 10,
                        color: v.ink3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: 8,
                      }}
                    >
                      more posts
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${stackedSearchLayout ? cols : 4}, 1fr)`,
                        gap: 12,
                        maxHeight: stackedSearchLayout ? 820 : 780,
                        overflowY: lowerPostRows.length > 16 ? 'auto' : 'visible',
                        paddingRight: lowerPostRows.length > 16 ? 6 : 0,
                      }}
                    >
                      {lowerPostRows.map((post) => {
                        const mediaUrl =
                          post.media && post.media.length > 0 ? post.media[0].cdnUrl : null;
                        return (
                          <div
                            key={post.id}
                            onClick={() => openOverlay(routeTo.postDetail(post.id))}
                            style={{
                              background: mediaUrl
                                ? `url(${mediaUrl}) center/cover no-repeat`
                                : 'color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)',
                              borderRadius: 12,
                              border: `1px solid ${v.borderSubtle}`,
                              aspectRatio: '1/1',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 10,
                              boxSizing: 'border-box',
                            }}
                          >
                            {!mediaUrl && post.caption ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: v.fontBody,
                                  color: v.ink3,
                                  textAlign: 'center',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {post.caption}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>
            )
          ) : (
            <div>
              <RecommendedPostsGrid surface="search" />
              <SuggestedHashtags hashtags={hashtagRows} navigate={navigate} />
            </div>
          ))}

        {tab === 'posts' &&
          (query ? (
            <ResultsSection
              query={query}
              label="posts"
              result={postResult}
              renderRows={(rows) => (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: 2,
                    padding: '2px 0 0',
                  }}
                >
                  {rows.map((post) => {
                    const mediaUrl =
                      post.media && post.media.length > 0 ? post.media[0].cdnUrl : null;
                    return (
                      <div
                        key={post.id}
                        onClick={() => openOverlay(routeTo.postDetail(post.id))}
                        style={{
                          background: mediaUrl
                            ? `url(${mediaUrl}) center/cover no-repeat`
                            : 'color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)',
                          aspectRatio: '1/1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 10,
                          boxSizing: 'border-box',
                        }}
                      >
                        {!mediaUrl && post.caption && (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: v.fontBody,
                              color: v.ink3,
                              textAlign: 'center',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {post.caption}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            />
          ) : (
            // Before a query, the posts tab shows the same recommendation
            // content Explore does, from the same source (useExplore /
            // GET /recommendations/feed?excludeFollowed=true), sharing one
            // cache entry with Explore's own mount. Typing a query switches
            // back to ResultsSection above; clearing it returns here without
            // a remount, since this is a plain conditional render, not a
            // route change.
            <RecommendedPostsGrid surface="search" />
          ))}

        {tab === 'people' && (
          <ResultsSection
            query={query}
            label="people"
            result={userResult}
            renderRows={(rows) => (
              <div style={{ padding: '4px 16px' }}>
                {rows
                  .filter((item, index, allRows) => {
                    const rowUser = getUserSummary(item, 'user');
                    return (
                      rowUser.id &&
                      allRows.findIndex((row) => getUserSummary(row, 'user').id === rowUser.id) ===
                        index
                    );
                  })
                  .map((item) => {
                    // Rows are UserListItemResponse: the account nests under `user`
                    // and the relationship travels alongside it, so the follow
                    // control starts in the state the server reports rather than
                    // always reading "follow".
                    const rowUser = getUserSummary(item, 'user');
                    return (
                      <UserCard
                        key={rowUser.id}
                        user={rowUser}
                        initiallyFollowing={item.viewerState?.isFollowing ?? false}
                        initiallyRequested={item.viewerState?.isFollowRequested ?? false}
                        onAvatarClick={(u) => navigate(routeTo.userProfile(u.id))}
                      />
                    );
                  })}
              </div>
            )}
          />
        )}

        {tab === 'tags' && (
          <ResultsSection
            query={query}
            label="tags"
            result={hashtagResult}
            renderRows={(rows) => (
              <div style={{ padding: '4px 0' }}>
                {rows.map((tag) => (
                  <div
                    key={tag.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(routeTo.hashtag(tag.name))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(routeTo.hashtag(tag.name));
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: `1px solid ${v.borderSubtle}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: v.surfaceRaised,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <LxIcon name="hash" size={18} color={v.ink2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: v.fontBody,
                          fontSize: 14,
                          fontWeight: 600,
                          color: v.ink,
                        }}
                      >
                        #{tag.name}
                      </div>
                      <div
                        style={{
                          fontFamily: v.fontBody,
                          fontSize: 12,
                          color: v.ink3,
                          marginTop: 2,
                        }}
                      >
                        {formatPostCount(tag.postCount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
