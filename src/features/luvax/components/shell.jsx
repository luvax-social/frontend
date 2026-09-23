import { useState } from 'react';
import { v } from '@/config/tokens';
import { LxTrendingRail } from './LxTrendingRail';
import { ROUTES } from '@/config/constants';
import { extractPageContent } from '@/utils/helpers';
import { useViewport, useViewportWidth } from '../hooks/useViewport';
import { LxIcon, LxAvatar, LxBtn } from './primitives';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';
import { useSuggestions, useFollowSuggestion, useDismissSuggestion } from '../hooks/useSuggestions';
import { usePendingFollowRequests } from '../hooks/useSocial';
import { useNotificationState } from '../hooks/useNotifications';
import { NotificationBadge } from '../notifications/NotificationBadge';
import { useAuthStore } from '@/store/useAuthStore';
import { isPanelRole } from '@/config/roles';
import { useConversations } from '@/features/messages/hooks/useConversations';
import { toThreadSummary } from '@/features/messages/utils/messageViewModel';

// `id` still identifies the active tab for the shell's own styling; `path` is
// where the tab actually goes.
const PRIMARY_TABS = [
  { id: 'feed', path: ROUTES.FEED, icon: 'home', label: 'home' },
  // The messages interface is restored. It runs on its own presentation without
  // live data wiring yet, so the tab is enabled and reachable again.
  { id: 'messages', path: ROUTES.MESSAGES, icon: 'message', label: 'message' },
  { id: 'compose', path: ROUTES.COMPOSE, icon: 'plus', label: 'post' },
  { id: 'explore', path: ROUTES.EXPLORE, icon: 'explore', label: 'search' },
  { id: 'notifications', path: ROUTES.NOTIFICATIONS, icon: 'bell', label: 'notification' },
];

const BOTTOM_TABS = [
  ...PRIMARY_TABS,
  { id: 'profile', path: ROUTES.PROFILE, icon: 'profile', label: 'profile' },
];

const MESSAGE_PREVIEW_LIMIT = 3;

