import type { ChangeEvent, ReactNode } from 'react';
import type { ComposerAttachment, ComposerTag } from '@/types/composer';
import type {
  HashtagResponse,
  PlaceSummaryResponse,
  PostResponse,
  PostStatus,
  UserSummaryResponse,
} from '@/types/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ROUTES, CHAR_LIMITS } from '@/config/constants';
import { v } from '@/config/tokens';
import { postService } from '@/services/post.service';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorCode, getErrorMessage } from '@/utils/errors';
import { LxDivider, LxIcon, LxTag } from './primitives';
import { ComposerAttachments } from './ComposerAttachments';
import { AltTextDialog } from './composer/AltTextDialog';
import { CollaboratorPicker } from './composer/CollaboratorPicker';
import { DraftsPanel } from './composer/DraftsPanel';
import { PlacePicker } from './composer/PlacePicker';
import { SchedulePicker } from './composer/SchedulePicker';
import { TagPeopleEditor } from './composer/TagPeopleEditor';
import { toast } from './Toast';
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useMediaConstraints } from '../hooks/useMediaConstraints';
import { useMyPostCounts } from '../hooks/useDrafts';
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
import {
  attachmentsFromPost,
  buildContentRequest,
  collaboratorsFromPost,
  tagsFromPost,
} from '../utils/composerContent';
import { invalidatePostAffectedQueries } from '../utils/postCacheKeys';
import { formatScheduleLabel } from '../utils/scheduleTime';

const MAX_CHARS = CHAR_LIMITS.caption;

const clampCaption = (value: string) => value.slice(0, MAX_CHARS);

const SUBMIT_LABEL: Record<string, string> = {
  TEXT: 'post text',
  IMAGE: 'post photo',
  VIDEO: 'post video',
};

/**
 * One option row under the caption: an icon, what the option is, and what it is set to.
 *
 * Every capability beyond the caption is a row like this one, so a plain post stays as quick as it
 * always was and the extras never crowd the media.
 */
