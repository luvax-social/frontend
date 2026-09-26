# Search Results, Saved Posts, and Profile Tabs

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Four surfaces that are lists of posts or users, built against endpoints verified first against the running backend.

Two of them turned out to have no backend support at all, and this documents that rather than faking it.

## What was built

**A search results screen** at `/app/search`.

One input searches posts, people, and hashtags, each shown under its own tab.

The term lives in the address, so a search can be shared and survives a reload.

Typing is debounced, so a word costs one request rather than one per letter.

Each half pages independently, and each has its own loading, empty, and failure state.

A follow control on a person result shows the real relationship rather than always reading "follow".

**A saved posts screen** at `/app/settings/saved`, reached from the account section of settings.

The backend has had this endpoint all along and nothing called it, so saving a post left it nowhere to be found.

Unsaving from the list removes the row without a reload, and saving a post anywhere else in the application makes it turn up here.

**Real profile tabs.**

The profile screen rendered three tabs whose selection reached only the underline colour.

The grid showed the same posts whatever was selected, so `photos` listed text-only posts.

The tab selection now reaches the grid.

**An honest state for the two tabs that cannot work.**

`photos` needs a way to ask for a profile's posts that carry media.

`liked` needs a way to ask for the posts an account has liked.

Neither exists on the backend.

Both tabs now say the view is not available yet, and `backend-requests.md` is written to hand to the backend team.

Nothing is filtered on the client and nothing is fabricated.

## What is not here

The seed script repair is part of the same brief and lands as a separate pull request.

The code for these four surfaces came to 816 lines, and folding the seed in would have crossed the thousand line target the brief sets.

The seed shares no code with any of this and is already required to be its own commit scope, so the split was agreed before implementation started.

## The commits that carry it

| Commit | Subject |
|--------|---------|
| `f89f0d4` | `docs(common): record search saved and profile tab endpoint checks` |
| `ae1da3f` | `feat(post): add search services and paginated search hooks` |
| `0a44e9f` | `feat(post): add search results screen for posts people and tags` |
| `611c628` | `feat(post): add saved posts screen and settings entry point` |
| `eab931d` | `feat(users): make profile tab selection reach the grid` |

The endpoint verification was committed before any feature code, which the brief requires.

Documentation is committed separately from code.

## The documents

| File | What is in it |
|------|---------------|
| `endpoint-verification.md` | Every endpoint checked against the running server, with observed request and response. Written and committed before any feature code |
| `changes-applied.md` | One entry per change: what was missing, the evidence, what was built, the file touched |
| `design-decisions.md` | Decisions, reasoning, and what was rejected. Every derived treatment labelled |
| `verification-evidence.md` | Browser evidence for every surface: populated, empty, loading, failure, and pagination past the first page |
| `backend-requests.md` | The two missing capabilities, written to be handed to the backend team directly |
| `deferred-findings.md` | Everything found and deliberately not acted on |

`seed-data.md` will accompany the seed work in its own pull request.

## Things worth knowing

**Post search cannot tell you it found nothing.**

It returns `200` with an empty page when Elasticsearch is unavailable.

That was verified by stopping the container: the response was byte-identical to a genuine no-match.

So the post half of search is worded to cover both readings, while the people and tags halves state the empty case plainly because they do not degrade this way.

**An unknown filter parameter is silently ignored.**

`GET /posts/user/{id}?mediaType=IMAGE` returns `200` and the full unfiltered list.

That is why the `photos` tab was proven impossible by comparing id lists rather than by trusting a status code.

**The trending rail in the header is hardcoded** and does not come from the trending endpoint, which exists and works.

Found while checking why a tag visible in the rail returned no search results.

Recorded in `deferred-findings.md`, not fixed, since the rail is not one of these four surfaces.

## Verification that the backend was not modified

The backend repository is read-only for this work.

```
$ cd ../backend && git status
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

The staged `Makefile` was already there before this work began and is not ours.

It was recorded as the baseline at the start so this check could not be misread.

No file in the backend repository was created, modified, or deleted.

## Data

Nothing was deleted from the development database.

The accounts the backend team created for administrative testing were not touched.

Rows were created to make pagination testable, because the seed produces fewer than one page and pagination has been claimed without evidence in this project before.

What was created and left behind is listed at the end of `verification-evidence.md`.
