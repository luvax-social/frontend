import type { UserSummaryView } from '@/types/user';
import { getErrorMessage } from '@/utils/errors';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { LxAvatar, LxBtn } from './primitives';
import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';
import { useAuthStore } from '@/store/useAuthStore';
import { useFollowing } from '../hooks/useSocial';
import { getUserSearchTerms, useUserSearch } from '@/features/search/hooks/useSearch';
import {
  copyPostLink,
  extractPageContent,
  getDisplayName,
  getUserSummary,
  sharePost,
} from '@/utils/helpers';
import { messageService } from '@/services/message.service';
import { toast } from './Toast';

const MAX_SHARE_RECIPIENTS = 10;

export function PostShareDialog({
  open,
  postId,
  onClose,
}: {
  open: boolean;
  postId: string;
  onClose: () => void;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useFollowing(
    currentUser?.id,
    open
  );
  const [sendingTo, setSendingTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set<string | null>());
  const searchTerms = getUserSearchTerms(search);
  const primarySearch = useUserSearch(open ? searchTerms[0] || '' : '');
  const secondarySearch = useUserSearch(open ? searchTerms[1] || '' : '');
  const tertiarySearch = useUserSearch(open ? searchTerms[2] || '' : '');
  const searchResults = [primarySearch, secondarySearch, tertiarySearch].filter((_, index) =>
    Boolean(searchTerms[index])
  );
  const isSearching = search.trim().length > 0;
  const isSearchLoading = searchResults.some((result) => result.isLoading);
  const hasSearchNextPage = searchResults.some((result) => result.hasNextPage);
  const isSearchFetchingNextPage = searchResults.some((result) => result.isFetchingNextPage);

  const friends = useMemo(() => {
    const rows = data?.pages?.flatMap((page) => extractPageContent(page)) || [];
    return rows
      .map((item) => getUserSummary(item, 'user'))
      .filter((user) => user.id && user.id !== currentUser?.id);
  }, [currentUser?.id, data]);

  const searchedUsers = useMemo(() => {
    const seen = new Set<string | null>();
    return searchResults
      .flatMap((result) => result.data?.pages?.flatMap((page) => extractPageContent(page)) || [])
      .map((item) => getUserSummary(item, 'user'))
      .filter((user) => {
        if (!user.id || user.id === currentUser?.id || seen.has(user.id)) return false;
        seen.add(user.id);
        return true;
      });
  }, [currentUser?.id, searchResults]);

  const shownUsers = isSearching ? searchedUsers : friends;
  const selectedUsers = useMemo(() => {
    const seen = new Set<string | null>();
    return [...friends, ...searchedUsers].filter((user) => {
      if (!selectedUserIds.has(user.id) || seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
  }, [friends, searchedUsers, selectedUserIds]);
  const userListLoading = isSearching ? isSearchLoading : isLoading;
  const canLoadMore = isSearching ? hasSearchNextPage : hasNextPage;
  const isLoadingMore = isSearching ? isSearchFetchingNextPage : isFetchingNextPage;
  const loadMore = () => {
    if (isSearching) {
      searchResults.forEach((result) => {
        if (result.hasNextPage) result.fetchNextPage();
      });
      return;
    }
    fetchNextPage();
  };

  useEffect(() => {
    if (!open) {
      const resetId = window.setTimeout(() => {
        setSelectedUserIds(new Set());
        setSearch('');
        setSendingTo('');
      }, 0);
      return () => window.clearTimeout(resetId);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const handleCopy = () => {
    copyPostLink(postId)
      .then(() => toast('link copied'))
      .catch(() => {});
  };

  const handleExternalShare = () => {
    sharePost(postId)
      .then(() => toast('share ready'))
      .catch((error) => {
        if (error?.name !== 'AbortError')
          toast(getErrorMessage(error, '') || 'could not share this post');
      });
  };

  const toggleUser = (userId: string | null) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < MAX_SHARE_RECIPIENTS) next.add(userId);
      else toast(`you can share with up to ${MAX_SHARE_RECIPIENTS} people at once`);
      return next;
    });
  };

  const sendToUser = async (user: UserSummaryView) => {
    const conversation = await messageService.createDirect(user.id!);
    await messageService.sendMessage(conversation.data.id, {
      messageType: 'post_share',
      sharedPostId: postId,
    });
  };

  const handleSendSelected = async () => {
    if (selectedUsers.length === 0 || sendingTo) return;
    setSendingTo('selected');
    try {
      await Promise.all(selectedUsers.map((user) => sendToUser(user)));
      toast(`sent to ${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'}`);
      onClose?.();
    } catch (error) {
      toast(getErrorMessage(error, '') || 'could not share this post');
    } finally {
      setSendingTo('');
    }
  };

  if (typeof document === 'undefined') return null;

  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  const dialog = (
    <>
      <div
        onClick={(event) => {
          event.stopPropagation();
          onClose?.();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ position: 'fixed', inset: 0, background: v.scrim, zIndex: 1900 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="share post"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          top: `calc(50vh / ${zoom})`,
          left: `calc(50vw / ${zoom})`,
          transform: 'translate(-50%, -50%)',
          width: `min(calc((100vw - 32px) / ${zoom}), 460px)`,
          maxHeight: `min(calc((100vh - 56px) / ${zoom}), 620px)`,
          background: v.base,
          border: `1px solid ${v.border}`,
          borderRadius: 14,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          overflow: 'hidden',
          zIndex: 1901,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid ${v.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: v.fontDisplay, fontSize: 17, fontWeight: 700, color: v.ink }}>
            share
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <LxIcon name="close" size={16} color={v.ink3} />
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: `1px solid ${v.border}` }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            <LxBtn
              variant="ghost"
              onClick={handleCopy}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LxIcon name="link" size={15} color={v.ink2} />
              <span>copy link</span>
            </LxBtn>
            <LxBtn
              variant="ghost"
              onClick={handleExternalShare}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <LxIcon name="share" size={15} color={v.ink2} />
              <span>share outside</span>
            </LxBtn>
          </div>
          <form
            onSubmit={(event) => event.preventDefault()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 38,
              marginTop: 10,
              padding: '0 12px',
              border: `1px solid ${v.border}`,
              borderRadius: 999,
              background: v.surfaceSunken,
            }}
          >
            <LxIcon name="explore" size={15} color={v.ink3} />
            <input
              type="search"
              value={search}
              maxLength={64}
              aria-label="search people to share with"
              placeholder="search people"
              onChange={(event) => setSearch(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: v.ink,
                fontFamily: v.fontBody,
                fontSize: 14,
              }}
            />
          </form>
          {selectedUsers.length >= MAX_SHARE_RECIPIENTS ? (
            <div
              style={{
                marginTop: 8,
                fontFamily: v.fontMono,
                fontSize: 10,
                color: v.ink3,
                textAlign: 'center',
              }}
            >
              up to {MAX_SHARE_RECIPIENTS} people at once
            </div>
          ) : null}
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0', minHeight: 180 }}>
          {userListLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: v.ink3 }}>
              {isSearching ? 'searching people...' : 'loading friends...'}
            </div>
          ) : shownUsers.length ? (
            shownUsers.map((user) => {
              const selected = selectedUserIds.has(user.id);
              const capped = !selected && selectedUserIds.size >= MAX_SHARE_RECIPIENTS;

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  disabled={Boolean(sendingTo)}
                  aria-disabled={capped || undefined}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 18px',
                    cursor: sendingTo ? 'default' : capped ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: capped ? 0.55 : 1,
                  }}
                >
                  <LxAvatar size={38} src={user.avatarUrl} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: v.fontBody,
                        fontSize: 14,
                        fontWeight: 700,
                        color: v.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getDisplayName(user)}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: v.fontMono,
                        fontSize: 11,
                        color: v.ink3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      @{user.username}
                    </span>
                  </span>
                  <span
                    style={{
                      minWidth: 25,
                      height: 25,
                      borderRadius: '50%',
                      border: `1px solid ${selected ? v.accent : v.borderStrong}`,
                      background: selected ? v.accent : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? <LxIcon name="check" size={13} color={v.black} /> : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: v.ink3 }}>
              {isSearching ? 'no people found' : 'no friends to share with yet'}
            </div>
          )}
        </div>

        {selectedUsers.length > 0 ? (
          <div style={{ padding: 12, borderTop: `1px solid ${v.border}` }}>
            <LxBtn
              variant="primary"
              onClick={handleSendSelected}
              disabled={Boolean(sendingTo)}
              style={{ width: '100%' }}
            >
              {sendingTo ? 'sending...' : `send to ${selectedUsers.length}`}
            </LxBtn>
          </div>
        ) : null}

        {canLoadMore ? (
          <div style={{ padding: 12, borderTop: `1px solid ${v.border}` }}>
            <LxBtn
              variant="ghost"
              onClick={loadMore}
              disabled={isLoadingMore}
              style={{ width: '100%' }}
            >
              {isLoadingMore ? 'loading...' : 'load more'}
            </LxBtn>
          </div>
        ) : null}
      </div>
    </>
  );

  return createPortal(dialog, document.body);
}
