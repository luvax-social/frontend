# Verification evidence

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything below was driven in a real browser through Playwright against the running
application and the running backend, or measured in the page. Console and network were captured
throughout. Screenshots are in `screens/` and linked from the check they evidence.

Environment: backend `UP` on `:8080`, compose stack healthy (six services), frontend dev server
on `:5173`, database seeded with the five `seed_*` accounts.

---

## Contract

| # | Check | What was driven | Observed |
|---|---|---|---|
| 1 | Contract doc committed before feature code | `git log` | `7c01c57 docs(users): record the settings and oauth contract verification` — the first commit on the branch, before any `src/` change |
| 2 | Every self endpoint enumerated | Read the live `/api-docs` (115 paths), then **called** each self endpoint | Five reads, five writes, plus the absences. Recorded in `settings-contract-verification.md` §3.1–3.2 |
| 3 | Inventory table exists; absences separate | — | `settings-inventory.md`: 23 rows under "What exists", a separate "What does not exist" section |
| 4 | Settings write semantics | Five probes against `PATCH /users/me/settings` | **Partial accepted**; **omitted = unchanged** (confirmed by re-read); `{}` → 200 no change; explicit `null` treated as absent; **unknown field → 400 `MALFORMED_REQUEST_BODY`, whole request rejected** |
| 5 | Cancelled sign-in chain recorded, server established | Real Google consent screen, Cancel pressed | Ends on **the backend origin**, `…/auth/oauth2/callback/google?error=access_denied&state=…`, **HTTP 500**, `text/html`, whitelabel page with `java.lang.StackOverflowError`. No redirect follows. [before](screens/oauth-cancel-BEFORE-backend-error.png) |

The 500 is condition-dependent and both conditions were recorded: with the flow's cookie (a
real cancellation) it is the 500 page; without it (plain `curl`) the callback answers **401**
with a clean JSON envelope. Neither redirects to the frontend — no `Location` header in any of
five query variants.

---

## Settings

| # | Check | What was driven | Observed |
|---|---|---|---|
| 6 | Every category has its own URL; pasting opens the same state | Navigated directly to all seven category addresses in a fresh load | Each opened its own category with the group list intact. [profile](screens/category-profile-desktop.png) · [notifications](screens/category-notifications-desktop.png) · [saved](screens/category-saved-desktop.png) · [privacy](screens/category-privacy-desktop.png) · [requests](screens/category-requests-desktop.png) · [blocked](screens/category-blocked-desktop.png) · [account](screens/category-account-desktop.png) |
| 7 | Back walks between categories, not out | Clicked `blocked` → `profile`, pressed Back | Landed on `/app/settings/blocked` — a category, not the feed |
| 8 | Group list keeps position; selection visible | Scrolled the list to 120px, changed category by click | List still at **120**; category region reset to **0**; open category carries `aria-current="page"` and the accent marker |
| 9 | Phone collapse, no horizontal scroll | 390 × 844 | List full width with category region removed; category full width with list removed and `all settings` back link shown. `scrollWidth` **384** vs `innerWidth` **390** — no horizontal overflow. [list](screens/settings-phone-list.png) · [category](screens/settings-phone-category-privacy.png) |
| 10 | Both regions scroll independently | Set each region's `scrollTop` separately at 1440 × 560 | groups `scrollHeight` 620 / client 491 / top **120**; category 813 / 491 / top **200**; page body not scrollable |
| 11 | Zero controls with nothing behind them | Cross-checked every rendered control against the inventory | Every control maps to a row. Network log confirms the screen calls only `/users/me`, `/users/me/settings`, `/users/me/warnings`, `/social/blocked`, `/social/follow-requests`, `/config/vocabularies`, `/posts/saved` |
| 12 | Every setting in exactly one group | — | `settings-inventory.md`. `isPrivate` is displayed in two categories and written in one, stated there |
| 13 | Edited in place | Opened each category | No category navigates away. The three screens that used to be navigated to are deleted |
| 14 | Validation error against its field | Typed `ab` into username, pressed save | Message under the username field, red border, `aria-invalid="true"`, value retained. [camera](screens/profile-validation-error-against-field.png) |
| 15 | Failed save retains the value | Typed `seed_bob` (taken), pressed save | Field still reads `seed_bob`; "that username is taken. try a different one." against the field; no banner; `aria-invalid="true"`. Server answered **409** `USER_USERNAME_ALREADY_EXISTS`. [camera](screens/profile-failed-save-value-retained.png) |
| 16 | Read-only renders as information | account category | `email`, `verified`, `account`, `joined` render as plain text, not disabled controls. [camera](screens/category-account-desktop.png) |
| 17 | Account state shown | Normal account, and a really suspended one | Normal: verified / public / joined / warnings, including a real warning issued through the panel. Suspended: **cannot reach settings at all** — 401 everywhere, 403 at sign-in — so it is stated at sign-in instead. [normal](screens/category-account-desktop.png) · [suspended](screens/auth-suspended-account-signin.png) |
| 18 | Categories keyboard-operable | Focused the first category link, pressed Enter | Navigated to `/app/settings/profile`. Tab moves through all seven; ring clearly visible. [camera](screens/settings-keyboard-focus-ring.png) |

