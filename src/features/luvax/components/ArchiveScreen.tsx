import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES, routeTo } from '@/config/constants';
import { v } from '@/config/tokens';

import { ARCHIVE_TABS } from './archive/archiveTabs';
import { useMyPostCounts } from '../hooks/useDrafts';

/**
 * The viewer's archive: a heading, the line that says who can see it, and a bar of tabs built from
 * the tab registry.
 *
 * The tab is part of the address, so a tab can be linked and reloaded. An unknown tab name falls
 * back to the first tab rather than showing an empty screen.
 */
export function ArchiveScreen() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const counts = useMyPostCounts();
  const active = ARCHIVE_TABS.find((entry) => entry.id === tab) ?? ARCHIVE_TABS[0];
  const Active = active.component;

  if (tab && !ARCHIVE_TABS.some((entry) => entry.id === tab)) {
    return <Navigate to={ROUTES.ARCHIVE} replace />;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
      <div style={{ padding: '24px 0 4px' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: v.fontDisplay,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: v.ink,
          }}
        >
          archive
        </h1>
        <p style={{ margin: '6px 0 0', fontFamily: v.fontBody, fontSize: 14, color: v.ink2 }}>
          Only you can see archived posts. Unarchive one to put it back on your profile.
        </p>
      </div>

      <div
        role="tablist"
        style={{ display: 'flex', gap: 22, marginTop: 18, borderBottom: `1px solid ${v.border}` }}
      >
        {ARCHIVE_TABS.map((entry) => {
          const selected = entry.id === active.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => navigate(routeTo.archiveTab(entry.id))}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${selected ? v.accent : 'transparent'}`,
                padding: '8px 2px',
                cursor: 'pointer',
                fontFamily: v.fontBody,
                fontSize: 14,
                color: selected ? v.ink : v.ink3,
                marginBottom: -1,
              }}
            >
              {entry.label}
              {entry.id === 'posts' && counts.data ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontFamily: v.fontMono,
                    fontSize: 11,
                    background: v.surface,
                    borderRadius: 999,
                    padding: '1px 7px',
                  }}
                >
                  {counts.data.data.archived}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Active />
    </div>
  );
}

export default ArchiveScreen;
