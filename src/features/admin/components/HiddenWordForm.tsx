import { useEffect, useRef, useState } from 'react';

import { v } from '@/config/tokens';
import { LxBtn } from '@/features/luvax/components/primitives';
import type { AdminHiddenWordResponse } from '@/types/admin';
import { normalizePhrase } from '@/utils/textMatch';

import { validatePhrase } from '../lib/hiddenWordPhrase';

const REASON_MAX_CHARS = 2000;

const fieldLabel = {
  display: 'block',
  fontFamily: v.fontBody,
  fontSize: 13,
  fontWeight: 500,
  color: v.ink,
  marginBottom: 6,
} as const;

const fieldBase = {
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: v.fontBody,
  fontSize: 14,
  color: v.ink,
  background: v.surfaceSunken,
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
} as const;

const errorText = {
  fontFamily: v.fontBody,
  fontSize: 12,
  color: v.errorText,
  marginTop: 6,
} as const;

/**
 * The side form for adding a hidden word or editing and deleting an existing one.
 *
 * Every action needs a reason because each writes an audit row. The phrase is checked locally
 * with the same normaliser the backend uses, and the preview shows the form that is matched, so
 * near-duplicates are visible before saving. `serverError` carries a refusal the backend made
 * after the request, such as a duplicate, and is shown against the phrase field.
 *
 * Mount it with a `key` per word so switching rows resets the draft.
 */
export function HiddenWordForm({
  word,
  busy,
  serverError,
  onSave,
  onDelete,
  onPhraseEdited,
  onCancel,
}: {
  word: AdminHiddenWordResponse | null;
  busy: boolean;
  serverError: string | null;
  onSave: (phrase: string, reason: string) => void;
  onDelete: (reason: string) => void;
  onPhraseEdited: () => void;
  onCancel: () => void;
}) {
  const editing = word !== null;
  const title = editing ? 'edit word' : 'add word';
  const [phrase, setPhrase] = useState(word?.phrase ?? '');
  const [reason, setReason] = useState('');
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const phraseRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const normalized = normalizePhrase(phrase);
  const shownPhraseError = phraseError ?? serverError;

  // A refusal the server made after the request belongs to the phrase, so the keyboard user lands
  // where the message is instead of staying on a disabled save button.
  useEffect(() => {
    if (serverError) {
      phraseRef.current?.focus();
    }
  }, [serverError]);

  const checkReason = () => {
    if (!reason.trim()) {
      setReasonError('A reason is required.');
      return false;
    }
    return true;
  };

  const save = () => {
    const invalid = validatePhrase(phrase);
    setPhraseError(invalid);
    const reasonOk = checkReason();
    if (invalid || !reasonOk) {
      (invalid ? phraseRef : reasonRef).current?.focus();
      return;
    }
    onSave(phrase.trim(), reason.trim());
  };

  const remove = () => {
    if (checkReason()) {
      onDelete(reason.trim());
    } else {
      reasonRef.current?.focus();
    }
  };

  return (
    <aside
      aria-label={title}
      style={{
        flex: '0 0 380px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        alignSelf: 'flex-start',
        background: v.surface,
        borderRadius: 16,
        padding: 22,
      }}
    >
      <h2
        style={{
          margin: '0 0 14px',
          fontFamily: v.fontDisplay,
          fontSize: 18,
          fontWeight: 600,
          color: v.ink,
        }}
      >
        {title}
      </h2>

      <label htmlFor="hidden-word-phrase" style={fieldLabel}>
        word or phrase
      </label>
      <input
        id="hidden-word-phrase"
        ref={phraseRef}
        type="text"
        value={phrase}
        disabled={busy}
        autoFocus
        aria-invalid={shownPhraseError ? true : undefined}
        aria-describedby="hidden-word-phrase-note"
        onChange={(event) => {
          setPhrase(event.target.value);
          setPhraseError(null);
          onPhraseEdited();
        }}
        style={{
          ...fieldBase,
          border: `1px solid ${shownPhraseError ? v.error : v.border}`,
        }}
      />
      {shownPhraseError ? (
        <div id="hidden-word-phrase-note" role="alert" style={errorText}>
          {shownPhraseError}
        </div>
      ) : (
        <div
          id="hidden-word-phrase-note"
          role="status"
          aria-live="polite"
          style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 6 }}
        >
          {normalized
            ? `Matches "${normalized}".`
            : 'Matching ignores accents, case and common character swaps.'}
        </div>
      )}

      <label htmlFor="hidden-word-reason" style={{ ...fieldLabel, marginTop: 16 }}>
        reason
      </label>
      <textarea
        id="hidden-word-reason"
        ref={reasonRef}
        value={reason}
        rows={4}
        maxLength={REASON_MAX_CHARS}
        disabled={busy}
        placeholder="Why this change is needed. Saved to the audit log."
        aria-invalid={reasonError ? true : undefined}
        aria-describedby={reasonError ? 'hidden-word-reason-error' : undefined}
        onChange={(event) => {
          setReason(event.target.value);
          setReasonError(null);
        }}
        style={{
          ...fieldBase,
          resize: 'vertical',
          lineHeight: 1.5,
          border: `1px solid ${reasonError ? v.error : v.border}`,
        }}
      />
      {reasonError ? (
        <div id="hidden-word-reason-error" role="alert" style={errorText}>
          {reasonError}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
        {editing ? (
          <LxBtn type="button" variant="danger" size="sm" disabled={busy} onClick={remove}>
            delete
          </LxBtn>
        ) : null}
        <span style={{ flex: 1 }} />
        <LxBtn type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          cancel
        </LxBtn>
        <LxBtn type="button" variant="primary" size="sm" disabled={busy} onClick={save}>
          save
        </LxBtn>
      </div>
    </aside>
  );
}
