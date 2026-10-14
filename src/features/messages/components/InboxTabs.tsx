import type { CSSProperties } from 'react';

import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';
import type { ConversationFolder } from '@/types/domain';

interface Props {
  folder: ConversationFolder;
  /** Server-owned count of pending, visible requests; zero renders no badge. */
  requestCount: number;
  onSelectFolder: (folder: ConversationFolder) => void;
}

const tabStyle = (selected: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 0',
  marginRight: 18,
  background: 'none',
  border: 'none',
  borderBottom: `2px solid ${selected ? v.accent : 'transparent'}`,
  color: selected ? v.ink : v.ink3,
  fontFamily: v.fontBody,
  fontSize: 13,
  fontWeight: selected ? 600 : 400,
  cursor: 'pointer',
});

const countStyle: CSSProperties = {
  minWidth: 16,
  height: 16,
  padding: '0 5px',
  borderRadius: 999,
  background: v.accent,
  color: v.black,
  fontFamily: v.fontBody,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: '16px',
  textAlign: 'center',
  boxSizing: 'border-box',
};

/**
 * The primary and requests tabs above the conversation list.
 *
 * Only the requests tab carries a number. The hidden requests folder is reached through a row
 * under the requests tab and never shows a count, so a request filtered out by the recipient's
 * hidden words or interaction limits is not advertised.
 */
export function InboxTabs({ folder, requestCount, onSelectFolder }: Props) {
  const requestsSelected = folder !== 'primary';
  return (
    <div>
      <div
        role="tablist"
        aria-label="inbox folders"
        style={{ display: 'flex', padding: '0 14px', borderBottom: `1px solid ${v.borderSubtle}` }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={!requestsSelected}
          onClick={() => onSelectFolder('primary')}
          style={tabStyle(!requestsSelected)}
        >
          primary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={requestsSelected}
          onClick={() => onSelectFolder('requests')}
          style={tabStyle(requestsSelected)}
        >
          requests
          {requestCount > 0 ? <span style={countStyle}>{requestCount}</span> : null}
        </button>
      </div>

      {folder === 'requests' ? (
        <button
          type="button"
          onClick={() => onSelectFolder('hidden_requests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: 'calc(100% - 28px)',
            margin: '10px 14px 4px',
            padding: '10px 12px',
            borderRadius: 12,
            border: 'none',
            background: v.surface,
            color: v.ink,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <LxIcon name="eye" size={16} color={v.ink2} />
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: v.fontBody, fontSize: 13, fontWeight: 600 }}>
              hidden requests
            </span>
            <span style={{ fontFamily: v.fontBody, fontSize: 11.5, color: v.ink3 }}>
              Requests that matched your hidden words or limits
            </span>
          </span>
          <LxIcon name="chevronRight" size={12} color={v.ink3} />
        </button>
      ) : null}

      {folder === 'hidden_requests' ? (
        <button
          type="button"
          onClick={() => onSelectFolder('requests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '10px 14px 4px',
            padding: 0,
            border: 'none',
            background: 'none',
            color: v.ink2,
            fontFamily: v.fontBody,
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          <LxIcon name="chevronLeft" size={12} color={v.ink2} />
          hidden requests
        </button>
      ) : null}
    </div>
  );
}
