# Verification Gaps Closed

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The previous phase recorded six things it had built but not observed.
This document closes the first five.

Each entry records what was done, what was observed, and any defect the exercise turned up.
Nothing here is closed on the grounds that the code looked right.

## Environment

| | |
|---|---|
| Backend | `http://localhost:8080`, commit `42f6147`, started in 22.7 seconds |
| Frontend | `http://localhost:5173`, Vite 8.0.13 dev server |
| Containers | compose project `backend`: postgres, redis, rabbitmq, elasticsearch, mailpit |
| Browser | Chromium via Playwright, dev tools attached |
| Account | `luvax_ava`, with `luvax_ben` used as a control |

The database survived the restart with the `luvax_*` accounts intact.
This contradicts `docs/reconnaissance/local-environment-runbook.md`, which states that postgres has no named volume and that a restart discards the data.
No reseed was needed.

## Gap 1: the short-page case

**The claim to test.** A liked or saved page can come back shorter than the requested limit, including empty, while more pages exist.
`useDrainEmptyPages` was built for this and never exercised.

**How the condition was produced.**
Ava liked and saved a set of her own posts, then archived the posts occupying the first page of each list.
Archiving leaves the like and save rows in place while removing the posts from the page, which is exactly the shape the hook exists for.
Only the documented contract was used: `POST /posts/{id}/like`, `POST /posts/{id}/save`, and `PATCH /posts/{id}/status` with `{"targetStatus":"archived"}`.
No database write was made.

The strongest form of the condition was reached, an empty first page rather than merely a short one:

```
liked  page1 rows= 0 hasNextPage=True
liked  page2 rows=10 hasNextPage=True
liked  page3 rows= 4 hasNextPage=False   -> 14 rows exist
saved  page1 rows= 0 hasNextPage=True
saved  page2 rows=10 hasNextPage=True
saved  page3 rows= 5 hasNextPage=False   -> 15 rows exist
```

**Observed in the browser, liked tab.**
The tab rendered 14 rows.
It did not declare itself empty.

Network log for the tab, showing the empty first page being drained rather than treated as the end:

```
GET /api/v1/posts/liked?limit=12                 => 200   (0 rows)
GET /api/v1/posts/liked?cursor=bGtkOjE3ODY1OTQwMjIxMDQ4NzI6...&limit=12 => 200
GET /api/v1/posts/liked?cursor=bGtkOjE3ODY1OTQwMjA3NzY4MDA6...&limit=12 => 200
```

**Observed in the browser, saved list** at `/app/settings/saved`.
The list rendered 15 rows, with the same three-request drain:

```
GET /api/v1/posts/saved?limit=12                 => 200   (0 rows)
GET /api/v1/posts/saved?cursor=c2F2OjE3ODY1Mjk1ODc3NjM1MjI6...&limit=12 => 200
GET /api/v1/posts/saved?cursor=c2F2OjE3ODY1Mjk1ODYzOTg3MjA6...&limit=12 => 200
```

**The other half of the claim, that the empty state appears only when the server says there is no next page.**
`luvax_ben` has genuinely empty lists, `rows=0 hasNextPage=False` on both.
Signed in as Ben, `/app/settings/saved` rendered:

```
nothing saved yet.
tap the bookmark on a post to keep it here.
```

So the empty state is driven by the server's `hasNextPage` and not by page length.
Both directions of the claim hold.

**Defect found.** None.
The fix the previous phase shipped behaves as designed under the condition it was written for.

## Gap 2: the block loop in a browser

Every step below was performed through the interface.

| Step | Observed |
|------|----------|
| Open Dan's profile from the feed | Profile rendered, follow control read `following` |
| Overflow menu | `block @luvax_dan` and `report` offered |
| Block chosen | Confirmation dialog rendered, `role="dialog"` |
| Confirm | Profile replaced by a blocked notice |
| Feed | Dan's post gone, feed went from 4 articles to 3 |
| Blocked list | `1 blocked user`, Dan listed with an `unblock` control |
| Unblock | List became `No blocked users` |
| Reopen profile | Readable again |

**The dialog renders what was written.** Captured verbatim:

```
block @luvax_dan?
blocking takes effect straight away:
you both stop following each other
their posts leave your feed
neither of you finds the other in search
you can no longer open their profile
unblocking later restores access but does not restore the follows. if you want to
follow each other again, you will both have to do it again.
cancel
block
```

**The dialog's least obvious claim was confirmed in the browser, not just at the API.**
Before the block, Dan's profile showed the follow control reading `following`, with 1 following and 1 follower.
After block and unblock, it showed `follow`, with 0 following and 0 followers.
Access was restored and the follows were not.
That is precisely what the last line of the dialog promises.

**What the screen does at the moment the profile becomes unreadable.**
The backend answers 404 for a blocked profile.
The screen does not fall over or show a raw error.
It renders:

```
you blocked @luvax_dan.
their posts are hidden from you and yours from them. unblock from the overflow menu or from settings.
```

Six console errors accompany this, and all six are expected:

```
404  /api/v1/users/e95da1cb-...          (x2)
404  /api/v1/posts/user/e95da1cb-...     (x2)
[QueryClient] Requested resource was not found
[QueryClient] User not found
```

These are the blocked-profile 404s plus the global query error handler logging them.
**No React render error.**
The global handler logging an expected outcome as an error is listed in `deferred-findings.md`; it was already known and is out of scope here.

