import { ROUTES } from '@/config/constants';

/**
 * The settings groups and the categories inside them.
 *
 * Every category here corresponds to at least one endpoint that was called and
 * recorded in
 * `docs/user-settings-and-auth-errors/settings-contract-verification.md`.
 * Nothing is listed because a comparable product has it. If the inventory in
 * that document does not contain a row for a control, the control is not built.
 *
 * The group names are the person's own words rather than system nouns, and the
 * two named in the brief set the tone for the third:
 *
 *   how you use luvax     - the account's own presence and what it receives
 *   who can see your content - visibility and audience
 *   your account          - what is true about the account, and how you get in
 *
 * The third group exists because the inventory holds real settings that fit
 * neither of the first two: the email address, the verified badge, the join
 * date, the warnings the account has received, the password reset, and signing
 * out. These are facts about the account and its access, not preferences about
 * presence or audience. The reasoning is recorded in `design-decisions.md`.
 */
export const SETTINGS_GROUPS = [
  {
    id: 'use',
    title: 'how you use luvax',
    categories: [
      {
        id: 'profile',
        path: ROUTES.EDIT_PROFILE,
        label: 'profile',
        icon: 'profile',
        description: 'your name, your picture and how you appear to other people.',
      },
      {
        id: 'notifications',
        path: ROUTES.SETTINGS_NOTIFICATIONS,
        label: 'notifications',
        icon: 'bell',
        description: 'choose what luvax tells you about. each one saves on its own.',
      },
      {
        id: 'appearance',
        path: ROUTES.SETTINGS_APPEARANCE,
        label: 'appearance',
        icon: 'sun',
        description: 'switch between dark and light mode on this device.',
      },
      {
        id: 'saved',
        path: ROUTES.SAVED,
        label: 'saved posts',
        icon: 'bookmark',
        description: 'the posts you kept.',
        // The saved list draws its own sticky header. The category region skips
        // its heading here rather than stacking a second copy of the same word.
        ownsHeading: true,
      },
    ],
  },
  {
    id: 'audience',
    title: 'who can see your content',
    categories: [
      {
        id: 'privacy',
        path: ROUTES.SETTINGS_PRIVACY,
        label: 'privacy',
        icon: 'lock',
        description: 'who can see what you post, and who can reach you.',
      },
      {
        id: 'requests',
        path: ROUTES.SETTINGS_REQUESTS,
        label: 'follow requests',
        icon: 'userPlus',
        description: 'people waiting for you to let them follow you.',
      },
      {
        id: 'blocked',
        path: ROUTES.BLOCKED_USERS,
        label: 'blocked accounts',
        icon: 'ban',
        description: 'people you have blocked. they cannot see you, and you cannot see them.',
      },
    ],
  },
  {
    id: 'account',
    title: 'your account',
    categories: [
      {
        id: 'account',
        path: ROUTES.SETTINGS_ACCOUNT,
        label: 'account',
        icon: 'shield',
        description: 'your email address, where your account stands, and your password.',
      },
      {
        id: 'support',
        path: ROUTES.SETTINGS_SUPPORT,
        label: 'support',
        icon: 'mail',
        // The help centre's own subtitle, moved here because the category
        // region renders the description and the category no longer draws a
        // heading of its own.
        description:
          'ask us something, appeal a decision, or request a verified badge. one request, one reply.',
      },
    ],
  },
];

/** Every category, flattened, in the order the group list renders them. */
export const SETTINGS_CATEGORIES = SETTINGS_GROUPS.flatMap((group) =>
  group.categories.map((category) => ({ ...category, groupId: group.id }))
);

/**
 * Addresses that existed before the rebuild and must keep resolving. `password`
 * was a screen that only said it was not built yet; the account category is
 * where the one real password action now lives.
 */
const CATEGORY_ALIASES = { password: 'account' };

/**
 * Resolves the `:category` segment of the URL to a category, or null for the
 * bare settings address. An unknown segment also resolves to null, which the
 * screen renders as a stale-link message beside a working group list rather
 * than as a broken screen.
 */
export const resolveCategory = (segment) => {
  if (!segment) return null;
  const id = CATEGORY_ALIASES[segment] ?? segment;
  return SETTINGS_CATEGORIES.find((category) => category.id === id) ?? null;
};

/** True when the segment is present but names no category the app has. */
export const isUnknownCategory = (segment) => Boolean(segment) && !resolveCategory(segment);
