# Verification evidence

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything below was driven through a real browser against the running
application and the live backend. Nothing here is inferred.

## Environment

| | |
|---|---|
| Frontend | Vite dev server, `http://localhost:5173` |
| Backend | compose stack healthy — postgres, redis, rabbitmq, elasticsearch, gorse, mailpit all `Up (healthy)`; API answering on 8080 |
| Administrator context | `JohnDoe` (role `admin`) |
| Moderator context | `seed_mod` (role `moderator`) |
| Ordinary context | `sol.reyes` (role `user`) |
| Desktop width | 1920 × 1080 |
| Narrow width | 414 × 896 |

**On the two contexts.** The brief asks for a moderator and an administrator
context open simultaneously. The browser exposed here has a single storage
partition, so two authenticated sessions cannot be held at once — the second
sign-in replaces the first. Both role trees were therefore driven in full,
sequentially, in the same browser. This is a limitation of the tooling and is
stated rather than papered over; nothing about the checks themselves was reduced.

**On the fixture.** The environment held a dataset of 16 accounts and 70 posts
but no moderator and an empty report queue, so the split pattern had nothing to
show. Rather than run the destructive `--reset` seed and lose that content, a
moderator account, a known password for the existing administrator, and a queue
of 21 reports across every status and type were added additively. Reports were
attached to posts carrying several media so the viewer's paging was exercisable.

---

## 1. Entry point

| Check | Driven | Observed |
|---|---|---|
| Present for a privileged account, directly above settings | Signed in as `JohnDoe`, read the rail's DOM order | `… profile, panel, profile settings` — `panelDirectlyAboveSettings: true`. `screens/after-entrypoint-privileged-admin-dark.png` |
| Absent for an ordinary account | Signed in as `sol.reyes`, read the same | `… profile, profile settings`; `panelPresent: false`. `screens/after-entrypoint-ordinary-account-absent-dark.png` |
| Never flashes into view | Polled the rail every 50 ms for 2.5 s across an ordinary account's load | 41 samples, `everAppeared: false` |
| Leaving the panel is equally reachable | Read the panel header | `back to luvax` present beside the theme control and sign out |
| Follows the navigation's shape | Read the rendered button | Same `lx-tab-btn` class, same row/icon/label styles, same icon component and size, same lowercase label as its neighbours |

## 2. Master and detail

| Check | Driven | Observed |
|---|---|---|
| Opening a record fills the right region, list stays | Clicked row 2 on `/admin/reports` | URL became `?selected=42334f70…`; list still rendered beside the detail. `screens/after-reports-second-record-selected-dark-desktop.png` |
| **Selecting a second record does not reload the list** | Installed a `fetch`/`XHR` recorder, then selected two records in turn | First: only that report's 4 requests. Second: only the second report's 4. `listRequestFired: false` |
| The detail's URL restores the state in a fresh tab | Opened `?selected=21f51a1b…` in a new tab | `hasSplit: true`, correct row marked selected, detail heading `report`, 13 rows loaded |
| Back returns to the previous record, then the bare list | Selected two records, pressed back twice | `?selected=21f51a1b` → `?selected=f2bc69b5` → `/admin/reports`. Never left the panel |
| Every pre-existing URL still works | Loaded `/admin/reports/:id` and `/admin/users/:id` directly | Both render standalone, unchanged, with their own back links; no error state |
| Nothing selected explains itself | Loaded `/admin/reports` and `/admin/users` bare | "no report open …" / "no account open …". `screens/after-accounts-empty-detail-light-desktop.png` |
| Both regions scroll independently | Inspected the split | Each region has its own `overflow-y: auto` inside a viewport-height column |
| Keyboard operability | Read the rendered rows | Rows carry `tabIndex=0`, `role="button"`, `aria-current` when selected, and handle Enter and Space; focus moves into the detail region when the open record changes |
| Narrow collapse, every screen | Resized to 414 and walked all eight screens | `horizontalScroll: false` on all eight (`scrollWidth 408 === clientWidth 408`). With a record open: list hidden, detail full width, `back to the queue` present. `screens/after-reports-list-light-narrow.png`, `screens/after-reports-detail-dark-narrow.png` |

## 3. Controls and legibility

| Check | Driven | Observed |
|---|---|---|
| Select matches the buttons beside it | Loaded `/admin/actions` | The action-type select, both date inputs and `apply` now share pill, border, height and focus treatment. `screens/before-actions-light-desktop.png` → `screens/after-actions-light-desktop.png` |
| Focus ring never vanishes | Read the panel's focus rule | One rule on `--lx-accent-text` for every focusable element; the select's `outline: none` removed |
| Filters grouped, labelled, separated, wrapping | Loaded `/admin/reports` at both widths | Each condition on its own labelled plate; at 414 each takes full width and its chips wrap — all options reachable. `screens/before-reports-light-desktop.png` → `screens/after-reports-light-desktop.png` |
| **Contrast, measured** | Scripted WCAG audit over all 8 screens × 2 themes | Before: 5 failing roles dark, 5 light (worst 2.08). After: **0 failing roles anywhere**; worst 6.58 dark, 5.15 light. Full table in `contrast-audit.md` |
| Type on the export's scale | Measured the rendered export, then the panel | Export scale 10/11/12/13/14/16/22; every panel 10px label moved to 11px |
| No new token, no raw hex | Grepped every file this phase created | No hex match in `AdminMediaViewer`, `SplitView`, `splitSelection`, `useThemeChoice`, `panelStyles` |
| No dependency added | `git diff` on `package.json` / `package-lock.json` | No change |

