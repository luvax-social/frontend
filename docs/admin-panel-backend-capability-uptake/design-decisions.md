# Design Decisions

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision this phase was asked to state, with the option that was rejected and why. Evidence
is in `uptake-contract-verification.md` and `verification-evidence.md`.

---

## 1. The environment-gated activity filter

**Decision.** The activity log's event-type filter offers seven types in a development build and
three in a production build. The gate is a conjunction of two signals:

```js
import.meta.env.DEV && (import.meta.env.VITE_APP_ENV ?? 'development') === 'development'
```

**Evidence, produced rather than inferred.** Each of the seven types was produced against the local
stack and read back out of `user_events`
(`uptake-contract-verification.md` §5.4): `post_view`, `post_like`, `post_save`, `post_comment`,
`profile_view`, `search`, `session_start`. The four engagement types land because the consumer that
writes them depends on the recommender service, which is part of the default local compose stack and
of no production deployment.

**Why two signals and not one.** `VITE_APP_ENV` is the deployment's own tag and is the thing that
actually describes which stack the panel faces, so the prompt's instruction to use the existing
environment variable is honoured. But it is a `.env` value: a production bundle built from a
checkout whose `.env` still reads `development` would offer four filters that can never match,
against a server that answers `200` with an empty page — the exact failure the gate exists to
prevent. `import.meta.env.DEV` is false in anything `vite build` produces, so requiring both makes
that impossible.

**Rejected: gate on `VITE_APP_ENV` alone.** It is one careless `.env` away from the failure mode.

**Rejected: gate on `import.meta.env.DEV` alone.** It ignores the variable the phase named and would
narrow a locally-built preview that is genuinely pointed at a development stack.

**Which way the conjunction errs.** Toward offering fewer filters. A missing filter costs a reviewer
one unfiltered read; a filter that can never match costs them a false conclusion about the log. The
unfiltered list still shows whatever type a row carries, so nothing is hidden either way.

**Verified in both branches, by camera.** The dev server offers seven
(`screens/activity-filter-development-build.png`); a real `vite build` served on port 3000 offers
three (`screens/activity-filter-production-build.png`). The production bundle does not merely hide
them — `grep` over `dist/assets/*.js` finds `session_start` and finds no `post_like`, `post_save`,
`post_view`, or `post_comment` at all: the four are tree-shaken out.

**This is recorded because a filter list that changes by build is exactly the kind of thing a later
reader assumes is a bug.** It is not. It is the only honest option when the same panel serves two
backends that write different things.

---

## 2. The restore copy under the field's new meaning

**Decision.** The post restore message describes the post's present state:

> post restored. its caption still carries banned hashtags: #uptakekeep, #uptakesecond

**Why the copy had to change and not just the field name.** The server renamed `droppedHashtags` to
`remainingBannedHashtags` **and changed what it means**: it was "tags this call dropped", it is now
"banned tags the caption still carries after the restore". Restoring the same post twice returns the
same names both times — verified, both responses recorded in
`uptake-contract-verification.md` §3, and both messages photographed in one frame
(`screens/post-restore-twice-same-names-desktop.png`).

Under the old wording — "dropped: #x" — a reviewer restoring twice would read two events that never
happened. A rename applied without a copy change is a lie told fluently, and this is the sentence it
would have been told in.

**"still carries" is the load-bearing phrase.** It describes the post, so seeing it twice reads as
the post being unchanged rather than as the action repeating.

**The empty case** produces a plain `post restored` with no dangling label.

**The audit drawer** reads `action.metadata.remainingBannedHashtags` and labels it *banned hashtags
still in the caption* — the label changed with the meaning, not just the key
(`screens/drawer-new-metadata-key-desktop.png`).

**The hashtag ban confirmation was re-checked** under the new meaning, as the phase required. It
tells the reviewer that banning a tag does not retroactively strip it from existing captions, which
is *more* clearly true now: `remainingBannedHashtags` is the standing proof that a banned tag
survives in a caption across restores.

---

