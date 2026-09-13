# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- A pull request check that rejects any commit whose subject exceeds the 80-character limit, closing the gap that let an over-length subject reach develop while only pull request titles were validated.
- `scripts/regenerate_struct_figures.sh`, which regenerates the slice inventory, the route table, the dependency list, the npm script list and the environment variable list from `git ls-files` and `package.json`.
- A back control on the three anonymous support screens, beside the product mark, so a reader who is in the wrong place has an affordance rather than a wordmark to guess at.
- Support is a settings section, carrying ticket submission, the account's own requests and the verification request, reachable from the side rail and from the settings list.
- A support link on the sign-in screen and on the forgot-password screen, so a person who cannot get into their account has a route to us without holding an email.
- A sign-in refused because the account is banned or suspended now says which of the two it is and offers the support form, instead of reading as a passing failure worth retrying.
- The reason a verification request was refused is shown while the next one is being written, not only on the old request.
- A support surface where an account can open a support request, appeal a decision, or request a verified badge, and read the reply to any of them.
- Three anonymous support routes: the appeal form reached from a moderation notice, the email confirmation landing, and a public form behind a Turnstile challenge.
- A staff support console under moderation, with the queue, ticket detail, claiming, responding, escalating and internal notes.
- A verified badge beside a username on every surface that shows one: post headers, comments and replies, profile headers, profile list rows, search results, suggestions, direct messages, story headers and notifications.
- Eight verification categories, each with its own glyph inside the badge, so the mark says what an account is verified for and not only that it is.
- A verification request form, with its submitted and decided states, that counts the evidence fields as they are filled and states the three-field minimum before submission rather than refusing afterwards.
- A verification review queue in the moderation panel, reachable by moderators as well as administrators, showing every evidence field and every badge the account previously held.
- People you may know in the right rail, with follow, a keyboard-reachable dismiss control, pending state for a private account, and skeleton loading.
- A settings toggle to stop the account being offered in other people's suggestions.
- Hashtag detail page at `/app/tags/:name`, with a shareable `/tags/:name` deep link that redirects to it.
- Trending hashtags in the right rail, with a personalised tab and a platform tab and a marker on pinned hashtags.
- Hashtag suggestions in the composer before any text is typed, replaced by live search results as soon as a `#` token is being written.
- Hashtag tokens inside post captions are now links to that hashtag's page.

### Changed
- Zod and the React and router runtimes are emitted as their own chunks, taking the entry chunk from 528 kB to 202 kB and clearing the build's chunk-size warning; all three are still fetched in parallel with the entry, so the sign-in form validates on first interaction without an extra round trip.
- The frontend rule files now describe this repository rather than the backend: `comment_style.md` was a Java document naming Javadoc, `@Transactional` and a pre-commit hook that has never existed here, and `struct.md` described a four-slice scaffold whose whole application lived at one address.
- `DESIGN.md` records the casing split the product actually uses - lowercase for chrome and short labels, sentence case for anything that reads as a sentence - and names the icon component as a file in this repository rather than a global on `window`.
- `CONTRIBUTING.md` describes the Vitest suite and the CI workflow that runs it, in place of a claim that no automated test suite was configured.
- The `docs/` tree is triaged: every one of its 188 files carries a line saying which date it records and that it is not maintained, and the eight documents a later source replaced name their successor.
- The local environment runbook's service table matches `docker-compose.yaml`, and its mail section states that Mailpit was removed and what replaced it.
- The support screens use the same field treatment as sign-in and sign-up: the label rests inside the box and rises to the border once the field has focus or content.
- Copy on the support and auth screens is sentence case rather than all lowercase.
- Category names come through as the vocabulary table writes them, instead of being forced to lowercase on the way to the screen.
- Every support surface was built and none of them had an entry point: nothing in the signed-in navigation reached support, and no signed-out screen linked to the public form, so the only support-shaped thing a person could find was a badge request buried in account settings.
- `/app/support` now redirects into the support settings section, so an existing link or bookmark still lands on support while there is one place that looks like the entrance. A ticket keeps its own address.
- The trending hashtag count is now nullable on the wire: the backend returns no count for a hashtag outside the current snapshot rather than substituting its lifetime total, and this application renders that as new. A renderer without a null branch would have shown an empty value or the word null beside a hashtag name.
- Verification is requested through the support settings section and reviewed in the support console, rather than on screens of their own.
- Trending hashtags and people you may know are shown on explore below the width where the right rail is dropped, so neither feature is absent on a phone.
- A hashtag result in search and explore now opens that hashtag's page instead of running a caption text search for its name, which returned unrelated posts or nothing at all.
- The preview server proxies the API, so a production build can be exercised against a local backend.

