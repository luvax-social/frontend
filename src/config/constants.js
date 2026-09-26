/** Global app constants */

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'MyApp';

/**
 * The API base address is deliberately not re-declared here.
 *
 * It lived in this file as a second copy of the expression in `api/axiosClient`,
 * had no importer, and carried the dev-versus-production fork that broke
 * authentication under a production bundle. `API_BASE_URL` from
 * `api/axiosClient` is the single definition; every request goes through that
 * client, so nothing else needs the address.
 */

/** Route paths — single source of truth for navigation */
export const ROUTES = {
  HOME: '/',
  APP: '/app',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  VERIFY_EMAIL_NOTICE: '/verify-email-notice',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  OAUTH_CALLBACK: '/oauth2/callback',
  DASHBOARD: '/dashboard',

  // Authenticated area. Every screen inside /app has its own address, so any of
  // them can be linked, bookmarked, and reloaded.
  FEED: '/app',
  EXPLORE: '/app/explore',
  // Hashtag detail lives inside /app like every other authenticated screen, because the shell,
  // the navigation and the right rail only exist there. The bare /tags/:name address in
  // HASHTAG_DEEP_LINK is kept as a shareable top-level link and redirects here, so a link pasted
  // into a message still resolves.
  HASHTAG: '/app/tags/:name',
  HASHTAG_DEEP_LINK: '/tags/:name',
  COMPOSE: '/app/compose',
  NOTIFICATIONS: '/app/notifications',
  MESSAGES: '/app/messages',
  // Settings is a group list beside a category. The bare path is the list with
  // no category open; every category has its own address below it, so a
  // category can be linked, bookmarked and reloaded into the same state.
  SETTINGS: '/app/settings',
  SETTINGS_CATEGORY: '/app/settings/:category',
  EDIT_PROFILE: '/app/settings/profile',
  SETTINGS_NOTIFICATIONS: '/app/settings/notifications',
  SETTINGS_APPEARANCE: '/app/settings/appearance',
  SETTINGS_PRIVACY: '/app/settings/privacy',
  SETTINGS_ACCOUNT: '/app/settings/account',
  SETTINGS_REQUESTS: '/app/settings/requests',
  // Support is a settings category rather than a screen of its own. Every
  // surface it needs was built and none of them had an entry point: nothing in
  // the signed-in navigation reached /app/support, so the only support-shaped
  // thing a user could find was a verification form buried in account settings.
  SETTINGS_SUPPORT: '/app/settings/support',
  // Kept because it was a published address before the settings rebuild. It now
  // resolves to the account category, which carries the only password action
  // the backend actually offers, rather than to a screen that said it was not
  // built yet.
  CHANGE_PASSWORD: '/app/settings/password',
  BLOCKED_USERS: '/app/settings/blocked',
  // The viewer's saved posts. Filed under settings because the list belongs to
  // the viewer rather than to a profile being looked at, and is private to them.
  SAVED: '/app/settings/saved',
  // The address the help centre used to occupy. It now redirects to
  // SETTINGS_SUPPORT, so a bookmark or an older link still lands on support
  // while there is exactly one place that looks like the entrance.
  SUPPORT: '/app/support',
  // A ticket keeps its own address. The detail could have been folded into the
  // settings pane as a master-detail, but settings routes one segment only, and
  // an in-pane detail would take back the thing P7-FE-004 asked for: a ticket
  // that can be copied, bookmarked and opened in a second tab.
  SUPPORT_TICKET: '/app/support/:ticketId',

  // The three anonymous support addresses. These sit outside the authenticated
  // tree because the accounts that need them cannot authenticate: a banned or
  // suspended account is refused a session by design, and it is exactly the
  // population an appeal exists for.
  //
  // The first two are already built into moderation and confirmation mail that
  // has been sent, so their shapes are fixed by messages already in inboxes and
  // must not be changed.
  SUPPORT_APPEAL: '/support/appeal',
  SUPPORT_CONFIRM: '/support/confirm',
  SUPPORT_PUBLIC: '/support/new',
  // Where a status link lands. Anonymous like the three above, and for the
  // same population: the appeal token is spent by the submission that created
  // the ticket, so this token is the only thing that can reach it afterwards.
  SUPPORT_APPEAL_STATUS: '/support/appeal/status',
  // The lost-link recovery form. Its own address rather than a panel on the
  // public form, so the sentence on the sign-in failure can link straight to
  // it instead of asking the reader to find it.
  SUPPORT_APPEAL_RESEND: '/support/appeal/resend',

  ONBOARDING: '/app/onboarding',
  STORY_COMPOSE: '/app/stories/new',

  // The viewer's own profile needs an address that can be built without knowing
  // an id, because the header avatar and the bottom-nav tab link to it while the
  // user object may still be loading.
  PROFILE: '/app/profile',

  // Parameterised paths. Build them with `routeTo` rather than interpolating
  // here, so no call site assembles a path by hand.
  USER_PROFILE: '/app/u/:userId',
  USER_FOLLOWERS: '/app/u/:userId/followers',
  USER_FOLLOWING: '/app/u/:userId/following',
  POST_DETAIL: '/app/p/:postId',
  STORY_VIEW: '/app/stories/:storyId',

  // The search results screen. Carries the term as `q` and the selected result
  // type as `type`, so a search can be shared and survives a reload.
  SEARCH: '/app/search',

  // Administrative and moderation panel. Served under a single prefix for both
  // roles; the role decides which tree exists beneath it, not the prefix. Every
  // screen has a real address so it can be linked, reloaded, and bookmarked.
  ADMIN: '/admin',
  ADMIN_REPORTS: '/admin/reports',
  // Parameterised. Build with `routeTo.adminReportDetail` rather than by hand.
  ADMIN_REPORT_DETAIL: '/admin/reports/:reportId',
  // Administrator-only escalated queue. Sits on its own segment rather than
  // under /admin/reports so it never collides with the :reportId detail route.
  ADMIN_ESCALATED: '/admin/escalated',
  // The reports the caller escalated, whatever became of them. Open to both
  // roles: the endpoint scopes by caller, so an administrator sees its own
  // escalations rather than everyone's. Its own segment for the same
  // no-collision reason as the escalated queue.
  ADMIN_MY_ESCALATIONS: '/admin/my-escalations',
  // The moderation action log. A moderator sees its own actions here; an
  // administrator sees all. The open action's detail lives in the `action`
  // query parameter so a specific action is a shareable link.
  ADMIN_ACTIONS: '/admin/actions',
  // The account list and search. Administrator only: the backend answers the
  // whole account surface (list, search, detail) with 403 for a moderator. A row
  // opens the account at ADMIN_USER.
  ADMIN_USERS: '/admin/users',
  // An account's moderation context: its violation history, its posts and
  // comments, the warn control, and — for an administrator — the lifecycle
  // controls (ban, suspend, role change, force logout) driven by the account's
  // capabilities. Reachable by both roles; a moderator sees only the discipline
  // surfaces because the capabilities-bearing detail is administrator-only.
  // Build with `routeTo.adminUser`.
  ADMIN_USER: '/admin/users/:userId',
  // The administrative hashtag registry. Administrator only.
  ADMIN_HASHTAGS: '/admin/hashtags',
  // Moderator-reachable, not administrator-only: verification is a discretionary grant rather than
  // an enforcement action, so it sits with reports rather than with the account list.
  // The staff support console. Verification review happens here, as one
  // category of ticket among the rest, rather than on a screen of its own: a
  // verification request is a support ticket, claimed and decided by the same
  // rules as any other, and reviewing it somewhere else meant two queues with
  // one workflow between them.
  ADMIN_SUPPORT: '/admin/support',
  // Platform statistics. Administrator only; both statistics endpoints answer a
  // moderator with 403.
  ADMIN_STATISTICS: '/admin/statistics',
  // The behavioural activity log. Administrator only. The account under
  // investigation and the event type live in the `account` and `type` query
  // parameters so a view is shareable; the time window does not, because it is
  // mandatory and must be a deliberate commit rather than something a link can
  // fire on arrival.
  ADMIN_ACTIVITY: '/admin/activity',

  NOT_FOUND: '*',
};

