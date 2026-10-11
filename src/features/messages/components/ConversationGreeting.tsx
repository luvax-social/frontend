interface Props {
  messageCount: number;
  pending: boolean;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  userId?: string | null;
}
import { v } from '@/config/tokens';
import { AvatarVisual } from './AvatarVisual';
import { routeTo } from '@/config/constants';
import { useNavigate } from 'react-router-dom';

/**
 * The notice shown in a conversation nobody has written in yet.
 *
 * Deliberately not a `MessageBubble`. It states something about the relationship rather than
 * something either person said, and there is no message row behind it: a mutual-follow
 * conversation is created by the follow itself, so an empty thread is the normal starting state
 * rather than an error. Rendering the greeting from that emptiness costs nothing and adds no
 * schema.
 *
 * `pending` is the other empty case: a profile's "message" button, before a conversation exists
 * at all. "You're now friends" would be false there - the two may not even follow each other -
 * so this shows who the message will go to instead of asserting a relationship.
 */
export function ConversationGreeting({
  messageCount,
  pending,
  name,
  username,
  avatarUrl,
  userId,
}: Props) {
  const navigate = useNavigate();

  const subtitle = username ? `${username} · luvax` : 'luvax';

  return (
    <div
      style={{
        alignSelf: 'center',
        margin: messageCount > 0 ? '18px 0 24px' : 'auto 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
      }}
    >
      <AvatarVisual thread={{ avatarUrl, name }} size={76} />
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 18,
            fontWeight: 800,
            color: v.ink,
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </div>
        {username ? (
          <div
            style={{
              marginTop: 4,
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
              overflowWrap: 'anywhere',
            }}
          >
            @{username}
          </div>
        ) : null}
        <div style={{ marginTop: 5, fontFamily: v.fontBody, fontSize: 12.5, color: v.ink2 }}>
          {pending ? subtitle : "you're now connected on luvax"}
        </div>
      </div>
      {userId ? (
        <button
          type="button"
          onClick={() => navigate(routeTo.userProfile(userId))}
          style={{
            border: 'none',
            borderRadius: 8,
            background: v.surfaceRaised,
            color: v.ink,
            fontFamily: v.fontBody,
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          view profile
        </button>
      ) : null}
    </div>
  );
}
