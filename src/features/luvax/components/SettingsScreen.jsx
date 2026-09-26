import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { LxIcon } from '@/components/ui/lx-icon';
import { ROUTES } from '@/config/constants';
import { v } from '@/config/tokens';

// Support is a slice of its own, and the settings screen renders its body the
// way the shell already renders the messages slice's hooks from here: the
// category is a settings concern, the request form behind it is not.
import { SupportCenter } from '@/features/support/components/SupportCenter';

import { isUnknownCategory, resolveCategory, SETTINGS_GROUPS } from './settingsCatalog';
import {
  AccountCategory,
  AppearanceCategory,
  BlockedCategory,
  NotificationsCategory,
  PrivacyCategory,
  ProfileCategory,
  RequestsCategory,
  SavedCategory,
} from './settingsCategories';
import { SETTINGS_CSS } from './settingsStyles';

const CATEGORY_VIEWS = {
  profile: ProfileCategory,
  notifications: NotificationsCategory,
  appearance: AppearanceCategory,
  saved: SavedCategory,
  privacy: PrivacyCategory,
  requests: RequestsCategory,
  blocked: BlockedCategory,
  account: AccountCategory,
  support: SupportCenter,
};

/**
 * Settings: a persistent list of groups beside the category that is open.
 *
 * The category lives in the path, not in component state, so every category has
 * its own address. Pasting one opens that category directly, the browser's back
 * button walks between categories rather than out of settings, and choosing a
 * category is a navigation rather than a screen replacement.
 *
 * Because the group list is one component instance that stays mounted while the
 * category changes, only the right region swaps: the list keeps its scroll
 * offset and issues no request when the selection moves.
 *
 * The list carries a name and an icon per category and nothing else. What a
 * category is for is said once, at the top of the category itself, rather than
 * under every name in the list where seven straplines compete with the names
 * they describe.
 *
 * At a narrow width this is not a split. The stylesheet removes whichever
 * region is not in play, so the group list is the whole width until a category
 * is opened and the category is the whole width afterwards, with a way back.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const { category: segment } = useParams();
  const category = resolveCategory(segment);
  const unknown = isUnknownCategory(segment);
  const regionRef = useRef(null);
  const headingRef = useRef(null);
  const [query, setQuery] = useState('');

  // Filters the list to categories whose name contains what was typed, and
  // drops any group left with nothing in it. Purely a filter over a static
  // list - it asks the server nothing and can invent nothing.
  const trimmedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!trimmedQuery) return SETTINGS_GROUPS;
    return SETTINGS_GROUPS.map((group) => ({
      ...group,
      categories: group.categories.filter(
        (entry) =>
          entry.label.toLowerCase().includes(trimmedQuery) ||
          group.title.toLowerCase().includes(trimmedQuery)
      ),
    })).filter((group) => group.categories.length > 0);
  }, [trimmedQuery]);

  const matchCount = visibleGroups.reduce((total, group) => total + group.categories.length, 0);

  // When the open category changes, the region returns to its own top and takes
  // focus. Without this, choosing a second category from the list would leave
  // focus on the list row and the region scrolled to wherever the last one was
  // left.
  useEffect(() => {
    if (!category) return;
    // preventScroll matters: focusing the wrapper otherwise scrolls it into
    // view, which pulls the region past its own top padding and clips the
    // heading against the top edge.
    if (headingRef.current) headingRef.current.focus({ preventScroll: true });
    if (regionRef.current) regionRef.current.scrollTop = 0;
  }, [category?.id]);

  const CategoryView = category ? CATEGORY_VIEWS[category.id] : null;

  return (
    <>
      <style>{SETTINGS_CSS}</style>
      <div className={`lx-settings${category || unknown ? ' has-category' : ''}`}>
        <div className="lx-settings-groups">
          {/* Hidden at the narrow width, where the app bar already carries the
              word and two copies of it would stack. */}
          <h1 className="lx-settings-title">settings</h1>

          <div className="lx-settings-search">
            <LxIcon name="explore" size={15} color={v.ink2} />
            <input
              type="search"
              className="lx-settings-search-input"
              placeholder="search settings"
              aria-label="search settings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="lx-settings-search-clear"
                aria-label="clear the search"
                onClick={() => setQuery('')}
              >
                <LxIcon name="close" size={14} color={v.ink2} />
              </button>
            ) : null}
          </div>

          {matchCount === 0 ? (
            <p className="lx-settings-no-match">
              nothing here is called “{query.trim()}”. try another word, or clear the search to see
              everything.
            </p>
          ) : (
            visibleGroups.map((group) => (
              <div className="lx-settings-group" key={group.id}>
                <h2 className="lx-settings-group-title">{group.title}</h2>
                {group.categories.map((entry) => {
                  const isOpen = category?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className="lx-settings-link"
                      aria-current={isOpen ? 'page' : undefined}
                      onClick={() => navigate(entry.path)}
                    >
                      <LxIcon
                        name={entry.icon}
                        size={18}
                        color={isOpen ? v.ink : v.ink2}
                        stroke={isOpen ? 1.8 : 1.5}
                      />
                      <span className="lx-settings-link-label">{entry.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="lx-settings-category" ref={regionRef}>
          <button
            type="button"
            className="lx-settings-back"
            onClick={() => navigate(ROUTES.SETTINGS)}
          >
            <LxIcon name="chevronLeft" size={14} color={v.ink2} />
            all settings
          </button>

          {/* Takes focus when the open category changes; not a tab stop itself. */}
          <div ref={headingRef} tabIndex={-1} className="lx-settings-measure">
            {category && CategoryView ? (
              <>
                {category.ownsHeading ? null : (
                  <div className="lx-settings-category-head">
                    <h2 className="lx-settings-heading">{category.label}</h2>
                    {category.description ? (
                      <p className="lx-settings-description">{category.description}</p>
                    ) : null}
                  </div>
                )}
                <CategoryView />
              </>
            ) : (
              <div className="lx-settings-state">
                <LxIcon name={unknown ? 'alert' : 'settings'} size={22} color={v.ink2} />
                <h3>{unknown ? 'that setting has moved' : 'nothing open'}</h3>
                <p>
                  {unknown
                    ? 'the link you followed does not point at a setting any more. pick one from the list.'
                    : 'pick a setting from the list to change it here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
