# Design Decisions — Observability and Hardening

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision this phase's prompt asked to be stated, plus the ones the work forced.

---

## 1. The chart

### What was built

A **line chart per dimension over a linear time axis**, drawn as inline SVG from the existing
`--lx-*` tokens. No charting library exists in this project and none was added. It lives in
`components/TimeseriesChart.jsx`; the data and geometry rules it draws from are pure functions in
`lib/statistics.js`.

### Why that form

Two properties of the form are the reason for it, and both are about honesty rather than looks.

**The x axis is time, not the index of a point.** This is the decision the whole screen rests on.
The server returns only the buckets it actually collected, and a bucket that was never written can
never be written later — there is no backfill. On an index axis a missing bucket is *invisible*: the
points either side sit adjacent, and the chart silently asserts that the measurement continued
without interruption. On a time axis the same absence leaves a visibly wider blank, and it can be
marked. A bar chart was rejected for the same reason a bar chart usually is here: it implies a
complete, evenly-spaced categorical series, which is precisely what this data is not.

**Every measured point carries a marker, and the line is cut at every gap.** A line alone cannot say
which of its pixels were measured; the markers can. The line is broken into segments wherever
consecutive bucket starts differ by more than one interval and a half, so the chart never draws
through a hole. The tolerance absorbs boundary jitter without ever absorbing a genuinely missing
bucket.

A gap is then drawn as a **hatched band**, not left blank, so an interval that was never collected
reads as a stated absence rather than as an accident of layout, and the legend names how many
buckets are missing. Marking a gap is not the same as inventing data: the band asserts "nothing was
measured here", which is exactly what is true.

### How it reads at a narrow width

The geometry is computed from the container's **measured width** through a `ResizeObserver`, never
from pinned pixel values. Nothing about the drawing is a constant that a different container breaks.

The alternative — a fixed `viewBox` with `width: 100%` — was rejected. It scales cleanly, but it
scales the *type* with the drawing: at a 390-pixel viewport a 10-unit axis label would render at
about four physical pixels and become unreadable. Measuring instead lets the plot area shrink while
the type stays at a legible size.

Below 520 pixels the chart adapts rather than merely shrinking:

- tick density drops (one x tick per 78 pixels instead of per 104), so labels never collide;
- markers shrink and the stroke thins, so a dense series does not become a solid band;
- axis type steps down one size, still legible;
- the left inset is sized from the widest value label actually rendered, so a five-digit count is
  never clipped and a single digit leaves no dead channel;
- height follows width between a floor and a ceiling, so the chart keeps a workable shape from a
  phone to a wide desktop.

Verified at 390 × 844: the chart renders, the gap band is still visible, both axis labels are
readable, and the page body does not scroll horizontally.

### Colour

Series identity comes from the seven-value categorical token palette (`--lx-avatar-0` … `-6`). It is
the only categorical scale the token set defines, and it holds its values across light and dark.
**No raw hex, `rgb()`, or `hsl()` value appears anywhere in the chart** — or anywhere in the panel;
grep-verified across all four phases.

Because the palette has seven entries, **at most seven dimensions are drawn**. Cycling it would give
two dimensions the same colour and make the chart ambiguous, which is worse than not drawing one. A
metric with more dimensions than that draws the seven with the largest peak and **names the ones it
did not draw** underneath. A silent top-N would read as "this is everything".

### What the chart does not do

No interpolation, no extrapolation, no zero-fill, no smoothing, no trend line, no projection. The
only marks are the measurements the server returned and the lines between measurements that are
genuinely adjacent.

---

## 2. Empty, zero, and gap are three different things

The single most important distinction on the statistics screen, established from the server (see
`observability-contract-verification.md` §1.7) rather than assumed.

| State | What the server returns | What it means | How the screen renders it |
|---|---|---|---|
| **Empty** | `points: []` | nothing was ever collected in this window | no chart at all, and a sentence saying the job never wrote here and — because nothing backfills — never will |
| **Zero** | points whose `value` is `0` | the job ran, looked, and counted nothing | the chart, with the line on the baseline, above a sentence saying this is a measurement and not an absence |
| **Gap** | a bucket simply absent from a returned series | that pass did not run | the line is cut, the interval is hatched, and the legend names how many buckets are missing |

The same rule governs the snapshot. When `computedAt` is null, the payload's figures are all zero —
and rendering them would assert that the platform has **no accounts**, which is both false and
alarming. So none of them are shown. The screen says no statistics have been collected yet and when
the first will appear.