## 3. The revoked-violations reversal

**Decision.** The violations list carries an *include revoked records* checkbox, **off by default**,
matching the server's own default. A revoked record renders with a `REVOKED` badge, reduced
emphasis, and a line naming who revoked it and when.

**What this reverses.** The moderation-history phase recorded that a revoked record simply leaves
the list and survives only in the action log, and accepted that. `includeRevoked=true` now exists.
That phase's `design-decisions.md` and `deferred-findings.md` have been corrected in place rather
than left stating the old answer as current.

**Toggling restarts pagination.** Not a nicety: the cursor is scoped on the flag, and a cursor
issued under one setting is rejected by the other with `400 INVALID_CURSOR` — verified in **both**
directions (`uptake-contract-verification.md` §4.2). The flag is therefore part of the React Query
key, so flipping it starts a fresh sequence instead of replaying a cursor the other listing refuses.

**The toggle renders in every list state, including the empty one.** Rejected: rendering it only
alongside rows. An account whose revoked records are its only records would then show an empty list
with no control to reveal them — the control that turns the setting on would be hidden by the
setting being on.

**A revoked record offers no revoke control and nothing implies un-revoking**, because there is no
such operation.

---

## 4. A story restore states the mechanism, not a per-story outcome

**Decision.** Both the confirmation and the success message say the same true thing about every
story:

> this lifts the removal only — a story already past its expiry stays out of every feed, and
> restoring does not extend its lifetime

**Why not "this story has expired".** The panel cannot know. The report target payload carries
`reportType, entityId, ownerId, ownerUsername, status, text, mediaUrls, removed, createdAt` and
**no expiry field**. Expiry is not derivable from `createdAt` either: the lifetime comes from the
server's `story_duration_hours` setting, and in this database three of the four stories have an
`expires_at` *earlier* than their `created_at` (§1.1). A `createdAt + 24h` rule would call all three
unexpired, which is the opposite of the truth.

**Rejected: compute expiry from `createdAt` and a 24-hour constant.** It would state the opposite of
the truth on three rows out of four here, and the constant is a server setting the panel never sees.

**Rejected: a bare "story restored".** That is the thing the phase exists to stop — the server
answers an ordinary success whether or not the story will ever be visible again
(`screens/story-expired-restore-toast-desktop.png` shows the message that replaced it).

**The cleanup-job case** is a `404 STORY_NOT_FOUND`, which the shared error handling surfaces as a
calm not-found rather than a success.

**Recorded as a backend request:** the story target payload should carry `expiresAt`. Until it does,
no panel can tell a reviewer what actually happened to one particular story.

---

## 5. The message restore refusal, and what the handoff got wrong

**Decision.** The message restore confirmation and success both say:

> this lifts the removal only — if the sender had also deleted it, it stays hidden for both
> participants

