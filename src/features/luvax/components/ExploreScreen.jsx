import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { v } from '@/config/tokens';
import {
  canViewerSeePost,
  extractPageContent,
  getDisplayName,
  getUserSummary,
  isPageDegraded,
} from '@/utils/helpers';
import { LxIcon } from './primitives';
import { UserCard } from './UserCard';
import { useExploreSearch } from '../hooks/usePosts';
import { useLuvaxTweaks } from '../LuvaxTweaksContext';
import { routeTo } from '@/config/constants';
import {
  getUserSearchTerms,
  useHashtagSearch,
  useUserSearch,
} from '@/features/search/hooks/useSearch';
import { SearchDegraded, SearchFailed } from '@/features/search/components/SearchResultsEmpty';
import { RecommendedPostsGrid, SearchResultPost } from './RecommendedPostsGrid';
import { LxTrendingRail } from './LxTrendingRail';
import { LxSuggestedRail, TABLET_RAIL_MIN_WIDTH } from './shell';
import { useViewportWidth } from '../hooks/useViewport';

function SuggestedHashtags({ tags, query, onSelect }) {
  if (!query) return null;

  return (
    <section
      style={{
        marginTop: 22,
        padding: '16px 0 0',
        borderTop: `1px solid ${v.borderSubtle}`,
      }}
    >
      <div
        style={{
          fontFamily: v.fontMono,
          fontSize: 10,
          color: v.ink3,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        suggested hashtags
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tags.slice(0, 10).map((tag) => (
          <button
            key={tag.id || tag.name}
            type="button"
            onClick={() => onSelect(tag.name)}
            style={{
              border: `1px solid ${v.border}`,
              background: v.surface,
              color: v.ink2,
              borderRadius: 999,
              padding: '8px 12px',
              fontFamily: v.fontBody,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            #{tag.name}
          </button>
        ))}
        {tags.length === 0 ? (
          <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
            no hashtag suggestions
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function ExploreScreen() {
  // The search terms live in the address, so an explore search can be shared
  // and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeQuery = searchParams.get('q') || '';
  const shouldFocusSearch = searchParams.get('focusSearch') === '1';
  const { viewport } = useLuvaxTweaks();
  const viewportWidth = useViewportWidth();
  const railHomeless = viewportWidth < TABLET_RAIL_MIN_WIDTH;
  const [query, setQuery] = useState(activeQuery);
  const searchInputRef = useRef(null);

  const { ref, inView } = useInView();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError: postsErrored,
  } = useExploreSearch({ q: query });
  const userSearchTerms = getUserSearchTerms(query);
  const primaryUserResult = useUserSearch(userSearchTerms[0] || '');
  const secondaryUserResult = useUserSearch(userSearchTerms[1] || '');
  const tertiaryUserResult = useUserSearch(userSearchTerms[2] || '');
  const hashtagResult = useHashtagSearch(query.trim());

  // Adjusted during render, not in an effect: the field is user-editable so it cannot be derived,
  // but resetting it from an effect rendered the screen twice on every address change.
  const [lastActiveQuery, setLastActiveQuery] = useState(activeQuery);
  if (activeQuery !== lastActiveQuery) {
    setLastActiveQuery(activeQuery);
    setQuery(activeQuery);
  }

  useEffect(() => {
    if (shouldFocusSearch) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [shouldFocusSearch, activeQuery]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = (data?.pages?.flatMap((page) => extractPageContent(page)) || []).filter(
    canViewerSeePost
  );
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const userResults = [primaryUserResult, secondaryUserResult, tertiaryUserResult].filter(
    (_, index) => Boolean(userSearchTerms[index])
  );
  const userRows = userResults.flatMap(
    (result) => result.data?.pages?.flatMap((page) => extractPageContent(page)) || []
  );
  const searchedPeople = userRows.reduce((acc, item) => {
    const user = getUserSummary(item, 'user');
    if (!user.id || acc.some((person) => person.id === user.id)) return acc;
    acc.push({
      id: user.id,
      username: user.username,
      displayName: getDisplayName(user),
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount:
        user.followerCount ??
        user.followersCount ??
        item.followerCount ??
        item.followersCount ??
        item.user?.followerCount ??
        item.user?.followersCount,
      viewerState: item.viewerState ?? user.viewerState,
      isPrivate: user.isPrivate ?? item.user?.isPrivate,
    });
    return acc;
  }, []);
  // Include both direct account matches and distinct authors from matched posts.
  // Without the direct account search, the Explore field could only find a user
  // when one of their posts happened to match the same query.
  const people = posts.reduce((acc, post) => {
    const author = getUserSummary(post);
    if (!author.id || acc.some((user) => user.id === author.id)) return acc;
    acc.push({
      id: author.id,
      username: author.username,
      displayName: getDisplayName(author),
      avatarUrl: author.avatarUrl,
      followerCount: author.followerCount ?? author.followersCount,
      viewerState: post.viewerState ?? author.viewerState,
      isPrivate: author.isPrivate,
    });
    return acc;
  }, searchedPeople);
  const foundCount = people.length + posts.length;
  const isFindingPeople = isSearching && userResults.some((result) => result.isLoading);
  // The server distinguishes "nothing matched" from "the search backend is down
  // and this page is not an answer" via the `degraded` flag on post pages, and a
  // hard failure surfaces as isError from the query itself. Reading a channel's
  // own reject/degrade state is what stops a real outage from rendering
  // identically to an honest zero-result search.
  const postsDegraded = (data?.pages || []).some((page) => isPageDegraded(page));
  const hashtagsErrored = hashtagResult.isError;
  const peopleErrored = userResults.length > 0 && userResults.every((result) => result.isError);
  const searchFailed = postsErrored || hashtagsErrored || peopleErrored;
  const searchDegraded = !searchFailed && postsDegraded;
  const hashtagSuggestions =
    hashtagResult.data?.pages?.flatMap((page) => extractPageContent(page)) || [];
  const sidePosts = posts.slice(0, 4);
  const lowerPosts = posts.slice(4);

  // Enter commits the query to the address so a search can be shared and
  // survives a reload, which a bare input could not do.
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const next = query.trim();
    setSearchParams(next ? { q: next } : {});
    searchInputRef.current?.blur();
  };

  return (
    <>
      <div
        style={{
          padding: '12px 16px 14px',
          background: v.base,
          borderBottom: `1px solid ${v.border}`,
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
          <div
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            <LxIcon name="explore" size={15} color={v.ink3} />
          </div>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search posts, people, hashtags..."
            style={{
              width: '100%',
              fontFamily: v.fontBody,
              fontSize: 15,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${v.border}`,
              borderRadius: 999,
              padding: '10px 42px 10px 34px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {query.trim() ? (
            <button
              type="button"
              aria-label="clear search"
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: v.surfaceRaised,
                color: v.ink3,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <LxIcon name="close" size={12} color={v.ink3} />
            </button>
          ) : null}
        </form>
      </div>

      {/* The topic chips that used to sit here were a hardcoded list of invented
          topics. There is no endpoint behind them, and a chip that filters
          nothing is a control that lies about what it does. Hashtag search is
          the real way to reach a tag. The activeTopic state that drove them was
          removed with this phase, since nothing wrote a real value and nothing
          read it. */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isSearching ? (
          <div style={{ padding: '18px 16px 28px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: v.fontDisplay,
                    fontSize: 22,
                    lineHeight: 1,
                    letterSpacing: '-0.035em',
                    color: v.ink,
                  }}
                >
                  results
                </span>
                <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink3 }}>
                  for “{trimmedQuery}”
                </span>
              </div>
              <span
                style={{
                  fontFamily: v.fontMono,
                  fontSize: 12,
                  color: v.ink3,
                  whiteSpace: 'nowrap',
                }}
              >
                {foundCount} found
              </span>
            </div>

            {foundCount === 0 && isFindingPeople ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 15,
                    fontWeight: 500,
                    color: v.ink2,
                    marginBottom: 4,
                  }}
                >
                  searching people...
                </div>
              </div>
            ) : foundCount === 0 && searchFailed ? (
              <SearchFailed label="results" />
            ) : foundCount === 0 && searchDegraded ? (
              <SearchDegraded label="results" />
            ) : foundCount === 0 ? (
              // Search empty state, on the design's own empty-state geometry.
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 15,
                    fontWeight: 500,
                    color: v.ink2,
                    marginBottom: 4,
                  }}
                >
                  nothing matched “{trimmedQuery}”
                </div>
                <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
                  try a different name, caption, or hashtag
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        viewport === 'mobile' ? '1fr' : 'minmax(300px, 0.92fr) minmax(0, 1.58fr)',
                      gap: viewport === 'mobile' ? 22 : 28,
                      alignItems: 'start',
                    }}
                  >
                    <section style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: v.fontMono,
                          fontSize: 10,
                          color: v.ink3,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          marginTop: 14,
                          marginBottom: 14,
                        }}
                      >
                        people
                      </div>
                      {people.length > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            maxHeight: 520,
                            overflowY: people.length > 10 ? 'auto' : 'visible',
                            paddingRight: people.length > 10 ? 6 : 0,
                          }}
                        >
                          {people.map((person) => (
                            <UserCard
                              key={person.id}
                              user={person}
                              compact
                              initiallyFollowing={
                                person.viewerState?.isFollowing ??
                                person.viewerState?.isFollowedByViewer ??
                                false
                              }
                              initiallyRequested={person.viewerState?.isFollowRequested ?? false}
                              onAvatarClick={(u) => navigate(routeTo.userProfile(u.id))}
                              showFollowButton={false}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
                          no people found
                        </div>
                      )}
                      <SuggestedHashtags
                        tags={hashtagSuggestions}
                        query={trimmedQuery}
                        onSelect={(tag) => navigate(routeTo.hashtag(tag))}
                      />
                    </section>

                    <section style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: v.fontMono,
                          fontSize: 10,
                          color: v.ink3,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          marginTop: 14,
                          marginBottom: 14,
                        }}
                      >
                        posts
                      </div>
                      {posts.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            position: 'relative',
                            gridTemplateColumns:
                              viewport === 'mobile' ? '1fr 1fr' : 'repeat(2, minmax(0, 1fr))',
                            gap: 12,
                            height: viewport === 'mobile' ? 410 : 390,
                            gridAutoRows: 'minmax(0, 1fr)',
                            alignItems: 'stretch',
                            overflowY: posts.length > 4 ? 'auto' : 'hidden',
                            paddingRight: posts.length > 4 ? 6 : 0,
                          }}
                        >
                          {sidePosts.map((p, i) => (
                            <SearchResultPost key={p.id || i} post={p} fluid />
                          ))}
                          <div
                            ref={ref}
                            style={{
                              position: 'absolute',
                              right: 0,
                              bottom: 0,
                              width: 1,
                              height: 1,
                              opacity: 0,
                              pointerEvents: 'none',
                            }}
                          />
                        </div>
                      ) : postsErrored ? (
                        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.error }}>
                          we couldn't search posts. check your connection and try again.
                        </div>
                      ) : postsDegraded ? (
                        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.error }}>
                          post search is temporarily unavailable. this is not an empty result.
                        </div>
                      ) : (
                        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3 }}>
                          no posts found
                        </div>
                      )}
                    </section>
                  </div>
                </div>
                {lowerPosts.length > 0 ? (
                  <section style={{ marginTop: 24 }}>
                    <div
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 10,
                        color: v.ink3,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        marginBottom: 12,
                      }}
                    >
                      more posts
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewport === 'mobile' ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
                        gap: 12,
                        maxHeight: viewport === 'mobile' ? 820 : 780,
                        overflowY: lowerPosts.length > 16 ? 'auto' : 'visible',
                        paddingRight: lowerPosts.length > 16 ? 6 : 0,
                      }}
                    >
                      {lowerPosts.map((p, i) => (
                        <SearchResultPost key={p.id || `more-${i}`} post={p} fluid />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Below TABLET_RAIL_MIN_WIDTH the shell renders no right rail, and trending and
                people-you-may-know had no other mount point, so both features were entirely
                absent at phone and small-tablet widths - the form factor this application is
                mostly read on. Explore hosts them here rather than forcing the rail into a
                narrow column, which is what the tablet threshold exists to prevent. */}
            {railHomeless ? (
              <div style={{ padding: '18px 16px 0' }}>
                <LxTrendingRail />
                <LxSuggestedRail />
              </div>
            ) : null}
            <RecommendedPostsGrid surface="explore" />
          </>
        )}
      </div>
    </>
  );
}
