import { Link, useParams } from 'react-router-dom';

import { v } from '@/config/tokens';
import { ROUTES } from '@/config/constants';
import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';
import { LxIcon } from '@/components/ui/lx-icon';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { AccountLifecyclePanel } from '../components/AccountLifecyclePanel';
import { AccountDisciplinePanel } from '../components/AccountDisciplinePanel';
import { AccountContent } from '../components/AccountContent';
import { useResolveUsername, shortId } from '../hooks/useResolveUsername';

/**
 * An account's moderation context. It carries the discipline history, the warn
 * control, and the account's posts and comments for both roles, and — for an
 * administrator — the account's state and every lifecycle action the server
 * permits on it, driven by the account's capabilities.
 *
 * The lifecycle card is administrator-only: the capabilities-bearing detail is
 * administrator-only, so a moderator sees the discipline and content surfaces
 * exactly as before and no empty control card. Reached by URL from a report's
 * owner, an audit row's target, and the account list, so a specific account's
 * record is a shareable link.
 */
/**
 * Rendered two ways from one implementation. On its own route it is the whole
 * screen and reads the account from the path — the form a moderator reaches
 * from the action log. Inside the account list's right region it is handed the
 * id and drops its own "all accounts" link, because the split carries the way
 * back. Neither form changes what is fetched.
 */
export function AccountModerationScreen({
  userId: userIdProp,
  embedded = false,
}: { userId?: string | null; embedded?: boolean } = {}) {
  const params = useParams();
  const userId = userIdProp ?? params.userId;
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const { username, isLoading: nameLoading } = useResolveUsername(userId);

  const nameLabel = username
    ? `@${username}`
    : nameLoading
      ? `${shortId(userId)}…`
      : shortId(userId);

  return (
    <div>
      <PageHeader
        title={
          <>
            account <span style={{ color: v.ink2, fontWeight: 500 }}>{nameLabel}</span>
          </>
        }
        right={
          isAdmin && !embedded ? (
            <Link
              to={ROUTES.ADMIN_USERS}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: v.fontBody,
                fontSize: 13,
                color: v.ink2,
                textDecoration: 'none',
              }}
            >
              <LxIcon name="chevronLeft" size={14} color={v.ink2} />
              all accounts
            </Link>
          ) : null
        }
      />

      {isAdmin ? (
        <PanelCard title="state & actions">
          <AccountLifecyclePanel userId={userId} />
        </PanelCard>
      ) : null}

      <PanelCard title="discipline history">
        <AccountDisciplinePanel userId={userId} />
      </PanelCard>

      <PanelCard title="content">
        <AccountContent userId={userId} />
      </PanelCard>
    </div>
  );
}
