import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/config/constants';
import { ScreenNotFound } from '@/features/luvax/components/ScreenNotFound';

/**
 * Screens loaded on demand.
 *
 * The whole application used to arrive in one chunk, so a visitor on the sign-in page downloaded
 * the composer, the story viewer, and the message pane before the form was interactive. Every
 * screen here is now deferred, as is the shell that frames them.
 *
 * {@code ScreenNotFound} stays eager: it is the fallback for an address that matched nothing, so
 * suspending to fetch a chunk in order to say "not found" would be the wrong trade.
 *
 * The route table below is unchanged. Only the import style differs, and the Suspense boundary in
 * the router supplies the fallback.
 */
const FeedScreen = lazy(() =>
  import('@/features/luvax/components/FeedScreen').then((m) => ({ default: m.FeedScreen }))
);
const PostDetailScreen = lazy(() =>
  import('@/features/luvax/components/PostDetailScreen').then((m) => ({
    default: m.PostDetailScreen,
  }))
);
const ProfileScreen = lazy(() =>
  import('@/features/luvax/components/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const ComposerScreen = lazy(() =>
  import('@/features/luvax/components/ComposerScreen').then((m) => ({
    default: m.ComposerScreen,
  }))
);
const SupportTicketDetailScreen = lazy(() =>
  import('@/features/support/components/TicketDetailScreen').then((m) => ({
    default: m.TicketDetailScreen,
  }))
);
const ExploreScreen = lazy(() =>
  import('@/features/luvax/components/ExploreScreen').then((m) => ({
    default: m.ExploreScreen,
  }))
);
const FollowersScreen = lazy(() =>
  import('@/features/luvax/components/FollowersScreen').then((m) => ({
    default: m.FollowersScreen,
  }))
);
const FollowingScreen = lazy(() =>
  import('@/features/luvax/components/FollowingScreen').then((m) => ({
    default: m.FollowingScreen,
  }))
);
const NotificationsScreen = lazy(() =>
  import('@/features/luvax/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  }))
);
const OnboardingScreen = lazy(() =>
  import('@/features/luvax/components/OnboardingScreen').then((m) => ({
    default: m.OnboardingScreen,
  }))
);
const HashtagScreen = lazy(() =>
  import('@/features/luvax/components/HashtagScreen').then((m) => ({
    default: m.HashtagScreen,
  }))
);
const SearchScreen = lazy(() =>
  import('@/features/search/components/SearchScreen').then((m) => ({
    default: m.SearchScreen,
  }))
);
const SettingsScreen = lazy(() =>
  import('@/features/luvax/components/SettingsScreen').then((m) => ({
    default: m.SettingsScreen,
  }))
);
const StoryComposerScreen = lazy(() =>
  import('@/features/luvax/components/StoryScreens').then((m) => ({
    default: m.StoryComposerScreen,
  }))
);
const StoryViewScreen = lazy(() =>
  import('@/features/luvax/components/StoryScreens').then((m) => ({
    default: m.StoryViewScreen,
  }))
);
const MessagesScreen = lazy(() =>
  import('@/features/messages/MessagesScreen').then((m) => ({ default: m.MessagesScreen }))
);

/**
 * Every screen reachable inside the authenticated shell.
 *
 * The router builds its child routes from this list and the app layout reads the
 * same list back to work out which screen sits behind an overlay, so the two can
 * never disagree about which address renders which screen.
 *
 * `screen` is the identifier the shell already keys its chrome off: which tab
 * reads as active, whether a back header replaces the logo, and how wide the
 * tablet pane is. Keeping the existing identifiers is what makes this refactor
 * invisible.
 *
 * `chrome` selects the frame:
 * - `shell`    the standard app bar, rails, and bottom nav
 * - `messages` the fixed full-height pane messages has always rendered in
 * - `bare`     no frame at all
 *
 * `rightRail` marks the screens that show the trending rail: explore and the
 * hashtag page. The feed dropped it when its suggestions moved inline.
 */
export const APP_SCREENS = [
  // No right rail: the feed carries trending hashtags and suggested accounts inline between its
  // posts now, so the rail beside it would say the same things twice. Explore and the hashtag page
  // still show it, because neither has an inline equivalent.
  {
    screen: 'feed',
    index: true,
    path: ROUTES.FEED,
    element: <FeedScreen />,
    chrome: 'shell',
  },
  {
    screen: 'explore',
    path: ROUTES.EXPLORE,
    element: <ExploreScreen />,
    chrome: 'shell',
    rightRail: true,
  },
  { screen: 'search', path: ROUTES.SEARCH, element: <SearchScreen />, chrome: 'shell' },
  // No right rail: a ticket is a request and a reply, and trending hashtags
  // beside a ban appeal would be the wrong thing to offer.
  {
    screen: 'support',
    path: ROUTES.SUPPORT_TICKET,
    element: <SupportTicketDetailScreen />,
    chrome: 'shell',
  },
  // Support moved into settings, where the rest of the account's own business
  // already lives. This address kept nothing behind it, so rather than 404 an
  // older link it sends the reader to the one real door.
  {
    screen: 'support',
    path: ROUTES.SUPPORT,
    element: <Navigate to={ROUTES.SETTINGS_SUPPORT} replace />,
    chrome: 'shell',
  },
  // Carries the right rail: a hashtag page is a discovery surface, and the trending list beside it
  // is the obvious next thing to look at from one.
  {
    screen: 'hashtag',
    path: ROUTES.HASHTAG,
    element: <HashtagScreen />,
    chrome: 'shell',
    rightRail: true,
  },
  { screen: 'compose', path: ROUTES.COMPOSE, element: <ComposerScreen />, chrome: 'shell' },
  {
    screen: 'notifications',
    path: ROUTES.NOTIFICATIONS,
    element: <NotificationsScreen />,
    chrome: 'shell',
  },
  { screen: 'messages', path: ROUTES.MESSAGES, element: <MessagesScreen />, chrome: 'messages' },
  // Settings is one screen with a category in the path. The bare address is the
  // group list with nothing open; `:category` is every category, including the
  // three that were separate screens before the rebuild, so their published
  // addresses keep resolving.
  { screen: 'settings', path: ROUTES.SETTINGS, element: <SettingsScreen />, chrome: 'shell' },
  {
    screen: 'settings',
    path: ROUTES.SETTINGS_CATEGORY,
    element: <SettingsScreen />,
    chrome: 'shell',
  },
  { screen: 'profile', path: ROUTES.PROFILE, element: <ProfileScreen />, chrome: 'shell' },
  { screen: 'profile', path: ROUTES.USER_PROFILE, element: <ProfileScreen />, chrome: 'shell' },
  {
    screen: 'followers',
    path: ROUTES.USER_FOLLOWERS,
    element: <FollowersScreen />,
    chrome: 'shell',
  },
  {
    screen: 'following',
    path: ROUTES.USER_FOLLOWING,
    element: <FollowingScreen />,
    chrome: 'shell',
  },
  { screen: 'onboarding', path: ROUTES.ONBOARDING, element: <OnboardingScreen />, chrome: 'bare' },
];

/**
 * Screens that render on top of another screen rather than replacing it.
 *
 * Each one is a real address that can be shared and opened cold, and each one
 * renders over whichever screen it was opened from. The layout owns that
 * composition, so whether a post detail stays an overlay or becomes a full page
 * is a change in one place and does not touch this table.
 */
export const APP_OVERLAY_SCREENS = [
  { screen: 'post', path: ROUTES.POST_DETAIL, element: <PostDetailScreen overlay /> },
  { screen: 'story-compose', path: ROUTES.STORY_COMPOSE, element: <StoryComposerScreen /> },
  { screen: 'story-view', path: ROUTES.STORY_VIEW, element: <StoryViewScreen /> },
];

/**
 * Rendered for any address under /app that matches nothing above, so a mistyped
 * or stale link keeps the user inside the application instead of dropping them
 * on the global 404 with no way back.
 */
export const APP_NOT_FOUND_SCREEN = {
  screen: 'not-found',
  element: <ScreenNotFound />,
  chrome: 'shell',
};

/** The screen an overlay falls back to when it is opened cold. */
export const DEFAULT_BASE_SCREEN = APP_SCREENS[0];
