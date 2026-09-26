# Response Shape Correction, Session Persistence, and Lint Baseline

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

## What changed, in plain language

The previous phase made login work.
The moment anyone could actually get in and see a post, the application fell over.

The backend returns a post's author as a nested object.
The frontend read `post.username`, which does not exist, and fell through to `post.author`, which is that object.
React was handed an object where it expected a string, and the whole screen was replaced by "Something went wrong".

That was the reported defect.
It turned out to be one instance of sixteen.

### The pattern

Every one of these is the same mistake: the frontend reading a path the backend does not serve, and a `||` fallback chain turning the miss into a plausible-looking wrong value instead of an obvious failure.

**Posts** carried an author object, and the code wanted a flat `username`, `userId`, and `userAvatarUrl`. None of those exist. The crash was the loud symptom; the quiet ones were that follow, block, and view-profile from a post card all received `undefined`, and that the owner's own edit and delete menu items never appeared on their own posts.

**Comments and notifications** each fired an extra network request per row to fetch a profile using an id field that does not exist, then rendered "unknown" and "Someone" when it inevitably came back empty. Both responses already embed the author, so the requests were not just failing, they were unnecessary.

**Notification text** compared the type against `'like'` and `'comment'`. The enum members are `like_post`, `like_comment`, `comment_post`, and seven others. Nothing ever matched, so every notification read "interacted with you".

**Follower and following lists** return each row as `{user, viewerState}`. Five places read the row as if it were the user. Two rendered lists of "Unknown / @unknown" with dead click targets; three used it to decide whether a follow button says "Follow" or "Unfollow", and always got "Follow", including for people you already follow.

**Pagination** nests its cursor block under `pageInfo`. Three hooks read it one level too high, so followers, following, and notifications silently stopped loading after their first page.

**The unread badge** read `data.count`. The field is `unreadCount`. The account under test had eight unread notifications and the badge never appeared.

**Hidden profile counts** came back `null` for a private account, and `|| 0` turned them into `0`. That is not a missing value rendered safely, it is a false statement: it told the viewer the account has no posts and no followers rather than that the numbers are not visible to them. They now render an en dash.

**Videos** never played. The media type serialises lower case as `"video"`, and the comparison was against `'VIDEO'`, so every video rendered through the image branch.

**A comment count was fabricated.** `post.commentCount || Math.floor((post.likes || 0) / 8) + 2` meant a post with zero comments displayed `2`, because `0` is falsy. The interface invented a number and showed it as fact.

### How it was fixed

By reading the correct path, not by adding more fallbacks. A chain like `a || b || c` is what produced this, so the chains were removed rather than extended.

The path knowledge now lives in five small accessors in `src/utils/helpers.js` rather than being repeated in a dozen components. TanStack Query still holds the server response exactly as the server sent it; nothing rewrites or reshapes it.

### Guarding against recurrence

Section 4.5 asked whether Zod schemas at the service boundary would be proportionate. They would not, for a reason worth stating plainly: **a response schema would not have caught a single one of these sixteen defects.** Every response was exactly what the backend promised. It was the reads that were wrong. A schema validating `PostResponse` against its true shape would have passed while `post.username` still returned `undefined`.

Schemas would also duplicate every backend DTO in the frontend, creating a second source of truth to maintain in lockstep, against the rule that the backend owns data shapes.

So the guard went where it can actually help. The accessors now log a clear console error in development when a non-empty response does not carry the field they expect, naming the key they wanted and the keys actually present. It is gated on `import.meta.env.DEV`, never throws, and is verified absent from the production bundle.

---

## Session persistence: it needs a backend change

The previous phase's claim was treated as unverified and tested against the source, the server, and the browser.

**The claim is correct.** `POST /auth/login` returns no `Set-Cookie` header. The refresh token comes back in the response body and nowhere else, so it cannot outlive the JavaScript heap that received it.

The security rules forbid persisting tokens to `localStorage` or `sessionStorage`, and the backend is read-only. A refresh therefore logs the user out, and no frontend change can alter that without breaking a rule that exists for good reason.

This is an acceptable outcome of the phase, so no code changed. What did get established is that the rest of the machinery is already sound and one change unlocks it:

- Tokens rotate correctly, and reuse of a consumed token is rejected with `AUTH_REFRESH_TOKEN_INVALID`.
- The refresh token is valid for 30 days, which is what makes discarding it on reload wasteful.
- CORS already permits credentialed requests from the dev origin.
- `AuthSessionBootstrap` and `ProtectedRoute` are already correct: `isBootstrapping` starts `true`, so the guard shows a loader from the first render rather than flashing the login screen, and it requires a live access token rather than trusting the rehydrated `isAuthenticated` flag. After a refresh the persisted state is cleared to `{user: null, isAuthenticated: false}` with no half-authenticated window.

