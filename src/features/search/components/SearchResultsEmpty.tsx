import { v } from '@/config/tokens';
import { LxIcon } from '@/features/luvax/components/primitives';

/**
 * The non-populated states shared by every half of the search screen.
 *
 * The design export defines a search input and an explore grid but no results
 * screen, so the treatment here is derived: it reuses the centred-notice
 * spacing, the muted `ink3` foreground, and the icon sizing the followers and
 * profile screens already use for their own empty states.
 */
function Notice({
  icon,
  title,
  detail,
  tone = 'muted',
}: {
  icon: string;
  title: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <LxIcon name={icon} size={36} color={tone === 'error' ? v.error : v.ink3} />
      <div
        style={{
          fontFamily: v.fontBody,
          fontSize: 14,
          color: tone === 'error' ? v.error : v.ink2,
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {title}
      </div>
      {detail && (
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink3,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}

/** Shown before the viewer has typed anything to search for. */
export function SearchPrompt() {
  return <Notice icon="explore" title="search for posts, people, or tags" />;
}

/** Shown while the first page of a half is in flight. */
export function SearchLoading({ label }: { label: string }) {
  return <Notice icon="explore" title={`searching ${label}...`} />;
}

/**
 * Shown when a half rejected.
 *
 * This is deliberately worded so it cannot be mistaken for an empty result,
 * because the two mean different things and the viewer can act on one of them.
 */
export function SearchFailed({ label }: { label: string }) {
  return (
    <Notice
      icon="alert"
      tone="error"
      title={`we couldn't search ${label}.`}
      detail="check your connection and try again."
    />
  );
}

/**
 * Shown when a half returned zero rows and said so honestly.
 *
 * This used to hedge with "or search is temporarily unavailable" on the post
 * half, because an outage and a genuine empty result were indistinguishable on
 * the wire. The response now carries a flag for exactly that, so the two cases
 * are told apart and each is worded as what it is. The hedge is gone.
 */
export function SearchEmpty({ label, query }: { label: string; query: string }) {
  return <Notice icon="explore" title={`no ${label} match "${query}"`} />;
}

/**
 * Shown when the server reported that results may be incomplete.
 *
 * Only post search sets this, and only when its search backend is unavailable.
 * The distinction matters to the viewer: an empty result is an answer about
 * their query, and this is not an answer at all. Retrying is worth something
 * here and worth nothing on a genuine empty result, so only this state
 * suggests it.
 */
export function SearchDegraded({ label }: { label: string }) {
  return (
    <Notice
      icon="alert"
      title={`${label} search is temporarily unavailable.`}
      detail="this is not an empty result. try again in a moment."
    />
  );
}
