# Changes applied, by area

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

## The settings surface

### Added

| File | What it is |
|---|---|
| `settingsCatalog.js` | The three groups and seven categories as data, plus the resolver that maps a `:category` segment (and the one legacy alias, `password` → `account`) to a category. |
| `settingsCategories.jsx` | The seven category views, plus the shared row, read-only row, person row and state block they are built from. |
| `settingsStyles.js` | The screen's own layout CSS, injected by the screen. Every colour is an `--lx-*` token; no raw hex. |
| `useAccountStanding.js` | `useMyWarnings` and `useReportReasonNames` — the account's own warnings, and the server vocabulary that turns a `reasonKey` into the name the server gives it. |

### Rewritten

- **`SettingsScreen.jsx`** — from a 329-line scrolling list of rows into the group list and
  category region. Reads the category from the path, marks the open one with `aria-current`,
  resets the region's scroll and moves focus into it when the category changes.

### Deleted

Three screens the categories replaced. Each was referenced from exactly one place, the old
settings list, and each is now a category:

- `EditProfileScreen.jsx` (409 lines) — became the **profile** category. Its avatar and banner
  upload was carried over. Two defects were fixed in the move: it seeded its form from the
  session user in the store, which carries no `bio`, so opening it showed an empty bio to
  anyone who had one; and it did not handle `websiteUrl` at all, though the server accepts it.
  It also navigated away to the profile on save, which the new category does not.
- `BlockedUsersScreen.jsx` (80 lines) — became the **blocked accounts** category.
- `ChangePasswordScreen.jsx` (41 lines) — was a screen that said "coming soon". The one real
  password action lives in the **account** category.

### Removed controls

`delete account` (no handler, no endpoint), `story views` (permanently disabled, no field),
`help center`, `terms & privacy`, `about luvax` (empty handlers), and the unconditional
verified tick beside the email address.

### Refined after first review

| Change | Detail |
|---|---|
| Icons in the list | Each category carries one, from the existing internal icon component. A person-with-plus glyph was added to that component for follow requests, in the export's 24×24 / 1.5-stroke style. |
| Selection treatment | The accent rule on the leading edge is gone. The open row is a step up the surface scale with its name at weight 600 and its icon in full ink; hovering is one step less. |
| Straplines moved | The one-line description under every name in the list is gone. It is said once, under the heading of the category it belongs to. |
| Search | A field above the list filters names and group titles, drops empty groups, and says so when nothing matches. Client-side over a fixed structure; it calls nothing. |
| Position | Settings takes the full width from the rail's collapsed edge instead of sitting in the centred column, so the rail expands over the list rather than over empty space. |
| Divider | Both columns are exactly viewport height, so the rule between them runs the whole way down instead of ending with the shorter column's content. |

---

## The authentication surface

### Added

- **`AuthNotice.jsx`** — the outcome page for an authentication flow that ended somewhere
  other than signed in. Reuses the auth surface's existing centred-card composition. Its
  `tone` changes only the badge: `calm` for something the person chose, `problem` for a real
  failure.

### Rewritten

- **`OAuthCallbackPage.jsx`** — previously rendered `<h1>Google sign-in failed.</h1>` in bare
  unstyled markup with the raw error value beneath it and no way out. Now maps each real
  failure to a sentence, renders through `AuthNotice`, and always offers two ways onward. A
  cancellation is drawn calm rather than as an error. The file documents, at the top, that a
  real cancellation never reaches this page and why.

### Changed

- **`AuthPage.jsx`** — the four failure paths (sign-in, sign-up, forgotten password, starting
  Google sign-in) no longer print the server's sentence. A suspended account and wrong
  credentials are named specifically; everything else gets one calm sentence.
- **`EmailVerificationPage.jsx`** — an invalid or expired link previously printed the server's
  message under a heading that still said "verify your email" and a subtitle telling the person
  to check their inbox. The heading and subtitle now state the actual outcome, with the resend
  button under them.