const withParams = (pattern, params) =>
  Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value ?? '')),
    pattern
  );

/** Builders for the parameterised routes above. */
export const routeTo = {
  userProfile: (userId) => withParams(ROUTES.USER_PROFILE, { userId }),
  userFollowers: (userId) => withParams(ROUTES.USER_FOLLOWERS, { userId }),
  userFollowing: (userId) => withParams(ROUTES.USER_FOLLOWING, { userId }),
  postDetail: (postId) => withParams(ROUTES.POST_DETAIL, { postId }),
  hashtag: (name) => withParams(ROUTES.HASHTAG, { name }),
  storyView: (storyId) => withParams(ROUTES.STORY_VIEW, { storyId }),
  adminReportDetail: (reportId) => withParams(ROUTES.ADMIN_REPORT_DETAIL, { reportId }),
  adminUser: (userId) => withParams(ROUTES.ADMIN_USER, { userId }),
  supportTicket: (ticketId) => withParams(ROUTES.SUPPORT_TICKET, { ticketId }),
  // The action log with a specific action open in its drawer; the open state is
  // a query parameter so the link is shareable and the list stays mounted.
  adminAction: (actionId) => `${ROUTES.ADMIN_ACTIONS}?action=${encodeURIComponent(actionId ?? '')}`,
};

/** Query cache stale times (ms) */
export const STALE_TIME = {
  SHORT: 30_000, // 30 seconds
  MEDIUM: 5 * 60_000, // 5 minutes
  LONG: 30 * 60_000, // 30 minutes
};

/** HTTP status codes */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

// Maximum input lengths, mirroring the backend @Size limits so the client stops
// at the same boundary the server enforces rather than inventing its own.
export const CHAR_LIMITS = {
  comment: 2200,
  caption: 2200,
  bio: 500,
  displayName: 100,
  username: 30,
  websiteUrl: 2048,
  locationName: 255,
  reportDescription: 2000,
  // The warning note the warn endpoint accepts (AdminWarnUserRequest.note @Size
  // maxLength 2000). Required and non-blank; the client stops at this boundary.
  warningNote: 2000,
  message: 4000,
  nickname: 50,
  search: 100,
};
