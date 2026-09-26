# Real Routing and Session Restoration

> Record of work done on 2026-08-10. Not maintained; it is correct as of that date and is not updated as the code moves.

Two changes that meet at the same place: what happens when you reload the page.

Before this work the whole signed-in application lived at one address, `/app`.
The visible screen was a string in React state, mirrored into `sessionStorage`.
Nothing could be linked, the back button left the application instead of going back a screen, and a reload logged you out and lost the screen you were on.

The backend has since shipped an `HttpOnly` refresh cookie, which makes a surviving session possible for the first time.
Fixing the routing without the session, or the session without the routing, still leaves a broken reload, so both are done here.

## What changed, in plain language

**A reload keeps you signed in.**
The browser holds the refresh token in a cookie that application code cannot read.
On a cold load the app asks the backend to trade that cookie for a fresh access token, which is kept in memory only.
No token is written to `localStorage` or `sessionStorage`, before or after.

**Signing out now really signs you out.**
It did not before.
The logout request was being sent without the bearer token the backend requires, so it answered `401`, the refresh token was never revoked, and the cookie was never expired.
With the cookie now live, that would have meant a "signed out" browser could restore the session on the next reload.

**Every screen has an address.**
All twenty-two of them, including screens for modules that are out of scope.
They can be linked, bookmarked, shared, reloaded, and reached with the back and forward buttons.

**The URL is the only source of truth for navigation.**
The screen state and its `sessionStorage` mirror are gone, and each screen reads its own parameters from the address rather than being handed them by a parent.

## What did not change

Nothing about how the application looks.
Feed, settings, and profile were screenshotted at 1440x900 before and after and are byte-for-byte identical.
The one behavioural difference that is visible is recorded in `route-table.md` under "backdrop behind an overlay", with the reasoning.

No new features and no new screens.
The search results screen is still not built; only its address is reserved.

## The commits that carry it

| Commit | Subject |
|--------|---------|
| `6c6c5c3` | `fix(auth): restore the session from the httponly refresh cookie` |
| `061c405` | `refactor(common): give every authenticated screen its own url` |
| `docs` commit | this directory, the runbook update, and the changelog entry |

The branch is `refactor/common/url-routing`.

It was cut from `fix/common/response-shape-and-session` rather than from `develop`, because that branch carries the prerequisite work named in the brief and it has not been merged to `develop` yet.
The earlier phases chain the same way.

## Branch size

The code changes total 973 changed lines, which is inside `size/M`.

Adding the six documents this phase is required to produce takes the branch past one thousand lines and into `size/L`.
That is reported rather than resolved: dropping a required deliverable to stay under a label would be the wrong trade, and the two previous phases on this chain shipped their documentation on the same branch.
The reviewable code is the 973 lines in the two commits above.

## The backend was not touched

Required check, run from `backend/`:

```
$ git status
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean
```

The refresh-cookie work was already merged there before this phase started, at `1e36f54`.
It was verified, not modified.

## The rest of this directory

| File | What is in it |
|------|---------------|
| `route-table.md` | Every route, its parameters, guard, component, and what it renders when a parameter is missing or wrong. The addressing decisions and why they went the way they did |
| `session-restoration.md` | The cookie behaviour as actually observed, what the app now does on a cold load, and the evidence for each check |
| `changes-applied.md` | One entry per change: what was wrong, the evidence, what changed, which file |
| `verification-evidence.md` | Every route against the four browser checks, with observed results |
| `deferred-findings.md` | What was found and deliberately left alone, and where it belongs |
