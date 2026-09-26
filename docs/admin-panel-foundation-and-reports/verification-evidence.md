# Verification Evidence

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every claim here was observed in a real browser (Chromium via Playwright) against the running dev server at `http://localhost:5173`, proxying to the backend at `http://localhost:8080`, on 2026-08-21.
Where a session was needed on both sides of a check, the two sessions are named.
Fixtures were created through the public API and, for a story target, through direct SQL because no story-upload flow exists in the panel.

## Session and role separation

1. Signing in as `admin@seed.local` landed on `/admin/reports` and rendered the administrator navigation (`reports` under moderation, `escalated` under administration with a count badge).
2. Signing in as `mod@seed.local` landed on `/admin/reports` and rendered the moderator navigation only: the nav text was exactly "moderation reports", with no escalated item and no `a[href="/admin/escalated"]` present.
3. Reloading the page as an administrator kept the session and rendered the administrator navigation on the first paint, including the escalated item; there was no moderator-to-administrator flicker, because the guard holds the loader until the boot refresh resolves.
4. As a moderator, over a full page load the network tab showed zero requests to `/api/v1/admin/reports/escalated/count`; the boot refresh, `users/me`, `config/vocabularies`, the report list, and the reporter resolutions were the only calls.
5. As an administrator, the escalated count endpoint returned 200 and the badge showed the live count; the poll is gated on role and runs on a 60-second interval.
6. As a moderator, typing `/admin/escalated` into the address bar rendered a full-page "not available - the escalated queue is available to administrators only"; there was no table and the screen behind the guard never mounted, so no 403 was fired.
7. As an ordinary user (`alice@seed.local`), navigating to `/admin` redirected to `/app`.
8. Signing out returned `POST /api/v1/auth/logout` 204, cleared the store, and redirected to the login page.

## The token epoch and the 401 that cannot loop

9. Signed in as an administrator, incrementing `token_epoch` for `seed_admin` in the database and then navigating to the escalated queue produced one 401 on the list call, one refresh (200, because a bare epoch bump does not revoke the refresh token), and a successful replay; the session self-healed with exactly one refresh and no loop.
10. Then additionally revoking the account's refresh tokens in the database and opening a report produced two 401s on the report and target calls, a single coalesced refresh attempt (401, because the refresh token was now revoked), and a redirect to login; the single-flight guard meant one refresh for two 401s, and there was no loop.

This is a refinement of the backend handoff's section 15.1 item 4, which assumed the epoch bump alone would force a redirect.
Observably a bare epoch bump invalidates the access token only, and the client correctly refreshes and stays signed in; the redirect requires the refresh to also fail.
Both the no-loop guarantee and the exactly-one-refresh guarantee hold in both cases.

## Report queue

11. The queue rendered reasons as their vocabulary display names ("Spam", "Scam or Fraud", "Harassment or Bullying", "Hate Speech", "Nudity or Sexual Content"), confirmed against the vocabulary response; no raw key appeared.
12. Reporters rendered as resolved usernames (`seed_carol`, `seed_alice`, `seed_bob`); a page of twenty rows referencing three distinct reporters produced exactly three `admin/content/user/{id}` requests.
13. Timestamps rendered in the viewer's local zone, labelled with the zone (`Asia/Saigon`), with the UTC instant on hover.
14. First paint was `GET /api/v1/reports?status=pending&limit=20`, carrying only declared parameters.
15. Changing the type filter to `user` updated the URL to `?reportType=user`, fired a fresh `GET /api/v1/reports?status=pending&reportType=user&limit=20` with no cursor, produced no `INVALID_CURSOR`, and narrowed the list to twelve user rows.
16. With thirty-one pending reports, the first page showed twenty rows and a "load more" button; loading more fetched page two with a cursor, showed all thirty-one rows, and removed the button; no third page request was made past the point where `hasNextPage` became false.
17. There is no numbered pagination anywhere; the only affordance is "load more".

## The four list states

18. Populated: the queue with rows.
19. Empty: filtering to `reportType=message` rendered "the queue is clear - no reports match this view. nothing is waiting for review.", worded positively, with no table.
20. Loading: a skeleton renders on first paint before the list resolves.
21. Failed: forcing the report list request to error rendered "something went wrong - Unable to reach the server. Please check your connection." with a "try again" button; the message was the normalized safe string, not a raw error.

## Report detail and actions

22. A report whose target is a user rendered the owner and the entity status with no empty content block where text would be, and offered no remove or restore control.
23. A report whose target is a story rendered read-only with the caption, the media, and an on-screen note "a story cannot be taken down from this panel. the available actions are resolve, dismiss, and escalate.", and offered no remove or restore control.
24. A removed post rendered its removed state once (the lifecycle status badge), not twice.
25. Submitting an action with an empty reason showed "a reason is required" as a field-level message beneath the textarea and kept the dialogue open; it was not a toast.
26. Restoring a removed post that carried a hashtag banned while it was down produced the success message "post restored. dropped: #bantag", naming the tag.
27. Restoring a removed post with no banned hashtag produced the plain message "post restored", with no empty "dropped" text.

