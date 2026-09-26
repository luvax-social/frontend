# Adopting the Backend Changes

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

The backend delivered a batch of work in response to the frontend's findings report.

Several items made existing frontend behaviour wrong rather than merely unfinished: a control was hidden that now works, a marker was missing that can now be rendered, a vague warning stood where a number is now available, and the sign-up form enforced looser rules than the server.

This phase closes those gaps. It builds no new screens and adds no new features.

## What changed, in plain language

**A report you already made is now visible.** Where you have already reported a post, a comment, or an account, its menu says "Reported" instead of offering an action that could only fail. Submitting a report settles the item into that state without needing a reload, and the duplicate message is still there as a backstop for the case where you reported the same thing from somewhere else.

**You can like your own comment again.** The control was removed in an earlier phase because the server refused the request. The server no longer refuses it, so the control is back and the count behaves.

**An edited comment says so.** A small "edited" marker sits beside the timestamp, driven by a field the server sets only when the body actually changes. A comment that was merely liked or replied to is not marked, which is why the row's update timestamp could not be used for this.

**The delete confirmation states the number.** It used to say "deleting this comment also deletes its reply", counting only direct replies. On the seeded thread that understated the real consequence by ten comments. It now says how many comments will go in total, and falls back to the old wording if the count is unavailable or slow.

**The sign-up form matches the server.** The server enforces six password rules; the form enforced one and a half. It now enforces exactly the six, in the same order, and a rejection names the rule that failed instead of saying only that validation failed. Signing in is deliberately untouched, because existing accounts predate the policy.

**Failed media uploads can be retried.** The server now checks that an uploaded file actually arrived before registering it. Those failures say what happened and keep your selected file, rather than reading as a dead end.

**Verifying an email works locally.** A mail catcher now runs alongside the other services, so an account can be registered and verified through the browser. The manual database write the runbook required is gone.

## Two things verified and deliberately not built

- **Post like events over the websocket.** The topic, payload and subscription rules are recorded from observed frames so the realtime phase can build against facts.
- **Comment sorting.** The parameter works and is documented. No control was built; whether the product wants one is a separate decision.

## One thing investigated and not changed

The profile screen renders three tabs. Two of them are backed by nothing and change nothing when selected. Two earlier documents record only one tab as present, which is wrong. See `profile-tabs-finding.md`.

## Documents

| File | Contents |
|------|----------|
| `backend-capability-verification.md` | Every claim checked against the running server, written and committed before any feature code |
| `changes-applied.md` | Each change: what was wrong, the evidence, what changed, which files |
| `design-decisions.md` | Decisions with reasoning and rejected alternatives, including every derived visual treatment |
| `verification-evidence.md` | Browser-level before and after, including the failure cases |
| `profile-tabs-finding.md` | What the profile screen actually renders and which document is wrong |
| `deferred-findings.md` | Everything found and deliberately not acted on |

`docs/reconnaissance/local-environment-runbook.md` and `docs/reconnaissance/seed-data.md` were updated, because a runbook describes how to do something rather than recording what was once true. No other earlier report was edited; corrections to those are recorded here instead.

## Commits

In order. The verification document is first, before any feature code.

| Commit | Subject |
|--------|---------|
| `e2ceebb` | `docs(common): verify the delivered backend capabilities` |
| `9733a83` | `fix(auth): mirror the server password policy on the registration form` |
| `2d62401` | `feat(report): reflect a prior report on the item instead of on submission` |
| `290eb1f` | `feat(comment): allow liking your own comment, mark edits, count deletions` |
| `a382ccd` | `feat(media): present upload registration failures as retryable` |
| `15c0685` | `fix(comment): keep the edited marker after an edit without a refetch` |
| `aaa509d` | `fix(comment): keep the deletion estimate once it arrives in time` |
| `6448028` | `fix(auth): accept every uppercase character the server counts as one` |

The last three fix defects found while exercising the earlier commits in the browser, which is what the browser step is for.

Documentation is committed separately from code, so the code is reviewable on its own.

## Branch

`feat/common/adopt-backend-capabilities`, cut from `feat/report/report-content-and-accounts` rather than from `develop`.

That deviates from the branching rule and is deliberate: the reporting work is not merged into `develop` yet, and item 6.1 modifies it. Branching from `develop` would have meant editing code that is not there.

## The backend was not modified

Definition of done item 13. `git status` in the backend repository, taken after all work:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

The staged `Makefile` was already present before this phase began and was not created by it. The same status was captured as a baseline at the start and is byte-identical to the one above, so nothing in the backend was touched.

## One outward-facing action

Exercising the successful media upload writes a real object into a real Cloudflare R2 bucket, so it was raised before being done rather than assumed. It was approved and went to the `luvax-develop` bucket, a single 336-byte test image.

The failure cases needed no such write: the direct upload was stubbed to report success without transferring anything, which is exactly what the server's new check is designed to catch.
