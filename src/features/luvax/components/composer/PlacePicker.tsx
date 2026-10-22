import { useState } from 'react';

import type { PlaceSummaryResponse } from '@/types/domain';
import { CHAR_LIMITS } from '@/config/constants';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { placeService } from '@/services/place.service';
import { getApiErrorCode, getErrorMessage } from '@/utils/errors';
import { normalizeName } from '@/utils/textMatch';

import { LxBtn } from '../primitives';
import { usePlaceSearch } from '../../hooks/usePlaces';
import { DialogShell } from './DialogShell';

/**
 * Chooses the place of a post.
 *
 * Search runs as the person types. The row that adds the typed name comes last and is offered only
 * when no result already has the same normalised name, so "da nang" never offers to create a second
 * "Da Nang". Adding resolves the name against the registry first, which returns the existing place
 * for a repeat and refuses a name an administrator removed with "That place is not available.", so
 * a removed place is never recreated and the post is never sent with it.
 */
export function PlacePicker({
  value,
  onChoose,
  onRemove,
  onClose,
}: {
  value: PlaceSummaryResponse | null;
  onChoose: (place: PlaceSummaryResponse) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [selected, setSelected] = useState<PlaceSummaryResponse | null>(value);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState('');
  const search = usePlaceSearch(query);

  const typed = query.trim().replace(/\s+/g, ' ');
  const results = search.data?.data.content ?? [];
  const typedKey = normalizeName(typed);
  const alreadyListed = results.some((place) => normalizeName(place.name) === typedKey);
  const canAdd = typedKey.length > 0 && typed.length >= 2 && !alreadyListed;

  const choose = (place: PlaceSummaryResponse) => {
    setProblem('');
    setSelected(place);
  };

  const addTyped = async () => {
    if (adding || !canAdd) return;
    setAdding(true);
    setProblem('');
    try {
      const created = await placeService.createPlace(typed);
      choose({ id: created.data.id, name: created.data.name });
    } catch (error) {
      const code = getApiErrorCode(error);
      setProblem(
        code === 'POST_PLACE_UNAVAILABLE' || code === 'PLACE_UNAVAILABLE'
          ? 'That place is not available.'
          : getErrorMessage(error, "We couldn't add that place. Try again.")
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <DialogShell title="add location" onClose={onClose} width={480} testId="place-picker">
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          background: v.surfaceSunken,
          border: `1px solid ${v.border}`,
          borderRadius: 999,
        }}
      >
        <LxIcon name="explore" size={16} color={v.ink3} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value.slice(0, CHAR_LIMITS.placeName));
            setProblem('');
          }}
          placeholder="search places"
          aria-label="search places"
          autoFocus
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink,
          }}
        />
      </label>

      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
        {results.map((place) => {
          const active = selected?.id === place.id;
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose({ id: place.id, name: place.name })}
                aria-pressed={active}
                data-place={place.name}
                style={{
                  appearance: 'none',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 8px',
                  background: active ? v.surface : 'none',
                  border: 'none',
                  borderRadius: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <LxIcon name="mapPin" size={18} color={v.ink2} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: v.fontBody,
                      fontSize: 14,
                      fontWeight: 500,
                      color: v.ink,
                    }}
                  >
                    {place.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: v.fontBody,
                      fontSize: 12,
                      color: v.ink3,
                    }}
                  >
                    {place.postCount.toLocaleString('en-US')}{' '}
                    {place.postCount === 1 ? 'post' : 'posts'}
                  </span>
                </span>
                {active ? <LxIcon name="check" size={16} color={v.accentText} /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {canAdd ? (
        <div style={{ borderTop: `1px solid ${v.border}`, marginTop: 6, paddingTop: 6 }}>
          <button
            type="button"
            onClick={addTyped}
            disabled={adding}
            style={{
              appearance: 'none',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 8px',
              background: 'none',
              border: 'none',
              borderRadius: 8,
              textAlign: 'left',
              cursor: adding ? 'default' : 'pointer',
            }}
          >
            <LxIcon name="plus" size={18} color={v.ink2} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  fontWeight: 500,
                  color: v.ink,
                }}
              >
                Add &ldquo;{typed}&rdquo;
              </span>
              <span
                style={{ display: 'block', fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}
              >
                Places are shared. Other people can use the name you add.
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" style={{ margin: '10px 8px 0', fontSize: 13, color: v.errorText }}>
          {problem}
        </p>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
        <LxBtn
          variant="ghost"
          type="button"
          onClick={() => {
            onRemove();
            onClose();
          }}
          disabled={!value}
        >
          remove location
        </LxBtn>
        <LxBtn
          type="button"
          disabled={!selected}
          onClick={() => {
            if (selected) onChoose(selected);
            onClose();
          }}
        >
          done
        </LxBtn>
      </div>
    </DialogShell>
  );
}
