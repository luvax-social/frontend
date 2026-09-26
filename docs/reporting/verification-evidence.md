# Verification Evidence

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Browser-level evidence for all three target types, covering the happy path and every failure case.

## Environment

| Piece | State |
|-------|-------|
| Infrastructure | `docker compose up -d` in `backend/`: postgres, rabbitmq, redis, elasticsearch, mailpit |
| Backend | `./mvnw spring-boot:run`, dev profile, 45 Flyway migrations applied |
| Frontend | `npm run dev` at `http://localhost:5173` |
| Seed data | `python tools/seed/seed.py` after the documented email-verification SQL step |
| Viewer | `luvax_ava` |
| Other accounts | `luvax_ben`, `luvax_cleo`, `luvax_dan` |

The backend needed `./mvnw clean` before it would start.
See `deferred-findings.md`.

## Reason coverage

The definition of done requires every offered reason to be submitted at least once.
All eight were accepted by the running server, read back from the database afterwards:

```
spam|3|comment,post
nudity|1|user
violence|1|post
hate_speech|1|post
harassment|1|comment
false_information|1|comment
scam|1|post
other|1|user
```

`SELECT count(DISTINCT report_reason) FROM reports` returned `8`.

Of these, `hate_speech`, `scam`, `false_information`, and `other` were submitted through the
browser; the rest through `curl` while verifying the contract.

## Reporting a post

### Happy path

Feed, Ben's post "light is the medium, not the message".

1. Overflow menu opened. Items: Unlike, Share, Copy link, View author's profile,
   Unfollow @luvax_ben, Block @luvax_ben, **Report**.
2. Report opened the modal. Accessible name `Report post`.
   Preview card showed "Luvax Ben", type label "post", the caption, and the "reporting" chip.
   Heading read "report post".
   All eight reasons were listed. **Continue was disabled** with no reason chosen.
3. "Hate speech" chosen, Continue pressed.
   Step 2 showed the chip "Hate Speech" and the counter `0/2000`.
4. A description was typed, Submit Report pressed.

Observed: `POST /api/v1/reports` returned **201 Created**.
The modal moved to "report submitted".

Screenshots: `report-post-step1.png`, `report-post-step3-submitted.png`.

### A second post, a different reason

Post detail for Ben's "morning, window, coffee", reason "Scam or fraud", submitted through
"skip and submit without details".

Observed: **201 Created**, terminal step reached.
This is the case that exercised submission with no description.

### The action is absent on the viewer's own post

Post detail for Ava's own post `eb18cfec`.

Menu items: `["Like", "Share", "Copy link"]`.
No Report item.

For contrast, the same menu on Ben's post `d6db9033` read
`["Like", "Share", "Copy link", "Report"]`.

## Reporting a comment

### Happy path

Post detail for `4600d442`, Dan's comment "an older comment everyone liked".

1. The comment overflow control appears on hover. Hovering revealed it.
2. Menu items: Unlike, Share, Copy link, View author's profile, **Report**.
3. Report opened the modal. Accessible name `Report comment`.
   Preview showed "Luvax Dan", type label "COMMENT", and the comment text.
   Heading read "report comment".
4. "False information" chosen, a description typed, Submit Report pressed.

Observed: **201 Created**, terminal step reached.

### The action is absent on the viewer's own comment

Same screen, Ava's own comment "a top-level comment".

Menu items: `["Share", "Copy link", "View author's profile", "Edit", "Delete"]`.
No Report item, and no Like item either, consistent with the previous phase.

## Reporting an account

### Happy path

Ben's profile at `/app/u/f70f7348-...`.

1. The header showed the new **More options** button beside follow.
2. Menu items: `["Report"]`.
3. Report opened the modal. Accessible name `Report account`.
   Preview showed "Luvax Ben" and the type label "ACCOUNT".
   Heading read "report account", using the design's word for a user report.
4. "Something else" chosen, Submit Report pressed.

Observed: **201 Created**, terminal step reached.
The wire value sent was `other`.

### The action is absent on the viewer's own profile

Own profile at `/app/profile`.