### Fixed
- An already signed-in visitor who opens the sign-in, registration, forgotten-password, password-reset or verification address is no longer signed out by the visit; the session is restored from the refresh cookie and the sign-in and registration addresses send them on to their role's landing screen.
- The dropdown arrow on a support form's select sits on the field's own gutter; the native one ignored the field's padding and read as pushed inward.
- A verification request now reaches the server. The form sent two evidence fields the endpoint does not declare, and it refuses an undeclared field outright rather than ignoring it, so every submission failed no matter what was typed.
- A moderator now sees the last two evidence fields of a verification request, which the console had been reading under names the response does not carry.
- Links on the signed-out screens now show a focus ring; the global rule named only buttons and form controls.
- The email confirmation landing now shows what happened instead of sitting on its loading state for ever when a link has expired or already been used.
- The appeal landing now checks the link before offering the form, so a dead link is reported before the appeal is written rather than after, and reloading the page or restoring the tab no longer discards the link and the text composed so far.
- A declined support request now reads as a refusal to the person who made it, rather than sharing the word "closed" and the reply heading with a request that was granted.
- Every field on the support screens shows a focus ring again; an inline style had been overriding the one the stylesheet draws.
- The focus ring is now visible against the surfaces controls actually sit on, error text is readable on the error surface, and the primary button's label is readable on its fill in the dark theme.
- The support queue uses the width the layout gives it: a subject fits on one or two lines, a timestamp fits on one, and whether a ticket is claimed is shown the same way as its status.
- A timestamp and its timezone are now separated in the text as well as visually, on every panel screen that shows one.
- A support ticket now has an address: rows in the help centre are links rather than buttons, with a visible affordance and a touch target that does not depend on how long the subject is.
- The challenge on the public form follows the application's theme rather than the operating system's, and the instruction to complete it no longer appears before it has drawn.
- The three anonymous support screens now carry the product mark, linked to the public entry point; they previously offered no navigation of any kind.
- The verification badge no longer claims to convey its category visually, which it cannot at the size it is drawn, and its accessible name now uses the category's display name rather than its raw key.
- A hashtag with no count for the current trending window is now shown as new rather than as a missing number.
- The staff console announces the outcome of a claim and of a decision, and says that reading a ticket is not what the claim gates.
- The right rail no longer renders its last row underneath the fixed messages launcher, which made that row's controls unclickable at some viewport heights.
- Explore no longer scrolls sideways at desktop widths where its wider centre column did not fit beside the rail.
- Signing in from a production build now works regardless of the API host's CORS configuration, and a deployed session can refresh itself: every request is sent to a same-origin path instead of an absolute cross-origin address, which previously meant the sign-in request could be refused by the server's CORS filter before authentication ran, and the refresh cookie was withheld by the browser wherever the API is a different site from the application.
- The settings sub-navigation is no longer covered by the expanded navigation rail, which had made the left half of every entry unclickable from the moment settings was opened, because opening it from the rail is what expands the rail.
- The share control on a post now has an accessible name, so it can be reached by assistive technology and announced as something other than an unlabelled button.
- The tablet shell no longer overflows the viewport at 768 pixels wide, where the reading column previously started off-screen and the right rail extended past the right edge.
- The tablet right spacer now matches the left one, so the reading column is centred rather than sitting left of centre.
- Layout decisions that depend on the viewport width now update when the window is resized within one breakpoint.

### Removed
- The verification panel in account settings, and the unused service module behind it. Verification is a support category, and the panel was a second door with its own field styling.
- The standalone verification queue screen, whose function moved into the support console.

### Tests
- Unit coverage for the session bootstrap, pinning that each address restores a cookie-backed session rather than clearing it, and that the OAuth callback is left to complete its own exchange.
- Unit coverage for the support request schemas, the declared-key request contracts, the ticket lifecycle helpers, and the console's role gating.
- The verification request body is pinned to the exact field names the endpoint declares, so a name that exists only on the form fails a test rather than every submission.
