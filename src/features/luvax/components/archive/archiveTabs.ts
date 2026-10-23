import type { ComponentType } from 'react';

import { ArchivePostsTab } from './ArchivePostsTab';

/** One tab of the archive screen. */
export interface ArchiveTab {
  /** The path segment of the tab, so each tab is a shareable address. */
  id: string;
  label: string;
  component: ComponentType;
}

/**
 * The tabs of the archive, in the order they are drawn.
 *
 * A later phase adds its own tab (the archive of stories) by appending one entry here, with no
 * change to the screen or the route. A single entry still renders the tab bar, so the layout is
 * the same before and after.
 */
export const ARCHIVE_TABS: ArchiveTab[] = [
  { id: 'posts', label: 'posts', component: ArchivePostsTab },
];
