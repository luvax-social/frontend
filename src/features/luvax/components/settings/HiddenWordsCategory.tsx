import type { FormEvent } from 'react';
import { useId, useRef, useState } from 'react';

import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';
import { getErrorCode } from '@/utils/captchaErrors';
import { normalizePhrase } from '@/utils/textMatch';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';

import {
  useMyHiddenWords,
  useAddHiddenWord,
  useRemoveHiddenWord,
  isPendingHiddenWord,
} from '../../hooks/useHiddenWords';
import { useMySettings } from '../../hooks/useSettings';
import { LxBtn } from '../primitives';
import { SettingToggle, StateBlock } from './settingsParts';

const duplicateMessage = (normalized: string) => `You already hide "${normalized}".`;
const FULL_MESSAGE = 'Your list is full. Remove a word to add another.';
const INVALID_MESSAGE = 'Use 1 to 64 characters that make up 1 to 6 words.';
const ADD_FAILED_MESSAGE = "We couldn't add that just now. Try again in a moment.";
const REMOVE_FAILED_MESSAGE = "We couldn't remove that just now. Try again in a moment.";

/** The sentence for a refused add, chosen by the backend error code and never by its message. */
const addFailureMessage = (error: unknown, normalized: string) => {
  switch (getErrorCode(error)) {
    case 'HIDDEN_WORD_DUPLICATE':
      return duplicateMessage(normalized);
    case 'HIDDEN_WORD_LIMIT_REACHED':
      return FULL_MESSAGE;
    case 'HIDDEN_WORD_INVALID':
      return INVALID_MESSAGE;
    default:
      return ADD_FAILED_MESSAGE;
  }
};

/**
 * The Hidden Words settings page: the switch for the platform-wide luvax list and the account's
 * own words and phrases.
 *
 * The preview under the field and the client-side duplicate refusal use the same normalisation
 * the server matches with (`utils/textMatch`), so what is previewed is what is matched. A refusal
 * from the server is shown beside the field in the person's own terms and the typed text is put
 * back so it can be edited rather than retyped.
 */
export function HiddenWordsCategory() {
  const { data: settingsResponse, isLoading: settingsLoading } = useMySettings();
  const settings = settingsResponse ? unwrapApiResponse(settingsResponse) : undefined;
  const { data: list, isLoading, error } = useMyHiddenWords();
  const addWord = useAddHiddenWord();
  const [removeError, setRemoveError] = useState('');
  // Hook-level, so every failed removal is reported, not only the latest one.
  const removeWord = useRemoveHiddenWord({ onError: () => setRemoveError(REMOVE_FAILED_MESSAGE) });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const previewId = useId();
  const errorId = useId();

  const [phrase, setPhrase] = useState('');
  const [addError, setAddError] = useState('');

  const entries = list?.entries ?? [];
  const limit = list?.limit ?? 0;
  const full = list !== undefined && entries.length >= limit;
  const normalized = normalizePhrase(phrase);
  const describedBy = [normalized ? previewId : null, addError ? errorId : null]
    .filter(Boolean)
    .join(' ');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!normalized || full || addWord.isPending) return;
    // Focus stays on the field whether the word is refused or taken, so the next one can be typed
    // at once; the add button is disabled while a request is in flight and would drop it.
    inputRef.current?.focus();
    if (entries.some((entry) => normalizePhrase(entry.phrase) === normalized)) {
      setAddError(duplicateMessage(normalized));
      return;
    }
    const submitted = phrase.trim();
    setAddError('');
    setPhrase('');
    addWord.mutate(submitted, {
      onError: (failure) => {
        // The field is refilled only if the person has not started typing something else.
        setPhrase((current) => current || submitted);
        setAddError(addFailureMessage(failure, normalized));
      },
    });
  };

  const remove = (entryId: string) => {
    setRemoveError('');
    // Focus moves to the next chip, else the previous one, else the field, before the removed chip
    // leaves the page; a word still being added has no usable remove button and is skipped.
    const index = entries.findIndex((entry) => entry.id === entryId);
    const neighbour = [...entries.slice(index + 1), ...entries.slice(0, index).reverse()].find(
      (entry) => !isPendingHiddenWord(entry)
    );
    (neighbour ? removeButtons.current.get(neighbour.id) : inputRef.current)?.focus();
    removeWord.mutate(entryId);
  };

  let words;
  if (error) {
    words = (
      <StateBlock
        icon="alert"
        title="we could not load your hidden words"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  } else if (isLoading || !list) {
    words = <StateBlock icon="clock" title="loading" />;
  } else {
    words = (
      <>
        {entries.length === 0 ? (
          <p className="lx-settings-note">You have not added any words yet.</p>
        ) : (
          <ul className="lx-chip-list" aria-label="your hidden words">
            {entries.map((entry) => (
              <li key={entry.id} className="lx-chip">
                {entry.phrase}
                <button
                  ref={(node) => {
                    if (node) removeButtons.current.set(entry.id, node);
                    else removeButtons.current.delete(entry.id);
                  }}
                  type="button"
                  className="lx-chip-remove"
                  aria-label={`remove ${entry.phrase}`}
                  disabled={isPendingHiddenWord(entry)}
                  onClick={() => remove(entry.id)}
                >
                  <LxIcon name="close" size={12} color={v.ink2} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {removeError ? (
          <div className="lx-settings-error" role="alert">
            {removeError}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <SettingToggle
        settings={settings}
        isLoading={settingsLoading}
        field="hiddenWordsSystemEnabled"
        label="use the luvax list"
        sub="Hide comments and requests with words luvax commonly sees used to harass people."
        failureMessage="We couldn't save that just now. Try again in a moment."
      />

      <div className="lx-settings-section">
        <div className="lx-hidden-words-head">
          <h3 className="lx-settings-section-title">your words and phrases</h3>
          {list ? (
            <span className="lx-hidden-words-count">{`${entries.length} of ${limit}`}</span>
          ) : null}
        </div>

        <form className="lx-hidden-words-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="lx-settings-input"
            type="text"
            autoComplete="off"
            aria-label="add a word or phrase"
            aria-invalid={addError ? true : undefined}
            aria-describedby={describedBy || undefined}
            aria-errormessage={addError ? errorId : undefined}
            placeholder="Add a word or phrase"
            value={phrase}
            onChange={(event) => {
              setPhrase(event.target.value);
              if (addError) setAddError('');
            }}
          />
          <LxBtn
            variant="primary"
            type="submit"
            disabled={!normalized || full || addWord.isPending}
          >
            add
          </LxBtn>
        </form>

        {normalized ? (
          <p id={previewId} className="lx-settings-note lx-hidden-words-preview">
            {`Matches "${normalized}", including accented, capitalised and number-swapped spellings.`}
          </p>
        ) : null}
        {addError ? (
          <div id={errorId} className="lx-settings-error" role="alert">
            {addError}
          </div>
        ) : null}
        {full && addError !== FULL_MESSAGE ? (
          <div className="lx-settings-error">{FULL_MESSAGE}</div>
        ) : null}

        {words}

        <p className="lx-settings-note lx-hidden-words-footnote">
          Changes apply to new comments and requests only. Things already posted stay as they are.
        </p>
      </div>
    </div>
  );
}
