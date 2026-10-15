# Interaction control and direct messages

This folder documents the interaction control and direct message features of the frontend, the backend contract they rely on and the decisions behind their design.
The backend is the source of truth for every shape named here; the OpenAPI document at `/api-docs` is authoritative if this page and the code disagree.

## Features shipped

### Feed and account controls

- Not interested hides one post from the viewer's recommendations and collapses it in place into an inline undo row, so the content below does not jump.
- Show fewer lowers how often one account appears in the recommended lists, and it is offered on For You and Explore only because following is unaffected by it.
- Mute is one dialog with two independent switches, posts and stories, and turning both off is the unmute, so there is no third state to keep in sync.
- Settings lists the muted accounts with the same two switches.

### Comment and message safety settings

- Hidden words keeps a per-account phrase list, previews the normalised form a phrase will match before saving, and has a switch for the platform-wide list.
- Limit interactions restricts comments from non-followers, recent followers or both for 1, 3, 7, 14 or 28 days, names every effect it has, shows the end time in the viewer's local time and can be switched off early.
- Who can message you offers everyone, people you follow or no one, and says where messages from each group land; mutual followers can still message when the choice is no one.
- A post owner reviews comments hidden by these rules in the post detail side column, sees why each was hidden and approves them one at a time.

### Direct messages

- Messages has a primary tab, a requests tab and a hidden requests folder reached from the requests tab.
- A recipient decides on an incoming request through an explicit accept, delete or block bar; deleting states that the sender is not told.
- A sender with an unanswered request sees a notice and a locked composer, worded the same whether the request is waiting or was deleted, and no read state.
- Reactions use a six-option picker with an any-emoji field, highlight the caller's current reaction and show as chips on the bubble; deleted or removed messages show neither chip nor picker.
- Reply quotes render from the server's preview of the replied-to message and read "message unavailable" when the original is gone.
- A conversation row shows a reaction that is newer than the last message.

### Administration

- The system hidden words registry lets an administrator add, edit and remove platform-wide phrases.
- A reported message reaction shows in the report detail with its emoji, reactor, time and the message it sits on, and a reviewer can remove or restore it.
- Every admin write asks for a reason because it writes an audit row.

## API contract the frontend relies on

All responses are wrapped in `ApiResponse<T>` and unwrapped in the service layer; list endpoints return a `CursorPage<T>` and are read with a cursor and a limit.

### Endpoints

| Area | Method and path | Notes |
|------|-----------------|-------|
| Not interested | `POST` and `DELETE /posts/{postId}/not-interested` | Undo is the `DELETE` |
| Show fewer | `POST` and `DELETE /social/show-fewer/{authorId}` | Undo is the `DELETE` |
| Mute | `PUT /social/mutes/{userId}` with `{mutePosts, muteStories}` | Answers `MuteResponse` |
| Unmute | `DELETE /social/mutes/{userId}` | |
| Muted accounts | `GET /social/mutes` | Cursor page of `MuteResponse` |
| Hidden words | `GET`, `POST /users/me/hidden-words` and `DELETE /users/me/hidden-words/{entryId}` | `GET` answers `{entries, limit}` |
| System word filter | `PATCH /users/me/settings` with `hiddenWordsSystemEnabled` | Part of the settings update |
| Message permission | `PATCH /users/me/settings` with `messagePermission` | `everyone`, `following` or `nobody` |
| Interaction limits | `GET`, `PUT`, `DELETE /users/me/interaction-limits` | `PUT` takes `limitNonFollowers`, `limitRecentFollowers` and `durationDays` |
| Hidden comments | `GET /posts/{postId}/comments/hidden` | Owner only; others get the stealth not-found answer |
| Approve a comment | `POST /comments/{commentId}/unhide` | 409 `COMMENT_PARENT_STILL_HIDDEN` while its parent is hidden |
| Inbox folders | `GET /conversations?folder=primary\|requests\|hidden_requests` | `primary` is the default |
| Accept a request | `POST /conversations/{id}/accept` | |
| Delete a request | `DELETE /conversations/{id}/request` | The sender is not told |
| Block a requester | `POST /conversations/{id}/block` | |
| React | `PUT /conversations/{id}/messages/{messageId}/reaction` with `{emoji}` | One reaction per person per message |
| Remove a reaction | `DELETE /conversations/{id}/messages/{messageId}/reaction` | Answers 204 either way |
| Send a reply | `POST /conversations/{id}/messages` with `replyToId` | The response carries `replyTo` |
| Unread counts | `GET /conversations/unread-count` | Shape below |
| Report a reaction | `POST /reports` with type `message_reaction` and the reaction's own id | |
| Admin word registry | `GET`, `POST /admin/hidden-words`, `PATCH`, `DELETE /admin/hidden-words/{id}` | Administrator only; every write carries a reason |
| Admin reaction moderation | `PATCH /admin/message-reactions/{reactionId}/remove` and `/restore` | Requires a reason; a removal tells the reactor |

