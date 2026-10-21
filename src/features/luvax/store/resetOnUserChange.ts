import { useAuthStore } from '@/store/useAuthStore';

/**
 * Runs `reset` whenever the signed-in account changes, including signing out.
 *
 * Signing out in the app does not reload the page: it clears the auth store and navigates, and a
 * different account can sign in straight afterwards. Anything held in memory about the previous
 * account's choices (dismissed posts, an open mute dialog) must not survive that. A refresh of
 * the same account keeps its id and leaves the state alone.
 *
 * Returns the function that stops the subscription. A store registers it for the module's
 * lifetime and releases it when the module is replaced, so a hot reload does not leave the old
 * module's reset running beside the new one.
 */
export const resetOnUserChange = (reset: () => void): (() => void) =>
  useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) reset();
  });

/** The id of the signed-in account, or null; read at call time, never held. */
export const currentUserId = (): string | null => useAuthStore.getState().user?.id ?? null;