// ─── Persistent App Bar (mobile only) ──────────────────────────────────────
// Desktop and tablet render no top bar at all: the side rail already carries every
// destination this bar used to duplicate (nav tabs, search, profile), so a second copy of
// the same nav only cost vertical space without adding a route. Mobile keeps this bar
// because it has no side rail - it is the only place carrying the back button for a
// subpage, the current page's title, and the notification bell.
export function LxAppBar({ screen, navigate }) {
  // Every settings category is the same screen with a category in the path, so
  // one entry covers what used to be four separate screen ids. The category's
  // own name is carried by the region's heading rather than by this bar.
  const subpages = {
    post: 'post',
    settings: 'settings',
  };
  const isSubpage = Boolean(subpages[screen]);
  const subpageLabel = subpages[screen];

  return (
    <header
      data-lx-bar="1"
      className="lx-bar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 56,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--lx-glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${v.border}`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'stretch',
          padding: '0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {isSubpage ? (
            <>
              <button
                onClick={() => navigate(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  marginLeft: -4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LxIcon name="back" size={20} color={v.ink} />
              </button>
              <span style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 600, color: v.ink }}>
                {subpageLabel}
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate(ROUTES.COMPOSE)}
              aria-label="open composer"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                marginLeft: -4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LxIcon name="plus" size={22} color={v.ink} />
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: isSubpage ? 'auto' : 'none',
            minWidth: 0,
          }}
        >
          {!isSubpage ? (
            <button
              type="button"
              onClick={() => navigate(screen === 'messages' ? ROUTES.MESSAGES : ROUTES.FEED)}
              style={{
                pointerEvents: 'all',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: v.fontDisplay,
                fontSize: 20,
                fontWeight: 700,
                color: v.ink,
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {screen === 'messages' ? 'messages' : 'luvax'}
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            justifyContent: 'flex-end',
          }}
        >
          {/* The bell used to live here, duplicating the bottom nav's own bell and its own
              dot (D14). The bottom nav is the only nav surface always present on mobile, so
              this slot stays an empty spacer of the same width rather than a second bell. */}
          <div style={{ width: 36, height: 36 }} aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}

// ─── Bottom Nav (mobile only) ──────────────────────────────────────────────
export function LxBottomNav({ active, navigate }) {
  const tabs = BOTTOM_TABS;

  const { data: requestsResponse } = usePendingFollowRequests();
  const requests = extractPageContent(requestsResponse);
  const { data: state } = useNotificationState();
  const unseenCount = state?.unseen?.count ?? 0;
  const unseenCapped = state?.unseen?.capped ?? false;
  const hasFollowRequests = requests.length > 0;
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        padding: '0',
        background: 'var(--lx-glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${v.border}`,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => !t.disabled && navigate(t.path)}
            disabled={t.disabled}
            aria-disabled={t.disabled || undefined}
            aria-label={t.label}
            title={t.disabled ? `${t.label} are not part of this build` : undefined}
            className="lx-tab-btn"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              height: 56,
              border: 'none',
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              opacity: t.disabled ? 0.4 : 1,
              position: 'relative',
              transition: 'color 150ms ease-out',
            }}
          >
            <LxIcon
              name={t.icon}
              size={22}
              filled={isActive}
              color={isActive ? v.accent : v.ink3}
              stroke={isActive ? 1.8 : 1.5}
            />
            {t.id === 'notifications' && (unseenCount > 0 || hasFollowRequests) && (
              <span style={{ position: 'absolute', top: 2, right: '22%' }}>
                <NotificationBadge
                  count={hasFollowRequests ? Math.max(unseenCount, 1) : unseenCount}
                  capped={unseenCapped}
                />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Suggested accounts (composition only) ─────────────────────────────────
// The design's rail carries a suggested block of three user rows. Its version is hardcoded to
// three invented people, and there is no suggested-accounts endpoint to drive a real one: the
// recommendation module now serves a post feed (GET /recommendations/feed), but nothing
// recommends accounts to follow.
//
// This is the composition, driven entirely by the caller's data. It is deliberately not mounted in
// the rail. Rendering it with placeholder accounts would put invented people back into the
// interface, which this project has already removed once. It renders nothing when handed nothing,
// so the day a suggested-accounts endpoint exists this needs a data hook and a single line in the
// rail.
export function LxSuggestedList({ users = [], loading = false, onFollow, onDismiss }) {
  if (loading) {
    return (
      <div>
        <div style={suggestedHeadingStyle}>suggested</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="lx-skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="lx-skeleton"
                  style={{ width: '62%', height: 11, borderRadius: 4, marginBottom: 6 }}
                />
                <div className="lx-skeleton" style={{ width: '40%', height: 9, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (users.length === 0) return null;

  return (
    <div>
      <div style={suggestedHeadingStyle}>suggested</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map((u) => {
          const pending = !u.isFollowing && u.isFollowRequested;
          return (
            <div
              key={u.id ?? u.username}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <LxAvatar size={36} src={u.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 13,
                    fontWeight: 600,
                    color: v.ink,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    minWidth: 0,
                  }}
                >
                  {/* The name truncates and the badge does not. A badge pushed off the end by a
                      long display name would silently drop the one fact the row exists to carry. */}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {u.displayName || u.username}
                  </span>
                  <LxVerifiedBadge verified={u.verified} category={u.verifiedCategory} size={13} />
                </div>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 11,
                    color: v.ink3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {u.username ? `@${u.username}` : u.bio}
                </div>
              </div>
              <LxBtn
                variant="ghost"
                size="sm"
                disabled={u.isFollowing || pending}
                onClick={() => (u.onFollow ? u.onFollow() : onFollow?.(u.id))}
              >
                {u.isFollowing ? 'following' : pending ? 'pending' : 'follow'}
              </LxBtn>
              {/* Its own button rather than a corner of the row, so it is reachable by keyboard in
                  the natural tab order. Kept to 24px and placed after the follow action so the
                  primary tap target on a touch screen is follow, not dismiss. */}
              <button
                type="button"
                aria-label={`Dismiss ${u.displayName || u.username}`}
                onClick={() => onDismiss?.(u.id)}
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: v.ink3,
                }}
              >
                <LxIcon name="close" size={13} color={v.ink3} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const suggestedHeadingStyle = {
  fontFamily: v.fontMono,
  fontSize: 10,
  color: v.ink3,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: 12,
};

// Reads the endpoint and hands LxSuggestedList rows in the shape it already expects. Kept beside
// the presentational component rather than inside it so the composition stays testable with
// invented data and the mounted widget never is.
//
// Exported because the rail is not the only mount point any more: below TABLET_RAIL_MIN_WIDTH
// there is no rail at all, and Explore hosts this and the trending list instead so the two
// features are not simply absent on the form factor this application is mostly read on.
export function LxSuggestedRail() {
  const { data: rows, isLoading } = useSuggestions(5);
  const followSuggestion = useFollowSuggestion();
  const dismissSuggestion = useDismissSuggestion();

  return (
    <LxSuggestedList
      users={rows ?? []}
      loading={isLoading}
      onFollow={(userId) => followSuggestion.mutate(userId)}
      onDismiss={(userId) => dismissSuggestion.mutate(userId)}
    />
  );
}

// ─── Right Rail (desktop) ──────────────────────────────────────────────────
export function LxRightRail({ compact = false }) {
  return (
    <aside
      style={{
        width: compact ? 196 : 280,
        flexShrink: 0,
        padding: compact ? '12px 10px 12px 12px' : '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        // vh is computed against the true viewport, unadjusted for the root's zoom scale, so a
        // raw 100vh here rendered taller than the real viewport and could push part of the rail
        // out of view. Dividing by --lx-scale cancels the zoom multiplication back out.
        //
        // The launcher clearance is subtracted rather than added as padding: the messages pill is
        // fixed to the bottom-right of the same viewport and reserves no space, and padding below
        // the content does not move the content up. Ending the rail's scroll viewport above the
        // pill is what keeps the last row reachable - at 1440x900 with five suggestions the fifth
        // row's follow and dismiss buttons were otherwise painted under it and unclickable, with
        // the launcher reported as the intercepting element.
        maxHeight: `calc((100vh / var(--lx-scale)) - ${MESSAGE_LAUNCHER_CLEARANCE}px)`,
        overflowY: 'auto',
      }}
    >
      <LxTrendingRail compact={compact} />
      <LxSuggestedRail />
    </aside>
  );
}

function LxFloatingMessagePreview({ navigate, currentUserId, hidden = false }) {
  const { conversations } = useConversations();
  const recentMessageThreads = conversations
    .slice(0, MESSAGE_PREVIEW_LIMIT)
    .map((conversation) => toThreadSummary(conversation, currentUserId));

  if (hidden) return null;

  const compact = recentMessageThreads.length === 0;

  return (
    <button
      type="button"
      onClick={() => navigate(ROUTES.MESSAGES)}
      aria-label="open messages"
      style={{
        position: 'fixed',
        right: 32,
        bottom: 30,
        zIndex: 90,
        minWidth: compact ? 106 : 142,
        height: 38,
        borderRadius: 999,
        border: `1px solid ${v.border}`,
        background: v.surface,
        color: v.ink,
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 7 : 9,
        padding: compact ? '0 11px' : '0 12px',
        cursor: 'pointer',
        boxShadow: `0 10px 28px ${v.shadow12}`,
        fontFamily: v.fontBody,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <LxIcon name="message" size={14} color={v.ink2} />
      <span>Message</span>
      {recentMessageThreads.length ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 2 }}>
          {recentMessageThreads.map((thread, index) => (
            <span
              key={thread.id}
              style={{
                marginLeft: index === 0 ? 0 : -6,
                border: `1px solid ${v.surface}`,
                borderRadius: '50%',
                display: 'inline-flex',
              }}
            >
              <LxAvatar size={18} src={thread.avatarUrl} />
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

// ─── Mark (icon-only) ───────────────────────────────────────────────────────
// The favicon PNG is the only icon-only Luvax mark in the project - the app
// otherwise only ever renders the "luvax" wordmark - so the rail reuses that
// same asset rather than a typographic stand-in.
function LxMark({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="luvax home"
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src="/luvax-mark.png"
        alt=""
        width={22}
        height={22}
        style={{ display: 'block', borderRadius: 6 }}
      />
    </button>
  );
}

// The icon column sits at a fixed offset from the rail's left edge in both
// states, so it never shifts horizontally when the rail expands - only the
// label beside it grows in. The inset centers a 20px icon in the collapsed
// rail's 60px width.
export const RAIL_COLLAPSED_W = 60;
const RAIL_EXPANDED_W = 196;
const RAIL_ICON_INSET = 20;
const RAIL_ICON_SIZE = 20;

// ─── Left Sub-Nav Rail (desktop/tablet) ────────────────────────────────────
// The primary nav on desktop and tablet: it is always on screen rather than a
// stand-in that appears only when something else disappears, matching the
// smaller icon-only sidebar Instagram itself keeps visible at all times.
// `position: fixed` keeps it out of the page's own flex flow, so hovering it
// open overlays the interface instead of shifting the app's layout. Hovering
// expands the rail and reveals a text label per icon, the same disclosure
// Instagram's own collapsed sidebar uses.
export function LxSideRail({ active, navigate, visible = true }) {
  const currentUser = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const [expanded, setExpanded] = useState(false);
  // The role is held in memory only and is absent until the session is
  // established, so this reads false first and turns true once the role
  // arrives. The entry appears late for a privileged account rather than
  // appearing for an ordinary one and then vanishing.
  const canReachPanel = isPanelRole(role);
  const { data: requestsResponse } = usePendingFollowRequests();
  const requests = extractPageContent(requestsResponse);
  const { data: state } = useNotificationState();
  const unseenCount = state?.unseen?.count ?? 0;
  const unseenCapped = state?.unseen?.capped ?? false;
  const hasFollowRequests = requests.length > 0;

  const rowStyle = (disabled) => ({
    width: '100%',
    height: 34,
    borderRadius: 9,
    border: 'none',
    paddingLeft: RAIL_ICON_INSET,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    flexShrink: 0,
  });

  // maxWidth (not just opacity) has to collapse to 0 too: a nowrap label's
  // intrinsic text width otherwise still competes for space in the flex row
  // even while invisible, and the row is narrower than most labels, so the
  // icon next to it gets squeezed down to zero width by the flex algorithm.
  const labelStyle = (isActive) => ({
    fontFamily: v.fontBody,
    fontSize: 13,
    fontWeight: 600,
    // --lx-ink-3 measures below 4.5:1 on this surface in both themes, and these
    // labels are the rail's only readable naming of its destinations rather
    // than a decorative mark. --lx-ink-2 is the same role above the threshold.
    color: isActive ? v.accent : v.ink2,
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    maxWidth: expanded ? 120 : 0,
    opacity: expanded ? 1 : 0,
    transition: 'opacity 120ms ease-out, max-width 180ms var(--ease-out)',
  });

  const iconWrapStyle = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <nav
      aria-hidden={!visible}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      // The labels are the rail's only way of naming its destinations, so
      // revealing them cannot be a mouse-only affordance. Focus entering the
      // rail opens it exactly as hover does and focus leaving closes it, which
      // makes tabbing through the nav show the same labels a pointer does.
      // React's focus events bubble, so this covers every button inside.
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: expanded ? RAIL_EXPANDED_W : RAIL_COLLAPSED_W,
        zIndex: 100,
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '16px 0',
        background: 'var(--lx-glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transform: visible ? 'translateX(0)' : 'translateX(-100%)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        // width is deliberately not transitioned: it is also this element's own hover hit-test
        // box, and animating it let a real mouse's path cross a not-yet-grown edge mid-transition,
        // firing a spurious mouseleave that collapsed the rail out from under the cursor. Snapping
        // it instantly removes that race; the label still reveals smoothly via its own transition.
        transition:
          'transform var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-out)',
      }}
    >
      <div style={{ paddingLeft: RAIL_ICON_INSET, flexShrink: 0 }}>
        <LxMark onClick={() => navigate(ROUTES.FEED)} />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {BOTTOM_TABS.map((t) => {
          const isActive = active === t.id;
          const isProfile = t.id === 'profile';
          return (
            <button
              key={t.id}
              onClick={() => !t.disabled && navigate(t.path)}
              disabled={t.disabled}
              aria-label={t.label}
              className="lx-tab-btn"
              style={rowStyle(t.disabled)}
            >
              <span style={iconWrapStyle}>
                {isProfile ? (
                  <LxAvatar size={RAIL_ICON_SIZE} src={currentUser?.avatarUrl} ring={isActive} />
                ) : (
                  <LxIcon
                    name={t.icon}
                    size={RAIL_ICON_SIZE}
                    filled={isActive}
                    color={isActive ? v.accent : v.ink3}
                    stroke={isActive ? 1.7 : 1.5}
                  />
                )}
              </span>
              <span style={labelStyle(isActive)}>{t.label}</span>
              {t.id === 'notifications' && (unseenCount > 0 || hasFollowRequests) && (
                <span style={{ position: 'absolute', top: 2, left: RAIL_ICON_INSET + 14 }}>
                  <NotificationBadge
                    count={hasFollowRequests ? Math.max(unseenCount, 1) : unseenCount}
                    capped={unseenCapped}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {canReachPanel ? (
        <button
          onClick={() => navigate(ROUTES.ADMIN)}
          aria-label="panel"
          className="lx-tab-btn"
          style={rowStyle(false)}
        >
          <span style={iconWrapStyle}>
            <LxIcon name="shield" size={RAIL_ICON_SIZE} color={v.ink3} stroke={1.5} />
          </span>
          <span style={labelStyle(false)}>panel</span>
        </button>
      ) : null}

      {/*
        Support sits with the panel and settings rather than among the tabs
        above, because it is somewhere you go when something is wrong rather
        than a place you browse. It points at the settings category, so the rail
        is a shortcut to the one door and not a second one: without it, reaching
        support meant opening settings first, and before this it meant typing an
        address, because nothing in the product linked to support at all.

        It does not light up as an active tab for the same reason `panel` does
        not: the rail's active state is keyed on the screen id, and the screen
        behind this address is `settings`.
      */}
      <button
        onClick={() => navigate(ROUTES.SETTINGS_SUPPORT)}
        aria-label="support"
        className="lx-tab-btn"
        style={rowStyle(false)}
      >
        <span style={iconWrapStyle}>
          <LxIcon name="mail" size={RAIL_ICON_SIZE} color={v.ink3} stroke={1.5} />
        </span>
        <span style={labelStyle(false)}>support</span>
      </button>

      <button
        onClick={() => navigate(ROUTES.SETTINGS)}
        aria-label="profile settings"
        className="lx-tab-btn"
        style={rowStyle(false)}
      >
        <span style={iconWrapStyle}>
          <LxIcon name="settings" size={RAIL_ICON_SIZE} color={v.ink3} stroke={1.5} />
        </span>
        <span style={labelStyle(false)}>settings</span>
      </button>
    </nav>
  );
}

/**
 * Narrowest tablet viewport, in device pixels, that can host the compact right rail beside a
 * readable column. Below this the rail is dropped and the column takes the space instead.
 */
export const TABLET_RAIL_MIN_WIDTH = 910;

// Height the fixed messages launcher occupies at the bottom-right, plus its offset and a little
// clearance. The right rail subtracts this from its own scroll viewport so its last row can never
// be painted underneath a control that reserves no space of its own.
const MESSAGE_LAUNCHER_CLEARANCE = 72;

// ─── App Shell ─────────────────────────────────────────────────────────────
export function LxShell({ screen, navigate, children, showRightRail = true }) {
  const vp = useViewport();
  const viewportWidth = useViewportWidth();
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Settings is the one screen that is not a reading column. It is a list of
  // groups beside the category that is open, and the list belongs immediately
  // against the navigation rail: that is what lets the rail expand over it
  // rather than over the content the person came to read. So it takes the full
  // width from the rail's collapsed edge instead of sitting in the centred
  // column the rest of the application uses.
  if (vp !== 'mobile' && screen === 'settings') {
    return (
      <div style={{ background: v.base }}>
        <LxSideRail active={screen} navigate={navigate} />
        <LxFloatingMessagePreview
          navigate={navigate}
          currentUserId={currentUserId}
          hidden={screen === 'messages'}
        />
        <main
          key={screen}
          className="lx-fade-in"
          style={{
            // The expanded width, not the collapsed one. The rail is fixed and
            // overlays rather than shifting the layout, so whatever the layout
            // fails to reserve, the rail covers. Reserving 60 left the rail's
            // open state overlapping this column by 136px, which swallowed the
            // left half of every sub-nav row including its label, and it was
            // open precisely on arrival: reaching settings means clicking the
            // rail's own settings button, which focuses it, and onFocus expands
            // the rail. The pointer then sits inside the overlay while crossing
            // to the sub-nav, so onMouseLeave never fires to collapse it. Every
            // other branch of this shell already reserves more than the rail can
            // grow to, which is why settings alone showed the defect.
            marginLeft: RAIL_EXPANDED_W,
            minHeight: 'calc(100vh / var(--lx-scale))',
            display: 'flex',
            flexDirection: 'column',
            background: v.base,
          }}
        >
          {children}
        </main>
      </div>
    );
  }

  if (vp === 'desktop') {
    const LEFT_W = 280;
    const isWideScreen = screen === 'search' || screen === 'explore';
    const mainWidth = isWideScreen ? 960 : 680;
    const shellMaxWidth = isWideScreen ? 1540 : 1260;
    return (
      // No min-height: 100vh here - it would carry the same zoom-vs-vh mismatch <main> below
      // has to correct for, and nothing in this row needs it: the rail is fixed-positioned and
      // <main> establishes the page's real height on its own.
      <div style={{ background: v.base, display: 'flex', flexDirection: 'column' }}>
        <LxSideRail active={screen} navigate={navigate} />
        <LxFloatingMessagePreview
          navigate={navigate}
          currentUserId={currentUserId}
          hidden={screen === 'messages'}
        />
        <div
          style={{
            display: 'flex',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            maxWidth: shellMaxWidth,
            margin: '0 auto',
          }}
        >
          <div style={{ width: LEFT_W, flexShrink: 0 }} aria-hidden="true" />
          {/* Keyed by screen so a screen change fades in rather than cutting. */}
          <main
            key={screen}
            className="lx-fade-in"
            style={{
              width: mainWidth,
              // Shrinkable, not fixed. Explore and search widen the centre column to 960, which
              // together with the 280 left spacer, the 280 rail and the rail's own padding needs
              // more room than a 1440 viewport has once the root zoom is applied - the row
              // overflowed by 149px and the page scrolled sideways. The rail and the spacer keep
              // their widths; the centre column gives up the difference instead.
              flexShrink: 1,
              minWidth: 0,
              // No column rules. The feed is one continuous surface on the page
              // background, so the borders that boxed the centre column are gone.
              minHeight: 'calc(100vh / var(--lx-scale))',
              display: 'flex',
              flexDirection: 'column',
              background: v.base,
            }}
          >
            {children}
          </main>
          {showRightRail && <LxRightRail navigate={navigate} />}
          {!showRightRail && <div style={{ width: 280, flexShrink: 0 }} aria-hidden="true" />}
        </div>
      </div>
    );
  }

  if (vp === 'tablet') {
    const LEFT_W = 82;
    // Settings never reaches here: it is handled above, against the rail.
    const tabletMainWidth =
      screen === 'compose' ? 784 : screen === 'search' || screen === 'explore' ? 760 : 604;
    const tabletShellWidth =
      screen === 'compose' ? 1090 : screen === 'search' || screen === 'explore' ? 1060 : 910;
    // Matched to LEFT_W rather than the 206 it used to be. The left spacer stands in for the
    // fixed navigation rail, so the main column is only centred between the rail and the right
    // edge when the two are equal; at 206 it sat measurably left of centre.
    const tabletRightSpacer = LEFT_W;
    // The rail is only offered when the viewport can host it beside a readable column. The tablet
    // shell is sized in CSS pixels but the root carries a zoom scale, so 768 device pixels is
    // about 673 CSS pixels - far less than the 882 the rail layout needs. Rendering it anyway is
    // what pushed the column off the left edge and the rail 116 pixels past the right one.
    const railFits = viewportWidth >= TABLET_RAIL_MIN_WIDTH;
    const showTabletRail = showRightRail && railFits;
    return (
      // No min-height: 100vh here - see the desktop branch above for why.
      <div style={{ background: v.base, display: 'flex', flexDirection: 'column' }}>
        <LxSideRail active={screen} navigate={navigate} />
        <LxFloatingMessagePreview
          navigate={navigate}
          currentUserId={currentUserId}
          hidden={screen === 'messages'}
        />
        <div
          style={{
            display: 'flex',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'flex-start',
            width: '100%',
            maxWidth: tabletShellWidth,
            margin: '0 auto',
          }}
        >
          <div style={{ width: LEFT_W, flexShrink: 0 }} aria-hidden="true" />
          <main
            key={screen}
            className="lx-fade-in"
            style={{
              // Flexible with a ceiling rather than a fixed width: at 1024 it still takes its
              // designed width, and at 768 it gives ground to the spacers instead of overflowing.
              flex: 1,
              maxWidth: tabletMainWidth,
              minWidth: 0,
              // Column rules removed to match the desktop feed's continuous surface.
              minHeight: 'calc(100vh / var(--lx-scale))',
              display: 'flex',
              flexDirection: 'column',
              background: v.base,
            }}
          >
            {children}
          </main>
          {showTabletRail ? (
            <LxRightRail navigate={navigate} compact />
          ) : (
            <div style={{ width: tabletRightSpacer, flexShrink: 0 }} aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }

  // mobile
  return (
    // <main> below is flex: 1, which needs a definite parent height to distribute against, so
    // (unlike the desktop/tablet branches) this wrapper keeps a real min-height - zoom-corrected.
    <div
      style={{
        minHeight: 'calc(100vh / var(--lx-scale))',
        background: v.base,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <LxAppBar screen={screen} navigate={navigate} />
      <main
        key={screen}
        className="lx-fade-in"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 72 }}
      >
        {children}
      </main>
      <LxBottomNav active={screen} navigate={navigate} />
    </div>
  );
}
