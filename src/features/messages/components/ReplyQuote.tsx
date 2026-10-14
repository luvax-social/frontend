import { v } from '@/config/tokens';

interface Props {
  /** Who sent the quoted message, or null when the server did not say. */
  name: string | null;
  text: string | null;
  /** True when the quoted message is no longer shown; the quote then says so and nothing else. */
  unavailable: boolean;
}

/**
 * The quote above a reply, rendered from the server's preview of the replied-to message.
 *
 * An unavailable parent reads "message unavailable" whether its sender deleted it, a moderator
 * removed it or it no longer exists, because the server does not distinguish the reasons and the
 * client must not guess one.
 */
export function ReplyQuote({ name, text, unavailable }: Props) {
  if (!text) return null;
  return (
    <div
      style={{
        borderLeft: `2px solid ${v.accent}`,
        paddingLeft: 8,
        minWidth: 0,
        fontFamily: v.fontBody,
        fontSize: 11.5,
        lineHeight: 1.35,
        color: v.ink2,
        fontStyle: unavailable ? 'italic' : 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {name && !unavailable ? `${name} - ${text}` : text}
    </div>
  );
}
