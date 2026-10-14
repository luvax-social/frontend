import { useAuthStore } from '@/store/useAuthStore';

/**
 * Runs `reset` whenever the signed-in account changes, including signing out.
 *
 * Signing out in the app does not reload the page: it clears the auth store and navigates, and a
 * different account can sign in straight afterwards. Anything held in memory about the previous
 * account's choices (dismissed posts, an open mute dialog) must not survive that. A refresh of
 * the same account keeps its id and leaves the state alone.
 */
export const resetOnUserChange = (reset: () => void) => {
  // Some tests replace the auth store with a stub that has no subscribe.
  if (typeof useAuthStore.subscribe !== 'function') return;
  useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) reset();
  });
};
