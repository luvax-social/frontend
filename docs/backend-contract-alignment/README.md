# Backend Contract Alignment

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

## What this changed, in plain language

Nobody could log in.

The login form posted a field called `email`. The server expects one called `identifier`. It refused to parse the body and answered `400`, and the form showed the user the parser's own words: "Request body could not be read". That was the state of the application before this branch, and it is why this work happened.

Fixing that uncovered four more places where the frontend and the backend disagreed about the shape of a request, and one place where they disagreed about the shape of an error.

Everything here is a frontend change. The backend was read and exercised, never modified.

### The fixes

**Login** now sends `identifier`. The server accepts either an email address or a username in that field and works out which by looking for an `@`, so both forms of login work.

**Password reset** stopped sending an `email` field the endpoint refuses to accept. That endpoint rejects any field it does not recognise, so password reset could not have worked with any token.

**The unverified-email message** now appears. The frontend was looking for an error field the server does not send, and comparing it against a value the server does not use. Both halves were wrong, so an unverified user got a generic failure instead of the "check your inbox" screen. They now get the screen, with their address filled in and a working resend button.

**Registration validation** was rejecting accounts the server would have accepted. The form refused usernames containing a dot and demanded an uppercase letter and a digit in the password. The server requires neither. The form now accepts exactly what the server accepts, and enforces the 128-character maximum it previously ignored.

That last change makes the form accept weaker passwords than before, because the server has no complexity rule at all. This was a deliberate instruction to follow the backend as the source of truth. If a stronger policy is wanted, it belongs in the backend, where it would apply to every client. This is set out in full in `auth-contract.md`.

**Blocked users** are now read from the server. They were being mirrored into `localStorage` by a mutation that caught every error, discarded it, and recorded the block as successful either way. A block made in one browser was invisible in another while the server-side block stayed in force, and clearing browser storage appeared to unblock everyone. A failed block now surfaces as a failure. As a side effect the blocked list can finally show who is on it, because the server returns each user's name and handle directly, and the old per-row profile lookup could never have resolved.

**A request to an endpoint that does not exist** was removed. The right rail asked for `GET /users/suggestions` on every feed and explore render. There is no such route, so the path was swallowed by the profile-by-id route and failed UUID conversion with a `400` every time. The feature it fed is not built. The call, its hook, and its call site are gone, and no mock data replaced them. The rail still renders its trending section, so nothing looks empty.

**Post status** now sends `targetStatus` rather than `status`. Nothing in the interface calls this path, so the fix is currently unreachable. It was corrected rather than deleted, as instructed.

**The design reference is in the repository.** `Luvax.html` is the pixel-perfect target for every interface task in this project and it existed only on one person's desktop, in no version control. It is now at `docs/design/Luvax.html` with a README explaining what it is and how to extract its bundled chunks, and the extraction was verified against the committed copy rather than the original.

### The commits

| Commit | Scope |
|--------|-------|
| `9396e07` | `fix(auth): align auth request bodies and validation with the backend` |
| `b5e4396` | `fix(post): send targetStatus on the status transition endpoint` |
| `a8eadce` | `fix(social): read blocked users from the server and drop suggestions` |
| `1698de0` | `chore(common): remove lucide-react and dead mock exports` |
| `docs` | this directory, `docs/design/`, the structure rules, and the runbook update |

Branch: `fix/common/backend-contract-alignment`, cut from `chore/common/full-stack-reconnaissance` because the reconnaissance reports this phase depends on exist only there and are not yet on `develop`.

Code change size: 14 files, 171 insertions, 214 deletions. Well inside the `size/M` budget. The documentation and the committed design export are additional.

---

## Two things to know before reading further

### One item from the brief was wrong, and one defect it did not mention was found

The brief stated that registration requires a `username` the form may not collect. It does collect it, and always did. Register was the one auth endpoint whose wire shape was already correct.

Password reset, which the brief did not flag, was sending a field that made the request unparseable. It was found by reading the request record rather than by trusting the brief.

Both are documented in `auth-contract.md`.

### A more serious defect was found during verification and deliberately not fixed

Every component that renders a post reads `post.username`, `post.userId`, and `post.userAvatarUrl`. None of those fields exist. The backend returns a nested `author` object. The fallback expression lands on that object and React throws, replacing the explore screen with a full-page "Something went wrong" as soon as any post exists.

This is the same class of defect as everything else in this phase, and it is worse than any of them. It was not fixed because it is a sixth mismatch beyond the five this phase enumerates, correcting it means reworking the author shape across every post surface, and the brief instructs stopping and reporting rather than growing the branch past its size budget.

It was invisible before now because nobody could log in. Fixing login is what exposed it. It is not a regression from this branch: the files and lines involved were not modified.

Full detail, with the observed response and the exact lines, is the first entry in `deferred-findings.md`.

---

## Two definition-of-done items were not met

Stated plainly rather than worked around.

**Lint does not pass.** It did not pass before this branch either: 9,900 problems before, 9,464 after. 9,306 of those are a single repeated error, ``Delete `␍` ``, caused by a repository-wide configuration conflict. `core.autocrlf` is `true`, there is no `.gitattributes`, and `.prettierrc` demands LF endings, so every line of every file violates the rule on a Windows checkout. Clearing it requires a repository-wide reformat that would dwarf this branch. The files touched here were checked individually and introduce no new violations. Measurements are in `verification-evidence.md`.

**The blocked list was not verified across a hard refresh or a second browser profile as literally specified.** A hard refresh cannot preserve the session in this application at all, because both tokens are held in memory by design and never persisted. The underlying property, that the list is read from the server rather than from client storage, was verified by re-authenticating in a clean session and confirming the list matched the database.

---

## The backend was not modified

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean

$ git log --oneline -1
450212e Merge pull request #142 from zentech-graduation/fix/common/api-contract-and-security-hardening
```

---

## The rest of this directory

| File | What is in it |
|------|---------------|
| `auth-contract.md` | The verified field-level contract for all nine auth endpoints, with the observed request and response for each, and the before and after of every form |
| `changes-applied.md` | One entry per change: what was wrong, the evidence, what changed, which file |
| `verification-evidence.md` | Browser before and after for every fix with a user-reachable path, plus the `curl` evidence behind every contract claim |
| `deferred-findings.md` | Everything found and deliberately not acted on, with the phase it belongs to |

`docs/reconnaissance/local-environment-runbook.md` was updated where this phase changed the account creation path. The other reconnaissance reports were left alone, as instructed, because their value depends on remaining a snapshot.
