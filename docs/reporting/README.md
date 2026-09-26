# Reporting Content and Accounts

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Users can now report someone else's post, someone else's comment, and someone else's account.

Before this, nothing on the client could report anything.
The backend had implemented reporting in full and the design had specified the modal in full, but
the frontend had no service, no hook, and no working control.
Three menus already showed a "Report" item; all three did nothing when pressed.

## What was built

**A report modal**, following the design's three steps: choose a reason, add optional details, then
a closing state that confirms the report was received.
One component serves all three target types, because the backend serves them from one endpoint and
nothing about the modal varies by target except one noun: a post is a "post", a comment is a
"comment", and a user is an "account".

**Three entry points**, all in an overflow menu, all with the same label, icon, and position.
The two inert items in the post menu and the comment menu were wired up.
The post detail screen had no report item at all and now has one, so the same post offers the same
action whether it is seen in the feed or opened.
The profile screen had no overflow menu at all, so one was created.

**None of the three appears on the viewer's own content.**
The server refuses a self-report, so offering the action there would only produce a failure.

**Duplicate reports are treated as an ordinary outcome rather than an error.**
A regular user cannot read back what they have reported, so a duplicate can only be discovered when
the report is sent.
When that happens the modal says the item has already been reported, and says plainly that a
different reason will not make a second report possible, because the server's uniqueness rule
ignores the reason.
That was verified rather than assumed.

**Failures say something the reader can act on.**
If the target was deleted while the modal was open, the modal says so and keeps what was typed.

## What was deliberately not built

No way to view your own reports, because the backend exposes no endpoint for it.
No moderator surface, because those endpoints need a role the product cannot grant.
Blocking was not touched, though it shares a menu.

## Commits

| Commit | Contents |
|--------|----------|
| `5707565` | `feat(report): report posts, comments and accounts from the overflow menus` |
| _(this commit)_ | `docs(common): record the reporting work` |

Code and documentation are in separate commits so the code can be reviewed on its own.

The code commit is 734 lines across six files: three new, three modified.
That is within the one thousand line target.

## Documents

| File | Contents |
|------|----------|
| `report-contract.md` | The verified contract, the complete reason enum, every failure case with its observed response, and the disagreement found against the design |
| `design-decisions.md` | The decisions behind the modal, the entry points, and the duplicate handling, each with what was rejected |
| `changes-applied.md` | One entry per change: what was missing, the evidence, what was built, the file |
| `verification-evidence.md` | Browser evidence for all three target types, happy path and every failure case |
| `deferred-findings.md` | What was found and deliberately left alone, with the phase it belongs to |

## The backend was not modified

Required by the brief.
`git status` in the backend repository at the end of this work:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

The staged `Makefile` is **not from this work**.
It was already staged before this phase began and was present in the first `git status` taken at the
start of the session, before anything was read or written.
It is left exactly as it was found.

No tracked backend file was added, modified, or deleted here.

One backend-side action was taken and is worth stating plainly: `./mvnw clean` was run, because the
application would not start against a stale compiled class left behind by an earlier refactor.
That removes build output only.
`target/` is gitignored, confirmed with `git check-ignore`, so no tracked file was touched.
The cause is recorded in `deferred-findings.md`.

## Reproducing the verification

```bash
cd backend && docker compose up -d
cd backend && ./mvnw clean && ./mvnw spring-boot:run
cd frontend && npm run dev
cd frontend && python tools/seed/seed.py
```

The seeded accounts still need the manual email-verification step from
`docs/reconnaissance/local-environment-runbook.md` before they can log in.

Sign in as `luvax_ava` with `ReconPass123!`, then open the overflow menu on any post, comment, or
profile that is not your own.
