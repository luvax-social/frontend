import { useEffect, useRef, useState } from 'react';

import { LxToggle } from '@/components/ui/lx-toggle';
import type { MuteResponse } from '@/types/domain';
import { extractPageContent } from '@/utils/helpers';

import { useMutes, useSetMute, useUnmute } from '../../hooks/useMutes';
import { LxAvatar, LxBtn } from '../primitives';
import { StateBlock } from './settingsParts';

const SAVE_FAILED = "We couldn't save that just now. Try again in a moment.";
const UNMUTE_FAILED = "We couldn't unmute them just now. Try again in a moment.";

/**
 * The muted accounts settings page: every account the viewer muted, with a switch for its posts, a
 * switch for its stories and an unmute button.
 *
 * Each switch saves on change with both values sent, so the row never writes a value the person
 * did not see. Turning off the last switch that was on is an unmute, and the row leaves the list
 * like it does for the unmute button. A refused change puts the row back through the hook's
 * rollback and says so. Focus moves before a row leaves: to the next row, else the previous one,
 * else the empty message, so it is never left on a control that has gone.
 */
export function MutedAccountsCategory() {
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useMutes();
  const [failure, setFailure] = useState('');
  const setMute = useSetMute({ onError: () => setFailure(SAVE_FAILED) });
  const unmute = useUnmute({ onError: () => setFailure(UNMUTE_FAILED) });
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const emptyRef = useRef<HTMLDivElement | null>(null);
  const focusEmptyWhenReached = useRef(false);

  const rows: MuteResponse[] = (data?.pages ?? []).flatMap((page) => extractPageContent(page));

  useEffect(() => {
    if (rows.length === 0 && focusEmptyWhenReached.current) {
      focusEmptyWhenReached.current = false;
      emptyRef.current?.focus();
    }
  }, [rows.length]);

  const moveFocusAwayFrom = (userId: string) => {
    const index = rows.findIndex((row) => row.userId === userId);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    if (!neighbour) {
      focusEmptyWhenReached.current = true;
      return;
    }
    rowRefs.current.get(neighbour.userId)?.querySelector<HTMLElement>('[role="switch"]')?.focus();
  };

  const change = (row: MuteResponse, next: { mutePosts: boolean; muteStories: boolean }) => {
    setFailure('');
    if (!next.mutePosts && !next.muteStories) moveFocusAwayFrom(row.userId);
    setMute.mutate({
      userId: row.userId,
      ...next,
      was: { mutePosts: row.mutePosts, muteStories: row.muteStories },
    });
  };

  const remove = (row: MuteResponse) => {
    setFailure('');
    moveFocusAwayFrom(row.userId);
    unmute.mutate({
      userId: row.userId,
      was: { mutePosts: row.mutePosts, muteStories: row.muteStories },
    });
  };

  // A page that fails to load after the first leaves what is already loaded on screen; only a
  // list that never loaded is replaced by the failure block.
  if (error && !data) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load this"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }
  if (isLoading) return <StateBlock icon="clock" title="loading" />;
  if (rows.length === 0) {
    return (
      <div ref={emptyRef} tabIndex={-1} style={{ outline: 'none' }}>
        <StateBlock
          icon="bellOff"
          title="You haven't muted anyone."
          hint="Mute someone from their profile or a post's menu."
        />
      </div>
    );
  }

  return (
    <div>
      {failure ? (
        <div className="lx-settings-error" role="alert">
          {failure}
        </div>
      ) : null}
      <div className="lx-mute-head" aria-hidden="true">
        <span />
        <span>posts</span>
        <span>stories</span>
        <span />
      </div>
      <ul className="lx-mute-list">
        {rows.map((row) => {
          // A muted account that was deleted since resolves to a placeholder with no username, which
          // is still listed so the mute can be removed.
          const named = Boolean(row.user.username);
          const handle = named
            ? `@${row.user.username}`
            : (row.user.displayName ?? 'deleted account');
          return (
            <li
              key={row.userId}
              className="lx-mute-row"
              ref={(node) => {
                if (node) rowRefs.current.set(row.userId, node);
                else rowRefs.current.delete(row.userId);
              }}
            >
              <div className="lx-mute-who">
                <LxAvatar size={36} src={row.user.avatarUrl} />
                <div className="lx-settings-person-text">
                  <div className="lx-settings-person-name">{handle}</div>
                  {named && row.user.displayName ? (
                    <div className="lx-settings-row-sub">{row.user.displayName}</div>
                  ) : null}
                </div>
              </div>
              <div className="lx-mute-cell">
                <span className="lx-mute-cell-label" aria-hidden="true">
                  posts
                </span>
                <LxToggle
                  label={`mute posts from ${handle}`}
                  on={row.mutePosts}
                  onChange={(value) =>
                    change(row, { mutePosts: value, muteStories: row.muteStories })
                  }
                />
              </div>
              <div className="lx-mute-cell">
                <span className="lx-mute-cell-label" aria-hidden="true">
                  stories
                </span>
                <LxToggle
                  label={`mute stories from ${handle}`}
                  on={row.muteStories}
                  onChange={(value) =>
                    change(row, { mutePosts: row.mutePosts, muteStories: value })
                  }
                />
              </div>
              <LxBtn
                variant="secondary"
                size="sm"
                type="button"
                aria-label={`unmute ${handle}`}
                onClick={() => remove(row)}
              >
                unmute
              </LxBtn>
            </li>
          );
        })}
      </ul>
      {isFetchNextPageError ? (
        <div className="lx-settings-error" role="alert" style={{ marginTop: 16 }}>
          {"We couldn't load more. "}
          <button
            type="button"
            className="lx-settings-textlink"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            try again
          </button>
        </div>
      ) : hasNextPage ? (
        <div style={{ marginTop: 16 }}>
          <LxBtn
            variant="secondary"
            size="sm"
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            show more
          </LxBtn>
        </div>
      ) : null}
    </div>
  );
}
