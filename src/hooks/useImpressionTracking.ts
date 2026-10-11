import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { reportImpression } from '@/services/impressionQueue';
import { useAuthStore } from '@/store/useAuthStore';

// A post reported already this session never fires again, so an id fired
// once by one call site (e.g. Explore) is not re-reported by another (e.g.
// Search's pre-query grid, which renders the same underlying recommendation
// content). Session-scoped, not per-hook-instance: two mounted tiles for the
// same postId must not double-report either.
const reportedThisSession = new Set<string>();

const VISIBILITY_THRESHOLD = 0.5;
const DWELL_MS = 1000;
const DWELL_SECONDS = DWELL_MS / 1000;

/**
 * Reports one impression when `postId` has been at least 50% visible for one
 * continuous second, once per session per post. A falsy `postId` or
 * `surface` makes this a permanent no-op — used by call sites that render
 * the same tile component in a context this task does not track (see
 * RecommendedPostsGrid's ExploreScreen-inline-search usage).
 *
 * @param {string|undefined} postId
 * @param {'feed'|'explore'|'search'|undefined} surface
 * @returns {{ ref: (node: Element|null) => void }}
 */
export function useImpressionTracking(
  postId: string | undefined,
  surface: 'feed' | 'explore' | 'search' | undefined
) {
  const { ref, inView } = useInView({ threshold: VISIBILITY_THRESHOLD });
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!postId || !surface || !isAuthenticated) return undefined;
    if (!inView) return undefined;
    if (reportedThisSession.has(postId)) return undefined;

    const timer = setTimeout(() => {
      reportedThisSession.add(postId);
      reportImpression(postId, DWELL_SECONDS, surface);
    }, DWELL_MS);

    return () => clearTimeout(timer);
  }, [postId, surface, isAuthenticated, inView]);

  return { ref };
}
