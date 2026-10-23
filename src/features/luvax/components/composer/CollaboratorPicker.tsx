import { useState } from 'react';

import type { UserSummaryResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

import { LxAvatar, LxBtn } from '../primitives';
import { DialogShell } from './DialogShell';
import { PersonSearch } from './PersonSearch';

/** Mirrors the `max_post_collaborators` setting. */
export const MAX_COLLABORATORS = 3;

/**
 * Chooses the accounts invited to co-author a post.
 *
 * Search offers anyone who is not already invited, and once three are chosen the remaining rows say
 * so. The copy states what the invitation means: co-authors are asked when the post is published,
 * appear on it only after accepting, and the author keeps editing and deleting. Nobody is told
 * anything while the post is a draft.
 */
export function CollaboratorPicker({
  value,
  onDone,
  onClose,
}: {
  value: UserSummaryResponse[];
  onDone: (users: UserSummaryResponse[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<UserSummaryResponse[]>(value);
  const full = draft.length >= MAX_COLLABORATORS;
  const invited = new Set(draft.map((user) => user.id));

  return (
    <DialogShell title="invite collaborators" onClose={onClose} width={480} testId="collab-picker">
      <p style={{ margin: '0 0 12px', fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        Co-authors are asked when you post. They appear on the post only after they accept. You keep
        editing and deleting it.
      </p>

      <PersonSearch
        placeholder="search people to invite"
        onChoose={(user) =>
          setDraft((current) =>
            current.some((entry) => entry.id === user.id) || current.length >= MAX_COLLABORATORS
              ? current
              : [...current, user]
          )
        }
        rowState={(user) =>
          invited.has(user.id)
            ? { badge: 'invited', disabled: true }
            : full
              ? { note: `You can invite up to ${MAX_COLLABORATORS} people`, disabled: true }
              : {}
        }
      />

      {draft.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {draft.map((user) => (
            <li
              key={user.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
            >
              <LxAvatar size={28} src={user.avatarUrl} />
              <span style={{ flex: 1, fontFamily: v.fontBody, fontSize: 14, color: v.ink }}>
                {user.username}
              </span>
              <button
                type="button"
                aria-label={`remove ${user.username}`}
                onClick={() =>
                  setDraft((current) => current.filter((entry) => entry.id !== user.id))
                }
                style={{
                  appearance: 'none',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 4,
                }}
              >
                <LxIcon name="close" size={16} color={v.ink3} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, margin: '14px 0' }}>
        {draft.length} of {MAX_COLLABORATORS} invited
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <LxBtn variant="ghost" type="button" onClick={onClose}>
          cancel
        </LxBtn>
        <LxBtn
          type="button"
          onClick={() => {
            onDone(draft);
            onClose();
          }}
        >
          done
        </LxBtn>
      </div>
    </DialogShell>
  );
}