**Conflating empty with zero is how a panel lies.** It converts "we do not know" into "we know it
was none", and a chart makes that conversion look authoritative.

### One divergence in the empty-state wording

The handoff asks the pre-collection state to say the first snapshot appears "within 30 minutes of
the server starting". **Read from source**, that understates it: the collection job's initial delay
is 30 minutes *and* it discards the partial bucket the process started inside, so the worst case is
just under an hour. The screen says **within an hour**, because a reviewer who waits 30 minutes,
sees nothing, and concludes the job is broken has been misled by a number that was too optimistic.

---

## 3. The written event types

**The activity log's event-type filter offers exactly three options** — `session_start`, `search`,
`profile_view` — and this is derived from observed behaviour with the source as its evidence, not
from the OpenAPI enumeration.

### The evidence

**Read from source.** `UserEventRecorder.java` is the unconditional writer, and it writes three
types and no others:

| Type | Written at | Called from |
|---|---|---|
| `SESSION_START` | `UserEventRecorder.java:85` | `AuthServiceImpl.java:469` |
| `SEARCH` | `UserEventRecorder.java:97` | `PostSearchServiceImpl.java:71`, `:145`; `UserSearchServiceImpl.java:58` |
| `PROFILE_VIEW` | `UserEventRecorder.java:102` | `UserServiceImpl.java:163` |

The endpoint's own contract says the same thing in `AdminUserEventApi.java:32`: *"Only three event
types are ever written. … The `event_type` enum declares seventeen further values that exist in the
schema and have no writer."*

### The complication, and why it did not change the answer

A **second writer exists that the handoff does not mention**. `RecommendationFeedbackConsumer.java`
writes `POST_LIKE`, `POST_SAVE`, `POST_VIEW`, and `POST_COMMENT` into the same table through
`UserEventJdbcRepository`. It is gated on `app.recommendation.consumer.enabled`, which is `true` in
**both** the development and production profiles. On the source alone, seven types have a writer.

So it was tested rather than argued about. A post was liked as `seed_carol`; the engagement event
was published; the queue depth rose to one; a consumer was confirmed attached and active on
`recommendation.feedback.queue`; and the message then moved to `recommendation.feedback.dlq`
(depth 4 → 5). **No `user_events` row appeared.** The consumer cannot complete, because it calls a
Gorse service that is not part of this deployment — there is no Gorse container in the compose stack
and no `gorse` key in any `application*.yml`. The stored data agrees: over the life of this database
`user_events` holds only `session_start` and `search` rows.

**The decision.** The rule this filter exists to serve is "an option must be able to return a row".
The four engagement types fail it in every environment the panel can observe. Offering them would
reproduce exactly the mistake the report queue's status filter already made and this project already
settled.

**Nothing is hidden by the choice.** The unfiltered list renders whatever `eventType` a row carries,
so a deployment that does write an engagement row shows it in the list — only the filter shortcut is
absent. That, and the condition under which the filter should widen to seven, is recorded in
`deferred-findings.md`.

---

## 4. Two different limits, told apart

The prompt treats "the maximum window" as one number. The server has two, and they are unrelated:

- **The window limit is one year**, applied to the span `to − from`. 365 days passes; 366 is refused.
- **The fine-granularity horizon is 30 days**, applied to `from` alone against *now*. It is a
  rolling boundary: a one-hour window whose lower bound is 31 days old is still refused at half-hour
  granularity, even though the window is tiny.

They therefore drive different controls. The **date range** clamps to one year. The **granularity
selector** decides availability from `from` alone, and renders half-hour as unavailable — visible,
explained, unselectable — rather than allowing it and meeting a 400. Verified: choosing an
out-of-range window produced a `granularity=day` request and no 400 ever reached the wire.

## 5. Fire on commit, not on change

Both endpoints this phase consumes allow **20 requests a minute in production**, the tightest budget
in the system. (The prompt says 30; the configuration says 20. Built to 20.)

A range control wired to its own `onChange` issues a request for every intermediate value a reviewer
passes through. So every edit changes a draft and only *apply* turns a draft into a request, and the
control says so while a draft is pending. Verified by counting: **17 control interactions — thirteen
slider drags and four date edits — produced zero requests.**

