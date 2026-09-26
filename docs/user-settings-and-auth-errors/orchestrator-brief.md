# Orchestrator brief — user settings and authentication error handling

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

For the planner. Under two pages.

---

## What was built

**Settings is now a browsable screen.** A persistent list of three groups and seven categories
sits beside the navigation rail; choosing a category swaps the region to its right. Every
category has its own address, the back button walks between categories rather than out of
settings, both regions scroll independently, and at phone width it collapses to a full-width
list and a full-width category with a way back. Fields are edited where they are displayed —
no category opens a separate screen to change one value.

**Three whole screens were deleted**, because the categories replaced them: the profile
editor, the blocked-users list, and a "change password" screen that was 41 lines of
"coming soon".

**Five dead controls were removed.** The old screen rendered a red `delete account` button
with no click handler at all and no endpoint behind it; a permanently disabled "story views ·
coming soon" toggle; and `help center`, `terms & privacy` and `about luvax` rows whose click
handlers were empty functions. It also showed a green tick beside the email address
unconditionally, reading `isVerified` off a session object that only carries `emailVerified` —
so the indicator never reflected anything.

**Authentication failures now read as sentences instead of backend messages.** Sign-in,
sign-up, email verification, password reset and the OAuth callback previously printed whatever
the server said, in the server's Title Case voice.

---

## What the cancelled sign-in actually does, and what that meant

**It was reproduced in a real browser, not reasoned about.** Google sign-in reached the
consent screen and Cancel was pressed.

The browser goes to `localhost:8080/api/v1/auth/oauth2/callback/google?error=access_denied&
state=…` — **the backend's own address** — and stops there with **HTTP 500** and a Spring
**Whitelabel Error Page carrying a `java.lang.StackOverflowError` stack trace**. There is no
redirect after it. The frontend is not in the chain at any point and has no route, parameter
or listener that could observe this.

The backend does have an OAuth failure handler that writes a clean 401 envelope, and calling
the same callback without the flow's cookie does reach it. With the cookie — that is, in an
actual cancellation — authentication recurses until the stack blows, so that handler never
runs.

**What that meant for the work.** This is Section 5.2 of the brief, not 5.1. The frontend
cannot fix it, and no workaround was attempted: no polling, no intercepting a navigation the
app does not control, no guessing at a redirect. It is recorded as a backend request item in
`docs/admin-panel/backend-request.md`, stated as observed behaviour plus what the frontend
needs.

**What was built instead is the part that is reachable.** Five authentication failures *are*
responses to calls the frontend makes, and each is now distinguishable to the person without
exposing internals: an expired or replayed exchange code, a malformed return from Google, a
retired implicit-flow return, invalid credentials, and a suspended account. The OAuth callback
route also keeps a branch for a returned `?error=`, written so a cancellation reads as a calm
choice rather than an error — so that if the backend is fixed to redirect, the page is already
correct.

---

## The final grouping and why

| Group | Categories |
|---|---|
| how you use luvax | profile, notifications, saved posts |
| who can see your content | privacy, follow requests, blocked accounts |
| **your account** | account |

The first two were given. The third was added because the verified inventory holds six real
things that are neither presence nor audience: the email address, the verified badge, the join
date, warnings received, the password reset, and signing out.

`saved posts` is content rather than a preference. It stayed because the settings screen was
the only place in the application it was reachable from, and removing the entry would have
taken away a working capability.

---

## Architectural decisions, and the option rejected

| Decision | Rejected alternative, and why |
|---|---|
| Category in the path (`/app/settings/:category`), one screen | **Category in component state.** Less code, but every category would share one URL — which is the complaint the phase exists to fix — and the back button would stop working. |
| `/app/settings` is the group list at every width | **Redirect to the first category at desktop.** Avoids an empty region on a wide screen, but the redirect can only be right at one width: at phone width the bare address must be the list. One URL would mean two states. |
| The split is new code in the user-facing feature, matched to the panel's | **Importing the panel's `SplitView`.** Forbidden: a feature may not import another feature's internals, and extracting it to a shared location means moving a file, which this phase may not do. |
| Panel entry at phone width sits beside the settings pill on the profile header | **A seventh slot in the bottom bar.** The bar is a six-slot primary-destination row with no settings slot to sit adjacent to, and a slot visible to two roles out of three would reflow the bar per-role. The profile pill is where settings is actually reached at that width. |
| Text fields save on an explicit button; toggles save on the flip | **Saving text on every keystroke.** A change is meant to be deliberate. A toggle click already is one. |

---

## What the reference product has that this one does not, and therefore was not built

Activity log and time-spent controls, close friends, comment filtering and keyword muting,
hidden words, tagging and mention permissions, story-sharing controls, ads and personalisation,
linked accounts, login activity and devices, saved login info, two-factor authentication,
professional or business account switching, archived content, subscriptions, language, data
download, and account deletion or deactivation.

Also absent from the server and therefore not rendered: changing your password while signed in
(only the email loop exists), changing your email address (the profile endpoint rejects the
field), seeing your own sessions, and a story-view notification preference.

**Zero controls on the screen have nothing behind them.** Every one maps to a row in
`settings-inventory.md`, and the network log confirms the screen issues only declared query
parameters and sends only declared body fields.

---

## What could not be verified

- **A suspended account's own view of its suspension.** Not a tooling limit — it does not
  exist. A suspended account is refused at sign-in with **403** and answered **401** on every
  authenticated endpoint, so it can never load a settings screen, and the refusal carries no
  end date. The brief asked for a suspension with its end date on the settings screen; that
  surface cannot exist. It is surfaced at sign-in instead, stated plainly, and the missing end
  date is a backend request item.
- **A genuine network interruption mid-OAuth-flow.** Staging a real transport failure between
  Google and the backend is outside what the tooling here can do. Killing the backend mid-flow
  produces a browser connection error on the backend origin — the same unreachable-frontend
  class already recorded — so it adds nothing. Not claimed as tested.
- **A replayed exchange code using a genuinely issued one.** A successful sign-in was never
  completed, because cancelling was the object of the exercise. Replay was exercised with a
  fabricated code, which the server answers with the same error as an expired one; the code
  path is shared and the distinction is not observable to a client.
- **`Luvax_Auth.html` does not exist.** The brief names it as the design export for the
  authentication surface and requires the pages to follow it. It is not in either working tree
  or anywhere in the workspace; only `docs/design/Luvax.html` exists. The authentication pages
  therefore follow the implemented auth surface — the composition and CSS the unified auth page
  already uses — rather than a file that could not be found.
