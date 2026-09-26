# Workarounds Removed

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

The handoff names five workarounds the new capabilities replace. All five are gone. Each is recorded
with where it was, what replaced it, and the evidence it is no longer there.

A workaround left in place alongside its replacement is a defect, not a leftover — so each of these
was deleted rather than disabled, and the grep evidence below is the check that nothing survives.

---

## 1. Rendering a story or message report read-only, and the copy saying so

**Where it was**

| File | What it was |
|---|---|
| `src/features/admin/lib/reportSchema.js:52` | `ACTIONABLE_TARGET_TYPES = new Set(['post', 'comment'])` with the comment "the rest are read-only" |
| `src/features/admin/screens/ReportDetailScreen.jsx:59` | `const isReadOnlyType = target.reportType === 'story' \|\| target.reportType === 'message'` |
| `src/features/admin/screens/ReportDetailScreen.jsx:134-152` | A warning panel reading *a {reportType} cannot be taken down from this panel. the available actions are resolve, dismiss, and escalate.* |

**What replaced it.** `PATCH /admin/stories/{id}/remove|restore` and the same pair for messages,
wired through `useReportActions`'s four-type dispatch maps.

**Evidence it is gone**

- `ACTIONABLE_TARGET_TYPES` is now `['post', 'comment', 'story', 'message']`.
- `isReadOnlyType` no longer exists in the codebase.
- `grep -rn "cannot be taken down" src/` → no matches.
- The now-unused `LxIcon` import that the deleted panel required was removed with it.
- Driven: a story report renders *remove story* for both an administrator and a moderator
  (`screens/story-target-controls-desktop-light.png`), and a message report renders *remove message*
  (`screens/message-remove-confirmation-desktop.png`). Neither screen states the old claim.

---

## 2. Linking from a moderator's own audit rows back to a report it escalated

**Where it was**

| File | What it was |
|---|---|
| `src/features/admin/components/ActionDetailDrawer.jsx:308-325` | An unconditional `<Link to={routeTo.adminReportDetail(action.reportId)}>` on any action carrying a `reportId` |
| `docs/admin-panel-moderation-history-and-audit/design-decisions.md:144-147` | Recorded this link as "the route back the previous phase recorded as missing: a moderator that escalated a report reaches it from its own action log via this link" |

**What replaced it.** `GET /reports/escalated/mine`, surfaced as the *my escalations* screen at
`/admin/my-escalations`, in the nav for both roles.

**Evidence it is gone.** An `escalate_report` row no longer links. It shows the report id and names
where the answer lives: *listed under "my escalations", with what became of it*. The link survives
on other action types, where it never was an escalation route — the reasoning and the rejected
alternative are in `design-decisions.md` §7.

The prior phase's design note has been corrected in place so it no longer states the workaround as
the current route. Driven: the escalations list shows the moderator's escalated report carrying the
status an administrator later closed it into
(`screens/my-escalations-moderator-desktop.png`).

---

## 3. Resolving account identifiers one at a time and caching the result

**Where it was**

| File | What it was |
|---|---|
| `src/features/admin/api/adminApi.js:72-79` | `getUserContent(userId)` — `GET /admin/content/user/{userId}`, one request per id |
| `src/features/admin/hooks/useResolveUsername.js` | A `useQuery` per id calling it, `staleTime`/`gcTime` `Infinity` |

**What replaced it.** `GET /admin/user-summaries?ids=` behind `lib/userSummaries.js`, a batching
loader that coalesces every id a rendered page asks for into one request, split at the server's
hundred-id bound.

**Evidence it is gone**

- `grep -rn "getUserContent" src/` → no matches. The method is deleted, and it had exactly one
  caller, so nothing else lost a capability.
- `grep -rn "admin/content/user" src/` → no matches.
- Network log, twenty audit rows referencing five distinct people: **one**
  `admin/user-summaries?ids=…&ids=…` request and **zero** `content/user` requests. Before: five.
- Both role trees walked; every screen that showed a resolved name still shows one.

---

## 4. Treating suspension `durationDays` as required and bounded

**Where it was**

| File | What it was |
|---|---|
| `src/features/admin/components/SuspendDialog.jsx` | A required numeric field; submit blocked with *enter a whole number of days between 1 and 3650* when empty |
| `docs/admin-panel-accounts-and-hashtags/accounts-contract-verification.md` | "the panel treats `durationDays` as a required, bounded input" |

**What replaced it.** Nothing new on the server — the optionality was always there and had been read
as an oversight. Omitting `durationDays` suspends indefinitely, verified: `200`, then
`status = suspended`, `suspendedUntil = null`.

**Evidence it is gone.** The form offers *for a set number of days* and *indefinitely* as an explicit
pair; choosing indefinite hides the duration field and omits the key from the request entirely. The
1..3650 bounds still apply when a duration **is** given, because those are real
(`screens/suspension-indefinite-option-desktop.png`). The accounts phase's verification document has
been corrected in place.

---

## 5. Stating the static three-warning rule because the count could not be read

**Where it was**

| File | What it was |
|---|---|
| `src/features/admin/components/WarnDialog.jsx:154` | *a formal warning is recorded against this account. three active warnings issue a strike.* — a constant, shown to everyone regardless of the account |

**What replaced it.** `AdminUserDetailResponse.activeWarningCount`, read into the dialogue.

**Evidence it is gone.** The sentence no longer exists as a standalone claim. An administrator sees
the account's real number and, when this warning is the third, the full consequence
(`screens/warning-third-consequence-desktop.png`).

**One qualification, recorded rather than glossed.** A moderator receives `403` from the account
detail and genuinely cannot read the count. That branch says so and then states the rule — which is
not the workaround returning, but the honest state for a caller who lacks the read. The workaround
was showing a constant *instead of a number that was available*; the number is not available there
(`screens/warning-moderator-count-unreadable-desktop.png`). Reasoning and the rejected alternative
in `design-decisions.md` §8.

---

## Sweep

Run at the end of the phase over `src/`:

| Pattern | Matches in `src/` |
|---|---|
| `getUserContent` | 0 |
| `admin/content/user` | 0 |
| `isReadOnlyType` | 0 |
| `cannot be taken down` | 0 |
| `droppedHashtags` | 1 — a comment in `lib/contentModeration.js` recording the rename |
| `strippedHashtags` | 1 — a comment in `ActionDetailDrawer.jsx` recording the rename |

The last two matches are prose, not code: **no reader of either old key survives anywhere**,
including the audit drawer, which now reads `remainingBannedHashtags`. The comments are deliberate —
the rename changed the field's meaning, and a reader who finds the new key without knowing what it
replaced is one careless edit away from restoring the old wording.
