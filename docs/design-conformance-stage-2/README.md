# Design Conformance Stage 2

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The feed, the profile, and multi-image posts.

Stage 1 fixed the chrome.
This stage fixed what sits inside it.

## What changed, in plain language

Multi-image posts work now.
Before this stage a post carrying three images showed exactly one of them, on every screen, with nothing to say the others existed.
A post carrying an image and a video showed the image, and the video could not be reached from anywhere in the application.
Both now show every item, one at a time, with a count and a way to move between them.

Portrait photographs are no longer cropped in the feed.
A 9:16 image lost about a tenth of its height to a fixed pixel cap.
The cap is gone, replaced by a rule based on the image's own shape.

Media now reserves its space before it loads.
The backend has always returned the width and height of every asset and the frontend never read them.
It reads them now, so a card no longer grows and pushes the page down when a photograph finishes decoding.

A video in the profile grid used to be a blank square.
It is now a visible video frame with a marker in the corner.

A broken image used to collapse to a single line of alt text and drag everything below it upward.
It now holds its space and says what happened.

The profile follow button used to say `follow` even when you already followed the account.
It now says `following` and changes shape to match.

An account that follows nobody used to see a blank column.
It now sees a deliberate empty state.

Search results used to show no media at all.
They show it now.

The feed post card and the profile were measured against the design export and brought to its values.

## Commits

Code, in order:

| Commit | Subject |
|--------|---------|
| `1092692` | `feat(post): add media frame ratio helpers` |
| `8f2ff74` | `feat(post): add multi-item post media carousel` |
| `f6d5062` | `feat(post): render every carousel item on the feed card` |
| `8dca061` | `fix(post): align the feed post card with the design` |
| `6c92703` | `feat(post): render every carousel item on post detail` |
| `b0c355c` | `feat(post): add a media grid tile with video and multi-item states` |
| `d6e3375` | `fix(users): align the profile with the design and show the followed state` |
| `ef00236` | `fix(post): show post media in the explore grid and search results` |
| `4d77d83` | `fix(post): add an empty state to the feed` |

Documentation is carried in a separate commit, as required.

The branch is `feat/post/design-conformance-feed-profile`, cut from `develop` at `c04cdd6`.

Stage 1 was merged into `develop` first, because it was still unmerged and this stage builds on it.
That merge is local and has not been pushed.

## Files touched

Eight files, two of them new.

| File | Change |
|------|--------|
| `src/utils/helpers.js` | Added the media geometry helpers |
| `src/features/luvax/components/PostMedia.jsx` | New. The carousel and single-media frame |
| `src/features/luvax/components/MediaThumb.jsx` | New. The square grid tile |
| `src/features/luvax/components/PostCard.jsx` | Carousel, design values, card-level click |
| `src/features/luvax/components/PostDetailScreen.jsx` | Carousel |
| `src/features/luvax/components/ProfileScreen.jsx` | Grid tiles, follow button, design values |
| `src/features/luvax/components/ExploreScreen.jsx` | Media in the explore grid and search results |
| `src/features/luvax/components/FeedScreen.jsx` | Empty state |

No file was moved, renamed or restructured.

## Three claims that did not survive checking

The task description and the audit were both checked before being acted on.
Three of their statements were wrong.

**The typed-but-empty posts do not exist.**
Section 5.5 of the task describes "a large number of posts typed as image, video, or carousel that carry no media asset at all".
There are none.
Every post in the local database that carries no media is typed `text`, and there are 33 of them.
The three caption tiles on Ben's profile are text posts, so the caption tile is the correct treatment and not a defect.
No code changed.
This is recorded in full in `design-decisions.md`.

**The follow button claim was true, and the counter-claim was about a different control.**
The audit said the profile follow button never shows a followed state.
A later phase reported fixing exactly that.
Both are correct about different things.
The `PostCard` dropdown row does toggle between `Follow` and `Unfollow`, and that is what the later phase changed.
The profile button hardcoded the label `follow` and `variant="primary"`, and was still doing so at the start of this stage.
It was confirmed broken in the browser before it was touched.

**The word carousel does appear in the design export.**
The audit and the task both say it does not.
It appears five times, and every one of them is `StoriesCarousel`.
The substantive claim stands: the design defines no media carousel, so there was no reference to conform to.

## Backend integrity

Definition of Done item 16 requires proof that no backend file was modified.

```
$ cd backend && git status
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile

$ git diff --name-only HEAD   # backend files changed by this stage
(no source files modified)
```

The staged `Makefile` is not from this stage.
It was already staged when this session began, which the session's opening `git status` recorded as ` M backend`, and its modification time is 2026-08-10, three days before this work.

The backend was started with `./mvnw spring-boot:run` so the application could be observed.
Running it is not modifying it, and no backend file was created, edited or deleted.

The root aggregator repository finished in exactly the state it started in:

```
 M backend
 M frontend
?? .playwright-mcp/
?? AGENTS.md
?? CLAUDE.md
```

## The rest of the record

| File | Contents |
|------|----------|
| `carousel-design.md` | The carousel as built, every decision and every derived value |
| `changes-applied.md` | One entry per change, with the design value, the previous value and the new one |
| `design-decisions.md` | Every decision in sections 5, 6 and 7, with what was rejected |
| `verification-evidence.md` | Before and after, and a plain statement of what was not verified |
| `deferred-findings.md` | Everything found and deliberately not acted on |
