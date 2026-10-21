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

## Requirement identifiers and live specs

The `P1-*` identifiers in the live spec titles and in the screenshot file names are the requirement identifiers of this work.
Each row below names the behavior an identifier stands for and the spec under `tests/e2e-live` that exercises it.
Run them against the running stack with `npx playwright test -c playwright.live.config.ts <file>`.

| Identifier | Behavior | Spec |
|------------|----------|------|
| P1-A2-R1 | Not interested hides a post, collapses it into an undo row and undo restores it | `not-interested-feed.spec.ts` |
| P1-A2-R3 | Show fewer is offered on For You and Explore only and lowers one account in recommendations | `show-fewer-posts.spec.ts` |
| P1-A2-R4 | A post marked not interested stays out of every recommendation list | `not-interested-feed.spec.ts` |
| P1-A2-R5 | Mute is one dialog with independent posts and stories switches, and the muted account is not notified | `mute-accounts.spec.ts` |
| P1-A2-R6 | Muted posts leave every post list and muted stories leave the tray and discovery | `mute-accounts.spec.ts` |
| P1-A2-R7 | Settings lists the muted accounts and unmutes them | `mute-accounts.spec.ts` |
| P1-B1-R1 | A message reaction can be added, changed, removed and reported from its chip | `message-reactions-and-quotes.spec.ts` |
| P1-B1-R2 | A deleted or moderator removed message hides its reactions and refuses new ones | `message-reactions-and-quotes.spec.ts` |
| P1-B1-R3 | A reaction reaches the other participant live and disappears when removed | `message-reactions-and-quotes.spec.ts` |
| P1-B1-R4 | The conversation list previews a newer reaction without adding unread | `message-reactions-and-quotes.spec.ts` |
| P1-B1-R5 | A reply quotes its parent from the server preview and reads message unavailable when it is gone | `message-reactions-and-quotes.spec.ts` |
| P1-B2-R1 | Privacy settings offer who can message you and save the choice | `interaction-policy-outcomes.spec.ts` |
| P1-B2-R2 | Accepting a request moves it to Primary and opens the composer | `message-requests.spec.ts` |
| P1-B2-R3 | A later change of relationship never demotes an accepted conversation | `message-requests.spec.ts` |
| P1-B2-R4 | A sender may send one request message and then waits for acceptance | `message-requests.spec.ts` |
| P1-B2-R5 | The recipient accepts, deletes or blocks, and the sender sees nothing about a decline | `message-requests.spec.ts` |
| P1-B2-R6 | A stranger message lands in Requests and not in Primary | `message-requests.spec.ts` |
| P1-B2-R7 | The requests tab carries its own server owned count | `message-requests.spec.ts` |
| P1-B2-R8 | The inbox live topic delivers only the account own frames, with no message content | `inbox-live-topic-security.spec.ts` |
| P1-D1-R1 | An administrator adds, edits and removes a platform hidden word with an audited reason | `hidden-words.spec.ts` |
| P1-D1-R2 | The spam heuristics still reject rather than hide | `hidden-words.spec.ts` |
| P1-D1-R3 | Settings shows the platform switch and a personal list that previews what a phrase matches | `hidden-words.spec.ts` |
| P1-D1-R4 | Matching folds case, diacritics and leetspeak and matches whole tokens only | `hidden-words.spec.ts` |
| P1-D1-R5 | Only the post owner list applies to a comment | `hidden-words.spec.ts` |
| P1-D1-R6 | A matching comment is hidden from everyone but its author | `hidden-words.spec.ts` |
| P1-D1-R7 | The post owner reviews hidden comments and approves one | `hidden-words.spec.ts` |
| P1-D1-R8 | A first message matching the recipient hidden words goes to Hidden requests and is not counted | `message-requests.spec.ts` |
| P1-D1-R9 | Adding a phrase does not hide comments already posted | `hidden-words.spec.ts` |
| P1-D5-R1 | A recent followers limit hides an account approved this week and not an older follower | `limit-interactions.spec.ts` |
| P1-D5-R2 | Settings turns a limit on for a chosen duration and off early | `limit-interactions.spec.ts` |
| P1-D5-R3 | A limit past its expiry reads as off and filters nothing | `limit-interactions.spec.ts` |
| P1-D5-R4 | An active limit hides stranger comments, silences mentions and sends new requests to Hidden requests | `limit-interactions.spec.ts`, `message-requests.spec.ts` |
| P1-D5-R5 | A limit applies to new comments only | `limit-interactions.spec.ts` |
| P1-D5-R6 | The post owner limit decides, not the commenter own limit | `limit-interactions.spec.ts` |
| P1-S-R2 | An allowed and a hidden comment look the same to the person writing them | `interaction-policy-outcomes.spec.ts` |
| P1-S-R3 | A block is decided before hidden words and limits | `interaction-policy-outcomes.spec.ts` |
| P1-S-R4 | Replies and edits are evaluated like new comments, and who can message me applies before a conversation exists | `interaction-policy-outcomes.spec.ts` |
| P1-BUGS | A comment notification stops showing the comment text once its author is blocked | `comment-notification-snippet.spec.ts` |
| P1-BUGS-1 | A reused send key with another reply target is a conflict and never replays the old quote | `message-send-regressions.spec.ts` |
| P1-BUGS-2 | A send to a peer who left and then blocked the sender is refused as not found | `message-send-regressions.spec.ts` |

## Verification

Screenshots of these features running in the application are recorded beside this page once they are captured.
