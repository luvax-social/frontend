import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Post } from '@/types/social';
import type { UserSummaryResponse } from '@/types/domain';
import { routeTo } from '@/config/constants';
import { v } from '@/config/tokens';
import { getDisplayName } from '@/utils/helpers';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

import { LxAvatar } from './primitives';
import { postAuthors } from '../utils/postAuthors';

/**
 * Who a post is by, and where it was made.
 *
 * A post with one author shows what it always showed: the avatar and the name. A post with
 * co-authors shows each accepted co-author beside the owner, with overlapping avatars and names
 * joined by "and", each name linking to its own profile; an invitation still waiting is never shown
 * here. A post with a place adds a quiet line below that links to the location page. A place an
 * administrator removed arrives as null and shows nothing.
 *
 * `trailing` is where the caller puts the options menu so it stays right of the whole line.
 */
export function PostByline({
  post,
  avatarSize = 26,
  nameSize = 13,
  meta,
  trailing,
}: {
  post: Post;
  avatarSize?: number;
  nameSize?: number;
  /** A short fragment after the names, such as "co-authors, 2h". */
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  const navigate = useNavigate();
  const authors = postAuthors(post);
  const owner = authors[0];
  const multiple = authors.length > 1;

  const open = (user: UserSummaryResponse) => user.id && navigate(routeTo.userProfile(user.id));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, width: '100%' }}>
      <div
        data-lxtap="1"
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
        onClick={() => owner && open(owner)}
      >
        {authors.slice(0, 3).map((user, index) => (
          <div key={user.id} style={{ marginLeft: index === 0 ? 0 : -avatarSize * 0.35 }}>
            <LxAvatar size={avatarSize} src={user.avatarUrl} />
          </div>
        ))}
      </div>
      <div style={{ minWidth: 0, flex: 1 }} data-testid="post-byline">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {multiple ? (
            <span
              style={{
                fontFamily: v.fontBody,
                fontSize: nameSize,
                fontWeight: 600,
                color: v.ink,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {authors.map((user, index) => (
                <span key={user.id}>
                  {index > 0 ? (index === authors.length - 1 ? ' and ' : ', ') : ''}
                  <button
                    type="button"
                    data-lxtap="1"
                    data-author={user.username ?? undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      open(user);
                    }}
                    style={{
                      appearance: 'none',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {getDisplayName(user)}
                  </button>
                </span>
              ))}
            </span>
          ) : owner ? (
            <div
              data-lxtap="1"
              onClick={() => open(owner)}
              style={{ cursor: 'pointer', minWidth: 0 }}
            >
              <LxVerifiedName
                name={getDisplayName(owner)}
                verified={owner.isVerified}
                category={owner.verifiedCategory}
                size={nameSize}
                textStyle={{
                  fontFamily: v.fontBody,
                  fontSize: nameSize,
                  fontWeight: 600,
                  color: v.ink,
                }}
              />
            </div>
          ) : null}
        </div>
        {meta || post.place ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: v.fontBody,
              fontSize: 12,
              color: v.ink3,
              marginTop: 1,
            }}
          >
            {meta ? <span>{meta}</span> : null}
            {post.place ? (
              <button
                type="button"
                data-lxtap="1"
                data-testid="post-place"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(routeTo.place(post.place?.id));
                }}
                style={{
                  appearance: 'none',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <LxIcon name="mapPin" size={12} color={v.ink3} />
                {post.place.name}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