## Two sessions

28. Role separation, moderator versus administrator: verified across two sign-ins on the same machine.
The moderator saw only the report queue in its navigation and was refused the escalated route; the administrator saw both and reached the escalated queue.
Neither tree leaked into the other.

29. Two reviewers on the same pending report: with reviewer one resolving the report through the API and reviewer two resolving it in the browser, reviewer two received the calm message "another reviewer already handled this. refreshing.", the dialogue closed, and the report refetched to show the resolved status; it was not a raw error dialogue.

30. A moderator escalated a report, reloaded it, and found it readable with resolve and dismiss absent (only a content control remained, which the contract permits); an administrator then opened the same report and found resolve and dismiss available.

## Other checks

31. Every modal closed on Escape, confirmed on the reason dialogue, including under the reduced-motion emulation in check 35 below.
32. A vocabulary entry disabled in the database (`spam`) still rendered its display name "Spam" on an existing report after a reload, rather than vanishing or showing the raw key.
33. The user-facing application still works after this phase: signing in as an ordinary user landed on `/app`, the feed loaded, opening a post worked, and posting a comment succeeded and appeared.
34. No raw hex colour value exists in the code this phase added, confirmed by searching the panel source.

## Reduced motion (Definition of Done item 28)

35. Exercised through Playwright's media emulation (`page.emulateMedia({ reducedMotion: 'reduce' })`), confirmed active via `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`, and confirmed it survived navigation within the session.
Driven the report queue and the report detail screen under the emulated preference, including opening the reason-confirm dialogue on a removed-post control (`screens/report-detail-reduced-motion.png`) and closing it with Escape, which still worked (check 31).
Every element in the panel that carries a duration was measured with `getComputedStyle` while the preference was active: the navigation link and sign-out button transitions (`transition: background var(--duration-fast) ...` in `panelStyles.js`), the table row hover transition (inline, in `RecordTable.jsx`), and the loading-skeleton fade (inline `animation: lx-fade-in ...`, in `ListStates.jsx`).
All four resolved to a computed `1e-6s` (0.001ms) duration, matching the global stylesheet's `prefers-reduced-motion` rule (`src/index.css` lines 594-603), which sets `animation-duration`, `animation-iteration-count`, and `transition-duration` to `0.001ms !important` on every element.
An author-stylesheet `!important` declaration overrides an inline style without `!important` even though inline styles normally have higher specificity, which is why the global rule reaches the panel's inline durations; this was confirmed directly by constructing a test element carrying the exact inline `animation` and `transition` declarations used in the panel and reading its computed style under the emulated preference.
No element in the panel animates under the reduced-motion preference.
The reason-confirm dialogue's 500 millisecond arming delay is unaffected, and correctly so: it is a functional debounce against a mistaken double-click on a destructive action, timed in JavaScript rather than expressed as CSS motion, not a decorative animation the reduced-motion preference is meant to suppress.

## Close-out delta

36. The moderator's status filter offers exactly two options, `all`, `pending`, `reviewing`; the administrator's offers five, `all`, `pending`, `reviewing`, `resolved`, `dismissed`, `escalated`.
Confirmed by reading the rendered filter bar text in both sessions (`screens/report-queue-filters-moderator-01.png` for the moderator; the administrator's five-option bar was read from the DOM in the same session used for check 6).
37. A moderator escalated a report (`d52c5431-...`), then found it absent from the queue under every status the moderator's filter offers, under a direct navigation to `?status=escalated` even though the UI no longer offers that chip, and under no status filter at all; the last two were confirmed empty both in the rendered table (zero rows) and at the network level (`GET /api/v1/reports?status=escalated&limit=20` returned `200` with an empty `content`).
The report remained readable at its own URL, with the moderator's normal escalated-report controls (no resolve or dismiss, a content control present).
`GET /api/v1/admin/actions?actionType=escalate_report` as the same moderator returned exactly the one action, and its `reportId` field already carried the report's id, confirming the audit row needs no backend change to support a future link back to the report.

## What could not be verified, and why

The administrator escalated-count poll interval (Definition of Done item 7, "roughly two requests over two minutes"): the poll was observed firing on its 60-second interval and gated on role, but a full two-minute count was not timed; the gating and the interval were confirmed rather than the exact two-minute total.

A message-target report (part of Definition of Done item 18): a story target was created and verified read-only; a message target was not created because it requires a conversation and message fixtures the panel does not build, and the read-only rendering is the same branch as the story target (both fall outside the actionable post-and-comment set).
