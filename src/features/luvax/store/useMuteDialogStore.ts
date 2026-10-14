import { create } from 'zustand';

import { resetOnUserChange } from './resetOnUserChange';

/** The account being muted, as much of it as the dialog's header needs. */
export interface MuteDialogUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MuteDialogTarget {
  user: MuteDialogUser;
  /** The control that opened the dialog, which takes focus back when the dialog closes. */
  returnFocusTo: HTMLElement | null;
}

interface MuteDialogState {
  target: MuteDialogTarget | null;
  open: (target: MuteDialogTarget) => void;
  close: () => void;
}

/**
 * Which account the mute dialog is open for, if any.
 *
 * The dialog is mounted once by `MuteDialogHost` and opened from here, not rendered by the post
 * card or the profile that opened it. Muting reloads the lists those screens sit in, and a card
 * whose post just left the feed would take an inline dialog with it in the middle of the
 * person's change.
 */
export const useMuteDialogStore = create<MuteDialogState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

// The dialog belongs to the account that opened it; it closes when that account signs out or
// another one signs in.
resetOnUserChange(() => useMuteDialogStore.setState({ target: null }));
