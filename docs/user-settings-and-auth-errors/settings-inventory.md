# Settings inventory

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

Every setting the backend supports, what reads it, what writes it, its constraints, and the
group it landed in. Derived entirely from `settings-contract-verification.md`, which was
produced by calling the running server.

**Rule applied: a control exists on the screen if and only if it has a row in this table.**

---

## What exists

### Group: how you use luvax

| Setting | Category | Read by | Written by | Constraints |
|---|---|---|---|---|
| display name | profile | `GET /users/me` `.displayName` | `PATCH /users/me` `{displayName}` | 0–100 chars |
| username | profile | `GET /users/me` `.username` | `PATCH /users/me` `{username}` | 3–30; letters, digits, `_`, `.`; **409** `USER_USERNAME_ALREADY_EXISTS` if taken |
| bio | profile | `GET /users/me` `.bio` | `PATCH /users/me` `{bio}` | 0–500 chars |
| link | profile | `GET /users/me` `.websiteUrl` | `PATCH /users/me` `{websiteUrl}` | ≤ 2048; **no server-side format check** |
| picture | profile | `GET /users/me` `.avatarUrl` | `POST /media/upload` + `/upload-complete`, then `PATCH /users/me` `{avatarUrl}` | image mime, ≤ 100 MB (`GET /media/constraints`) |
| banner | profile | `GET /users/me` `.bannerUrl` | same flow as picture, `{bannerUrl}` | same |
| notify likes | notifications | `GET /users/me/settings` `.notifyLikes` | `PATCH /users/me/settings` | boolean; partial body |
| notify comments and replies | notifications | `.notifyComments` | `PATCH /users/me/settings` | boolean; partial body |
| notify new followers | notifications | `.notifyFollows` | `PATCH /users/me/settings` | boolean; partial body |
| notify mentions | notifications | `.notifyMentions` | `PATCH /users/me/settings` | boolean; partial body |
| notify messages | notifications | `.notifyMessages` | `PATCH /users/me/settings` | boolean; partial body |
| saved posts | saved posts | `GET /posts/saved` | `DELETE /posts/{id}/save` (from a post) | cursor-paged |

### Group: who can see your content

| Setting | Category | Read by | Written by | Constraints |
|---|---|---|---|---|
| private account | privacy | `GET /users/me` `.isPrivate` | `PATCH /users/me` `{isPrivate}` | boolean |
| show activity status | privacy | `GET /users/me/settings` `.showActivityStatus` | `PATCH /users/me/settings` | boolean; partial body |
| allow story replies | privacy | `.allowStoryReplies` | `PATCH /users/me/settings` | boolean; partial body |
| allow message requests | privacy | `.allowMessageRequests` | `PATCH /users/me/settings` | boolean; partial body |
| incoming follow requests | follow requests | `GET /social/follow-requests` (`cursor`, `limit`) | `PATCH /social/follow-requests/{id}/approve` \| `/reject` | cursor-paged; only a private account accumulates them |
| blocked accounts | blocked accounts | `GET /social/blocked` (`cursor`, `limit`) | `DELETE /social/block/{id}` | **204** on success; **404** if not blocked |

### Group: your account

| Setting | Category | Read by | Written by | Constraints |
|---|---|---|---|---|
| email address | account | `GET /users/me` `.email` | **nothing** | read-only; `PATCH /users/me` rejects the field with **400** `MALFORMED_REQUEST_BODY` |
| verified badge | account | `GET /users/me` `.isVerified` | **nothing** | read-only |
| account visibility (public/private) | account | `GET /users/me` `.isPrivate` | shown read-only here; written in **privacy** | displayed twice, written once |
| joined date | account | `GET /users/me` `.createdAt` | **nothing** | read-only; rendered in the viewer's local timezone |
| warnings received | account | `GET /users/me/warnings` (`cursor`, `limit`) | **nothing** | read-only; `reasonKey` resolved through `GET /config/vocabularies` |
| password | account | not readable | `POST /auth/forgot-password {email}` — sends a reset link | **200** regardless of whether the address exists; token lives 15 minutes |
| sign out | account | — | `POST /auth/logout` | — |

**Every setting appears in exactly one group.** `isPrivate` is shown in two places but written
in one: the account category renders it as information alongside the rest of the account's
standing, and the privacy category owns the control.

---

## What does not exist

Separated deliberately. Each was searched for across all 115 declared paths and is absent, so
**no control for it was built**.

| Capability a settings screen might be expected to have | Status |
|---|---|
| Change password while signed in | **Absent.** No authenticated change-password endpoint. Only the unauthenticated email loop (`forgot-password` → `reset-password`), which is what the account category offers. |
| Change email address | **Absent.** The profile endpoint rejects an `email` field outright. |
| Delete or deactivate the account | **Absent.** No path matches delete, deactivate or close. The previous screen rendered a red `delete account` button wired to nothing; it is gone. |
| See or revoke your own sessions | **Absent for the account.** An administrator can revoke another account's session; a person cannot list their own. |
| Two-factor authentication | Absent |
| Download or export your data | Absent |
| Theme, language, locale, timezone | **Absent from the server.** Theme is a browser-local preference with no endpoint, so it is not rendered as a server-backed setting on this screen. It remains available where it already lived. |
| Story-view notifications | **Absent.** `notify_*` covers likes, comments, follows, mentions and messages and nothing else. The previous screen rendered a permanently disabled "story views · coming soon" toggle; it is gone. |
| Muted or restricted accounts | **Absent** as an account-level list. `mute` exists only per conversation and belongs to messages. |
| Close friends or any second audience list | Absent |
| See your own suspension and its end date | **Absent, and unreachable by construction.** A suspended account is answered **401** on every authenticated endpoint and **403** `AUTH_ACCOUNT_INACTIVE` at sign-in, so it can never load a settings screen. The refusal carries no end date. Surfaced at sign-in instead; raised as a backend request item. |
| Help centre, terms, about | **No endpoint and no destination.** The previous screen rendered three rows with empty click handlers; they are gone. |

---

## Reference-product settings deliberately not built

The reference this screen is modelled on carries all of the following. None has a server
behind it here, so none was built: activity log and time-spent controls, close friends,
comment filtering and keyword muting, hidden words, tagging and mention permissions, story
sharing controls, ads and personalisation preferences, linked accounts, login activity and
devices, saved login info, two-factor authentication, account type switching (professional
or business), archived content, subscriptions, language, data download, and account deletion
or deactivation.
