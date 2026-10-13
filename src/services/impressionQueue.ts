import { useAuthStore } from '@/store/useAuthStore';
import { API_BASE_URL } from '@/api/axiosClient';

const IMPRESSIONS_PATH = '/recommendations/impressions';
const MAX_BATCH_SIZE = 100;

// The per-caller rule for this exact endpoint keys on IP, not account, so
// several people behind one NAT'd address share one bucket. The dev profile
// allows 120 requests/60s (application-dev.yml, deliberately loosened so
// local scroll/impression testing is not throttled), but production is
// tighter: 30 requests/60s (application-prod.yml). The interval must clear
// the tighter of the two, since the same build runs in both. Budgeting for
// 6 concurrent users behind one address with a 3x safety margin for the
// extra visibilitychange/pagehide-triggered flushes on top of this timer:
// 30 / 3 = 10 requests/60s of total headroom, 10 / 6 ≈ 1.67 requests/60s
// per user, i.e. an interval no shorter than 60 / 1.67 ≈ 36s per user. 40s
// gives 1.5 req/min per user, 9 req/min for 6 users — 30% of the prod
// budget (and 7.5% of dev's looser one).
const FLUSH_INTERVAL_MS = 40_000;

// Fallback backoff when a 429 arrives without a readable Retry-After,
// matching the same 60s fallback src/hooks/useRateLimitCooldown.js uses.
const DEFAULT_RETRY_AFTER_SECONDS = 60;

interface Impression {
  impressionId: string;
  postId: string;
  dwellSeconds: number;
  surface: 'feed' | 'explore' | 'search';
}
const reported = new Set<string>();
const pending = new Map<string, Impression>();
let retryAfterUntil = 0;
let initialized = false;

/**
 * Queues one impression for the next flush. A no-op for an unauthenticated
 * session, a missing postId/surface, or a postId already reported this
 * session — dedup is by postId, since Gorse accumulates rather than
 * overwrites feedback value, so reporting the same post twice inflates its
 * dwell total on the backend.
 */
export function reportImpression(
  postId: string | undefined,
  dwellSeconds: number,
  surface: Impression['surface'] | undefined
) {
  if (!postId || !surface) return;
  if (!useAuthStore.getState().isAuthenticated) return;
  if (reported.has(postId)) return;

  reported.add(postId);
  pending.set(postId, {
    impressionId: crypto.randomUUID(),
    postId,
    dwellSeconds,
    surface,
  });
}

async function sendBatch(chunk: Impression[], accessToken: string) {
  try {
    const response = await fetch(`${API_BASE_URL}${IMPRESSIONS_PATH}`, {
      method: 'POST',
      // sendBeacon cannot set headers, so a beaconed request would carry no
      // bearer token and be rejected unauthenticated — silently, in exactly
      // the page-unload conditions where losing the batch is least visible.
      // fetch with keepalive is the one primitive that both survives page
      // unload and carries the Authorization header this app requires.
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ impressions: chunk }),
    });

    if (response.ok) return true;

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get('Retry-After'));
      const seconds =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : DEFAULT_RETRY_AFTER_SECONDS;
      retryAfterUntil = Date.now() + seconds * 1000;
    }

    return false;
  } catch {
    // Network failure, offline, or a tab closing mid-request. The batch was
    // never removed from `pending`, so it is retried on the next flush.
    return false;
  }
}

/**
 * Sends every queued impression, split into batches of at most 100 (the
 * backend's ImpressionBatchRequest.MAX_BATCH_SIZE). Stops at the first
 * failed batch in a cycle rather than continuing to the next chunk, so one
 * failure does not cascade into hammering the endpoint with the rest of the
 * queue in the same tick. A failed batch stays in `pending` for the next
 * attempt; nothing is ever surfaced to the user, since this is a background
 * signal, not a user action.
 */
export async function flushImpressions() {
  if (Date.now() < retryAfterUntil) return;

  const { isAuthenticated, accessToken } = useAuthStore.getState();
  if (!isAuthenticated || !accessToken) return;
  if (pending.size === 0) return;

  const entries = Array.from(pending.values());
  for (let i = 0; i < entries.length; i += MAX_BATCH_SIZE) {
    const chunk = entries.slice(i, i + MAX_BATCH_SIZE);
    // Chunks send in order (not Promise.all) so a failed chunk halts the
    // cycle instead of firing every remaining chunk at once.
    const ok = await sendBatch(chunk, accessToken);
    if (!ok) break;
    for (const item of chunk) pending.delete(item.postId);
  }
}

/**
 * Starts the flush interval and the page-hide delivery listeners. Idempotent
 * so calling it more than once (e.g. React Strict Mode's double-invoke of
 * effects, or a hot reload) never registers a second interval or a second
 * pair of listeners.
 */
export function initImpressionQueue() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  setInterval(flushImpressions, FLUSH_INTERVAL_MS);

  // visibilitychange fires reliably on mobile Safari backgrounding, where
  // pagehide does not always fire in time; pagehide covers the desktop
  // close/navigate-away case, including the bfcache path beforeunload
  // would break. Neither depends on the other; both are kept.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushImpressions();
  });
  window.addEventListener('pagehide', () => {
    flushImpressions();
  });
}
