import type { ThreadSummary } from '../utils/messageViewModel';
import type { Viewport } from '@/features/luvax/LuvaxTweaksContext';
import type { ConversationFolder } from '@/types/domain';

interface Props {
  folder: ConversationFolder;
  requestCount: number;
  onSelectFolder: (folder: ConversationFolder) => void;
  /** True until the folder's first page arrives, so an empty folder is not announced early. */
  loading?: boolean;
  search: string;
  setSearch: (value: string) => void;
  filteredThreads: ThreadSummary[];
  activeThreadId: string | null;
  selectThread: (id: string) => void;
  viewport: Viewport;
  isThreadBlocked?: (thread: ThreadSummary) => boolean;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onPinThread?: (id: string) => void;
  onUnpinThread?: (id: string) => void;
  onMuteThread?: (id: string) => void;
  onUnmuteThread?: (id: string) => void;
  onDeleteThread?: (thread: ThreadSummary) => void;
  onReportThread?: (thread: ThreadSummary) => void;
  onBlockThread?: (thread: ThreadSummary) => void;
  onRenameThread?: (thread: ThreadSummary) => void;
}
import { useState } from 'react';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { ConvRow } from './ConvRow';
import { InboxTabs } from './InboxTabs';

export function ConversationListPanel({
  folder,
  requestCount,
  onSelectFolder,
  loading = false,
  search,
  setSearch,
  filteredThreads,
  activeThreadId,
  selectThread,
  viewport,
  onMarkRead,
  onMarkUnread,
  onDeleteThread,
  onReportThread,
  onBlockThread,
  isThreadBlocked,
  onPinThread,
  onUnpinThread,
  onMuteThread,
  onUnmuteThread,
  onRenameThread,
}: Props) {
  const [revealedThreadId, setRevealedThreadId] = useState<string | null>(null);
  const isRequestFolder = folder !== 'primary';

  return (
    <aside
      style={{
        height: '100%',
        minHeight: 0,
        borderRight: viewport === 'mobile' ? 'none' : `1px solid ${v.border}`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: v.base,
      }}
    >
      <div
        style={{
          padding: viewport === 'mobile' ? '8px 14px 9px' : '9px 14px 10px',
          borderBottom: `1px solid ${v.borderSubtle}`,
        }}
      >
        <div
          style={{
            height: viewport === 'mobile' ? 30 : 31,
            borderRadius: 999,
            background: v.surfaceSunken,
            border: `1px solid ${v.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
          }}
        >
          <LxIcon name="explore" size={12} color={v.ink3} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="search"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: v.ink,
              fontFamily: v.fontBody,
              fontSize: 12,
            }}
          />
        </div>
      </div>

      <InboxTabs folder={folder} requestCount={requestCount} onSelectFolder={onSelectFolder} />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isRequestFolder && !loading && filteredThreads.length === 0 ? (
          <div
            style={{
              padding: '22px 14px',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink3,
            }}
          >
            {folder === 'hidden_requests' ? 'No hidden requests.' : 'No message requests.'}
          </div>
        ) : null}
        {filteredThreads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isBlocked = Boolean(isThreadBlocked?.(thread));
          return (
            <ConvRow
              key={thread.id}
              // A request row carries no unread marker: requests never add to an unread count.
              thread={isRequestFolder ? { ...thread, unread: 0, manuallyUnread: false } : thread}
              viewport={viewport}
              revealedOptions={revealedThreadId === thread.id}
              optionsEnabled={!isRequestFolder}
              onRevealOptions={() => setRevealedThreadId(thread.id)}
              onHideOptions={() => setRevealedThreadId(null)}
              isActive={isActive}
              onSelect={() => {
                setRevealedThreadId(null);
                selectThread(thread.id);
              }}
              onMarkRead={() => onMarkRead?.(thread.id)}
              onMarkUnread={() => onMarkUnread?.(thread.id)}
              onDelete={() => onDeleteThread?.(thread)}
              onReport={thread.counterpartId ? () => onReportThread?.(thread) : null}
              onBlock={thread.counterpartId && !isBlocked ? () => onBlockThread?.(thread) : null}
              onPin={() => onPinThread?.(thread.id)}
              onUnpin={() => onUnpinThread?.(thread.id)}
              onMute={() => onMuteThread?.(thread.id)}
              onUnmute={() => onUnmuteThread?.(thread.id)}
              onRename={thread.counterpartId ? () => onRenameThread?.(thread) : null}
            />
          );
        })}
        {isRequestFolder && filteredThreads.length > 0 ? (
          <div
            style={{
              padding: '16px 14px',
              fontFamily: v.fontBody,
              fontSize: 12,
              lineHeight: 1.4,
              color: v.ink3,
            }}
          >
            Requests don&apos;t add to your unread count. They aren&apos;t told you&apos;ve seen
            them.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