---

## The rail

| # | Check | What was driven | Observed |
|---|---|---|---|
| 19 | Overlays; content beneath does not move | Measured every content coordinate closed, then hovered | Rail **68 → 223** rendered px. `main.x` **249 → 249**, group list **249 → 249**, category region **550 → 550**. Rail's right edge (223) never reaches the content (249). [closed](screens/rail-overlay-closed.png) · [hovered](screens/rail-overlay-hovered.png) |
| 20 | Keyboard-operable | Focus into the rail | Expands on focus, collapses when focus leaves, labels revealed |
| 21 | Respects reduced motion | `prefers-reduced-motion: reduce` emulated | Media query matches; rail label, category link and input transitions all resolve to **1e-06s**; screen renders correctly. [camera](screens/settings-reduced-motion.png) |
| 22 | Does not obscure a field | Hovered the rail while the profile form was on screen | Expanded rail ends at 223; the nearest field starts well right of it. Nothing covered |

---

## Authentication

Each distinct failure was produced and read back. **No raw body, code or stack trace appears
in any of them.**

| Case | How produced | What the person now sees | Camera |
|---|---|---|---|
| Cancelled sign-in | `?error=access_denied` on the frontend route | "you did not finish signing in — no problem — nothing was shared and no account was created." Calm badge, not an error treatment | [after](screens/auth-cancelled-signin-calm-page.png) · [before](screens/oauth-cancel-BEFORE-backend-error.png) |
| Expired / replayed exchange code | `?code=stale-code-probe`; server answered **400** `AUTH_OAUTH2_EXCHANGE_CODE_INVALID` | "that sign-in link had expired" | [camera](screens/auth-failure-expired-exchange-code.png) |
| Missing code on the return | `/oauth2/callback` with no parameters | "that sign-in did not come through" | [camera](screens/auth-failure-missing-code.png) |
| Retired implicit flow | `#access_token=abc` | "this sign-in arrived in a form we no longer accept, for security reasons" | [camera](screens/auth-failure-implicit-flow-refused.png) |
| Google refused for another reason | `?error=server_error` | "google could not sign you in" | [camera](screens/auth-failure-google-refused.png) |
| Suspended account signing in | Really suspended `seed_alice` through the panel, then signed in | "this account is suspended, so you cannot sign in to it at the moment…" | [camera](screens/auth-suspended-account-signin.png) |
| Invalid credentials | Wrong password; **401** `AUTH_INVALID_CREDENTIALS` | "that email or password is not right. check them and try again." | — |
| Expired email verification link | `?token=invalid-token-probe`; **400** `AUTH_VERIFY_TOKEN_INVALID` | "that link has expired — verification links stop working after a while, and each one can only be used once." Resend button beneath | [before](screens/auth-verify-email-invalid-token-BEFORE.png) · [after](screens/auth-verify-email-invalid-token-AFTER.png) |
| Expired password-reset link | `?token=invalid-token-probe` | The form renders (the token can only be judged on submit); submitting gives "this link has expired or has already been used." | [camera](screens/auth-reset-password-expired-link.png) |

**All six flows were walked end to end**: sign in (✓ succeeds, and both refusals named), sign
up (✓ reaches the verify notice), verify email (✓ both outcomes), forgot password (✓ sends,
"check your inbox"), reset password (✓ form and refusal), OAuth callback (✓ five outcomes).

The **before** state of the frontend callback: bare unstyled `<h1>Google sign-in failed.</h1>`
with the raw error value printed beneath it and **no way out**. Now every outcome offers two.

---

## Phone entry point

| # | Check | Observed | Camera |
|---|---|---|---|
| 29 | Privileged account reaches the panel at phone width | `panel` pill beside `settings` on the own-profile header; clicking it opened `/admin/reports` | [camera](screens/phone-entry-privileged-account-panel.png) |
| 30 | Ordinary account does not see it, and it never flashes | Absent for `seed_alice`. Role is read from the auth store and is `null` until the session resolves, so `isPanelRole` reads false first and can only turn true | [camera](screens/phone-entry-ordinary-account-absent.png) |
| 31 | Returning from the panel reachable at phone width | The panel header carries `back to luvax` → `/app`; at narrow width it keeps its icon and its accessible name | [camera](screens/phone-panel-return-to-app.png) |

Placement follows the evidence in §3.6: the bottom bar has six primary tabs and **no settings
slot**, and the side rail — which carries both `settings` and `panel` — does not exist at phone
width. The profile header pill is the only route into settings there.

---

## Failure branches, every category

Exercised with a transport-level failure injected at `XMLHttpRequest`, with a really revoked
session, and with real empty and populated data.