**Defect found.** One, minor.
The blocked list empty state reads `No blocked users`, capitalised, while every sibling empty state in the application is lower case, for example `nothing saved yet.` and `this page doesn't exist`.
Recorded in `deferred-findings.md` rather than fixed, because copy casing is design conformance and this phase does not do design conformance.

## Gap 3: the degraded search wording

Three states were observed in the browser, in sequence.

**Normal**, Elasticsearch running, searching `film`:

```
posts / people / tags
[luvax-seed] grain on film is the texture of memory #film
```

**A genuine empty result**, Elasticsearch running, searching a term that matches nothing:

```
no posts match "zzzqqxnothingmatches"
```

**Degraded**, after `docker stop backend-elasticsearch-1`, searching `film` again:

```
posts search is temporarily unavailable.
this is not an empty result. try again in a moment.
```

The API was confirmed to be reporting `degraded=true` with zero rows on six consecutive calls while stopped.

The two states are unmistakably distinguishable.
The degraded state names the outage, does not name the query, and explicitly disclaims being an empty result.
The empty state quotes the query back and makes no claim about availability.

**Recovery.** After `docker start backend-elasticsearch-1`, the API returned `rows=1 degraded=False` and the browser rendered the normal result again.

**Defect found.** None.

## Gap 4: pagination past the first page, in a browser

**Profile posts grid.**
Ava has 26 published posts against a page limit of 10.
Scrolling the grid produced a second and a third fetch, each carrying a distinct cursor:

```
GET /api/v1/posts/user/556c0a7a-...?limit=10                          => 200
GET /api/v1/posts/user/556c0a7a-...?cursor=cHN0OjE3ODY1MjkxNzcxMjcwODk6...&limit=10 => 200
GET /api/v1/posts/user/556c0a7a-...?cursor=cHN0OjE3ODY1MjkxNzY4ODgyMDQ6...&limit=10 => 200
```

**Photos tab.**
This half was initially not reproducible.
The database held exactly one image post, owned by `luvax_mira`, and every `luvax_*` seed post is `text`.
The photos tab filters `type=image,carousel`, so it had no second page to fetch.

Thirteen image posts were created for Ava through the documented pre-signed upload flow, with the user's approval to write real objects to the project's Cloudflare R2 bucket.
The flow used was the one in the workspace rules: `POST /media/upload`, `PUT` to the returned pre-signed URL, `POST /media/upload-complete`, then `POST /posts` with `postType: image`.
No media row was inserted directly into the database.

The photos tab then produced a second page fetch:

```
GET /api/v1/posts/user/556c0a7a-...?limit=10&type=image,carousel  => 200
GET /api/v1/posts/user/556c0a7a-...?cursor=cHN0LmltYWdlLmNhcm91c2VsOjE3ODY1OTQ5MDAzNDM2MDc6...&limit=10&type=image,carousel => 200
```

Two details worth recording.
The cursor is bound to the filter: decoded, its prefix is `pst.image.carousel:`, so a cursor from the unfiltered grid is not interchangeable with one from the photos tab.
The uploaded images render in the grid from the CDN, so the flow is confirmed end to end and not merely at the metadata level.

**Defect found.** None.

## Gap 5: the screens whose fabricated data was removed

All three were opened with dev tools attached.

**Explore.** Defect found and fixed.

The topic chips had been removed but the flex row that held them was left in place, still carrying `padding: '12px 16px'`.
An empty container with vertical padding reserves its own blank strip, so the screen rendered a band of dead space between the search field and the `trending today` label.
This is exactly the stranding this exercise was meant to catch.
The container is gone; the explanatory comment that justified removing the chips is preserved above the block.

A second observation on this screen is **not** fixed here.
`trending today` renders with nothing beneath it, because the explore feed is a search for the letter `a` and that search legitimately returns zero rows.
Section 6 of the brief defers the explore-screen-is-a-search issue explicitly, so the empty region below the label is recorded in `deferred-findings.md` and left alone.
Fixing the label without fixing the query would only hide the symptom.

**Composer.** Defect found and fixed.

The same pattern in a milder form.
The suggested tag chips were removed and the `hashtags` label above them kept a `marginBottom: 8` that had existed to separate the label from the chips.
The label itself still earns its place, because it reports a live count of tags typed into the caption, so the label was kept and only the now-purposeless bottom margin was dropped.
The screen is otherwise coherent: header, `post it` control, text/photo/video tabs, author row, caption placeholder, tag counter, character counter.

**Onboarding.** No defect.

Renders coherently: wordmark, the two-line tagline, a `get started` control, and a `sign in` link.
Nothing is stranded.
The content sits in the upper portion of the viewport with space below it, which is a layout choice rather than a remnant of removed data.

**Console.** Zero errors on all three screens after the fixes.

## Gap 6: failure states

Not closed here, by instruction.
The brief scopes this gap to the failure states of whatever this phase touches, which includes the realtime connection.
It is recorded in `verification-evidence.md` alongside the realtime work.

The one failure state already exercised is the Elasticsearch outage in gap 3, which was induced and recovered.

## Summary

| Gap | Status | Defect found |
|-----|--------|--------------|
| 1. Short-page case, liked and saved | Closed | None |
| 2. Block loop in a browser | Closed | Blocked-list empty state casing, deferred |
| 3. Degraded search wording | Closed | None |
| 4. Pagination past the first page | Closed | None |
| 5. Explore, composer, onboarding | Closed | Two stranded layouts, both fixed |
| 6. Failure states | Deferred to the realtime evidence | - |
