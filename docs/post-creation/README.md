# Post creation

This folder documents the post creation features of the frontend, the backend contract they rely on and the evidence that each requirement works end to end.
The backend is the source of truth for every shape named here; the OpenAPI document at `/api-docs` is authoritative if this page and the code disagree.
`wireframes/` holds the approved wireframes and `screenshots/` holds the captures taken by the live end-to-end specs.

## Features shipped

### Drafts, scheduling and the archive

- A post can be saved as a draft from the composer, resumed from the drafts drawer and published without creating a second post.
- A post can be scheduled for a time between one minute and thirty days ahead, chosen in the person's own time zone, and an account holds at most fifty drafts and scheduled posts together.
- A scheduled post whose place, hashtag or media became unavailable returns to drafts, and the notification names the reason and opens the draft.
- Every list orders posts by the time they were published, so a draft written long ago appears at the top of the profile on the day it goes out.
- The archive screen lists archived posts, unarchives one with the original publication time and offers an undo; it is built from a tab registry so a later tab is one more entry.
- A draft, a scheduled post and an archived post accept no like, save, view, not-interested mark, comment or report from anyone.

### Alt text, places and people

- Each image carries optional alt text of up to 500 characters, editable by the owner on a published post, and every image shows the alt text or a neutral label such as "Photo 2 of 4 by @name".
- A post can name a place from a shared registry, the location page lists the published posts at it and offers a report, and an administrator can ban, unban or delete a place with a reason without taking any post down.
- People are tagged at a spot on a photo, with a limit of twenty per photo, an account setting for who may tag it and whether tags wait for its approval.
- A waiting tag is visible only to the owner and the tagged person, who approves it from the Tags settings page or from the notification.
- A post can have up to three co-authors who appear in the byline and on their own profile only after accepting, and who can leave.
- Mentions in captions and comments are stored by account id, render as links to the current username and notify once; any other `@name` stays plain text.

## API contract the frontend relies on

All responses are wrapped in `ApiResponse<T>` and unwrapped in the service layer; list endpoints return a `CursorPage<T>`.

| Area | Method and path | Notes |
|------|-----------------|-------|
| Create | `POST /posts` | `status` is `draft`, `scheduled` or `published`; `scheduledAt` is required for `scheduled` |
| Replace content | `PUT /posts/{postId}/content` | Draft and scheduled posts only |
| Status | `PATCH /posts/{postId}/status` with `{targetStatus, scheduledAt?}` | Publish, schedule, return to drafts, archive, unarchive |
| Owner lists | `GET /users/me/posts?status=` and `GET /users/me/posts/counts` | `draft`, `scheduled` or `archived`; counts carry the shared limit |
| Alt text | `PATCH /posts/{postId}/media/{postMediaId}/alt-text` | Any retained status |
| Places | `POST /places`, `GET /places/search`, `GET /places/{id}`, `GET /places/{id}/posts` | A banned or deleted place answers as unavailable |
| Place on a post | `PUT /posts/{postId}/place` | Empty body clears it |
| Tags | `PUT /posts/{postId}/tags`, `POST /posts/{postId}/tags/{tagId}/approve`, `DELETE /posts/{postId}/tags/{tagId}` | The body is the complete set; approval is the tagged person's |
| Waiting tags and tagged posts | `GET /users/me/tags/pending`, `GET /users/{userId}/tagged-posts` | Only approved tags count as tagged |
| Co-authors | `PUT /posts/{postId}/collaborators`, `POST /posts/{postId}/collaboration/accept`, `POST .../decline`, `DELETE /posts/{postId}/collaboration` | At most three; `GET /users/me/collaboration-invites` lists the waiting ones |
| Tag settings | `GET` and `PATCH /users/me/settings` | `tagPermission` and `manualTagApproval` |
| Administration | `GET /admin/places`, `GET /admin/places/search`, `PATCH /admin/places/{placeId}` | A reason is required to ban or delete; an unban also restores a deleted place |

## Decisions the implementation keeps

The composer keeps one feed-width column and every capability is an option row under the caption, so a plain post stays as quick as before.
A draft resumed from the drawer reuses the media assets it already uploaded, so resuming and posting never uploads a file twice.
Tags are stored as fractions of the image and drawn inside the area the image actually occupies, so a marker lands on the same spot at every width.
A mention links only when the server stored it, which is why the same text renders differently for a handle nobody holds.
A place that became unavailable after a post was tagged simply stops being returned; the composer opens such a draft with no place rather than blocking it.
Optimistic changes (alt text, tag approval, archive, collaboration answers) roll back to the cached value they replaced when the request fails.

## Requirements, specs and screenshots

Every live spec signs in as seeded accounts against the real backend and writes screenshots named `<requirement>-<width>.png`.
New surfaces are captured at 1440 pixels, modified surfaces at 390, 768, 1024, 1440 and 1920.
Run them with the stack described in `backend/src/main/resources/seed/README.md`, `TZ=UTC` and the live Playwright project, for example:

