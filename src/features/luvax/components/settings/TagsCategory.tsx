import { useState } from 'react';

import type { TagPermission, TagRequestResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { mediaAltLabel } from '@/utils/mediaAlt';

import { useMySettings, useUpdateMySettings } from '../../hooks/useSettings';
import { useApproveTag, useRemoveTag, useTagRequests } from '../../hooks/usePostPeople';
import { LxAvatar, LxBtn } from '../primitives';
import { toast } from '../Toast';
import { SettingsRadioGroup, type RadioOption } from './SettingsRadioGroup';
import { SettingToggle, StateBlock } from './settingsParts';

const SAVE_FAILED_MESSAGE = "We couldn't save that just now. Try again in a moment.";

const OPTIONS: readonly RadioOption<TagPermission>[] = [
  {
    value: 'everyone',
    label: 'everyone',
    description: 'Anyone can tag you in a photo.',
  },
  {
    value: 'following',
    label: 'people you follow',
    description: 'Only people you follow can tag you. Everyone else is told they cannot.',
  },
  {
    value: 'nobody',
    label: 'no one',
    description: 'No one can tag you. Tags you already have stay until you remove them.',
  },
];

function RequestRow({ request }: { request: TagRequestResponse }) {
  const approve = useApproveTag();
  const remove = useRemoveTag();
  const busy = approve.isPending || remove.isPending;
  const who = request.requestedBy?.username ?? 'someone';

  return (
    <li
      data-testid="tag-request"
      data-post-id={request.postId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: `1px solid ${v.borderSubtle}`,
      }}
    >
      {request.requestedBy ? <LxAvatar size={32} src={request.requestedBy.avatarUrl} /> : null}
      <span style={{ flex: 1, minWidth: 0, fontFamily: v.fontBody, fontSize: 14, color: v.ink }}>
        {who} wants to tag you in a post.
      </span>
      {request.media ? (
        <div
          role="img"
          aria-label={mediaAltLabel(request.media, 0, 1, request.requestedBy)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 6,
            flexShrink: 0,
            background: `url(${request.media.url}) center/cover no-repeat`,
          }}
        />
      ) : null}
      <LxBtn
        size="sm"
        type="button"
        disabled={busy}
        onClick={() =>
          approve.mutate(
            { postId: request.postId, tagId: request.tagId },
            { onError: () => toast("We couldn't approve that tag. Try again.") }
          )
        }
      >
        approve
      </LxBtn>
      <LxBtn
        size="sm"
        variant="ghost"
        type="button"
        disabled={busy}
        onClick={() =>
          remove.mutate(
            { postId: request.postId, tagId: request.tagId },
            { onError: () => toast("We couldn't remove that tag. Try again.") }
          )
        }
      >
        remove
      </LxBtn>
    </li>
  );
}

/**
 * The Tags settings page: who can tag the account, whether tags wait for review, and the tags that
 * are waiting.
 *
 * "Who can tag you" saves on each choice through the shared settings mutation, which shows the
 * choice at once and rolls the cached record back if the server refuses it. The review switch works
 * the same way. The page says what each choice means in a sentence, and what a limit on
 * interactions does to tags, because that effect is silent for the person being tagged.
 * Waiting requests are approved or removed from this list, and each leaves it at once.
 */
export function TagsCategory() {
  const [failure, setFailure] = useState('');
  const settingsQuery = useMySettings();
  const settings = settingsQuery.data?.data;
  const update = useUpdateMySettings({ onError: () => setFailure(SAVE_FAILED_MESSAGE) });
  const requests = useTagRequests();
  const rows = requests.data?.pages.flatMap((page) => page.data.content) ?? [];

  return (
    <div>
      <div className="lx-radio-block">
        <h4 className="lx-radio-block-title">who can tag you</h4>
        <SettingsRadioGroup
          label="who can tag you"
          options={OPTIONS}
          value={settings?.tagPermission}
          disabled={!settings || settingsQuery.isLoading}
          onChange={(tagPermission) => {
            setFailure('');
            update.mutate({ tagPermission });
          }}
        />
        {failure ? (
          <div className="lx-settings-error" role="alert">
            {failure}
          </div>
        ) : null}
      </div>

      <SettingToggle
        settings={settings}
        field="manualTagApproval"
        label="review tags before they appear"
        sub="A tag waits here until you approve it. It stays off your profile until then, and only you and the person who tagged you can see it."
        isLoading={settingsQuery.isLoading}
      />

      <p style={{ margin: '14px 0 22px', fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        Limiting interactions also covers tags. While a limit is on, tags from the people it covers
        wait here without a notification.
      </p>

      <h4 className="lx-radio-block-title" style={{ marginBottom: 4 }}>
        waiting for you
      </h4>
      {requests.isLoading ? (
        <StateBlock icon="clock" title="loading" />
      ) : requests.isError ? (
        <StateBlock icon="alert" title="we could not load your requests" />
      ) : rows.length === 0 ? (
        <StateBlock
          icon="tag"
          title="no tags waiting"
          hint="Tags that need your review appear here."
        />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="tag-requests">
          {rows.map((row) => (
            <RequestRow key={row.tagId} request={row} />
          ))}
        </ul>
      )}
      {requests.hasNextPage ? (
        <div style={{ paddingTop: 12 }}>
          <LxBtn
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => requests.fetchNextPage()}
            disabled={requests.isFetchingNextPage}
          >
            load more
          </LxBtn>
        </div>
      ) : null}
    </div>
  );
}