### Unread count shape

```json
{ "unreadCount": 3, "requestCount": 2 }
```

`unreadCount` counts unread messages in the primary inbox only and drives the navigation badge.
`requestCount` counts pending, visible incoming requests that carry a message and drives the requests tab; the hidden requests folder is never counted.
The frontend displays both as received and never computes them.

### Conversation fields

- `requestStatus` is `accepted` or `pending`; a declined request reads as pending to its sender, so there is no declined value.
- `isRequestRecipient` tells the viewer which side of a request they are on, and `requestHidden` is true only for the recipient.
- `sendRestriction` is `none` or `awaiting_acceptance`; the sender's composer is locked while it is `awaiting_acceptance`.
- `lastReaction` previews the newest reaction when it is newer than the last message.
- Each message carries `reactions`, oldest first, each with its own `id` so a report can name it, and `replyTo` with `snippet`, `messageType` and `unavailable`.

### Query keys

| Folder | Key | Invalidated by |
|--------|-----|----------------|
| `features/luvax` | `['social', 'mutes']` | Mute and unmute, which also mark `['feed']`, `['recommendedFeed', false]`, `['recommendedFeed', true]` and `['storyFeed']` stale |
| `features/luvax` | `['users', 'me', 'hiddenWords']` | Adding or removing a phrase |
| `features/luvax` | `['users', 'me', 'interactionLimits']` | Saving or ending a limit |
| `features/luvax` | `['comments', postId, 'hidden']` | Approving a comment, which also refreshes `['comments', postId]`, `['post', postId]` and `['feed']` |
| `features/luvax` | `['feed']` and the two `recommendedFeed` keys | Not interested and show fewer, marked stale rather than refetched so the undo row survives |
| `features/messages` | `['conversations', folder]` for each folder | Request actions, reactions and live inbox frames |
| `features/messages` | `['conversations', 'unread-count']` | Request actions and every live frame |
| `features/messages` | `['conversations', conversationId, 'messages']` | Sending, reacting and live thread frames |
| `features/admin` | `['admin', 'hiddenWords', q]` | Registry writes, which also invalidate `['admin', 'actions']` |

Dismissed posts and the open mute dialog are client state in two Zustand stores; both are emptied when the signed-in account changes, including on sign-out.

### Live topics

| Topic | Frame | Frontend behaviour |
|-------|-------|--------------------|
| `/topic/inbox.{userId}` | `{eventType, conversationId, folder}` | Refetch the named folder, or all three when the frame names none, and the unread counts; the frame never carries message content |
| `/topic/conversations.{conversationId}.messages` | `{eventType, data}` | Refetch the thread, the list and the counts |
| `/topic/conversations.{conversationId}.messages` with `eventType` `message.reaction.changed.v1` | `data` is `{messageId, reactionId, userId, emoji, reactedAt}`, with `emoji` absent for a removal | Patch the cached history in place; a set frame without `reactionId` falls back to the refetch |

Both topics ride the message transport, which has its own feature flag.
Delivery is best effort and REST stays authoritative, so a dropped frame costs freshness and never correctness.

## Decisions the wireframes encode

The full list sits in `wireframes/README.md`.
In short:

- A dismissed post collapses into an undo row in place.
- Requests have their own tab and count, the hidden folder carries no count, and neither adds to the main messages badge.
- The sender's pending view is identical whether the request is pending or was deleted.
- Optimistic changes roll back to the state taken before the request when the server refuses.
- The hidden words field previews the normalised form before saving.
- Every admin write asks for a reason.

## Wireframes index

- `wireframes/index.html` is the annotated set to open in a browser.
- `wireframes/png/` holds the thirteen rendered frames, numbered 01 to 13 in the order of the table in `wireframes/README.md`.
- `wireframes/README.md` maps each frame to its surface and lists the design decisions.

## Verification

Screenshots of these features running in the application are recorded beside this page once they are captured.
