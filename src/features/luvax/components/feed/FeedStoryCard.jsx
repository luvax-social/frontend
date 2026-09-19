import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { REPORT_TYPES } from '@/services/report.service';
import { messageService } from '@/services/message.service';
import { rememberSharedStoryMedia } from '@/features/messages/utils/messageViewModel';

import { useOverlayNavigate } from '../../hooks/useOverlayNavigate';
import { useRelativeTime } from '../../hooks/useRelativeTime';
import { useLikeStory } from '../../hooks/useStories';
import { LxIcon } from '../primitives';
import { ReportModal } from '../ReportModal';
import { toast } from '../Toast';

/** How long one story holds the frame before the card advances to the author's next. */
const ADVANCE_MS = 5000;

/**
 * One author's stories, rendered in the feed with the shape and affordances of a post.
 *
 * The card carries a single author rather than a rail of many, which is what lets it be a block
 * the reader consumes in place instead of a menu they pick from. The feed places several of these,
 * each with a different author, so variety comes from the spacing between them rather than from
 * packing the surface.
 *
 * It stays identifiable as a story rather than a post through the segment bar over the media, the
 * ring on the avatar, and the portrait crop. What it borrows from the post is the chrome: an author
 * header, and a footer carrying like and reply, so the reader can act on it without opening
 * anything.
 *
 * Playback pauses whenever the full-screen viewer is open, because two stories advancing at once is
 * two timelines competing for the same attention. The tab being hidden pauses it for the same
 * reason.
 *
 * @param {Object} entry - One tray entry from `useStoryDiscovery`.
 * @param {string} [viewport] - `mobile` tightens the horizontal inset.
 * @param {Function} onDismiss - Removes the story card type for this session.
 */
export function FeedStoryCard({ entry, viewport = 'desktop', onDismiss }) {
  const isMobile = viewport === 'mobile';
  const openOverlay = useOverlayNavigate();
  const location = useLocation();
  const likeStory = useLikeStory();
  const [index, setIndex] = useState(0);
  const [replyDraft, setReplyDraft] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const videoRef = useRef(null);

  const stories = entry?.stories ?? [];
  const story = stories[Math.min(index, Math.max(stories.length - 1, 0))];
  const authorName = entry?.userDisplayName || entry?.username || '';
  const postedAt = useRelativeTime(story?.createdAt);

  // The viewer is an overlay on this same feed, so its address is the signal that something else
  // now owns playback. Reading the location avoids any cross-component channel for what is really
  // one question: is a story open on top of me.
  const viewerOpen = location.pathname.startsWith('/app/stories/');

  useEffect(() => {
    if (!story || stories.length < 2 || viewerOpen) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % stories.length), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [story, stories.length, viewerOpen, index]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (viewerOpen) node.pause();
    else node.play().catch(() => {});
  }, [viewerOpen, story?.id]);

  if (!entry || stories.length === 0 || !story) return null;

  const media = story.media ?? {};
  const isVideo = Boolean(media.cdnUrl) && story.storyType === 'video';
  const inset = isMobile ? 14 : 4;

  const open = () => openOverlay(routeTo.storyView(story.id));

  const sendReply = async () => {
    const text = replyDraft.trim();
    if (!text || !entry.userId) return;
    setReplyDraft('');
    try {
      rememberSharedStoryMedia(story);
      // Resolve-or-create, the same path the full viewer uses: replying to one author twice reuses
      // the existing thread rather than forking it.
      const conversation = await messageService.createDirect(entry.userId);
      await messageService.sendMessage(conversation.data.id, {
        messageType: 'story_share',
        content: text,
        sharedStoryId: story.id,
      });
      toast(`sent to ${authorName}`);
    } catch (error) {
      // A failed send must not take the card down with it, so the draft is reported rather than
      // thrown; the reader keeps the story and can try again.
      toast(error?.message || 'could not send your reply');
    }
  };

  return (
    <section aria-label={`story by ${authorName}`} style={{ background: v.base }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: `12px ${inset}px 10px`,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            padding: 2,
            boxSizing: 'border-box',
            background: v.accent,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: `2px solid ${v.base}`,
              boxSizing: 'border-box',
              background: entry.userAvatarUrl
                ? `url(${entry.userAvatarUrl}) center/cover no-repeat`
                : v.surfaceSunken,
            }}
          />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 13,
              fontWeight: 600,
              color: v.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {authorName}
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 11, color: v.ink2 }}>
            {/* Says it is a story rather than a post, without the card needing a label of its own. */}
            story {postedAt ? `· ${postedAt}` : ''}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Report story by ${authorName}`}
          onClick={() =>
            setReportTarget({
              entityType: REPORT_TYPES.STORY,
              entityId: story.id,
              author: authorName,
              avatarUrl: entry.userAvatarUrl,
            })
          }
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            color: v.ink2,
          }}
        >
          <LxIcon name="more" size={16} color={v.ink2} />
        </button>
        <button
          type="button"
          aria-label="Dismiss story suggestions"
          onClick={onDismiss}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <LxIcon name="close" size={13} color={v.ink2} />
        </button>
      </div>

      <button
        type="button"
        onClick={open}
        aria-label={`Open ${authorName}'s story`}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          // Portrait, so it reads as a story at a glance against the square and landscape media of
          // the posts around it. Capped so a tall story cannot push the next post off the screen.
          aspectRatio: '4 / 5',
          maxHeight: 520,
          overflow: 'hidden',
          background: media.cdnUrl
            ? `url(${media.cdnUrl}) center/cover no-repeat`
            : v.surfaceSunken,
        }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={media.cdnUrl}
            muted
            playsInline
            loop
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        <span
          data-testid={`story-segments-${entry.userId}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            gap: 3,
            zIndex: 2,
          }}
        >
          {stories.map((item, i) => (
            <i
              key={item.id}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 2,
                background: i <= index ? v.white : v.white45,
              }}
            />
          ))}
        </span>
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: `10px ${inset}px 4px`,
        }}
      >
        <button
          type="button"
          aria-label={story.liked ? 'Unlike story' : 'Like story'}
          aria-pressed={Boolean(story.liked)}
          onClick={() => likeStory.mutate({ storyId: story.id, liked: Boolean(story.liked) })}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* One heart glyph, coloured for state. There is no filled variant in the icon set;
              PostCard gets its fill from the lx-heart-button class rather than a second icon. */}
          <LxIcon name="heart" size={20} color={story.liked ? v.error : v.ink} />
        </button>
        <input
          value={replyDraft}
          onChange={(event) => setReplyDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') sendReply();
          }}
          placeholder={`reply to ${authorName}`}
          aria-label={`Reply to ${authorName}`}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 36,
            background: v.surfaceSunken,
            border: `1px solid ${v.border}`,
            borderRadius: 999,
            padding: '8px 14px',
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink,
            outline: 'none',
          }}
        />
        <button
          type="button"
          aria-label="Send reply"
          disabled={!replyDraft.trim()}
          onClick={sendReply}
          style={{
            width: 36,
            height: 36,
            border: 'none',
            background: 'none',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: replyDraft.trim() ? 'pointer' : 'default',
            opacity: replyDraft.trim() ? 1 : 0.4,
          }}
        >
          <LxIcon name="send" size={18} color={v.ink} />
        </button>
      </div>

      {reportTarget ? (
        <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
      ) : null}
    </section>
  );
}

export default FeedStoryCard;