## 4. Media viewer

| Check | Driven | Observed |
|---|---|---|
| Opens from a thumbnail | Clicked the 2nd of 4 thumbnails on a report | Full-viewport viewer over the scrim, counter `2/4`. `screens/after-media-viewer-open-dark-desktop.png` |
| Forward and back across the record's media | Pressed ArrowRight | Counter went `2/4` → `3/4` |
| Escape closes | Pressed Escape | `dialogOpen: false` |
| Focus returns to origin | Read `document.activeElement` after closing | `"open reported media, item 2 of 4"` — the thumbnail it was opened from |

## 5. Theme

| Check | Driven | Observed |
|---|---|---|
| **The defect, before** | Stored `lxDarkManual='1'`, `lxDark='true'`, loaded the panel | `data-theme: "light"`, body `rgb(249,247,244)` — dark chosen, light rendered. `screens/before-theme-bug-dark-requested-renders-light.png` |
| Panel has a control | Clicked it in the header | `data-theme: "dark"`, `lxDark: "true"` |
| Choice persists across a reload | Reloaded the panel | `data-theme: "dark"`, body `rgb(26,24,22)`, `persistedCorrectly: true` |
| No flash of the wrong theme | Theme is applied in `main.jsx` before React mounts, now reading both keys | Correct on first paint; nothing mounts later to correct it |
| The application's control works too | Wrote exactly what `SettingsScreen` writes, then reloaded both surfaces | dark → application dark **and** panel dark; light → panel light |
| System preference is the default | Read the hook and bootstrap | With no stored choice, `prefers-color-scheme` decides and keeps deciding as it changes |
| Every screen correct in both themes | Captured all eight, both themes | `screens/after-*-dark-desktop.png` and `screens/after-*-light-desktop.png` |

## 6. Failure branches

| Branch | Driven | Observed |
|---|---|---|
| Empty list | `/admin/hashtags` with no hashtags | "no hashtags yet — create a hashtag to start the vocabulary." `screens/after-hashtags-empty-*-desktop.png` |
| Empty queue | `/admin/reports` before the fixture | "the queue is clear" |
| Stale / invalid record link | `?selected=00000000-0000-0000-0000-000000000000` | List intact (13 rows), detail region reports "report not available…", no crash |
| Permission refusal | Moderator walked the whole tree | Only its three screens listed; **no request returned 403** |
| Moderator reaching an admin-only route | `/admin/users/:userId` as `seed_mod` | Renders the account record, as before — the access this phase deliberately preserved |
| Loading | Every navigation | Loading states render; the split does not shift when a list resolves |
| Reduced motion | `emulateMedia({ reducedMotion: 'reduce' })` | `matchesReduced: true`; every panel transition collapsed to `1e-06s`; screen renders correctly with 13 rows. `screens/after-reports-reduced-motion-light-desktop.png` |

## 7. Regression

| Check | Driven | Observed |
|---|---|---|
| Administrator tree | All eight screens | All render; no 403 |
| Moderator tree | All three screens | All render; no 403 |
| User-facing application | Sign in, feed, open a post, profile, settings | Feed rendered 10 posts; a post opened at `/app/p/<id>`; profile and settings loaded; **zero console errors** |
| Unit tests | `npm test` | **68 passed** (7 files) |
| New unit tests | `vitest run tests/unit/admin/splitSelection.test.js` | **10 passed** |
| Backend untouched | `git status` in the backend submodule | Clean working tree |

## 8. Console errors

Every console error seen during the whole run, and why:

- **Six 404s** on `/api/v1/reports/00000000-…` and `/admin/reports/00000000-…/target`,
  plus two `[QueryClient] Report not found` lines. These are the deliberate
  invalid-id failure branch above; the 404 is the expected answer and the
  QueryClient line is its dev-only logging.
- **One 401** on `/api/v1/auth/login`, from a first sign-in attempt with the
  password recorded in an out-of-date reconnaissance document.

No other console error appeared on any screen, in either theme, at either width,
in any of the three role contexts.

## 9. Network comparison against the previous phase

This phase changes no request, so any difference would be a defect it
introduced. Comparing the recorded traffic per screen with the previous phase's
readings:

- **Screen loads** — unchanged. Each list screen fires its own list request and
  the vocabularies request; each detail fires the report/target/violations/user
  set. No request was added, removed, reordered, or given different parameters.
- **The one new shape of traffic is an absence, not an addition.** Selecting a
  record inside the split fires the detail's requests *without* the list request
  that a full navigation used to trigger. Fewer requests, none different.
- **`?selected=` is a client-side parameter only.** It is never forwarded; the
  detail requests carry the same path parameters they always did.

**Limit worth stating.** The previous phase's readings are recorded per screen as
prose, not as a machine-comparable capture, so this comparison was made by
reading them against the live log rather than by diffing two files. That is the
strongest comparison the recorded material supports.
