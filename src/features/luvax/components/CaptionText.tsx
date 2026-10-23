import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PostMentionResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { splitMentions } from '../utils/mentionRender';

/**
 * Splits on a `#` that starts a token, so `#dev` matches and the `#` in `C#` or in a URL fragment
 * does not. The second captured group is the tag name without its `#`.
 *
 * The character class matches the backend's own normalisation: it lowercases and stores the tag
 * without the `#`, and stops at whitespace or punctuation. Unicode letters are included because
 * the seeded dataset and the backend column both accept them.
 */
const hashtagPattern = () => /(^|[^\p{L}\p{N}_#])#([\p{L}\p{N}_]{1,100})/gu;

/**
 * Renders a caption with its hashtag tokens as links to the hashtag page.
 *
 * The tag is navigated by name rather than by id, because a caption carries only the literal text.
 * The backend resolves the name with the same normalisation the write path used, so the token as
 * typed reaches the row it created.
 *
 * A banned or deleted tag keeps its literal text in the caption and stays clickable; the hashtag
 * page is what tells the reader it is unavailable. Hiding or unlinking it here would need a
 * per-token status lookup on every caption render, and the hashtag rules are explicit that banning
 * hides the tag from discovery surfaces, not from the posts that used it.
 *
 * An `@name` is a link only when `mentions` lists it, because the server stores a mention by
 * account id and a bare `@name` in text might belong to nobody. The link goes to the account by id
 * and shows its current username, so a rename never leaves a stale link.
 *
 * A comment passes `hashtags={false}`: it has always shown a `#word` as plain text, and only its
 * stored mentions are links.
 * @param {{text: string, mentions?: PostMentionResponse[], hashtags?: boolean}} props
 */
export function CaptionText({
  text,
  mentions,
  hashtags = true,
}: {
  text?: string | null;
  mentions?: readonly PostMentionResponse[] | null;
  hashtags?: boolean;
}) {
  const navigate = useNavigate();
  if (!text) return null;

  const withMentions = (run: string, keyPrefix: string): ReactNode[] =>
    splitMentions(run, mentions).map((segment, index) =>
      segment.mention ? (
        <button
          key={`${keyPrefix}-m${index}`}
          type="button"
          data-mention={segment.mention.username}
          onClick={(event) => {
            event.stopPropagation();
            navigate(routeTo.userProfile(segment.mention?.userId));
          }}
          style={{
            appearance: 'none',
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            font: 'inherit',
            color: v.accent,
            cursor: 'pointer',
          }}
        >
          @{segment.mention.username}
        </button>
      ) : (
        segment.text
      )
    );

  if (!hashtags) return <>{withMentions(text, 'c')}</>;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  // Built per call rather than held at module scope: a /g regex carries lastIndex between calls,
  // so a shared instance would resume mid-string on the next caption and drop its first tags.
  const pattern = hashtagPattern();

  while ((match = pattern.exec(text)) !== null) {
    const [whole, prefix, tag] = match;
    const tagStart = match.index + prefix.length;
    if (tagStart > lastIndex) {
      nodes.push(...withMentions(text.slice(lastIndex, tagStart), `t${lastIndex}`));
    }
    nodes.push(
      <button
        key={`${tagStart}-${tag}`}
        type="button"
        onClick={(event) => {
          // The caption often sits inside a card that opens the post, so the tag has to claim the
          // click rather than let both handlers run.
          event.stopPropagation();
          navigate(routeTo.hashtag(tag));
        }}
        style={{
          appearance: 'none',
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: v.accent,
          cursor: 'pointer',
        }}
      >
        #{tag}
      </button>
    );
    lastIndex = match.index + whole.length;
  }

  if (lastIndex < text.length) {
    nodes.push(...withMentions(text.slice(lastIndex), `t${lastIndex}`));
  }
  return <>{nodes}</>;
}

export default CaptionText;