The window slider exists partly for this reason. It is the control most likely to be dragged, so
having one makes the discipline demonstrable rather than merely asserted; it is also discrete, so it
cannot land on a span the endpoint refuses.

On a 429 the panel reads `Retry-After`, disables the controls for exactly that long, says why, and
**never retries on a timer**. Verified: one 429, then no further request for the remainder of the
window. An automatic retry against a rate limit turns a burst into a longer burst and takes the
decision away from the only party who can see what is happening.

---

## 6. Sessions: rendering the payload and nothing else

**A session record is rendered as exactly what it carries.** The payload holds a refresh-token row
id, an optional opaque device id, the user agent string recorded at issuance, the client address
recorded at the same moment, and two timestamps.

It does **not** hold a location, a city, a resolved device name, or a marker for which session is
the reader's own. So the columns are headed "user agent, as recorded" and "address, as recorded",
the values are shown verbatim, and a line under the table says the record does not state where the
person was or what device they held. An address dressed up as a place is an invented fact, and an
address is exactly the kind of invented fact a reviewer would go on to act on.

**There is no per-session revocation.** The whole backend surface was searched; the only revocation
that exists ends every session of the account at once. So **no per-row revoke control is drawn** — a
control that cannot exist is not rendered and then disabled — and the account-wide action is offered
instead, named for what it does. Verified live: force-logout took an account from three live
sessions to zero.

On the caller's own account the panel says the thing that matters plainly: the record does not say
which session is the one being read, so ending them ends that one too and signs the reviewer out
immediately.

`reportsAgainst` became a linked list because a list exists behind it — each entry carries a report
id, so each row opens that report. It is described as the recent set the detail carries rather than
a full history, because there is no cursor behind it and implying completeness would be a second way
of overstating what is known.

---

## 7. Fixes made during the hardening sweep

Five failures were found by walking section 15 against the built panel. Each is a wording or gating
decision, recorded here because each was a judgement rather than a mechanical correction.

1. **A range clamped to the wrong limit.** `clampRange` used the module's 365-day constant rather
   than the control's own `maxDays`, so the activity log's 30-day bound was not enforced and a
   234-day window reached the server as a 400. The limit is now a parameter.
2. **A clamp that applied silently.** The draft-sync effect cleared the explanatory note in the same
   tick the clamp wrote it, so a corrected range changed under the reviewer with no notice. The note
   now survives its own commit and is cleared where an edit actually invalidates it.
3. **A strike that did not name its outcome.** The warn feedback read `strikeIssued` but not
   `resultingStatus`, so it said a strike was applied without saying the account had been suspended.
   Both are now quoted from the server.
4. **A revocation that implied restoration.** Revoking a strike removes the record but not the
   suspension it caused. The confirmation now says the account stays suspended and must be lifted
   separately — otherwise a reviewer believes they have restored an account they have not.
5. **A warn control on a target that cannot be warned.** Only an ordinary account may be warned.
   Where the target's role is knowable the control is now withheld rather than offered and refused.
   An administrator can read the role from the account detail, so for an administrator this is
   decided before anything renders; a moderator cannot read that endpoint at all, so for a moderator
   the control is still offered and an ineligible target surfaces through the specific refusal code —
   the fallback the handoff prescribes for exactly this asymmetry.

A sixth was a missing branch rather than a wrong one: `suspendedUntil` is null both for an account
that is not suspended and for one suspended with no end date, and the panel rendered nothing in the
second case. Status is now read first, and the null branch says "suspended indefinitely".

A seventh was an omission of the sentence that matters most: the hashtag ban confirmation said what
banning does but not what it does **not** do. It now leads with "this does not take down any existing
post", because a reviewer who bans a tag believing the content is gone stops looking.

---

## 8. Reused, not rebuilt

Everything the shared layer already provided was used as-is: the request-contract sanitiser, cursor
pagination and its termination rule, the error classifier, the vocabulary cache, identifier
resolution, the shell and its role-filtered navigation, the framed card, the record table and its
four list states, load-more, local time, the status badge, the not-available page, and the
reason-carrying confirmation.

Three things are new, and each is new because nothing existing covered it: the chart, the
commit-driven range control, and a standalone rate-limit cooldown lifted out of `useDebouncedSearch`
for controls that are not search boxes.

One existing hook gained an option rather than a fork: `useAccountDetail` now takes `enabled`, so a
surface both roles reach can read the account's role as an administrator without a moderator firing
a request that would answer 403.
