import { useNavigate } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';

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
 * @param {{text: string}} props
 */
export function CaptionText({ text }) {
  const navigate = useNavigate();
  if (!text) return null;

  const nodes = [];
  let lastIndex = 0;
  let match;
  // Built per call rather than held at module scope: a /g regex carries lastIndex between calls,
  // so a shared instance would resume mid-string on the next caption and drop its first tags.
  const pattern = hashtagPattern();

  while ((match = pattern.exec(text)) !== null) {
    const [whole, prefix, tag] = match;
    const tagStart = match.index + prefix.length;
    if (tagStart > lastIndex) {
      nodes.push(text.slice(lastIndex, tagStart));
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
    nodes.push(text.slice(lastIndex));
  }
  return <>{nodes}</>;
}

export default CaptionText;
