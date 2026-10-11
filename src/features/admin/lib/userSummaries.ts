import type { UserSummaryResponse } from '@/types/domain';
import type { AdminUserLookupResponse } from '@/types/admin';
import { adminApi } from '../api/adminApi';

/**
 * The panel's only mechanism for turning an account id into a name.
 *
 * Every screen in the panel renders ids that mean nothing to a reviewer: the
 * reporter on a queue row, the actor and the target on an audit row, whoever
 * revoked a warning. Resolving each one with its own request cost a page of
 * twenty rows as many requests as it held distinct people, against an endpoint
 * whose production budget is the tightest in the system.
 *
 * `GET /api/v1/admin/user-summaries?ids=` resolves up to a hundred in one call,
 * so this module coalesces every id a rendered page asks for into a single
 * request. Callers still ask one id at a time — that is what a row can know —
 * and this batches underneath them.
 *
 * Three properties of the endpoint shape the implementation, all measured in
 * `uptake-contract-verification.md` §1.5:
 *
 * 1. `ids[]=a` — which is what Axios serialises an array to by default — is
 *    rejected with 400. The request must send repeated bare `ids=` keys, which
 *    `adminApi.getUserSummaries` pins down.
 * 2. More than 100 ids is a 400, not a truncated list, so a larger set is split.
 * 3. An unknown id comes back present with `found: false` rather than being
 *    omitted. That is a resolved fact, not a failure: it settles as a null name
 *    so the caller renders a shortened id and React Query caches it, which is
 *    what stops an unresolvable id from being retried on every render.
 *
 * The response preserves request order, and this module still never relies on
 * it: entries are indexed by their own `userId` and looked up by id. Order is
 * the endpoint's guarantee to make, not this module's to depend on.
 */

/** The server's own bound. 101 ids is a 400, so a larger set is split at this. */
export const MAX_IDS_PER_REQUEST = 100;

/** Ids asked for since the last flush, each with everyone waiting on it. */
const waiting = new Map<
  string,
  { resolve: (user: UserSummaryResponse | null) => void; reject: (error: unknown) => void }[]
>();

/** Whether a flush is already queued for the end of this tick. */
let flushQueued = false;

const chunk = <T>(items: T[], size: number) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/**
 * Resolves everyone waiting, in as few requests as the bound allows.
 *
 * Chunks are issued one after another rather than all at once. A page needing
 * more than a hundred distinct people is already unusual, and turning it into a
 * burst of parallel requests against the panel's tightest rate limit trades a
 * problem the reviewer does not have for one they would.
 */
const flush = async () => {
  flushQueued = false;
  const batch = new Map(waiting);
  waiting.clear();
  if (batch.size === 0) {
    return;
  }

  for (const ids of chunk([...batch.keys()], MAX_IDS_PER_REQUEST)) {
    try {
      const entries = await adminApi.getUserSummaries(ids);
      // Indexed by the id the entry itself carries. Never by position.
      const byId = new Map<string, AdminUserLookupResponse>();
      for (const entry of entries ?? []) {
        if (entry?.userId) {
          byId.set(entry.userId, entry);
        }
      }
      for (const id of ids) {
        const entry = byId.get(id);
        const user = entry?.found ? (entry.user ?? null) : null;
        for (const settle of batch.get(id) ?? []) {
          settle.resolve(user);
        }
      }
    } catch (error) {
      for (const id of ids) {
        for (const settle of batch.get(id) ?? []) {
          settle.reject(error);
        }
      }
    }
  }
};

/**
 * Asks for one account id and gets back its summary, or null when the server
 * says there is no such account.
 *
 * The returned promise settles once the batch this id joined has come back. Ids
 * requested within the same tick — which is every row of a page React committed
 * together — share one request.
 *
 * @param {string} userId
 * @returns {Promise<{id:string, username:string, displayName:string|null,
 *                    avatarUrl:string|null, isVerified:boolean}|null>}
 */
export const loadUserSummary = (
  userId: string | null | undefined
): Promise<UserSummaryResponse | null> => {
  if (!userId) {
    return Promise.resolve(null);
  }
  return new Promise<UserSummaryResponse | null>((resolve, reject) => {
    const settlers = waiting.get(userId);
    if (settlers) {
      settlers.push({ resolve, reject });
    } else {
      waiting.set(userId, [{ resolve, reject }]);
    }
    if (!flushQueued) {
      flushQueued = true;
      // End of tick, not end of microtask: React Query starts a mounted query's
      // fetch asynchronously, so a microtask can close the window before the
      // last row of a freshly committed page has asked for its id.
      setTimeout(flush, 0);
    }
  });
};

/** Test seam: drops anything queued but not yet sent. */
export const __resetUserSummaryQueue = () => {
  waiting.clear();
  flushQueued = false;
};
