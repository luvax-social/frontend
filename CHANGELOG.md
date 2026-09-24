# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Suggestion cards in the feed: trending hashtags with post previews, and suggested accounts showing avatar, banner and follower count. A card appears after every fifth post, alternating between the two kinds, and each kind can be dismissed for the session.
- An appeal action on each warning in settings and on each content-removal notification, opening an appeal against that decision without waiting for an email.
- A screen for requesting a replacement appeal link when the moderation email never arrived, reachable from the appeal and status screens.
- A status link handed over once when an appeal is filed from a moderation email, and an anonymous screen that resolves it, so an appellant with no account to sign in to can follow their own appeal.
- A copy control beside the appeal status link, and a line saying the same link was emailed, so the one credential an appellant leaves with is not something they have to transcribe by hand.
- A route to the replacement appeal link from the public support form, which is where the sign-in failure copy already sends someone who cannot reach their account.
- In-product notifications now name comment, story and message removal, which previously showed no notification at all.
- A Cloudflare Turnstile challenge on sign-in, registration, forgot password, reset password, resend verification and report submission, alongside the public support form that already carried one.
- Every submit control behind a challenge stays disabled with a visible reason until it is solved, and returns to that state when the token expires after roughly five minutes.
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
- A notifications screen rewrite: chips for all, unread, comments, mentions, follows, system and verified actors, a pinned follow-requests entry with its own confirm and delete sub-view, and a numeric unseen badge shared across every navigation surface.
- Reply and comment notifications now deep-link by address, so the target survives a reload or a link shared outside the app, and resolve a nested reply or a comment on a later page through the same thread the post detail screen already reads.

### Changed
- Each suggested account carries an options menu instead of a close button, offering follow, stop suggesting this account, block and report, with the two irreversible actions marked in red.
- Suggestion sections are dismissed from an options menu in the section header rather than from a close button, so hiding a section is one choice among several instead of the only one on offer.
- The banner, the avatar and the username of a suggested account all open that profile; previously only the username did.
- Trending hashtag thumbnails are larger, the section carries an options menu, and the explore link is shaped as a button so it reads as one.
- Suggestion sections are labelled with an icon beside the section name.
- Suggested account banners are square on mobile, matching the edge-to-edge media of the posts around them.
- The feed column is back to its original width; widening it for the suggestion cards had made a post with a large image no longer fit in one view.
- Suggested accounts show two to a row on desktop and one on mobile, with a larger avatar and the account's follower count in place of the explanatory line. Further accounts appear in later cards down the feed rather than behind a scroll control.
- Suggestion cards sit directly on the feed background with their content edge to edge, matching the posts around them, instead of inside a raised rounded container.
- The suggested-accounts carousel is paged by arrows overlaid on the track itself, in the same position and style as the post carousel's, rather than by controls in the card header.
- Each kind of suggestion card now appears at most once in a feed, instead of repeating the same accounts and hashtags every five posts.
- Trending hashtags are drawn from a deeper pool and rotate per visit rather than always showing the busiest few.
- The feed no longer shows the right rail. Explore and the hashtag page still show trending hashtags and suggested accounts in the rail.
- The staff support ticket is now laid out in the titled cards the report detail uses — its state and facts, what the requester wrote, the reply already sent, and the controls each in their own region — instead of one undivided card.
- Answering a support ticket now names each field and says where its text goes: the reply that reaches the requester and the note that never leaves the panel are labelled as such, on fields visible against the card rather than the same colour as it.
- The action log opens the action beside the log, with the row it belongs to marked, instead of over a scrim that hid the rows being compared.
- The escalated queue and my escalations open a report beside the queue, as the report queue and the account list already do, instead of navigating away and discarding the queue's position.
- The support icon in the admin panel's navigation is now a question mark rather than a checkmark, which read as "done" beside a queue of open tickets.
- The report detail's status badge now leads its own row above the field grid, matching the account screen's state-then-detail layout instead of sitting inline as one field among several.
- A refused challenge is now named as its own failure on every form rather than reported as a wrong password or a generic error, so the reader is not sent looking for a mistake that is not there.
- Any failed submission re-arms the challenge, not only a refused one, because the token is single-use and a retry would otherwise send a spent one.
- The Turnstile site key now governs the authentication forms and the report dialog as well as the public support form; the Google sign-in callback is deliberately left unchallenged.
- The challenge reserves its own height before the script resolves, so no card shifts when it appears, and it no longer claims a fixed width that overflowed a 390px screen.
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
- Opening the notifications screen no longer marks every notification read; read state now follows only what is actually seen and what is tapped.
- The unread indicator is a trailing dot per row instead of a full-row tint, which had lost contrast on its own timestamp in the dark theme.
- Mark all as read only reaches rows fetched before the action, so anything arriving afterward stays unread.
- The two duplicate notification bells and their two dots on phones are down to one, since the bottom navigation already carries its own.
- A notification row's timestamp now sits inline with its title instead of on its own line below the preview, and its follow-back or appeal action now sits beside the options button instead of below the text, matching the approved wireframe.
- A notification row's quoted comment or reply text is now truncated to one line with an ellipsis instead of wrapping in full, so a long reply does not push the rest of the list down.

