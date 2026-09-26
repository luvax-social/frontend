import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { v } from '@/config/tokens';
import { ROUTES } from '@/config/constants';
import { ROLES } from '@/config/roles';
import { authApi } from '@/api/authApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeChoice } from '@/hooks/useThemeChoice';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxAvatar } from '@/components/ui/lx-avatar';
import { ToastHost, toast } from '@/features/luvax/components/Toast';

import { useVocabularies } from '../hooks/useVocabularies';
import { useEscalatedCount } from '../hooks/useEscalatedCount';
import { PANEL_CSS } from './panelStyles';

/**
 * The panel shell. It establishes who is signed in and which navigation tree to
 * render, and frames every screen.
 *
 * The navigation is built from a single declaration filtered by role, so a
 * later phase adds a section by adding one entry rather than by restructuring.
 * A moderator sees the moderation group only; an administrator sees both.
 *
 * The signed-in identity in the header comes from GET /api/v1/users/me, which is
 * not needed for routing and does not block first paint. Sign out uses the
 * existing logout path, which revokes the session server-side and clears the
 * store, so the dead access token is never reused.
 */

// One declaration; the tree is derived by filtering on role. Adding a section
// later is one entry here and one route, with no restructuring.
const NAV_SECTIONS = [
  {
    heading: 'moderation',
    items: [
      {
        key: 'reports',
        label: 'reports',
        icon: 'flag',
        to: ROUTES.ADMIN_REPORTS,
        roles: [ROLES.MODERATOR, ROLES.ADMIN],
      },
      {
        key: 'my-escalations',
        label: 'my escalations',
        icon: 'alert',
        to: ROUTES.ADMIN_MY_ESCALATIONS,
        roles: [ROLES.MODERATOR, ROLES.ADMIN],
      },
      {
        key: 'support',
        label: 'support',
        icon: 'help',
        to: ROUTES.ADMIN_SUPPORT,
        roles: [ROLES.MODERATOR, ROLES.ADMIN],
      },
      {
        key: 'actions',
        label: 'actions',
        icon: 'clock',
        to: ROUTES.ADMIN_ACTIONS,
        roles: [ROLES.MODERATOR, ROLES.ADMIN],
      },
    ],
  },
  {
    heading: 'administration',
    items: [
      {
        key: 'escalated',
        label: 'escalated',
        icon: 'alert',
        to: ROUTES.ADMIN_ESCALATED,
        roles: [ROLES.ADMIN],
        badge: 'escalated',
      },
      {
        key: 'accounts',
        label: 'accounts',
        icon: 'profile',
        to: ROUTES.ADMIN_USERS,
        roles: [ROLES.ADMIN],
      },
      {
        key: 'hashtags',
        label: 'hashtags',
        icon: 'hash',
        to: ROUTES.ADMIN_HASHTAGS,
        roles: [ROLES.ADMIN],
      },
      {
        key: 'statistics',
        label: 'statistics',
        icon: 'eye',
        to: ROUTES.ADMIN_STATISTICS,
        roles: [ROLES.ADMIN],
      },
      {
        key: 'activity',
        label: 'activity',
        icon: 'explore',
        to: ROUTES.ADMIN_ACTIVITY,
        roles: [ROLES.ADMIN],
      },
    ],
  },
];

function HeaderIdentity() {
  const storeUser = useAuthStore((state) => state.user);
  const me = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => authApi.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const displayName =
    me.data?.displayName || storeUser?.displayName || storeUser?.username || 'signed in';
  const username = me.data?.username || storeUser?.username || '';
  const avatarUrl = me.data?.avatarUrl || null;
  const hue = [...username].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <LxAvatar size={30} src={avatarUrl} idx={hue} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontFamily: v.fontBody,
            fontSize: 13,
            fontWeight: 500,
            color: v.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </span>
        {username ? (
          <span style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink2 }}>@{username}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminShell() {
  const role = useAuthStore((state) => state.role);
  const navigate = useNavigate();
  const { count: escalatedCount } = useEscalatedCount();
  const { dark, toggleTheme } = useThemeChoice();

  // Fetched once here so every screen has the vocabulary labels available.
  useVocabularies();

  const handleSignOut = async () => {
    try {
      await authApi.logout();
    } catch {
      // The session is being ended regardless; a failed revoke still clears the
      // client, and the access token is dead once logout is issued.
    } finally {
      useAuthStore.getState().logout();
      toast('signed out');
      navigate(ROUTES.HOME, { replace: true });
    }
  };

  const badgeValue = (key) => (key === 'escalated' && escalatedCount > 0 ? escalatedCount : null);

  return (
    <div className="lx-admin-shell">
      <style>{PANEL_CSS}</style>

      <aside className="lx-admin-sidebar">
        <div className="lx-admin-brand">
          <LxIcon name="shield" size={20} color={v.accent} />
          <span>panel</span>
        </div>

        <nav className="lx-admin-nav" aria-label="panel navigation">
          {NAV_SECTIONS.map((section) => {
            const visible = section.items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) {
              return null;
            }
            return (
              <div key={section.heading} className="lx-admin-nav-group">
                <div className="lx-admin-nav-heading">{section.heading}</div>
                {visible.map((item) => {
                  const badge = badgeValue(item.badge);
                  return (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      end={item.to === ROUTES.ADMIN_REPORTS}
                      className={({ isActive }) =>
                        `lx-admin-navlink${isActive ? ' is-active' : ''}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <LxIcon
                            name={item.icon}
                            size={17}
                            color={isActive ? v.accentText : v.ink2}
                          />
                          <span>{item.label}</span>
                          {badge !== null ? <span className="lx-admin-badge">{badge}</span> : null}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="lx-admin-main">
        <header className="lx-admin-header">
          <HeaderIdentity />
          <div className="lx-admin-header-actions">
            {/* Leaving the panel is as reachable as entering it. */}
            <Link to={ROUTES.APP} className="lx-admin-signout" aria-label="back to luvax">
              <LxIcon name="chevronLeft" size={14} color={v.ink2} />
              <span>back to luvax</span>
            </Link>
            <button
              type="button"
              className="lx-admin-signout"
              onClick={toggleTheme}
              aria-pressed={dark}
              aria-label={dark ? 'switch to light theme' : 'switch to dark theme'}
            >
              <LxIcon name={dark ? 'sun' : 'moon'} size={14} color={v.ink2} />
              <span>{dark ? 'light' : 'dark'}</span>
            </button>
            <button
              type="button"
              className="lx-admin-signout"
              onClick={handleSignOut}
              aria-label="sign out"
            >
              <LxIcon name="logout" size={14} color={v.ink2} />
              <span>sign out</span>
            </button>
          </div>
        </header>

        <main className="lx-admin-content">
          <Outlet />
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
