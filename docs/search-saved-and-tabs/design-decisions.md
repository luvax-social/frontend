# Design Decisions

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Decisions taken during this work, the reasoning, and what was rejected.

The design export contains a search input and an explore grid but no results screen, no saved screen, and no treatment for an unavailable profile tab.

Everything not defined by the design is derived from existing tokens and is labelled below.

## Search

### The screen composes three requests, not one

There is no combined search endpoint.

Posts, users, and hashtags are three separate endpoints with three separate shapes.

The screen therefore runs three independent queries, each with its own cache key, its own cursor, and its own set of states.

One half running out of pages does not stop another, and one half failing does not blank the others.

That independence was verified by blocking user search at the network layer and confirming the post half still returned results.

### Debounce delay: 300ms

Typing issues one request per completed term rather than one per keystroke.

300ms sits inside the gap between keystrokes for an average typing cadence, so the whole word is searched once, while staying below the point where the pause reads as lag.

Rejected: 150ms, which still issued requests mid-word for slower typists.
Rejected: 500ms, which left the results visibly trailing the input.

Verified: typing a seven character term issued exactly one request.

### The term lives in the URL

`q` carries the term and `type` carries the selected result tab.

A search is therefore shareable and survives a reload, which the brief requires.

The debounced write uses `replace` rather than `push`, so the back button leaves the search instead of walking backwards through every prefix that was typed on the way to it.

### Hashtags are included as a third result type

The endpoint exists and was verified.

It returns `postCount`, which makes a result row informative rather than just a name, and a hashtag search is the one query where the user's intent is unambiguous.

Rejected: leaving hashtags out to keep the screen to the two halves the brief names explicitly.
That was rejected because the capability was already there and the cost was one more section on a screen that already had the structure for it.

Recorded discrepancy, not acted on: the identifier field is `id` on the search endpoint and `hashtagId` on the trending endpoint.
Nothing shared consumes both, so nothing needed to change.

### The empty state for posts is worded differently from the others

This wording is forced by backend behaviour, not chosen.

Post search returns `200` with an empty page when Elasticsearch is unavailable, verified by stopping the container and observing a response identical to a genuine no-match.

An empty post result therefore cannot be reported as "there are nothing matching" with confidence.

| Half | Empty copy |
|------|-----------|
| posts | `no posts match "term"` plus `or search is temporarily unavailable.` |
| people | `no people match "term"` |
| tags | `no tags match "term"` |

The people and tags endpoints are not backed by Elasticsearch and stayed available during the same outage, so they state the empty case plainly.

Rejected: using the hedged wording everywhere for consistency.
That was rejected because it would weaken two accurate messages to match one inaccurate one.

Failure is a separate treatment entirely, in the error colour with different copy, so an empty result and a rejected request never look alike.

### Derived treatments

Every visual choice on this screen is derived, since the design defines no results screen.

| Element | Derived from |
|---------|--------------|
| Result tab strip | The profile screen's tab strip: same 13px body font, same `ink`/`ink3` active and inactive foreground, same `2px solid var(--lx-ink)` underline |
| Post result grid | The profile grid: same square tiles, 2px gap, and caption fallback tile for a post with no media |
| People result rows | The existing `UserCard`, unchanged |
| Hashtag result rows | Derived: a 44px circular `surfaceRaised` swatch with the existing `hash` icon, matching the avatar size used by `UserCard` so the two lists align |
| Empty, loading, failure notices | Derived: centred, 48px vertical padding, 36px icon, `ink2` title over `ink3` detail, following the existing centred notices on the followers screen |

### The follow control on a people result

`UserCard` is used in its default mode, not its `compact` mode.

Compact mode hardcodes the label to "follow" regardless of state, which would have made the follow control on every search result read "follow" even for accounts the viewer already follows.

That is precisely the failure the brief calls out, so the mode was avoided.

The state comes from `viewerState.isFollowing`, which the endpoint returns per row.

Verified in the browser as Ava: Ben and Dan read "following", Cleo and Mira read "follow", matching the seed follow graph.

The compact-mode defect itself is pre-existing and is recorded in `deferred-findings.md` rather than fixed here.

