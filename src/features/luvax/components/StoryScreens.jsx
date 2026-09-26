import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v } from '@/config/tokens';
import { useViewport } from '../hooks/useViewport';
import { LxIcon, LxAvatar, LxBtn, LxModal } from './primitives';
import {
  useStoryFeed,
  useCreateStory,
  useDeleteStory,
  useRecordStoryView,
  useLikeStory,
} from '../hooks/useStories';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useMediaConstraints } from '../hooks/useMediaConstraints';
import { useAuthStore } from '@/store/useAuthStore';
import { messageService } from '@/services/message.service';
import { rememberSharedStoryMedia } from '@/features/messages/utils/messageViewModel';
import { routeTo, CHAR_LIMITS } from '@/config/constants';
import { buildAcceptAttribute, validateFile, validateDuration } from '../utils/composerMedia';
import { formatRelativeTime } from '../hooks/useRelativeTime';
import { toast } from './Toast';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

const STORY_CARD_RADIUS = 18;
const STORY_RATIO = 9 / 16;
const TEXT_STORY_WIDTH = 1080;
const TEXT_STORY_HEIGHT = 1920;
const IMAGE_STORY_DURATION_MS = 5000;
const HEART_COLOR = 'var(--lx-error)';

// Light frosted chips, matching the post-media carousel controls: legible over
// any image without a dark scrim that competes with the photo underneath.
const CONTROL_BG = 'rgba(255,255,255,0.9)';
const CONTROL_FG = '#1c1a17';
const CONTROL_SHADOW = '0 1px 5px rgba(0,0,0,0.3)';

const wrapCanvasText = (context, text, maxWidth) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      return;
    }

    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines;
};

const createTextStoryFile = (text) =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = TEXT_STORY_WIDTH;
    canvas.height = TEXT_STORY_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('could not create text story.'));
      return;
    }

    context.fillStyle = '#171514';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#d5b882';
    context.fillRect(0, 0, canvas.width, 12);
    context.fillRect(0, canvas.height - 12, canvas.width, 12);

    context.fillStyle = '#fffaf1';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 72px sans-serif';

    const lines = wrapCanvasText(context, text, canvas.width - 160).slice(0, 12);
    const lineHeight = 92;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('could not create text story.'));
        return;
      }
      resolve(new File([blob], `text-story-${Date.now()}.png`, { type: 'image/png' }));
    }, 'image/png');
  });

// A peek shows the immediate neighbour in the sequence - the previous or next
// story that a chevron click, or clicking the peek itself, would jump to. A
// missing neighbour still reserves its column's width (as a CSS calc, since
// height arrives as one too), so the main card never shifts sideways as the
// viewer approaches either end of the sequence.
function StoryPeek({ side, item, onClick, height }) {
  const width = `calc(${height} * ${STORY_RATIO})`;
  if (!item) return <div style={{ width, flexShrink: 0 }} aria-hidden="true" />;
  const { story, entry } = item;
  const isVideo = story.media?.mediaType?.toUpperCase() === 'VIDEO';
  return (
    <button
      onClick={onClick}
      aria-label={`${side === 'left' ? 'previous' : 'next'}: ${entry.userDisplayName || entry.username}'s story`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: STORY_CARD_RADIUS - 4,
          overflow: 'hidden',
          position: 'relative',
          opacity: 0.7,
        }}
      >
        {isVideo ? (
          <video
            src={story.media.cdnUrl}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <img
            src={story.media.cdnUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: v.black40 }} />
      </div>
      <span
        style={{
          fontFamily: v.fontBody,
          fontSize: 12,
          fontWeight: 500,
          color: v.white70,
          maxWidth: width,
        }}
      >
        {entry.userDisplayName || entry.username}
      </span>
      <LxVerifiedBadge verified={entry.isVerified} category={entry.verifiedCategory} size={11} />
    </button>
  );
}

function NavButton({ side, onClick }) {
  if (!onClick) return null;
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={side === 'left' ? 'previous story' : 'next story'}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: 'none',
        flexShrink: 0,
        background: CONTROL_BG,
        boxShadow: CONTROL_SHADOW,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <LxIcon
        name={side === 'left' ? 'chevronLeft' : 'chevronRight'}
        size={18}
        color={CONTROL_FG}
      />
    </button>
  );
}

