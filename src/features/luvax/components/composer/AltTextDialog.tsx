import { useState } from 'react';

import { CHAR_LIMITS } from '@/config/constants';
import { v } from '@/config/tokens';
import { mediaAltLabel } from '@/utils/mediaAlt';

import { LxBtn } from '../primitives';
import { DialogShell } from './DialogShell';
import { monoHint } from './dialogStyles';

export interface AltTextItem {
  /** Identifies the item to the caller: an attachment id while composing, a post media id after. */
  key: string;
  src: string;
  isVideo: boolean;
  altText: string;
}

/**
 * Edits the alt text of the items of one post.
 *
 * Used while composing, where saving only updates the composer, and after publishing, where saving
 * calls the server. The caller decides which by what `onSave` does; it resolves when the text is
 * stored and rejects with a message when it is not, which the dialog shows without closing.
 *
 * Leaving the text empty is a visible choice: the dialog states the neutral label readers get
 * instead, so no one believes an empty field means no description exists.
 */
export function AltTextDialog({
  items,
  initialKey,
  authorUsername,
  onSave,
  onClose,
}: {
  items: AltTextItem[];
  initialKey: string;
  authorUsername?: string | null;
  onSave: (key: string, altText: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [activeKey, setActiveKey] = useState(initialKey);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.key, item.altText]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const index = Math.max(
    0,
    items.findIndex((item) => item.key === activeKey)
  );
  const item = items[index];
  if (!item) return null;

  const text = drafts[item.key] ?? '';
  const overLimit = items.some((entry) => (drafts[entry.key] ?? '').length > CHAR_LIMITS.altText);
  const fallback = mediaAltLabel(
    { mediaType: item.isVideo ? 'video' : 'image' },
    index,
    items.length,
    { username: authorUsername }
  );

  const save = async () => {
    if (saving || overLimit) return;
    setSaving(true);
    setError('');
    try {
      // Every item whose text changed is saved, so switching between thumbnails never loses
      // an edit and one Save covers the whole post.
      for (const entry of items) {
        const next = (drafts[entry.key] ?? '').trim();
        if (next !== entry.altText.trim()) await onSave(entry.key, next);
      }
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : "We couldn't save that. Try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell
      title="alt text"
      onClose={onClose}
      width={560}
      testId="alt-text-dialog"
      aside={
        <span style={monoHint}>
          {item.isVideo ? 'video' : 'image'} {index + 1} of {items.length}
        </span>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 180,
            height: 180,
            flexShrink: 0,
            borderRadius: 12,
            overflow: 'hidden',
            background: v.surfaceSunken,
          }}
        >
          {item.isVideo ? (
            <video
              src={item.src}
              muted
              playsInline
              preload="metadata"
              aria-label={fallback}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src={item.src}
              alt={text.trim() || fallback}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            value={text}
            onChange={(event) =>
              setDrafts((current) => ({ ...current, [item.key]: event.target.value }))
            }
            aria-label={`alt text for image ${index + 1}`}
            aria-invalid={overLimit}
            placeholder="describe what is in the image"
            rows={5}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'none',
              padding: '10px 12px',
              fontFamily: v.fontBody,
              fontSize: 14,
              lineHeight: 1.45,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${overLimit ? v.error : v.border}`,
              borderRadius: 8,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
            <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
              Shown to screen readers and when the image does not load.
            </span>
            <span
              style={{ ...monoHint, color: overLimit ? v.error : v.ink3, whiteSpace: 'nowrap' }}
            >
              {text.length} / {CHAR_LIMITS.altText}
            </span>
          </div>
        </div>
      </div>

      <p style={{ margin: '12px 0', fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        Leave it empty and readers hear &ldquo;{fallback}&rdquo; instead.
      </p>

      {items.length > 1 ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {items.map((entry, entryIndex) => {
            const filled = (drafts[entry.key] ?? '').trim().length > 0;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setActiveKey(entry.key)}
                aria-label={`image ${entryIndex + 1}${filled ? ', has alt text' : ''}`}
                aria-current={entry.key === item.key}
                style={{
                  appearance: 'none',
                  position: 'relative',
                  width: 56,
                  height: 56,
                  padding: 0,
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: v.surfaceSunken,
                  border: `2px solid ${entry.key === item.key ? v.accent : 'transparent'}`,
                }}
              >
                {entry.isVideo ? (
                  <video
                    src={entry.src}
                    muted
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={entry.src}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                {filled ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 3,
                      bottom: 3,
                      fontFamily: v.fontMono,
                      fontSize: 9,
                      color: v.accentText,
                      background: v.accentDim,
                      borderRadius: 999,
                      padding: '1px 6px',
                    }}
                  >
                    alt
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: '0 0 10px', fontSize: 13, color: v.errorText }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <LxBtn variant="ghost" onClick={onClose} type="button">
          cancel
        </LxBtn>
        <LxBtn onClick={save} disabled={saving || overLimit} type="button">
          {saving ? 'saving' : 'save'}
        </LxBtn>
      </div>
    </DialogShell>
  );
}