**What the server actually does**, against what the handoff describes. The handoff says a message
the sender deleted "cannot be restored by moderation and answers 409". The schema has two
independent columns — `is_deleted`/`deleted_at` (the sender's own deletion) and `admin_removed_at`
(moderation's). They do not interact:

- Restoring a message moderation has **not** removed answers `409` for the ordinary already-in-state
  reason, with the same code and message as a double restore.
- Moderation **may** remove a sender-deleted message (`200`), and restoring it afterwards also
  answers `200` — leaving `is_deleted = true`, so it stays invisible to both participants.

**Consequence for the interface.** There is no distinguishable "sender deleted it" refusal to
surface. The panel therefore:

1. Renders the restore control only where the target reports `removed: true`, so the ordinary 409 is
   not reachable by a reviewer acting on a current view.
2. Words the restore outcome for the case that *is* real and invisible — a success that leaves the
   message hidden.
3. Surfaces a genuine `409` (two reviewers racing) through the shared conflict branch as *another
   reviewer already handled this. refreshing.*, driven and photographed
   (`screens/message-restore-conflict-409-desktop.png`).

**Removed message content is not withheld from the reviewer.** Verified rather than assumed: the
target payload keeps the full text with `removed: true`. No view-side redaction was added, because
the server does not do it and inventing one would hide evidence from the person reviewing it.

---

## 6. Batch identifier resolution: one mechanism, callers unchanged

**Decision.** `lib/userSummaries.js` is a batching loader. Callers still ask for one id;
every id requested in the same tick is coalesced into one `GET /admin/user-summaries`, split at the
server's hundred-id bound. `useResolveUsername` keeps its name and signature and is now backed by
the loader. `adminApi.getUserContent` — the per-id mechanism — is **deleted**, not disabled.

**Measured reduction.** A fully rendered page of twenty audit rows referencing five distinct people:
**five requests before, one after** (`verification-evidence.md` §2).

**The wire form is the load-bearing detail.** `ids[]=…`, which is Axios's *default* array
serialisation, is rejected with `400`. The API layer pins `paramsSerializer: { indexes: null }` so
the request emits repeated bare `ids=` keys. Without it every call fails; this is not a style
preference. Confirmed on the wire in the network log.

**Order is preserved by the endpoint and still not relied upon.** Entries are indexed by the
`userId` each entry carries and looked up by id, never by position. Order is the endpoint's
guarantee to make, not this module's to depend on.

**A not-found id settles as `null`, not as an error**, so React Query caches it as a resolved answer
and the row renders a shortened id once instead of retrying forever.

**Rejected: a React context that collects ids during render.** It would have required every caller
to be inside a provider and would have coupled resolution to the component tree. The loader is a
module singleton with no such requirement, and the call sites did not change at all.

**Rejected: renaming the hook or its file.** Moving or renaming a file is out of scope this phase,
and "resolve a username" is still exactly what the caller asks for. The batching is an
implementation detail of the shared layer, documented at the top of both modules.

**Chunks beyond 100 are issued sequentially, not in parallel.** A page needing more than a hundred
distinct people is already unusual, and turning it into a burst against the panel's tightest rate
limit would trade a problem the reviewer does not have for one they would.

---

## 7. The audit-row escalation link: removed for `escalate_report` only

**Decision.** The action drawer no longer links an `escalate_report` row to its report. It shows the
report id and names where the answer now lives: *listed under "my escalations", with what became of
it*. The link remains for every other action type that carries a `reportId`.

**Why not delete the link outright.** The workaround being replaced is "following your own
escalations through the audit log". For an `escalate_report` row that is precisely what the link
did, and keeping it would leave two mechanisms for one job — the defect this phase exists to remove.
For a `resolve_report` or `dismiss_report` row the link was never an escalation route; it is a plain
cross-reference from an action to the report it concerned, and deleting it would remove a working
affordance that replaces nothing.

**Rejected: delete the link for all action types.** It reads as thorough and is actually a
regression: an administrator loses the only jump from an audit row to the report it names, in
exchange for removing a redundancy that does not exist on those rows.

**The replacement is strictly better than what it removes**: the escalations list shows the outcome,
which a link to one report at a time never did.

---

## 8. The warning count, and the moderator who cannot read it

**Decision.** The warn dialogue states the account's current active warning count and what issuing
this one will do. The static three-warning sentence is gone wherever the number itself is available.

**When this warning is the third**, the dialogue names the full consequence:

> this account has 2 active warnings. this one will be the third, which issues a strike
> automatically and resets the count to zero. a strike suspends the account — seven days for a first
> strike, thirty for a second — and a third strike bans it outright.

**Why the whole ladder rather than one rung.** Which rung this account lands on depends on how many
strikes it already carries, and the account detail does not carry a strike count. Naming one rung
would be a guess; naming only "a strike is issued" would repeat the omission the previous phase
already had to fix, where a message said a strike was applied and left out that the account had been
suspended. The ladder was read out of the backend source and is stated in full:
`WARNINGS_PER_STRIKE = 3`, `STRIKE_ONE_SUSPENSION_DAYS = 7`, `STRIKE_TWO_SUSPENSION_DAYS = 30`, and
`strikeNumber >= 3` bans.

**A moderator cannot read the count at all** — `GET /admin/users/{id}` answers `403`, verified. That
case says so plainly and states the rule, which is the only true thing available without the number:

> how many warnings this account already carries cannot be read with your access. three active
> warnings issue a strike: a first strike suspends the account for seven days, a second for thirty,
> and a third bans it.

**Rejected: deriving the count from the violations list**, which a moderator *can* read. "Active"
means unrevoked *and* newer than the account's most recent unrevoked strike *and* inside a 90-day
window. Reconstructing that client-side from a paginated list would be inventing a number and
calling it the server's.

Both branches photographed: `screens/warning-third-consequence-desktop.png` and
`screens/warning-moderator-count-unreadable-desktop.png`.

---

## 9. Indefinite suspension is chosen, never defaulted into

**Decision.** The suspend form offers *for a set number of days* (default) and *indefinitely* as an
explicit pair. Choosing indefinite hides the duration field, changes the description, and renames
the confirm to *suspend indefinitely*. The request then omits `durationDays` entirely — `buildBody`
drops an undefined field, so no `durationDays` key reaches the wire rather than a `null` the
endpoint does not declare.

**Rejected: leaving the duration field blank to mean indefinite.** A blank field is
indistinguishable from an unfinished form, and the strongest action available on the screen must not
be reachable by omission.

**`status` is the only field that separates the two nulls.** `suspendedUntil` is `null` both for an
account that is not suspended and for one suspended indefinitely — the schema says so and the server
confirms it. Everything that renders suspension keys off `status`; the indefinite branch reads
*suspended indefinitely — there is no end date, and it lasts until an administrator lifts it*
(`screens/suspension-indefinite-account-reads-desktop.png`).

---

## 10. The report reason list is not filtered by report type

**Decision.** Every reason is offered for every report type, and no `appliesTo` filter exists in the
panel.

**Why this needed a decision at all.** An empty `appliesTo` means **every** type, not none, and four
of the eight reasons carry an empty list: `spam`, `harassment`, `scam`, `other` (§6). A filter that
treated empty as "matches nothing" would silently drop half the vocabulary. The panel has never
filtered, so the correct behaviour was already in place; a comment now records why, so a later
reader does not add the filter as an improvement.

---

## 11. The audit window control claims only what the server does

**Decision.** The shared range control states *from is included, to is not*, and the audit log's
widest preset is 365 days.

**Both halves were measured.** The half-open boundary was verified against a real row's timestamp on
**both** endpoints behind the control — `/admin/actions` and `/admin/user-events` — rather than on
one and assumed for the other: `from=<pivot>` includes the pivot row, `to=<pivot>` excludes it.

**The 365-day ceiling is the control's own preset range, not a server refusal.** `/admin/actions`
imposes **no span limit at all** — a 3650-day window is accepted — and enforces only that `to` is
later than `from`, which the control already enforces. This is stated in the screen so a later
reader does not "fix" a limit the server never had. The activity log's own 30-day limit is separate,
real, and unchanged.

---

## 12. A shared button may now opt out of submitting its form

**Decision.** `LxBtn` forwards a `type` prop. It is not defaulted, so every existing call site keeps
the browser's own behaviour and nothing else changes.

**Why this phase touched a file outside the panel.** `DateRangeControl` already passed
`type="button"` to its preset buttons and `type="submit"` to its apply button. `LxBtn` accepted
neither, so both fell through to the browser default of `submit`. Clicking a preset therefore
submitted the form as well as applying the preset, and with the draft fields still empty the form
set an error note. The result was a **false statement on screen**: *enter both a start and an end
before applying*, displayed while a window was applied and rows were showing.

Reproduced from a clean page, fixed, and re-driven to confirm the message is gone and the preset
still commits. The defect predates this phase and affects the activity log's copy of the same
control; the fix is at the root rather than worked around in one caller.

**Justification for the out-of-scope edit** is recorded in `changes-applied.md`, as the phase
requires for any change beyond the panel's directories.