// ─── Story Stage (shared chrome) ───────────────────────────────────────────
// peeks, when given, render the previous/next story as dimmed side panels
// with a chevron in the gap between each and the main card, matching the
// desktop reference: a contained card with its neighbours visible at a
// glance, rather than a near-fullscreen card with nothing around it.
function StoryStage({ children, onClose, footer, viewport, peeks, height }) {
  const isMobile = viewport === 'mobile';

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: v.black,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {children}
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              position: 'absolute',
              top: 14,
              right: 12,
              zIndex: 5,
              background: v.black35,
              border: 'none',
              cursor: 'pointer',
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LxIcon name="close" size={20} color={v.white} />
          </button>
        </div>
        {footer}
      </div>
    );
  }

  // Contained, not near-fullscreen, so the peeks and chevrons around it have
  // room to read as their own elements rather than crowding the card's edge.
  const cardHeight = height || 'min(80vh, 760px)';
  const cardWidth = `calc(${cardHeight} * ${STORY_RATIO})`;
  const peekHeight = `calc(${cardHeight} * 0.78)`;

  return (
    // Clicking the backdrop closes the viewer; the content wrapper below
    // stops that click from bubbling, so nothing inside - card, peeks,
    // chevrons, reply bar, close button - closes it by accident.
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: v.black78,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        cursor: 'pointer',
      }}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="close"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: v.white12,
          border: 'none',
          cursor: 'pointer',
          width: 38,
          height: 38,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LxIcon name="close" size={20} color={v.white} />
      </button>

      <div onClick={(event) => event.stopPropagation()} style={{ cursor: 'default' }}>
        {/* flex-start, not center: each side box below is exactly cardHeight
            tall and centers its own content within that, so every side lines
            up against the card's own height - never against the taller
            column the reply bar extends below it. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
          {peeks ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', height: cardHeight }}>
                <StoryPeek
                  side="left"
                  item={peeks.prev}
                  onClick={peeks.onPrev}
                  height={peekHeight}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: cardHeight }}>
                <NavButton side="left" onClick={peeks.prev ? peeks.onPrev : null} />
              </div>
            </>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius: STORY_CARD_RADIUS,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: `0 32px 80px ${v.black55}, 0 0 0 1px ${v.white04}`,
              }}
            >
              {children}
            </div>
            {footer && <div style={{ width: cardWidth }}>{footer}</div>}
          </div>

          {peeks ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', height: cardHeight }}>
                <NavButton side="right" onClick={peeks.next ? peeks.onNext : null} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: cardHeight }}>
                <StoryPeek
                  side="right"
                  item={peeks.next}
                  onClick={peeks.onNext}
                  height={peekHeight}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Flattens the story tray into one linear sequence in tray order (own entry
 * first, then each followed author in turn), so next/prev can step through
 * every story of one person and continue straight into the next person's
 * without the caller needing to reopen the viewer.
 */
function useFlatStorySequence() {
  const { tray } = useStoryFeed();
  return useMemo(
    () => tray.flatMap((entry) => entry.stories.map((story) => ({ story, entry }))),
    [tray]
  );
}

// ─── Story View Screen ──────────────────────────────────────────────────────
export function StoryViewScreen({ viewport: vpProp }) {
  const navigate = useNavigate();
  const { storyId } = useParams();
  // Called unconditionally. Short-circuiting on the prop skipped the hook whenever a viewport was
  // passed, so the hook count changed between renders and React misbound every hook after it.
  const measuredViewport = useViewport();
  const vp = vpProp || measuredViewport;
  const currentUser = useAuthStore((state) => state.user);
  const sequence = useFlatStorySequence();
  const recordView = useRecordStoryView();
  const likeStory = useLikeStory();
  const deleteStory = useDeleteStory();
  const [progress, setProgress] = useState(0);
  const [replyDraft, setReplyDraft] = useState('');
  const [heartBurst, setHeartBurst] = useState(false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const videoRef = useRef(null);
  const recordedRef = useRef(null);
  const lastTapRef = useRef(0);

  const currentIndex = sequence.findIndex((item) => item.story.id === storyId);
  const current = currentIndex >= 0 ? sequence[currentIndex] : null;
  const story = current?.story;
  const entry = current?.entry;
  const isVideo = story?.media?.mediaType?.toUpperCase() === 'VIDEO';
  const segmentIndex = entry ? entry.stories.findIndex((s) => s.id === storyId) : 0;
  const segmentCount = entry?.stories.length || 1;
  const isOwnStory = Boolean(entry?.userId && entry.userId === currentUser?.id);

  const close = () => navigate(-1);

  const goTo = (index) => {
    if (index < 0) {
      setProgress(0);
      return;
    }
    if (index >= sequence.length) {
      close();
      return;
    }
    navigate(routeTo.storyView(sequence[index].story.id), { replace: true });
  };

  const next = () => goTo(currentIndex + 1);
  const prev = () => goTo(currentIndex - 1);

  // A story the tray no longer carries (expired, or a stale link) cannot be
  // shown; closing rather than rendering a blank card keeps the viewer from
  // getting stuck on nothing.
  useEffect(() => {
    if (sequence.length > 0 && currentIndex === -1) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence.length, currentIndex]);

  // Records the view once per story shown. The owner's own stories never
  // create a view row server-side, so the call is skipped for them entirely.
  useEffect(() => {
    if (!story || !entry) return;
    if (entry.userId === currentUser?.id) return;
    if (recordedRef.current === story.id) return;
    recordedRef.current = story.id;
    recordView.mutate(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Progress resets on every story change and, for images, advances on a
  // fixed timer. Video stories are driven by the element's own playback via
  // onTimeUpdate/onEnded instead, so the bar tracks real duration exactly.
  useEffect(() => {
    // Resets progress and drives an interval; image story progress is time-based.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
    if (isVideo) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / IMAGE_STORY_DURATION_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(timer);
    }, 80);
    return () => clearInterval(timer);
  }, [story?.id, isVideo]);

  useEffect(() => {
    // NaN-safe by construction: progress < 100 is false for NaN too, which
    // would otherwise fall through to next() before the video's duration is
    // known (onTimeUpdate can fire once with duration still NaN on mount).
    if (!isVideo || !(progress >= 100)) return;
    // Advances the sequence from video playback progress reported by the media element.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, isVideo]);

  if (!story || !entry) {
    return (
      <StoryStage viewport={vp} onClose={close}>
        <div />
      </StoryStage>
    );
  }

  const authorName = entry.userDisplayName || entry.username;

  const handleLikeToggle = () => {
    setHeartBurst(false);
    window.requestAnimationFrame(() => setHeartBurst(true));
    likeStory.mutate({ storyId: story.id, liked: story.liked });
  };

  const handleDelete = () => {
    const fallback = sequence[currentIndex + 1] || sequence[currentIndex - 1] || null;
    deleteStory.mutate(story.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast('story deleted');
        if (fallback) {
          navigate(routeTo.storyView(fallback.story.id), { replace: true });
          return;
        }
        close();
      },
      onError: (error) => {
        toast(error?.message || "couldn't delete that story");
      },
    });
  };

  // Double-tap to like, in the manner of Instagram and matching the same
  // convention as the post feed: a double-tap always likes and never
  // unlikes, and replaying it on an already-liked story just replays the
  // burst. Scoped to a centre zone, separate from the left/right tap zones
  // that navigate, so a quick double-tap there can't also fire two
  // navigations. Unlike the reply bar's heart button, this also pops the
  // big centred heart over the media - the button click alone does not.
  const handleCenterDoubleTap = () => {
    if (vp !== 'mobile') return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (!story.liked) {
        likeStory.mutate({ storyId: story.id, liked: false });
      }
      setHeartBurst(false);
      setShowBigHeart(false);
      window.requestAnimationFrame(() => {
        setHeartBurst(true);
        setShowBigHeart(true);
      });
    } else {
      lastTapRef.current = now;
    }
  };

  const card = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: v.storySurface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isVideo ? (
        <video
          key={story.id}
          ref={videoRef}
          src={story.media.cdnUrl}
          autoPlay
          playsInline
          muted={false}
          className="lx-story-fade-in"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onTimeUpdate={(event) => {
            const el = event.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
          onEnded={next}
        />
      ) : (
        <img
          key={story.id}
          src={story.media.cdnUrl}
          alt=""
          className="lx-story-fade-in"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Progress bar: one segment per story this author currently has active. */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', gap: 4 }}>
        {Array.from({ length: segmentCount }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              background: v.white30,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${i < segmentIndex ? 100 : i === segmentIndex ? progress : 0}%`,
                height: '100%',
                background: v.white,
                transition: i === segmentIndex ? 'width 80ms linear' : 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Author header */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 14,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <LxAvatar size={30} src={entry.userAvatarUrl} />
        <span
          style={{
            fontFamily: v.fontBody,
            fontSize: 13,
            fontWeight: 600,
            color: v.white,
            textShadow: `0 1px 6px ${v.black40}`,
          }}
        >
          {authorName}
        </span>
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 11,
            color: v.white70,
            textShadow: `0 1px 6px ${v.black40}`,
          }}
        >
          {formatRelativeTime(story.createdAt)}
        </span>
        {isOwnStory ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleteStory.isPending}
            aria-label="delete story"
            style={{
              marginLeft: 'auto',
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: v.black35,
              cursor: deleteStory.isPending ? 'default' : 'pointer',
              opacity: deleteStory.isPending ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <LxIcon name="trash" size={16} color={v.white} />
          </button>
        ) : null}
      </div>

      {/* Caption */}
      {story.caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 16,
            right: 16,
            fontFamily: v.fontBody,
            fontSize: 15,
            fontWeight: 500,
            color: v.white,
            textShadow: `0 1px 8px ${v.black55}`,
            lineHeight: 1.35,
            maxHeight: 82,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {story.caption}
        </div>
      )}

      {/* Tap zones: the whole means of navigation on mobile, and a larger
          touch target than the desktop chevrons need no precise aim to hit.
          The centre strip between them is reserved for double-tap-to-like,
          so a quick double-tap there can't also fire two navigations. */}
      <button
        onClick={prev}
        style={{
          position: 'absolute',
          left: 0,
          top: 60,
          bottom: 80,
          width: '30%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="previous"
      />
      <button
        onClick={handleCenterDoubleTap}
        style={{
          position: 'absolute',
          left: '30%',
          top: 60,
          bottom: 80,
          width: '40%',
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
        aria-label="story media"
      />
      <button
        onClick={next}
        style={{
          position: 'absolute',
          right: 0,
          top: 60,
          bottom: 80,
          width: '30%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="next"
      />

      {showBigHeart && (
        <div
          key={`heart-${story.id}`}
          className="lx-story-heart-pop"
          onAnimationEnd={() => setShowBigHeart(false)}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <LxIcon name="heart" size={92} color={HEART_COLOR} filled />
        </div>
      )}

      {vp === 'mobile' && (currentIndex > 0 || currentIndex < sequence.length - 1) ? (
        <>
          {currentIndex > 0 && (
            <button
              onClick={prev}
              aria-label="previous story"
              style={{
                position: 'absolute',
                top: '50%',
                left: 10,
                transform: 'translateY(-50%)',
                width: 34,
                height: 34,
                borderRadius: 999,
                border: 'none',
                background: CONTROL_BG,
                boxShadow: CONTROL_SHADOW,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                zIndex: 5,
              }}
            >
              <LxIcon name="chevronLeft" size={18} color={CONTROL_FG} />
            </button>
          )}
          <button
            onClick={next}
            aria-label="next story"
            style={{
              position: 'absolute',
              top: '50%',
              right: 10,
              transform: 'translateY(-50%)',
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 'none',
              background: CONTROL_BG,
              boxShadow: CONTROL_SHADOW,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              zIndex: 5,
            }}
          >
            <LxIcon name="chevronRight" size={18} color={CONTROL_FG} />
          </button>
        </>
      ) : null}
    </div>
  );

  const handleReplySend = async () => {
    const text = replyDraft.trim();
    if (!text || !entry?.userId || isOwnStory) return;
    setReplyDraft('');

    try {
      rememberSharedStoryMedia(story);
      // Resolve-or-create: a direct-conversation pair key means replying to the same author twice
      // reuses the existing thread rather than forking it.
      const conversation = await messageService.createDirect(entry.userId);
      await messageService.sendMessage(conversation.data.id, {
        messageType: 'story_share',
        content: text,
        sharedStoryId: story.id,
      });
      toast(`sent to ${authorName}`);
    } catch (error) {
      // The reply bar is a side affordance on a viewer. A failed send must not close it or take
      // the story down with it, so the draft is reported rather than thrown.
      toast(error?.message || 'could not send your reply');
    }
  };

  const replyBar = isOwnStory ? null : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: vp === 'mobile' ? '12px 16px 18px' : 0,
        background: vp === 'mobile' ? v.black : 'transparent',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          background: v.white08,
          border: `1px solid ${v.white18}`,
          borderRadius: 999,
          padding: '9px 16px',
        }}
      >
        <input
          value={replyDraft}
          onChange={(event) => setReplyDraft(event.target.value.slice(0, CHAR_LIMITS.message))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleReplySend();
          }}
          placeholder={`reply to ${authorName}...`}
          style={{
            flex: 1,
            fontFamily: v.fontBody,
            fontSize: 13.5,
            color: v.white,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
        />
      </div>
      <button
        onClick={handleLikeToggle}
        aria-label={story.liked ? 'unlike' : 'like'}
        className={`lx-heart-button ${heartBurst ? 'is-liked' : ''}`}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          flexShrink: 0,
          background: v.white08,
          border: `1px solid ${v.white18}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="lx-heart-icon" style={{ display: 'inline-flex' }}>
          <LxIcon
            name="heart"
            size={18}
            color={story.liked ? HEART_COLOR : v.white}
            filled={story.liked}
          />
        </span>
      </button>
      <button
        onClick={handleReplySend}
        disabled={!replyDraft.trim()}
        aria-label="send reply"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          flexShrink: 0,
          background: v.white08,
          border: `1px solid ${v.white18}`,
          cursor: replyDraft.trim() ? 'pointer' : 'default',
          opacity: replyDraft.trim() ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LxIcon name="send" size={18} color={v.white} />
      </button>
    </div>
  );

  const prevItem = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const nextItem = currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;

  return (
    <>
      <StoryStage
        viewport={vp}
        onClose={close}
        footer={replyBar}
        peeks={
          vp === 'mobile' ? null : { prev: prevItem, next: nextItem, onPrev: prev, onNext: next }
        }
      >
        {card}
      </StoryStage>
      <LxModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="delete story"
        actions={
          <>
            <LxBtn variant="ghost" onClick={() => setConfirmDelete(false)}>
              cancel
            </LxBtn>
            <LxBtn variant="danger" onClick={handleDelete} disabled={deleteStory.isPending}>
              {deleteStory.isPending ? 'deleting...' : 'delete'}
            </LxBtn>
          </>
        }
      >
        This story will be removed from your profile and story tray.
      </LxModal>
    </>
  );
}

// ─── Story Composer Screen ──────────────────────────────────────────────────
export function StoryComposerScreen({ viewport: vpProp }) {
  const navigate = useNavigate();
  // See StoryViewScreen: the hook must run on every render regardless of the prop.
  const measuredViewport = useViewport();
  const vp = vpProp || measuredViewport;
  const fileInputRef = useRef(null);
  const [composeMode, setComposeMode] = useState('media');
  const [item, setItem] = useState(null);
  const [textStory, setTextStory] = useState('');
  const [caption, setCaption] = useState('');
  const [formError, setFormError] = useState('');

  const { uploadMedia, getMediaMetadata, isUploading } = useMediaUpload();
  const { constraints } = useMediaConstraints();
  const createStory = useCreateStory();
  const chooserWidth = 'min(380px, calc(100% - 48px))';

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setFormError('');

    const check = validateFile(file, constraints);
    if (!check.ok) {
      setFormError(check.message);
      return;
    }
    const metadata = await getMediaMetadata(file).catch(() => null);
    const durationCheck = validateDuration(file, metadata?.duration, constraints);
    if (!durationCheck.ok) {
      setFormError(durationCheck.message);
      return;
    }

    if (item) URL.revokeObjectURL(item.previewUrl);
    setItem({
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
    });
  };

  const canShare =
    (composeMode === 'media' ? Boolean(item) : Boolean(textStory.trim())) &&
    !isUploading &&
    !createStory.isPending;

  const handleShare = async () => {
    if (!canShare) return;
    setFormError('');
    try {
      const file =
        composeMode === 'media' ? item.file : await createTextStoryFile(textStory.trim());
      const asset = await uploadMedia(file);
      createStory.mutate(
        {
          mediaId: asset.id,
          caption:
            composeMode === 'media' ? caption.trim() || null : textStory.trim().slice(0, 140),
        },
        {
          onSuccess: () => {
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            navigate(-1);
          },
          onError: (error) => {
            setFormError(error.message || "we couldn't share that story. try again.");
          },
        }
      );
    } catch (error) {
      setFormError(error?.uploadMessage || "we couldn't upload that file. try again.");
    }
  };

  const card = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: v.storySurface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {item ? (
        <>
          {item.isVideo ? (
            <video
              src={item.previewUrl}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src={item.previewUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="choose a different file"
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              background: v.black35,
              border: 'none',
              cursor: 'pointer',
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LxIcon name="image" size={16} color={v.white} />
          </button>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value.slice(0, CHAR_LIMITS.caption))}
            placeholder="add a caption..."
            style={{
              position: 'absolute',
              bottom: 20,
              left: 16,
              right: 16,
              fontFamily: v.fontBody,
              fontSize: 15,
              fontWeight: 500,
              color: v.white,
              textShadow: `0 1px 8px ${v.black55}`,
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
        </>
      ) : (
        <div
          style={{
            color: v.white65,
            fontFamily: v.fontBody,
            textAlign: 'center',
            width: chooserWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 14,
          }}
        >
          <div
            style={{
              width: '100%',
              boxSizing: 'border-box',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: 4,
              borderRadius: 999,
              background: v.black35,
            }}
          >
            {[
              ['media', 'media'],
              ['text', 'text'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setComposeMode(mode);
                  setFormError('');
                }}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '9px 12px',
                  background: composeMode === mode ? v.accent : 'transparent',
                  color: composeMode === mode ? v.ink : v.white65,
                  fontFamily: v.fontBody,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {composeMode === 'media' ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'none',
                border: `1px dashed ${v.white35}`,
                borderRadius: 16,
                cursor: 'pointer',
                color: v.white65,
                fontFamily: v.fontBody,
                fontSize: 14,
                minHeight: 170,
                padding: '34px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LxIcon name="image" size={48} color={v.white45} />
              <div style={{ marginTop: 12 }}>tap to add a photo or video</div>
            </button>
          ) : (
            <textarea
              value={textStory}
              onChange={(event) => setTextStory(event.target.value.slice(0, 280))}
              placeholder="type your story..."
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 170,
                height: 170,
                resize: 'none',
                border: `1px solid ${v.white20}`,
                borderRadius: 16,
                background: v.black35,
                color: v.white,
                fontFamily: v.fontBody,
                fontSize: 22,
                lineHeight: 1.35,
                padding: '58px 18px 18px',
                outline: 'none',
                textAlign: 'center',
              }}
            />
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={buildAcceptAttribute(constraints)}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
    </div>
  );

  const controls = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: vp === 'mobile' ? '14px 16px 20px' : '8px 0 0',
        background: vp === 'mobile' ? v.black : 'transparent',
      }}
    >
      {formError ? (
        <div
          role="alert"
          style={{ fontFamily: v.fontBody, fontSize: 12, color: v.error, textAlign: 'center' }}
        >
          {formError}
        </div>
      ) : null}
      <button
        onClick={handleShare}
        disabled={!canShare}
        style={{
          width: '100%',
          fontFamily: v.fontBody,
          fontSize: 14,
          fontWeight: 600,
          background: canShare ? v.accent : v.white12,
          color: canShare ? v.ink : v.white40,
          border: 'none',
          borderRadius: 999,
          padding: '12px 20px',
          cursor: canShare ? 'pointer' : 'default',
        }}
      >
        {isUploading ? 'uploading...' : createStory.isPending ? 'sharing...' : 'share to story'}
      </button>
    </div>
  );

  return (
    <StoryStage
      viewport={vp}
      onClose={() => navigate(-1)}
      footer={controls}
      height="min(72vh, 680px)"
    >
      {card}
    </StoryStage>
  );
}