- **`ResetPasswordPage.jsx`** — the expired-token case is named; everything else gets a calm
  sentence. The success and no-token strings were brought into the product's voice.

---

## Outside the settings and authentication surfaces

Called out separately, with justification, as the brief requires.

| File | Change | Why it was necessary |
|---|---|---|
| `shell.jsx` | The rail expands on focus as well as hover, and closes when focus leaves it. | Work Item 4.5.2: the overlay must not be a mouse-only affordance. The labels are the rail's only naming of its destinations. |
| `shell.jsx` | Rail labels moved from `--lx-ink-3` to `--lx-ink-2`. | That token measures below 4.5:1 in both themes, and these labels are content. |
| `shell.jsx` | Settings gets a wider pane at desktop (960px) as it already did at tablet; the app bar's subpage table collapses four settings screen ids into one. | The screen is two regions side by side, not a reading column. The tablet branch already made this exception for the same screen. The three deleted screens no longer have ids. |
| `ProfileScreen.jsx` | A `panel` button beside the settings button, for a privileged role only. The settings button's label changed from `edit profile` to `settings`. | Work Item 6. Section 3.6 established that the profile header is the only route into settings at phone width. The label was wrong before: it said `edit profile` and navigated to the settings index. |
| `lx-toggle.jsx` | `role="switch"`, `aria-checked`, `aria-label`, `aria-busy`, a visible boundary, and transitions moved onto the shared duration tokens. | It reported itself as a plain button with no state and no name, and its off state measured 1.25:1 against the page in dark — it disappeared. Also used by the messages panel, which gets the same fix. |
| `axiosClient.js` | A `VALIDATION_ERROR`'s field-name-to-message map is lifted onto the error as `fieldErrors`. | Field-scoped refusals must appear against their field. Without this every call site would reach into `error.response.data` for itself, which the frontend rules discourage. Only string values are copied. |
| `AuthPage.css` | The primary button's label moved from `--lx-ink-inverse` to `--lx-black` on the accent fill. | The same 2.08:1 pairing the panel corrected in the previous phase. This phase's authentication pages use that button. |
| `validationFields.js` | Added `websiteUrlField`. | The profile category edits `websiteUrl`, which the server accepts and the previous editor ignored. Length only — the server applies no format check, and a validator stricter than the contract it mirrors would reject values the server takes. |
| `user.service.js` | Added `getMyWarnings`. | Nothing read the account's own warnings. Sends only the declared `cursor` and `limit`. |
| `config.service.js` | New — `getVocabularies`. | Resolves a warning's `reasonKey` to the server's own display name. The admin feature has its own copy; a feature may not import another feature's internals, and moving that file is not permitted this phase. |
| `ConversationInfoPanel.jsx` | Passes the new `label` to its toggle. | `LxToggle`'s contract changed this phase: it now reports itself as a switch and takes an accessible name. Its only other consumer would otherwise announce a state without saying what it controls. One prop, on the one call site the contract change reaches. |
| `lx-icon.jsx` | Added a `userPlus` glyph. | Follow requests had no icon in the set. Added to the existing component in the export's own style, which is what the design rules require instead of a second icon set. |
| `lx-toggle.jsx` | `box-sizing: border-box`, and the knob reduced from 18px to 16px. | The one-pixel border was being added outside the declared 38x22, so the track rendered 40x24 while the knob was positioned inside a 38x22 box — the knob sat out of true on whichever side it had travelled to. The track is now 38x22 including its border, and a 16px knob inset by 2 leaves the same gap on every side in both states. |
| `shell.jsx` | Settings gets its own full-bleed branch against the rail at desktop and tablet; the now-dead settings widths were removed from the centred and tablet branches. | The list has to begin where the rail ends for the rail to expand over it. |
| `constants.js` | Category route constants, and `SETTINGS_CATEGORY`. | Every category needs an address. |
| `appScreens.jsx` | Five settings rows became two; three lazy imports removed. | One screen with a category in the path. |

**Nothing in the backend repository was modified.** Verified: `git status` in `backend/`
reports a clean tree.
