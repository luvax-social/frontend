# Profile Tabs, Social States, and Removing Fabricated Data

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

What changed, in plain language.

## In short

Three groups of work, all of which make the application honest about what it can do.

The profile now has working photos and liked tabs, because the backend delivered the two endpoints they were waiting on.
Private accounts, follow requests and blocking now have real states instead of no state.
And every invented person, conversation, story and topic has been deleted, including two that the viewer could click through to a profile or story that does not exist.

## The backend's question, answered first

The backend asked whether the frontend sends query parameters it does not declare, anywhere at all, because the answer decides whether strict rejection is turned on across the whole API.

**The answer is an empty list.** No frontend call sends an undeclared parameter.

The three parameters they asked about specifically, `mediaType`, `hasMedia` and `postType`, were terminal probes from the previous phase and were never in the frontend source. Two of the names do appear, both as request body fields, which strict rejection does not touch.

`outbound-parameter-audit.md` has the full endpoint-by-endpoint table and is written to be handed to the backend team directly.
It was written and committed before any feature code, as required.

## What changed

### The photos tab

Asks the server for `image` and `carousel`.

Carousels are included as a product decision: a carousel is an image-first format in the way people author and look for it, and excluding it would empty the tab of exactly the posts it exists to show. Video is excluded because a tab labelled photos should not contain video. The reasoning and what was rejected are in `design-decisions.md`.

Switching tabs cannot replay a stale cursor. The filter is part of the query key, so a different filter is a different query and starts from a null cursor, which makes replaying a foreign cursor unrepresentable rather than merely avoided.

### The liked tab

Appears on the viewer's own profile only, because the endpoint always answers for the authenticated caller and takes no path parameter for anyone else.

Another person's profile shows two tabs. A disabled third was rejected: a disabled control claims the thing exists and is withheld, and neither half of that is true here.

### Short pages no longer end a list

A saved or liked page can come back short, or empty, while more pages exist.

The saved screen, shipped in the previous phase, got this wrong in two ways at once: it told the viewer they had saved nothing, and it never mounted the control that would fetch the next page, so the list stopped for good. Both are fixed, and the fix is shared with the liked tab.

### Honest search wording

The post half of search used to read "no posts match X, or search is temporarily unavailable", because the two were indistinguishable.

The response now carries a flag for exactly that, so the two cases are told apart and each is worded as what it is. Only the degraded state suggests retrying, because retrying is worth nothing on a genuine empty result.

### Block from the profile

Block and unblock are now reachable from the profile overflow menu, which previously did not exist at all.

Blocking is confirmed first, and the confirmation states what actually happens, including that unblocking does not restore the follows it destroys. That was verified rather than assumed.

The most useful finding here: a blocked account's profile answers **404**, so the screen would have shown a connection error for something the viewer chose to do. It now recognises the case from the blocked list and says so.

### Private accounts and follow requests

A private account is identifiably private to a non-follower, its three null counts render as `-` rather than `0`, and following it shows `requested`, driven by the server's viewer state rather than by having clicked.

Follow requests were already implemented in the notifications screen. They were verified end to end: approving Ava's request changed her view from no relationship and 403 on posts, to following with readable counts and posts.

### Fabricated data

Eight separate items removed, including invented conversations whose avatars were photographs of real people, and a story viewer that invented a story for any id it did not recognise.

Two of them were reachable, which was the real problem: "view profile" on an invented person navigated to an id that cannot exist, and every story rail item linked to a story that does not exist.

Neither path remains. `fabricated-data-removal.md` has the full inventory and the sweep confirming nothing leads anywhere that does not exist.

The messages tab stays visible in the navigation and is disabled, using the design export's own disabled treatment for buttons since it defines none for navigation items.

## The commits

| Commit | What it carries |
|--------|-----------------|
| `7b5418a` | `docs(common): audit outbound query parameters against the declared contract` |
| `1b722de` | `fix(post): keep the saved list paging past an empty page` |
| `f56bcaf` | `feat(post): add liked posts and a profile post type filter` |
| `1b77be9` | `feat(social): add photos and liked tabs, private states and profile block` |
| `c8efd06` | `feat(post): tell a degraded post search apart from an empty result` |
| `ad5980c` | `feat(common): remove fabricated conversations, stories and topics` |

The audit commit is first, before any feature code.
Documentation is committed separately from code.

Code changed: 788 insertions, within the 1000-line target.

## The backend was not modified

Required verification, run in the backend repository:

```
$ git status --short
A  Makefile

$ git log --oneline -1
42f6147 Merge pull request #157 from zentech-graduation/feat/post/profile-tabs-and-search-signal
```

**The staged `Makefile` predates this phase.** It was present in the working tree before any work began and was not created, modified, staged or removed here. No other backend file is touched, and no file was modified by this phase.

## What is not verified

Stated here rather than buried, because this phase is partly about not overclaiming.

The short-page fix was **not** deliberately exercised by producing a short page. The defect it fixes was confirmed by reading the shipped code, and the fix is reasoned from the endpoint's documented behaviour, but the list was not observed continuing past an empty page.

The block loop and the degraded search wording were verified at the API level but not walked in the browser.

Pagination was not captured past the first page in the browser.

The full list, including what was verified and how, is in `verification-evidence.md`.

## The documents

| File | What it holds |
|------|--------------|
| `outbound-parameter-audit.md` | The backend's answer, as a list. Written first |
| `endpoint-verification.md` | Observed request and response for the `type` parameter, the liked endpoint, the `degraded` flag, private accounts and blocking |
| `changes-applied.md` | One entry per change, with evidence and file |
| `design-decisions.md` | Decisions, reasoning, what was rejected, and every derived treatment labelled |
| `verification-evidence.md` | Browser and API evidence, and an explicit list of what was not verified |
| `fabricated-data-removal.md` | Every invented thing found, what happened to it, and the sweep |
| `deferred-findings.md` | Found and not acted on, with the phase each belongs to |

## One thing worth knowing before running this

The documented `luvax_*` seed set was not loaded, and the seed runbook's account-verification blocker is out of date.

It describes the old Resend mail transport. The dev profile now delivers to Mailpit, so the verification tokens can be read from the Mailpit API and submitted to the real endpoint. The manual database write the runbook prescribes is no longer necessary. The procedure that works is in `verification-evidence.md`.