Buttons present: `["luvax", "edit profile", "posts", "photos", "liked"]`.
No **More options** button, so no menu and no report action.

## Failure cases

### Duplicate, submitted under a different reason

This is the case that decided the copy, so it was exercised as the harder variant: not the same
reason twice, but a different reason on an already-reported target.

Ben's post "light is the medium" had already been reported for `hate_speech`.
It was reported again for "Scam or fraud".

Observed: `POST /api/v1/reports` returned **409 Conflict**.

The modal moved to its terminal step showing:

> you already reported this
> This is already with our review team, so there is nothing more to send.
> A report covers the whole item, so it cannot be sent again under a different reason.

Non-alarming, worded as an ordinary outcome, accurate to the backend's uniqueness rule, and offering
a **Done** control rather than leaving the reader stuck.

### Target no longer exists

Produced deliberately, since it cannot be reached by clicking alone.

The report modal was opened on Dan's comment "a newer comment nobody liked".
While it was open, that comment was deleted by its owner through the API.
The report was then submitted.

Observed: `POST /api/v1/reports` returned **404 Not Found**.

The details step showed, inline:

> this is no longer here
> It was removed or deleted before the report could be sent.

The chosen reason and the step were preserved, and both Submit and the dismiss route remained
available, so the reader was not stranded.

Screenshot: `report-comment-target-not-found.png`.

### Reporting your own content

Not reachable from the interface, by design: the control is absent on the viewer's own post,
comment, and profile, as recorded above.

Verified at the API instead. All three returned **400 `REPORT_SELF_NOT_ALLOWED`**: own post, own
comment, and own account.
Full responses are in `report-contract.md`.

### Reading your own reports

Not reachable from the interface, because nothing was built for it.

Verified at the API: `GET /reports` with a regular user's token returned **403 FORBIDDEN**.

### Invalid values and oversized descriptions

Not reachable from the interface.
The reason list only offers the eight enum values, and the textarea stops at 2000 characters.

Verified at the API. See the failure table in `report-contract.md`.

## Cancelling submits nothing

Verified with the network log, twice.

**At the reason step**: Dan's profile, the modal opened, "Spam" chosen, then dismissed by clicking
the overlay.
Requests matching `reports`: **none**. The dialog closed.

**At the details step**: Ben's post, a reason chosen, Continue pressed, a description typed, then
dismissed by clicking the overlay.
Requests matching `reports`: **none**. The dialog closed.

## Going back preserves what was entered

Ben's post.
"Hate speech" chosen, Continue pressed, then this text typed:

> Browser check: this is the description typed before going back a step.

Back pressed.
The reason step showed "Hate speech" still selected, carrying `[pressed]` in the accessibility tree.

Continue pressed again.
The details step still held the same text, and the counter read `70/2000`.

## Reopening on a new target starts clean

After a submission, the same post's modal was reopened.

No reason was selected, Continue was disabled again, and the previously typed description was gone.

## Console

Dev tools were open throughout.

**No React render error appeared on any surface touched**: feed, post detail for another user's
post, post detail for the viewer's own post, comment rows, another user's profile, and the viewer's
own profile.

The only console errors observed were the expected consequences of the two failure cases:

```
[ERROR] Failed to load resource: the server responded with a status of 409 (Conflict)
[ERROR] [QueryClient] You have already reported this entity
```

```
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
[ERROR] Reported entity not found
```

The first line of each pair is the browser's own network log.
The second comes from the application's pre-existing global query error handler at
`src/main.jsx:53`, which logs every mutation error regardless of whether the interface handles it.
That handler is not part of this change; that an expected duplicate is logged as an error is
recorded in `deferred-findings.md`.

### One error that was investigated and dismissed

An "Invalid hook call" error appeared once, in a log written while the dev server was being torn
down mid-session, after the server process had been killed by a broken output pipe.

It did not reproduce.
Every surface was re-exercised against a freshly started dev server and none produced it.
The hook order in all four touched components was also checked by hand: every hook is called
unconditionally at the top of its component, before any early return.

Recorded here because it was seen, not because it stands.

## Build

`npm run build` completed successfully, 288 modules transformed, no errors.
