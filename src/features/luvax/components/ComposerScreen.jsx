import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES, CHAR_LIMITS } from '@/config/constants';
import { v } from '@/config/tokens';
import { LxDivider, LxIcon, LxTag } from './primitives';
import { ComposerAttachments } from './ComposerAttachments';
import { useCreatePost } from '../hooks/usePosts';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useMediaConstraints } from '../hooks/useMediaConstraints';
import { useLuvaxTweaks } from '../LuvaxTweaksContext';
import { useHashtagSearch } from '@/features/search/hooks/useSearch';
import { useTrendingHashtags } from '../hooks/useHashtag';
import { extractPageContent } from '@/utils/helpers';
import {
  MAX_CAROUSEL_ITEMS,
  buildAcceptAttribute,
  buildHelperText,
  derivePostType,
  isVideoFile,
  moveItem,
  validateDuration,
  validateFile,
} from '../utils/composerMedia';

const MAX_CHARS = 280;

const clampCaption = (value) => value.slice(0, MAX_CHARS);

const SUBMIT_LABEL = {
  TEXT: 'post text',
  IMAGE: 'post photo',
  VIDEO: 'post video',
};

export function ComposerScreen() {
  const navigate = useNavigate();
  const { viewport } = useLuvaxTweaks();
  const [caption, setCaption] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [items, setItems] = useState([]);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  const { uploadMedia, getMediaMetadata } = useMediaUpload();
  const { constraints } = useMediaConstraints();

  const captionTags = useMemo(() => {
    const matches = caption.match(/#(\w+)/g) || [];
    return matches.map((match) => match.slice(1).toLowerCase());
  }, [caption]);

  const allTags = Array.from(new Set([...captionTags, ...selectedTags]));
  const hashtagQuery = useMemo(() => {
    const active = caption.match(/#([A-Za-z0-9_]{1,40})$/);
    return (
      active?.[1] ||
      caption
        .trim()
        .split(/\s+/)
        .find((word) => word.length >= 2) ||
      ''
    );
  }, [caption]);
  const hashtagResult = useHashtagSearch(hashtagQuery);
  // Two states of one surface, not two surfaces: suggestions while the caption has nothing to
  // search on, live search results the moment it does. The idle query is only issued in the idle
  // state, so typing does not keep a second request in flight behind the one being read.
  const isIdle = hashtagQuery.length === 0;
  const idleResult = useTrendingHashtags('for-you', 8, isIdle);
  const hashtagSuggestions = useMemo(() => {
    const searched = (hashtagResult.data?.pages?.flatMap((page) => extractPageContent(page)) || [])
      .filter((tag) => tag?.name && !allTags.includes(String(tag.name).toLowerCase()))
      .slice(0, 5);
    if (!isIdle || searched.length > 0) return searched;
    return (idleResult.data?.data?.content || [])
      .filter((tag) => tag?.name && !allTags.includes(String(tag.name).toLowerCase()))
      .map((tag) => ({ id: tag.hashtagId, name: tag.name }))
      .slice(0, 5);
  }, [allTags, hashtagResult.data, idleResult.data, isIdle]);

  const handleCaptionChange = (value) => {
    setCaption(clampCaption(value));
  };

  const makeItem = (file) => ({
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    isVideo: isVideoFile(file),
    status: 'pending',
    progress: 0,
    assetId: null,
    error: null,
  });

  /**
   * Files are added to what is already attached rather than replacing it, so a
   * second trip to the picker never costs the person the first selection.
   */
  const handleFilesSelected = async (event) => {
    const selected = Array.from(event.target.files || []);
    // Cleared immediately so choosing the same file again still fires a change.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (selected.length === 0) return;
    setFormError('');

    const room = MAX_CAROUSEL_ITEMS - items.length;
    if (room <= 0) {
      setFormError(`a post holds ${MAX_CAROUSEL_ITEMS} items at most. remove one to add another.`);
      return;
    }

    let rejection = '';
    if (selected.length > room) {
      rejection = `a post holds ${MAX_CAROUSEL_ITEMS} items at most, so ${room} of the ${selected.length} you chose were added.`;
    }

    const accepted = [];
    for (const file of selected.slice(0, room)) {
      const check = validateFile(file, constraints);
      if (!check.ok) {
        rejection = check.message;
        continue;
      }
      // The server bounds only the duration the client declares, so a file the
      // composer never measures is a file nothing checks.
      const metadata = await getMediaMetadata(file).catch(() => null);
      const durationCheck = validateDuration(file, metadata?.duration, constraints);
      if (!durationCheck.ok) {
        rejection = durationCheck.message;
        continue;
      }
      accepted.push(makeItem(file));
    }

    if (rejection) setFormError(rejection);
    if (accepted.length > 0) setItems((current) => [...current, ...accepted]);
  };

  const patchItem = (id, patch) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setFormError('');
  };

  const moveAttachment = (id, direction) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      return index < 0 ? current : moveItem(current, index, index + direction);
    });
  };

  const uploadOne = async (item) => {
    patchItem(item.id, { status: 'uploading', progress: 0, error: null });
    try {
      const asset = await uploadMedia(item.file, {
        onProgress: (percent) => patchItem(item.id, { progress: percent }),
      });
      patchItem(item.id, { status: 'done', progress: 100, assetId: asset.id });
      return asset.id;
    } catch (err) {
      // The file stays attached. Every failure the server reports can be
      // retried with the same file, so dropping it would make the person find
      // it again and would take the other attachments and the caption with it.
      patchItem(item.id, {
        status: 'failed',
        progress: 0,
        error: err?.uploadMessage || 'upload failed',
      });
      return null;
    }
  };

  const retryItem = async (id) => {
    const target = items.find((item) => item.id === id);
    if (target) {
      setFormError('');
      await uploadOne(target);
    }
  };

  const createPostMutation = useCreatePost();

  const postType = derivePostType(items);
  const isUploading = items.some((item) => item.status === 'uploading');

  const handlePost = async () => {
    setFormError('');
    if (createPostMutation.isPending || isUploading) return;

    // Captured once, because this list is both the upload set and the order
    // the post is created in. Submitting is blocked while uploads run, so it
    // cannot change underneath this.
    const ordered = items;
    const trimmedCaption = caption.trim();
    if (postType === 'TEXT' && !trimmedCaption) {
      setFormError('text posts need something written first.');
      return;
    }
    const assetIds = new Map(
      ordered.filter((item) => item.status === 'done').map((item) => [item.id, item.assetId])
    );

    const pending = ordered.filter((item) => item.status !== 'done');
    if (pending.length > 0) {
      const results = await Promise.all(
        pending.map(async (item) => [item.id, await uploadOne(item)])
      );
      results.forEach(([id, assetId]) => assetIds.set(id, assetId));

      if (results.some(([, assetId]) => !assetId)) {
        setFormError(
          pending.length === 1
            ? "that file didn't upload. retry it or remove it, then post again."
            : "some files didn't upload. retry or remove them, then post again."
        );
        return;
      }
    }

    const mediaIds = ordered.map((item) => assetIds.get(item.id)).filter(Boolean);
    const payload = {
      caption: postType === 'TEXT' ? trimmedCaption : caption,
      postType,
      ...(mediaIds.length > 0 ? { mediaIds } : {}),
    };

    createPostMutation.mutate(payload, {
      onSuccess: () => {
        ordered.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setCaption('');
        setItems([]);
        setSelectedTags([]);
        setFormError('');
        navigate(ROUTES.FEED);
      },
      onError: (error) => {
        setFormError(error.message || "we couldn't publish your post. try again.");
      },
    });
  };

  const insertTag = (tag) => {
    const regex = new RegExp(`#${tag}(?![A-Za-z0-9_])`, 'gi');
    if (regex.test(caption)) {
      handleCaptionChange(
        caption
          .replace(regex, '')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
      );
      return;
    }
    handleCaptionChange(caption ? `${caption} #${tag}` : `#${tag}`);
  };

  const isActionDisabled =
    createPostMutation.isPending || isUploading || (postType === 'TEXT' && !caption.trim());

  const completedCount = items.filter((item) => item.status === 'done').length;
  const submitLabel =
    postType === 'CAROUSEL' ? `post carousel of ${items.length}` : SUBMIT_LABEL[postType];

  const isTablet = viewport === 'tablet';
  const tabletLeftLineInset = 150;
  const tabletBodyPadLeft = 166;
  const tabletBodyPadRight = 24;
  const helperText = buildHelperText(constraints);
  const canAttachMore = items.length < MAX_CAROUSEL_ITEMS;

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: '100%' }}>
      {isTablet ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: tabletLeftLineInset,
            width: 1,
            background: v.border,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isTablet
            ? `10px ${tabletBodyPadRight}px 10px ${tabletBodyPadLeft}px`
            : '10px 16px',
          borderBottom: isTablet ? 'none' : `1px solid ${v.border}`,
          background: v.base,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontFamily: v.fontDisplay,
            fontSize: 16,
            fontWeight: 600,
            color: v.ink,
            letterSpacing: '-0.01em',
          }}
        >
          new post
        </span>
        <button
          onClick={handlePost}
          disabled={isActionDisabled}
          style={{
            fontFamily: v.fontBody,
            fontSize: 14,
            fontWeight: 600,
            background: isActionDisabled ? v.surfaceRaised : v.accent,
            color: isActionDisabled ? v.ink3 : v.inkInverse,
            border: 'none',
            borderRadius: 999,
            padding: '7px 16px',
            cursor: isActionDisabled ? 'default' : 'pointer',
          }}
        >
          {isUploading
            ? `uploading ${completedCount} of ${items.length}`
            : createPostMutation.isPending
              ? 'posting...'
              : submitLabel}
        </button>
        {isTablet ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: tabletLeftLineInset,
              right: 0,
              bottom: 0,
              height: 1.5,
              background: v.borderStrong,
            }}
          />
        ) : null}
      </div>

      {formError ? (
        <div
          role="alert"
          style={{
            padding: isTablet
              ? `10px ${tabletBodyPadRight}px 0 ${tabletBodyPadLeft}px`
              : '10px 16px 0',
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.error,
          }}
        >
          {formError}
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        <div
          style={{
            padding: isTablet
              ? `20px ${tabletBodyPadRight}px 0 ${tabletBodyPadLeft}px`
              : viewport === 'mobile'
                ? '16px 14px 0'
                : '20px 16px 0',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={buildAcceptAttribute(constraints)}
              onChange={handleFilesSelected}
            />

            <ComposerAttachments
              items={items}
              onRemove={removeItem}
              onMove={moveAttachment}
              onRetry={retryItem}
            />

            {items.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  height: 220,
                  background: v.surfaceSunken,
                  borderRadius: 16,
                  border: `1.5px dashed ${v.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  marginBottom: 16,
                  position: 'relative',
                  overflow: 'hidden',
                  transition:
                    'border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = v.accent;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = v.border;
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: v.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LxIcon name="image" size={26} color={v.ink2} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 600, color: v.ink }}
                  >
                    add photos or a video
                  </div>
                  <div
                    style={{
                      fontFamily: v.fontMono,
                      fontSize: 10,
                      color: v.ink3,
                      marginTop: 6,
                      padding: '0 12px',
                    }}
                  >
                    {helperText}
                  </div>
                </div>
              </div>
            ) : (
              // Derived, not from the design: with attachments present the
              // empty 160px box would be a large blank, so the add control
              // collapses to a single row that keeps the same border idiom.
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canAttachMore}
                style={{
                  width: '100%',
                  background: v.surfaceSunken,
                  borderRadius: 12,
                  border: `1px dashed ${v.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 0',
                  marginBottom: 14,
                  cursor: canAttachMore ? 'pointer' : 'default',
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  color: canAttachMore ? v.ink2 : v.ink3,
                }}
              >
                <LxIcon name="plus" size={16} color={canAttachMore ? v.ink2 : v.ink3} />
                {canAttachMore
                  ? `add more (${items.length}/${MAX_CAROUSEL_ITEMS})`
                  : `${MAX_CAROUSEL_ITEMS} is the maximum`}
              </button>
            )}

            <textarea
              value={caption}
              onChange={(event) => handleCaptionChange(event.target.value)}
              maxLength={CHAR_LIMITS.caption}
              placeholder={items.length === 0 ? 'title' : 'title or caption'}
              style={{
                width: '100%',
                fontFamily: v.fontBody,
                fontSize: items.length === 0 ? 17 : 14,
                color: v.ink,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
                minHeight: items.length === 0 ? 120 : 60,
                padding: 0,
              }}
            />
          </div>
        </div>

        <LxDivider mx={isTablet ? tabletLeftLineInset : 0} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isTablet
              ? `14px ${tabletBodyPadRight}px 14px ${tabletBodyPadLeft}px`
              : '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: v.fontMono,
              fontSize: 11,
              color: allTags.length > 0 ? v.accentText : v.ink3,
            }}
          >
            <LxIcon name="hash" size={13} color={allTags.length > 0 ? 'currentColor' : v.ink3} />
            <span>
              {allTags.length > 0
                ? `${allTags.length} hashtag${allTags.length > 1 ? 's' : ''}`
                : 'no hashtags yet'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {caption.length > 0 ? (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: `conic-gradient(var(--lx-accent) ${(caption.length / MAX_CHARS) * 360}deg, var(--lx-surface-raised) 0deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 17, height: 17, borderRadius: '50%', background: v.base }} />
              </div>
            ) : null}
            <span
              style={{
                fontFamily: v.fontMono,
                fontSize: 11,
                color: caption.length > MAX_CHARS * 0.9 ? v.error : v.ink3,
              }}
            >
              {MAX_CHARS - caption.length}
            </span>
          </div>
        </div>
        {hashtagSuggestions.length > 0 ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              padding: isTablet
                ? `0 ${tabletBodyPadRight}px 18px ${tabletBodyPadLeft}px`
                : '0 16px 18px',
            }}
          >
            {hashtagSuggestions.map((tag) => (
              <LxTag key={tag.id || tag.name} size="sm" onClick={() => insertTag(tag.name)}>
                #{tag.name}
              </LxTag>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
