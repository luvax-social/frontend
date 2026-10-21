import type { Column } from '../components/RecordTable';
import type { AdminHiddenWordResponse } from '@/types/admin';
import { useEffect, useState } from 'react';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';
import { toast } from '@/features/luvax/components/Toast';
import { getErrorMessage, getErrorResponse } from '@/utils/errors';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { RecordTable } from '../components/RecordTable';
import { LoadMore } from '../components/LoadMore';
import { LocalTime } from '../components/LocalTime';
import { HiddenWordForm } from '../components/HiddenWordForm';
import { useHiddenWordActions, useHiddenWordList } from '../hooks/useHiddenWords';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { shortId, useResolveUsername } from '../hooks/useResolveUsername';
import { describeError, getErrorCode } from '../lib/errors';
import { HIDDEN_WORD_INVALID_MESSAGE } from '../lib/hiddenWordPhrase';

type Panel = { mode: 'add' } | { mode: 'edit'; word: AdminHiddenWordResponse };

function AddedBy({ userId }: { userId: string | null }) {
  const { username } = useResolveUsername(userId);
  if (!userId) {
    return <span style={{ color: v.ink2 }}>removed account</span>;
  }
  return <span>{username ?? shortId(userId)}</span>;
}

/**
 * The platform-wide hidden word registry. Administrator only.
 *
 * Words listed here are hidden for every account that keeps the Luvax list on, so each change is
 * an administrative action: create, edit and delete all require a reason, which the backend
 * records on the audit row. The side form carries the reason and shows the normalised form that
 * is actually matched, which makes near-duplicates visible.
 */
export function HiddenWordRegistryScreen() {
  const search = useDebouncedSearch({ minLength: 1 });
  const list = useHiddenWordList(search.term);
  const actions = useHiddenWordActions();

  const [panel, setPanel] = useState<Panel | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);

  useEffect(() => {
    const described = list.isError ? describeError(list.error) : null;
    if (described?.retryAfterSeconds) {
      search.startCooldown(described.retryAfterSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.isError, list.error]);

  const busy = actions.create.isPending || actions.update.isPending || actions.remove.isPending;
  const searching = Boolean(search.term);

  const openPanel = (next: Panel) => {
    setPhraseError(null);
    setPanel(next);
  };

  const closePanel = () => {
    setPhraseError(null);
    setPanel(null);
  };

  const onSuccess = (message: string) => () => {
    toast(message);
    closePanel();
  };

  const onError = (err: unknown) => {
    if (getErrorResponse(err)?.status === 404) {
      toast('That word was already removed.');
      closePanel();
      return;
    }
    const code = getErrorCode(err);
    if (code === 'HIDDEN_WORD_DUPLICATE') {
      setPhraseError('This phrase is already on the list.');
      return;
    }
    if (code === 'HIDDEN_WORD_INVALID') {
      setPhraseError(HIDDEN_WORD_INVALID_MESSAGE);
      return;
    }
    const described = describeError(err);
    if (described.kind !== 'silent') {
      toast(described.message);
    }
  };

  const save = (phrase: string, reason: string) => {
    if (!panel) {
      return;
    }
    setPhraseError(null);
    if (panel.mode === 'add') {
      actions.create.mutate(
        { phrase, reason },
        { onSuccess: onSuccess('Hidden word added.'), onError }
      );
      return;
    }
    actions.update.mutate(
      { id: panel.word.id, phrase, reason },
      { onSuccess: onSuccess('Hidden word updated.'), onError }
    );
  };

  const remove = (reason: string) => {
    if (panel?.mode !== 'edit') {
      return;
    }
    actions.remove.mutate(
      { id: panel.word.id, reason },
      { onSuccess: onSuccess('Hidden word deleted.'), onError }
    );
  };

  const columns: Column<AdminHiddenWordResponse>[] = [
    {
      key: 'phrase',
      header: 'word or phrase',
      render: (row) => (
        <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink, fontWeight: 500 }}>
          {row.phrase}
        </span>
      ),
    },
    {
      key: 'matches',
      header: 'matches',
      render: (row) => (
        <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink2 }}>
          {row.normalizedPhrase}
        </span>
      ),
    },
    {
      key: 'addedBy',
      header: 'added by',
      nowrap: true,
      render: (row) => <AddedBy userId={row.createdBy} />,
    },
    {
      key: 'updated',
      header: 'updated',
      nowrap: true,
      render: (row) => <LocalTime value={row.updatedAt} showZone={false} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          aria-label={`edit ${row.phrase}`}
          onClick={() => openPanel({ mode: 'edit', word: row })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 9px',
            borderRadius: 999,
            background: v.surface,
            border: `1px solid ${v.border}`,
            cursor: 'pointer',
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink2,
          }}
        >
          <LxIcon name="edit" size={12} color={v.ink2} />
          edit
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="hidden words"
        right={
          <LxBtn variant="primary" size="sm" onClick={() => openPanel({ mode: 'add' })}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="plus" size={14} color={v.black} />
              add word
            </span>
          </LxBtn>
        }
      />
      <p
        style={{
          margin: '-8px 0 18px',
          fontFamily: v.fontBody,
          fontSize: 13,
          color: v.ink2,
        }}
      >
        Used for every account that keeps the Luvax list on. Changes apply to new comments and
        requests only.
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <PanelCard padded={false}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderBottom: `1px solid ${v.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                  background: v.surfaceSunken,
                  border: `1px solid ${search.cooling ? v.warning : v.border}`,
                  borderRadius: 999,
                  padding: '8px 14px',
                }}
              >
                <LxIcon name="explore" size={15} color={v.ink2} />
                <input
                  type="text"
                  value={search.text}
                  disabled={search.cooling}
                  aria-label="search words"
                  placeholder={
                    search.cooling
                      ? `Rate limited, searching again in ${search.cooldownRemaining}s`
                      : 'search words'
                  }
                  onChange={(event) => search.setText(event.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontFamily: v.fontBody,
                    fontSize: 14,
                    color: v.ink,
                  }}
                />
                {search.text ? (
                  <button
                    type="button"
                    aria-label="clear search"
                    onClick={search.reset}
                    style={{
                      display: 'inline-flex',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <LxIcon name="close" size={14} color={v.ink2} />
                  </button>
                ) : null}
              </div>
            </div>

            <RecordTable
              columns={columns}
              rows={list.rows}
              selectedKey={panel?.mode === 'edit' ? panel.word.id : null}
              isLoading={list.isLoading}
              isError={list.isError}
              errorMessage={getErrorMessage(list.error, 'Something went wrong.')}
              onRetry={list.refetch}
              emptyIcon="hash"
              emptyTitle={searching ? 'no words match' : 'no hidden words yet'}
              emptyHint={
                searching
                  ? 'No hidden word matches this search.'
                  : 'Add a word or phrase to hide it for every account that keeps the Luvax list on.'
              }
              footer={
                <LoadMore
                  hasNextPage={list.hasNextPage}
                  isFetchingNextPage={list.isFetchingNextPage}
                  onLoadMore={() => list.fetchNextPage()}
                />
              }
            />
          </PanelCard>
        </div>

        {panel ? (
          <HiddenWordForm
            key={panel.mode === 'edit' ? panel.word.id : 'add'}
            word={panel.mode === 'edit' ? panel.word : null}
            busy={busy}
            serverError={phraseError}
            onSave={save}
            onDelete={remove}
            onPhraseEdited={() => setPhraseError(null)}
            onCancel={closePanel}
          />
        ) : null}
      </div>
    </div>
  );
}