| Branch | Observed |
|---|---|
| Loading | Framed "loading" block. No layout jump when it resolves — the block and the content occupy the same framed region |
| Empty | Each category states its own empty case. `blocked`: "you have not blocked anyone". `requests`: "no one is waiting — your account is public, so people follow you without asking first". `saved`: "nothing saved yet" |
| Network failure | "we could not load this — the server did not answer. it is usually a passing thing…" in a framed block. Cached sections of the same category kept rendering. [camera](screens/category-failure-network-error.png) |
| Invalid input | Field-scoped, against its field. [camera](screens/profile-validation-error-against-field.png) |
| Rejected save | Value retained, reason stated. [camera](screens/profile-failed-save-value-retained.png) |
| Session expired while open | Revoked `seed_alice`'s session server-side through the panel, then flipped a toggle. The refresh failed and the app cleared the session and returned to sign-in. No blank screen, no raw error. [camera](screens/category-failure-session-expired.png) |

---

## Contrast, measured

Computed in the page: composited foreground over the real effective background, WCAG 2.1
ratios. Colours resolved through a canvas so `color-mix()` values are measured as painted.

### Text roles this phase adds

| Role | size/weight | Light | Dark | Threshold |
|---|---|---|---|---|
| group title | 12/600 | 7.51 | 7.92 | 4.5 |
| category label | 14/500 | 16.56 | 15.16 | 4.5 |
| category label (selected) | 14/500 | 4.78 | 10.12 | 4.5 |
| category hint | 12/400 | 7.51 | 7.92 | 4.5 |
| category hint (selected) | 12/400 | 6.88 | — | 4.5 |
| category heading | 22/700 | 16.56 | 15.16 | 3 (large) |
| section title | 13/600 | 7.51 | 7.92 | 4.5 |
| row label | 14/500 | 16.56 | 15.16 | 4.5 |
| row sub | 12/400 | 7.51 | 7.92 | 4.5 |
| read-only value | 13/400 | 7.51 | 7.92 | 4.5 |
| note | 13/400 | 7.51 | 7.92 | 4.5 |
| warning reason | 13/600 | 16.56 | 15.16 | 4.5 |
| warning note | 13/400 | 7.51 | 7.92 | 4.5 |
| warning date | 11/400 | 7.51 | 7.92 | 4.5 |
| back link | 13/500 | 7.51 | 7.92 | 4.5 |
| field label | 13/500 | — | 7.59 | 4.5 |
| input value | 15/400 | — | 14.52 | 4.5 |
| field error text | 12/400 | — | 7.02 | 4.5 |
| saved confirmation | 12/400 | — | 8.67 | 4.5 |
| primary button label on accent | 15/600 | — | 9.43 | 4.5 |

**Zero failures.**

### Non-text (3:1 for UI components)

| Element | Light | Dark |
|---|---|---|
| focus ring on base | 5.22 | 11.21 |
| focus ring on surface | 4.78 | 10.12 |
| focus ring on raised | 4.37 | 8.99 |
| failure banner border | — | 4.98 |
| toggle boundary, off | — | 7.92 |
| toggle boundary, on | — | 7.95 |

### Two failures found by measuring, and fixed

- **Failure banner**: `--lx-error-text` on `--lx-error-dim` measured **1.44:1** in dark. The
  banner now sits on `--lx-base` with the error carried by border and text tone — **7.02** and
  **4.98**.
- **Toggle**: off fill measured **1.25:1** against the page in dark, so the switch disappeared.
  Neither border token rescued it (1.44, 1.82). Boundary drawn in `--lx-ink-2` — **7.92**.

`--lx-ink-3` is used **nowhere** in what this phase adds — verified by grep, count zero,
including the input placeholder the export specifies it for.

---

## Craft and regression

| # | Check | Observed |
|---|---|---|
| 33 | No raw hex, no invented token | grep across all nine added/rewritten files: **0** hex literals |
| 35 | No dependency added | `git diff develop -- package.json package-lock.json` is empty |
| 36 | Declared parameters and fields only | Full network capture across all seven categories: `?limit=20` on warnings and blocked, `?limit=12` on saved, nothing else. The one mutation sent `{"notifyLikes":true}` |
| 38 | Renders under reduced motion | Verified above |
| 39 | Console errors | None from application code. Three benign browser-level entries recorded: the expected **400** when probing a bad exchange code, the expected **401** during pre-sign-in session bootstrap, and a **404** for `/favicon.ico` on the backend origin during the OAuth reproduction |
| 40 | Rest of the app still works | Signed in; feed renders; opened a post at its own address (`/app/p/1259744d-…`); **posted a real comment**, which appeared; profile renders with correct counts; explore renders. Zero console errors during that run |
| 41 | Admin panel, both role trees | **Administrator** (`seed_admin`): lands `/admin/reports`, nav shows moderation **and** administration groups. **Moderator** (`seed_mod`): lands `/admin/reports`, nav shows moderation only — `reports`, `my-escalations`, `actions` — and no administration group. Both see the `panel` pill on their profile |
| 43 | Backend untouched | `git status` in `backend/` reports a clean tree |

Build: `vite build` exits 0 after every change.