## Saved posts

### The entry point lives in settings, under the account section

Saved posts are private to the viewer, and settings is already the place where things belonging to the viewer live rather than things belonging to a profile being looked at.

It sits directly beneath "change password" in the account section, above "email".

Rejected: a fourth profile tab.
Rejected because the profile tab strip renders on other people's profiles too, and a tab strip reads as public. A private list does not belong in a control that is also shown to visitors.

Rejected: placing it in the privacy section next to "blocked users".
Rejected because saved posts are not a privacy control; the adjacency would have been positional rather than meaningful.

### Unsaving happens on the tile

Each saved tile carries a small filled bookmark control in its corner that removes the post from the list.

The brief requires unsaving from this screen, and this is the screen the row belongs to.

The alternative route, opening the post and unsaving from inside it, does not currently exist: the post detail screen defines a save handler but never renders a control wired to it.

That pre-existing gap is recorded in `deferred-findings.md` and was not fixed here.

The control stops event propagation so removing a post does not also open it.

### The list is re-read rather than patched

The save mutation invalidates the saved list on `onSettled` rather than `onSuccess`.

`onSettled` was chosen because saving a post that is already saved returns `409`, which means the post is in the target state rather than that anything went wrong.

Treating that as a reason to skip the refresh would leave the list stale in exactly the case where it is already correct on the server.

This is also what makes a post saved anywhere else in the application appear here, which the brief requires and which was verified by saving from the feed.

### Derived treatments

| Element | Derived from |
|---------|--------------|
| Grid | The profile grid, so a saved post looks the same here as where it was saved from |
| Header | The followers screen header: sticky, `surface` background, 16px body font at weight 600 |
| Unsave control | Derived: 28px circle, translucent `surface` via `color-mix`, holding the existing filled `bookmark` icon |
| Empty, loading, failure notices | Same derived notice treatment as the search screen |

### The empty state says what saving does

"nothing saved yet." over "tap the bookmark on a post to keep it here."

The brief requires the empty state to tell a user who has saved nothing what saving is for, so it names the control rather than only reporting the absence.

## Profile tabs

### All three tabs now behave honestly, but only one is backed

The tab state previously reached only the text colour and the underline.

The grid rendered the same posts whatever was selected, so `photos` listed text-only posts.

The tab state now reaches the grid.

`posts` keeps its existing query, its existing pagination, and its existing error treatment, unchanged.

`photos` and `liked` render a notice, because neither capability exists on the server.

Both were verified against the running backend and the evidence is in `endpoint-verification.md`.

### Filtering on the client was rejected

A media filter over the one page of posts already fetched would produce a grid missing every post beyond the first page, and the "scroll for more" affordance would page through unfiltered data.

It would look like a working feature while being wrong, which the brief explicitly forbids.

### The notice does not claim the list is empty

Wording is "photo-only posts aren't available yet." and "liked posts aren't available yet."

An empty grid would assert that the account has no such posts.

That is a claim about data nobody has, since the question cannot currently be asked.

The wording also avoids implying a fault, because nothing is broken.

This treatment is derived: the same centred notice used elsewhere in this phase, with the existing `image` and `heart` icons.

Note that no `lock` icon exists in the icon set, so the icons were chosen from what is actually available.

### The liked tab's visibility is undecided, deliberately

The brief says the backend's answer decides whether `liked` appears on another person's profile.

The backend exposes no endpoint for either the viewer's own liked posts or anyone else's, so the question cannot be answered yet and the tab is equally unavailable on every profile.

The condition that would settle it is recorded in `backend-requests.md`.

### Switching tabs does not refetch

Verified: loading a profile and switching posts, photos, liked, posts issued exactly one request to the user posts endpoint in total.

The pagination sentinel is also gated on the `posts` tab, so an unsupported tab cannot trigger a page fetch for a list it is not showing.

## Scope

The seed script repair is part of the same brief but is not in this branch.

The code for the four surfaces came to roughly 816 lines, and adding the seed work would have pushed the change past the thousand line target the brief sets.

The seed shares no code with these surfaces and is already required to be a separate commit scope, so it was agreed before implementation began that it lands as a separate pull request.