function OptionRow({
  icon,
  label,
  value,
  onClick,
  disabled = false,
  hint,
  testId,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        appearance: 'none',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '15px 0',
        background: 'none',
        border: 'none',
        borderBottom: `1px solid ${v.border}`,
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <LxIcon name={icon} size={20} color={v.ink2} />
      <span style={{ flex: 1, fontFamily: v.fontBody, fontSize: 15, color: v.ink }}>{label}</span>
      <span
        style={{
          fontFamily: v.fontBody,
          fontSize: 13,
          color: disabled ? v.ink3 : v.ink2,
          maxWidth: '55%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {disabled && hint ? hint : value}
      </span>
      <LxIcon name="chevronRight" size={16} color={v.ink3} />
    </button>
  );
}

/**
 * Turns a refused post into a sentence the author can act on.
 *
 * A refusal caused by someone's tag setting is stated; a block is never revealed, because the
 * backend answers a block exactly as it answers an account that does not exist.
 */
const describePostError = (error: unknown) => {
  switch (getApiErrorCode(error)) {
    case 'POST_PLACE_UNAVAILABLE':
      return 'That place is not available. Remove it or choose another to continue.';
    case 'POST_TAG_NOT_ALLOWED':
      return 'Someone you tagged does not allow tags. Remove their tag to continue.';
    case 'POST_TAG_LIMIT_REACHED':
      return 'A photo holds at most 20 tags. Remove some to continue.';
    case 'POST_COLLABORATOR_LIMIT_REACHED':
      return 'A post can have at most three co-authors.';
    case 'POST_DRAFT_LIMIT_REACHED':
      return 'You have reached the limit of drafts and scheduled posts. Delete one to save another.';
    case 'POST_SCHEDULE_INVALID':
      return 'Choose a time between a minute and 30 days from now.';
    default:
      return getErrorMessage(error, "We couldn't save your post. Try again.");
  }
};

type ComposerDialog = 'alt' | 'place' | 'tags' | 'collaborators' | 'drafts' | null;

export function ComposerScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewport } = useLuvaxTweaks();
  const [caption, setCaption] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [items, setItems] = useState<ComposerAttachment[]>([]);
  const [place, setPlace] = useState<PlaceSummaryResponse | null>(null);
  const [peopleTags, setPeopleTags] = useState<ComposerTag[]>([]);
  const [collaborators, setCollaborators] = useState<UserSummaryResponse[]>([]);
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [dialog, setDialog] = useState<ComposerDialog>(null);
  const [altKey, setAltKey] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loadedStatus, setLoadedStatus] = useState<PostStatus | null>(null);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const counts = useMyPostCounts();

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
    const searched = (
      hashtagResult.data?.pages?.flatMap((page) => extractPageContent<HashtagResponse>(page)) || []
    )
      .filter((tag) => tag?.name && !allTags.includes(String(tag.name).toLowerCase()))
      .slice(0, 5);
    if (!isIdle || searched.length > 0) return searched;
    return (idleResult.data?.data?.content || [])
      .filter((tag) => tag?.name && !allTags.includes(String(tag.name).toLowerCase()))
      .map((tag) => ({ id: tag.hashtagId, name: tag.name }))
      .slice(0, 5);
  }, [allTags, hashtagResult.data, idleResult.data, isIdle]);

  const handleCaptionChange = (value: string) => {
    setCaption(clampCaption(value));
  };

  const makeItem = (file: File): ComposerAttachment => ({
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    isVideo: isVideoFile(file),
    status: 'pending',
    progress: 0,
    assetId: null,
    error: null,
    altText: '',
  });

  /**
   * Files are added to what is already attached rather than replacing it, so a
   * second trip to the picker never costs the person the first selection.
   */
  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
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

    const accepted: ComposerAttachment[] = [];
    for (const file of selected.slice(0, room)) {
      const check = validateFile(file, constraints);
      if (!check.ok) {
        rejection = check.message ?? '';
        continue;
      }
      // The server bounds only the duration the client declares, so a file the
      // composer never measures is a file nothing checks.
      const metadata = await getMediaMetadata(file).catch(() => null);
      const durationCheck = validateDuration(file, metadata?.duration, constraints);
      if (!durationCheck.ok) {
        rejection = durationCheck.message ?? '';
        continue;
      }
      accepted.push(makeItem(file));
    }

    if (rejection) setFormError(rejection);
    if (accepted.length > 0) setItems((current) => [...current, ...accepted]);
  };

  const patchItem = (id: string, patch: Partial<ComposerAttachment>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      // Only an item picked in this session has an object URL; one resumed from a draft shows its
      // CDN address, which is not ours to revoke.
      if (target?.file) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    // A tag belongs to its image, so removing the image removes its tags.
    setPeopleTags((current) => current.filter((tag) => tag.attachmentId !== id));
    setFormError('');
  };

  const moveAttachment = (id: string, direction: number) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      return index < 0 ? current : moveItem(current, index, index + direction);
    });
  };

  const uploadOne = async (item: ComposerAttachment) => {
    // An item resumed from a draft is already uploaded and has no file to send again.
    if (!item.file) return item.assetId;
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
        error:
          err &&
          typeof err === 'object' &&
          'uploadMessage' in err &&
          typeof err.uploadMessage === 'string'
            ? err.uploadMessage || 'upload failed'
            : 'upload failed',
      });
      return null;
    }
  };

  const retryItem = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target) {
      setFormError('');
      await uploadOne(target);
    }
  };

  const postType = derivePostType(items);
  const isUploading = items.some((item) => item.status === 'uploading');

  /**
   * Uploads every attachment that is not uploaded yet and returns the asset id of each, keyed by
   * attachment id, or null when one failed and the person has been told which to retry.
   */
  const resolveAssets = async (): Promise<Map<string, string | null> | null> => {
    // Captured once, because this list is both the upload set and the order the post is created
    // in. Submitting is blocked while uploads run, so it cannot change underneath this.
    const assetIds = new Map<string, string | null>(
      items.filter((item) => item.status === 'done').map((item) => [item.id, item.assetId] as const)
    );
    const pending = items.filter((item) => item.status !== 'done');
    if (pending.length === 0) return assetIds;

    const results = await Promise.all(
      pending.map(async (item) => [item.id, await uploadOne(item)] as const)
    );
    results.forEach(([id, assetId]) => assetIds.set(id, assetId));

    if (results.some(([, assetId]) => !assetId)) {
      setFormError(
        pending.length === 1
          ? "that file didn't upload. retry it or remove it, then try again."
          : "some files didn't upload. retry or remove them, then try again."
      );
      return null;
    }
    return assetIds;
  };

  const resetComposer = () => {
    items.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.previewUrl);
    });
    setCaption('');
    setItems([]);
    setSelectedTags([]);
    setPlace(null);
    setPeopleTags([]);
    setCollaborators([]);
    setScheduleAt(null);
    setSchedulerOpen(false);
    setDraftId(null);
    setLoadedStatus(null);
    setFormError('');
  };

  /**
   * Saves the composer as a draft, or publishes or schedules it.
   *
   * A composer that is editing a stored post replaces that post's content first and then moves its
   * status, so resuming a draft and posting it never creates a second post. Every outcome ends in
   * the shared invalidation, because drafts, scheduled posts, the feed and the profile counts all
   * depend on it.
   */
  const submit = async (target: 'draft' | 'publish') => {
    setFormError('');
    if (busy || isUploading) return;
    // Captured once, so the attachments uploaded below and the content built from them agree.
    const trimmedCaption = caption.trim();
    if (postType === 'TEXT' && !trimmedCaption) {
      setFormError('text posts need something written first.');
      return;
    }

    setBusy(target);
    try {
      const assetIds = await resolveAssets();
      if (!assetIds) return;
      const content = buildContentRequest(
        { caption, items, place, tags: peopleTags, collaborators },
        assetIds
      );
      if (!content) return;

      const scheduling = target === 'publish' && scheduleAt !== null;
      const scheduledAt = scheduling ? scheduleAt.toISOString() : null;
      const wanted: PostStatus =
        target === 'draft' ? 'draft' : scheduling ? 'scheduled' : 'published';

      let savedId = draftId;
      if (draftId) {
        await postService.replacePostContent(draftId, content);
        if (wanted !== 'draft' || loadedStatus === 'scheduled') {
          await postService.updatePostStatus(draftId, wanted, scheduledAt);
        }
      } else {
        const created = await postService.createPost({
          ...content,
          status: wanted,
          ...(scheduledAt ? { scheduledAt } : {}),
        });
        savedId = created.data.id;
      }
      await invalidatePostAffectedQueries(queryClient, savedId);

      if (target === 'draft') {
        setDraftId(savedId);
        setLoadedStatus('draft');
        toast('draft saved');
        return;
      }
      if (scheduling) toast(`scheduled for ${formatScheduleLabel(scheduleAt, new Date())}`);
      resetComposer();
      navigate(ROUTES.FEED);
    } catch (error) {
      setFormError(describePostError(error));
    } finally {
      setBusy(null);
    }
  };

  const handlePost = () => submit('publish');

  /** Loads a stored draft or scheduled post into the composer. */
  const loadPost = (post: PostResponse) => {
    items.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.previewUrl);
    });
    setCaption(post.caption ?? '');
    setItems(attachmentsFromPost(post));
    setPlace(post.place);
    setPeopleTags(tagsFromPost(post));
    setCollaborators(collaboratorsFromPost(post));
    setScheduleAt(post.scheduledAt ? new Date(post.scheduledAt) : null);
    setSchedulerOpen(false);
    setSelectedTags([]);
    setDraftId(post.id);
    setLoadedStatus(post.status);
    setFormError('');
    setDialog(null);
  };

  // A link such as the one on a failed scheduled post opens its draft here. The parameter is
  // dropped once read, so a reload does not reopen it over newer edits.
  const requestedDraft = searchParams.get('draft');
  useEffect(() => {
    if (!requestedDraft) return undefined;
    let cancelled = false;
    postService
      .getPostById(requestedDraft)
      .then((response) => {
        if (!cancelled) loadPost(response.data);
      })
      .catch(() => {
        if (!cancelled) setFormError("We couldn't open that draft.");
      })
      .finally(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // loadPost only writes composer state, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedDraft]);

  const insertTag = (tag: string) => {
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

  const isActionDisabled = busy !== null || isUploading || (postType === 'TEXT' && !caption.trim());

  const completedCount = items.filter((item) => item.status === 'done').length;
  const submitLabel = scheduleAt
    ? 'schedule'
    : postType === 'CAROUSEL'
      ? `post carousel of ${items.length}`
      : SUBMIT_LABEL[postType];

  const authorUsername = useAuthStore((state) => state.user?.username);
  const photoCount = items.filter((item) => !item.isVideo).length;
  const taggedPhotos = new Set(peopleTags.map((tag) => tag.attachmentId)).size;
  const heldCount = counts.data ? counts.data.data.draft + counts.data.data.scheduled : null;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setDialog('drafts')}
            data-testid="open-drafts"
            style={{
              fontFamily: v.fontBody,
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              color: v.ink,
              border: `1px solid ${v.border}`,
              borderRadius: 999,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            drafts
            {heldCount !== null ? (
              <span
                style={{
                  marginLeft: 8,
                  fontFamily: v.fontMono,
                  fontSize: 11,
                  background: v.surface,
                  borderRadius: 999,
                  padding: '1px 7px',
                }}
              >
                {heldCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => submit('draft')}
            disabled={isActionDisabled || (items.length === 0 && caption.trim().length === 0)}
            data-testid="save-draft"
            style={{
              fontFamily: v.fontBody,
              fontSize: 13,
              fontWeight: 500,
              background: 'transparent',
              color: isActionDisabled ? v.ink3 : v.ink,
              border: `1px solid ${v.border}`,
              borderRadius: 999,
              padding: '6px 14px',
              cursor: isActionDisabled ? 'default' : 'pointer',
            }}
          >
            {busy === 'draft' ? 'saving...' : 'save draft'}
          </button>
          <button
            onClick={handlePost}
            disabled={isActionDisabled}
            data-testid="publish-post"
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
              : busy === 'publish'
                ? scheduleAt
                  ? 'scheduling...'
                  : 'posting...'
                : submitLabel}
          </button>
        </div>
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
              onEditAlt={(id) => {
                setAltKey(id);
                setDialog('alt');
              }}
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
              {caption.length} / {MAX_CHARS}
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

        <div
          style={{
            borderTop: `1px solid ${v.border}`,
            padding: isTablet ? `0 ${tabletBodyPadRight}px 0 ${tabletBodyPadLeft}px` : '0 16px',
          }}
        >
          <OptionRow
            icon="mapPin"
            label="add location"
            testId="option-location"
            value={place ? place.name : 'none'}
            onClick={() => setDialog('place')}
          />
          <OptionRow
            icon="tag"
            label="tag people"
            testId="option-tag-people"
            value={
              peopleTags.length > 0
                ? `${peopleTags.length} ${peopleTags.length === 1 ? 'person' : 'people'} on ${taggedPhotos} ${taggedPhotos === 1 ? 'photo' : 'photos'}`
                : 'none'
            }
            disabled={photoCount === 0}
            hint="add a photo first"
            onClick={() => setDialog('tags')}
          />
          <OptionRow
            icon="users"
            label="invite collaborators"
            testId="option-collaborators"
            value={
              collaborators.length > 0
                ? collaborators.map((user) => user.username).join(', ')
                : 'none'
            }
            onClick={() => setDialog('collaborators')}
          />
          <OptionRow
            icon="calendar"
            label="schedule"
            testId="option-schedule"
            value={scheduleAt ? formatScheduleLabel(scheduleAt, new Date()) : 'post now'}
            onClick={() => setSchedulerOpen((open) => !open)}
          />
          {schedulerOpen ? (
            <SchedulePicker
              value={scheduleAt}
              onSet={(at) => {
                setScheduleAt(at);
                setSchedulerOpen(false);
              }}
              onClear={() => {
                setScheduleAt(null);
                setSchedulerOpen(false);
              }}
              onCancel={() => setSchedulerOpen(false)}
            />
          ) : null}
        </div>
      </div>

      {dialog === 'alt' && items.length > 0 ? (
        <AltTextDialog
          items={items.map((item) => ({
            key: item.id,
            src: item.previewUrl,
            isVideo: item.isVideo,
            altText: item.altText,
          }))}
          initialKey={altKey}
          authorUsername={authorUsername}
          onSave={(key, text) => patchItem(key, { altText: text })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'place' ? (
        <PlacePicker
          value={place}
          onChoose={setPlace}
          onRemove={() => setPlace(null)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'tags' ? (
        <TagPeopleEditor
          attachments={items}
          tags={peopleTags}
          onDone={setPeopleTags}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'collaborators' ? (
        <CollaboratorPicker
          value={collaborators}
          onDone={setCollaborators}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'drafts' ? (
        <DraftsPanel onResume={loadPost} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
