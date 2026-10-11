import type { NavigateFunction } from 'react-router-dom';
import type { Viewport } from '@/features/luvax/LuvaxTweaksContext';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { v } from '@/config/tokens';
import { ROUTES, CHAR_LIMITS } from '@/config/constants';
import { LxIcon } from '@/components/ui/lx-icon';

export function LxHeaderSearch({
  navigate,
  viewport,
}: {
  navigate: NavigateFunction;
  viewport: Viewport;
}) {
  // The field mirrors the query in the address bar, so a shared or reloaded
  // search URL shows the terms it searched for.
  const [searchParams] = useSearchParams();
  const activeQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(activeQuery);

  // Adjusted during render rather than in an effect. The field is user-editable, so it cannot be
  // derived outright, but resetting it from an effect meant every address change rendered twice:
  // once with the stale term, then again after the effect committed. Comparing against the last
  // address seen resets it before the browser paints, in one pass.
  const [lastActiveQuery, setLastActiveQuery] = useState(activeQuery);
  if (activeQuery !== lastActiveQuery) {
    setLastActiveQuery(activeQuery);
    setQuery(activeQuery);
  }

  const openSearch = (nextQuery = query, focusSearch = true) => {
    const next = new URLSearchParams();
    if (nextQuery) {
      next.set('q', nextQuery);
    }
    if (focusSearch) {
      next.set('focusSearch', '1');
    }
    next.set('type', 'people');
    const search = next.toString();
    navigate(search ? `${ROUTES.SEARCH}?${search}` : `${ROUTES.SEARCH}?type=people`);
  };

  const submitSearch = () => {
    const nextQuery = query.trim();
    openSearch(nextQuery, false);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}
      className="lx-search-btn"
      style={{
        width: viewport === 'tablet' ? 184 : 206,
        minWidth: 0,
        flexShrink: 0,
        height: viewport === 'tablet' ? 32 : 36,
        padding: '0 14px',
        border: `1px solid ${v.borderSubtle}`,
        borderRadius: 999,
        background: v.surface,
        color: v.ink3,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transform: 'translateY(0px)',
        cursor: 'text',
        fontFamily: v.fontBody,
        fontSize: 13,
        letterSpacing: '-0.01em',
        transition: 'background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
      }}
    >
      <LxIcon name="explore" size={15} color={v.ink3} />
      <input
        type="search"
        value={query}
        maxLength={CHAR_LIMITS.search}
        aria-label="search people"
        placeholder="search"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submitSearch();
            event.currentTarget.blur();
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: v.ink2,
          fontFamily: v.fontBody,
          fontSize: 13,
          letterSpacing: '-0.01em',
        }}
      />
    </form>
  );
}