The backend needs to issue the refresh token as an `HttpOnly` cookie and read it back from there. `session-and-token-flow.md` sets out the suggested cookie attributes, the small frontend change that follows, and why each frontend-only workaround was rejected.

---

## Lint: 9,863 problems, now 1,045

9,812 of the original were a single repeated message, `Delete ␍`, from `core.autocrlf=true` with no `.gitattributes` while Prettier required LF.

That was worse than noise. `eslint-plugin-prettier` reports one error per line, so on a CRLF line the genuine formatting problem was never reported at all: the line-ending difference was found first and consumed the slot.

Fixed with a `.gitattributes` declaring `* text=auto eol=lf`, a one-line Prettier change, and a working-tree renormalisation committed on its own. No formatter was run and no file was reformatted, verified by diffing the normalisation with whitespace ignored, which leaves only `.gitattributes` itself.

The committed design export needed care here. `docs/design/Luvax.html` is marked `binary`, and it was confirmed byte-identical to its committed state afterwards, with its three bundled chunks still extracting at the sizes recorded during reconnaissance.

The result is honest rather than flattering: `prettier/prettier` went from 0 to 994, because those problems were previously unreportable and are now visible for the first time. The genuine non-formatting count is unchanged at 51. Section 6.2 asked for an accurate count and explicitly not for these to be fixed, so they are recorded and left.

---

## The commits

| Commit | Scope |
|--------|-------|
| `8c0f772` | `fix(common): read paginated responses from the pageInfo envelope` |
| `2ce46b8` | `fix(post): read the embedded author summary on posts and comments` |
| `831dd40` | `fix(social): unwrap the nested user on follower and following rows` |
| `74747d9` | `fix(notification): read the actor summary and the unread count field` |
| `a0b0d2a` | `chore(ci): declare lf line endings and stop prettier reporting them` |
| `d8bb6d1` | `chore(ci): renormalise line endings to lf` |
| `c94ea03` | `fix(social): show the server follow state on follower list rows` |
| `d0b7a3a` | `fix(common): warn in development when a response shape drifts` |
| `docs` | this directory and the changelog entry |

Branch: `fix/common/response-shape-and-session`, cut from `fix/common/backend-contract-alignment`.

Code change size: 15 files, 314 insertions, 125 deletions. Inside `size/M`. The line-ending renormalisation is a separate commit and excluded from that figure per the brief.

---

## Definition of done

| # | Item | Status |
|---|------|--------|
| 1 | Explore renders posts without an error boundary, with seeded data | met |
| 2 | Follow, block, and view-profile from a post card receive a real identifier | met, all three now read `author.id` |
| 3 | Every listed response type has a comparison table; unfixed mismatches are in `deferred-findings.md` with a reason | met |
| 4 | No React render error on any in-scope screen, dev tools open | met, zero console errors across feed, explore, post detail, profile, followers, following, blocked users |
| 5 | A profile with null counts renders a defined state | met, renders an en dash |
| 6 | Token lifecycle documented; refresh preserves the session or the report states what is missing | met, states what is missing |
| 7 | `AuthSessionBootstrap` does not flash the login screen | met, already correct, no change needed |
| 8 | No token in `localStorage` or `sessionStorage` | met, verified by inspecting both after login |
| 9 | No line-ending problems reported; remainder documented by rule | met, 0 remaining, 1,045 documented |
| 10 | No backend file modified | met, see below |
| 11 | `CHANGELOG.md` entry | met |

Two caveats stated rather than glossed:

**Pagination and video have no browser before-and-after.** The seeded data does not fill a second page on any affected list, and contains no video asset. Both are demonstrated from the contract and the real response bodies instead. Said plainly rather than claimed as verified.

**`comment.isLiked` is still unread.** It is returned by the server and ignored, which is a mismatch of exactly the audited class. Fixing it requires reworking the comment like-count display, and section 7 excludes comment like from this phase. Recorded in `deferred-findings.md` with that reason, which is what DoD 3 asks for.

---

## The backend was not modified

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean

$ git log --oneline -1
450212e Merge pull request #142 from zentech-graduation/fix/common/api-contract-and-security-hardening
```

---

## The rest of this directory

| File | What is in it |
|------|---------------|
| `response-shape-audit.md` | Field-by-field comparison for every response type, with the real body captured for each |
| `session-and-token-flow.md` | The verified token lifecycle, what the browser holds, what a refresh does, and the exact backend capability required |
| `changes-applied.md` | One entry per change: what was wrong, the evidence, what changed, which file |
| `verification-evidence.md` | Browser before and after for every fix with a reachable path, plus the `curl` evidence |
| `lint-baseline.md` | Counts before and after, by rule and by file, and why the formatting count rose |
| `deferred-findings.md` | Everything found and deliberately not acted on, with the phase it belongs to |

The reconnaissance reports and the previous phase's reports were not modified. They are snapshots and their value depends on staying that way.