### Fixed
- A full page reload no longer signs the user out after a password, email-verification or Google sign-in, because the sign-in requests now let the browser keep the session cookie the API sets from its separate origin.
- The verified badge beside a name now lines up with it everywhere it appears, instead of sitting visibly low against the name's optical centre.
- Opening a post's detail view no longer scrolls the feed behind it back to the top or replays its entrance animation; the feed now stays exactly where it was.
- A verified badge inside a comment no longer sits flush against the comment text that follows it.
- A text area in the panel now shows the focus ring every other control there has; keyboard focus in the support reply, note and escalation fields was previously invisible.
- A disabled outlined button now reads as disabled in every variant. Only the filled one was styled for it, so "close as rejected" and "escalate" looked clickable while the field they depend on was empty.
- The panel now reloads once automatically when a route's code chunk fails to load after a new deploy or a dev restart, instead of leaving a dead "something went wrong" page.
- The report detail's reporter note, resolution note, and reported post/comment text now sit in a raised, bordered block instead of blending into the card's own background.
- The report queue, escalated queue, my-escalations queue, and report detail screens now use the panel's shared card component the same way the account screens do, instead of a hand-rolled card div.
- The staff support ticket detail card had no inner padding, so its title, badges, body text and controls sat flush against the card's own border.
- The in-product appeal form showed its heading and nothing else: the subject field, the body field and the submit control were all conditional on a category selector that appeal mode deliberately does not have, so no appeal could be opened from a warning or a notification.
- An appeal refused because the decision was already contested, could not be found, or carries no appeal route now says which, instead of a generic failure, and stops offering a control whose every outcome would be the same refusal.
- The staff queue marks an appeal by the moderation decision it contests rather than by its category, so an appeal opened from a signed-in session is visible as one and an ordinary request labelled with an appeal category is not mistaken for one.
- The appeal marker in the staff queue reads as an appeal rather than borrowing the word `escalated`, which sat beside a status column showing `open` and read as a contradiction.
- A moderation notification no longer reports contract drift in development for the actor it is never sent with; the platform takes those actions, so the absence is declared rather than warned about.
- A hashtag holding a single post now reads "1 post" on the trending rail and the hashtag screen, which both hardcoded the plural; all three surfaces that render the figure now share one helper.
- A visitor who has never signed in on this browser no longer triggers a session-restore request on every cold load; it could only fail, and it put a failed request in the console on the first screen anyone sees. A stale session marker still triggers the call and is still handled.
- The commit subject check now fails when it cannot resolve the revision range it was given, instead of reporting that all zero subjects were within the limit and exiting successfully.
- The pull request check that rejects an over-length commit subject now actually runs; it was invoked in a way that failed with a permission error before the script was ever read, so the gate was red on every pull request for a reason unrelated to commit subjects.
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
- The mentions chip on the notifications screen now actually filters to mentions instead of repeating the unfiltered list.
- Notifications past the first twenty are reachable by scrolling instead of stopping at the first page.
- Warning and support-ticket notifications now show their own wording instead of a generic fallback, and never name the staff member who acted.
- Post-removal and restoration notifications can now be appealed in place.
- Notification rows are keyboard-focusable with a visible focus ring, and every icon-only navigation button carries an accessible name.
- Post detail now pluralises the like count correctly and marks only the actual top comment as pinned, instead of every comment the backend happens to flag.
- The centre content column no longer renders the last row of a long list underneath the fixed messages launcher, on desktop, tablet and settings; the right rail already reserved this clearance but the reading column next to it did not.

### Security
- Neither the appeal link nor the appeal status link is copied into browser storage any more; both are read from the address only, which is the rule already applied to access tokens and matters more here because an appeal link authorises a write and a status link reads for ninety days.

### Removed
- The verification panel in account settings, and the unused service module behind it. Verification is a support category, and the panel was a second door with its own field styling.
- The standalone verification queue screen, whose function moved into the support console.
- The per-row unread background tint on the notifications screen, replaced by a trailing dot.

### Tests
- A regression test asserts that every request able to receive the session cookie is sent with credentials.
- A Playwright end-to-end project covering the anonymous appeal paths, run with `npm run test:e2e`: the lost-link recovery form submits and reaches its one success state, the challenge is re-armed after a refusal so a retry succeeds, and the status screen renders a known appeal, persists no token and answers every dead link identically.
- Coverage proving the anonymous status screen renders one identical state for an unknown, an expired and a malformed token, that it writes no token to storage, and that it offers no control that could change anything.
- Coverage proving the captcha is re-armed after every failed link-recovery submission, and that the confirmation is the same whatever the address turned out to be.
- Coverage proving the staff console tells an appeal from its audit row rather than from its source or its category, while still gating the decision on the rule the server applies.
- Coverage for the two new support schemas and for the shared helper that builds the appeal address both in-product entry points use.
- The challenge token is covered on every schema that carries one, at the boundary the backend enforces.
- The sign-in form is covered end to end for a wrong password: the challenge is re-armed and the submit control returns to disabled.
- Unit coverage for the session bootstrap, pinning that each address restores a cookie-backed session rather than clearing it, and that the OAuth callback is left to complete its own exchange.
- Unit coverage for the support request schemas, the declared-key request contracts, the ticket lifecycle helpers, and the console's role gating.
- The verification request body is pinned to the exact field names the endpoint declares, so a name that exists only on the form fails a test rather than every submission.
- Coverage for the notification cache reducers, the rolling time-section buckets, and the per-type sentence builder.
- Coverage for the notifications screen's seen flow: one call on the first page load and none on any other chip, and mark-all-read bound to the most recently fetched page rather than the moment of the click.
- A Playwright suite for the notifications screen at 390, 768, 1024, 1440 and 1920 pixels, covering the seen flow, chip filtering, the read/unread/delete menu with rollback, and an unavailable target.