```bash
TZ=UTC npx playwright test -c playwright.live.config.ts tests/e2e-live/drafts-and-scheduled-posts.spec.ts
```

A spec that waits for a notification needs the backend running on the `dev` profile after the seed has finished, because the `seed` profile holds the notification consumers off.

| Requirement | Behavior | Spec | Screenshots |
|-------------|----------|------|-------------|
| P2-C1-R1 | Publication time orders the profile | `drafts-and-scheduled-posts.spec.ts` | `P2-C1-R1` |
| P2-C1-R2 | Draft saved, listed, resumed, published once | `drafts-and-scheduled-posts.spec.ts` | `P2-C1-R2-composer`, `P2-C1-R2-drawer` |
| P2-C1-R3 | Scheduling, limits, back to drafts | `drafts-and-scheduled-posts.spec.ts` | `P2-C1-R3-picker`, `P2-C1-R3-limit`, `P2-C1-R3-drawer` |
| P2-C1-R4 | Scheduled post published by the job | `scheduled-publish-failure.spec.ts`, backend `ScheduledPostPublisherIT` | none |
| P2-C1-R5 | Failed schedule returns to drafts with its reason | `scheduled-publish-failure.spec.ts` | `P2-C1-R5`, `P2-C1-R5-draft`, `P2-A5-R11-failed-schedule` |
| P2-C1-R6 | No interaction on an unpublished post | `unpublished-post-interactions.spec.ts` | `P2-C1-R6-draft`, `P2-C1-R6-scheduled` |
| P2-C1-R7 | Archive screen, unarchive, undo | `archive-posts.spec.ts` | `P2-C1-R7`, `P2-C1-R7-profile`, `P2-C1-R7-unarchived` |
| P2-C2-R1 | Alt text on creation, 500 character limit | `alt-text.spec.ts` | none (API) |
| P2-C2-R2 | Owner edits alt text after publishing | `alt-text.spec.ts` | `P2-C2-R2` |
| P2-C2-R3, P2-C2-R4 | Alt text or neutral label on every image | `alt-text.spec.ts` | `P2-C2-R3` |
| P2-C4-R1 | Choose or add a place, one place per name | `location-page-and-places.spec.ts` | `P2-C4-R1-picker`, `P2-C4-R1` |
| P2-C4-R3 | Place search | `location-page-and-places.spec.ts` | `P2-C4-R3` |
| P2-C4-R4 | Location page | `location-page-and-places.spec.ts` | `P2-C4-R4` |
| P2-C4-R5 | Registry actions and the unavailable page | `admin-places-moderation.spec.ts`, `location-page-and-places.spec.ts` | `P2-C4-R5-registry`, `P2-C4-R5-ban`, `P2-C4-R5-unavailable` |
| P2-C4-R7 | Place report resolved by the action | `admin-places-moderation.spec.ts`, `location-page-and-places.spec.ts` | `P2-C4-R7`, `P2-C4-R7-report` |
| P2-A5-R1 | Tag a person at a spot from the composer | `tagging-people.spec.ts` | `P2-A5-R1` |
| P2-A5-R2 | Review before a tag appears, the Tags settings page | `tag-approval-and-limits.spec.ts` | `P2-A5-R2`, `P2-A5-R2-settings` |
| P2-A5-R3 | Who may tag an account | `tag-approval-and-limits.spec.ts` | none (API) |
| P2-A5-R4 | A viewer sees tag markers | `tagging-people.spec.ts` | `P2-A5-R4` |
| P2-A5-R5 | Tagged tab, remove me from this post | `tagging-people.spec.ts` | `P2-A5-R5` |
| P2-A5-R6 | Invite co-authors, limit of three | `collaborative-posts.spec.ts` | `P2-A5-R6` |
| P2-A5-R7 | Co-authors in the byline and on their profile, leaving | `collaborative-posts.spec.ts` | `P2-A5-R7` |
| P2-A5-R10 | Stored mentions in captions and comments | `caption-and-comment-mentions.spec.ts` | `P2-A5-R10`, `P2-A5-R10-comment` |
| P2-A5-R11 | Notifications for tags, invitations and failed schedules | `tag-approval-and-limits.spec.ts`, `collaborative-posts.spec.ts`, `scheduled-publish-failure.spec.ts` | `P2-A5-R11-tag-request`, `P2-A5-R11-invite`, `P2-A5-R11-accepted` |
| Bug 1 | A comment mention of a username with a dot | `comment-mention-with-dot.spec.ts` | `Bug1-comment-mention-notification` |
| Bug 2 | An owner's like or save on a draft | `unpublished-post-interactions.spec.ts` | none (API) |

Requirements that live entirely in the backend (the place name normalisation, the location migration, the counters, the index backfill) are covered by the backend integration tests named in `backend/docs/modules/post/DATA_RULES.md`.
