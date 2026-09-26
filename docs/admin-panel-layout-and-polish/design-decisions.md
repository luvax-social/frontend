# Design decisions

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

## 1. The master-and-detail URL strategy

**Decision.** The open record lives in the address bar as a search parameter,
`?selected=<id>`, on the list screen. Every path that addressed a record before
this phase still exists, still renders, and is unchanged.

**The option rejected: nesting the detail route under the list route.** This was
the first choice and it is the better pattern in the abstract — React Router
keeps the parent mounted, so the list survives a selection for free, and the
record's URL stays exactly what it was.

It was rejected because the panel's two split screens cannot both be expressed
that way:

- Reports could be nested. `/admin/reports` and `/admin/reports/:reportId` are
  reachable by both roles, so a shared parent denies nobody anything.
- **Accounts could not.** `/admin/users` sits behind `AdminOnlyRoute`, while
  `/admin/users/:userId` is deliberately outside it, because a moderator reaches
  an account's record from the action log — `ActionDetailDrawer` links straight
  to it. Nesting the detail under the list would have put it behind the
  administrator guard and shown a moderator "this area is available to
  administrators only" for a screen they have today. That is a capability
  removal, which this phase is not permitted to make. The alternative — moving
  the list out from behind the guard — is worse: `AccountListScreen` would then
  mount for a moderator and fire the account-list request the guard exists to
  prevent, which the backend answers 403.

Two mechanisms for one pattern would have been the third-worst option. So the
search parameter is used for both, and the record paths are left untouched.

**What the parameter buys, verified in the browser:** the detail has its own
URL; that URL restores the same state in a fresh tab; back walks from a record
to the record opened before it and then to the bare list, never out of the
panel; and because the list component is never unmounted, it keeps its scroll
offset and its loaded pages and issues no request when the selection changes.

A `selected` value the loaded list does not contain is treated as a stale link:
the list renders and the detail region reports the record is not available,
rather than the screen breaking. While the first page is still in flight the
value is kept rather than discarded, so a shared link does not flash the empty
region before the list arrives.

### Which screens took the pattern

| Screen | Master–detail | Reason |
|---|---|---|
| `/admin/reports` | **yes** | A list whose records have a detail of their own. |
| `/admin/users` | **yes** | Same, subject to the guard constraint above. |
| `/admin/escalated` | no | Its rows open a report, at `/admin/reports/:id` — a URL the reports screen owns. Giving it a split would mint a second address for the same report. It keeps one region and hands off. |
| `/admin/my-escalations` | no | Same reason. |
| `/admin/actions` | no | It already has an in-place detail, `ActionDetailDrawer`, addressed by `?action=`. It is already a master-and-detail screen by another mechanism; converting it would be a behaviour change for no gain. |
| `/admin/hashtags` | no | No detail route exists. Rows are acted on in place. |
| `/admin/statistics` | no | No list. |
| `/admin/activity` | no | No detail route. |

Screens without a detail keep their single region and now simply use the full
width, which is the other half of the wasted-viewport complaint.

## 2. The select-control decision

**Decision.** Select-like controls stay native, and every one of them is brought
onto the panel's single control shape. The in-DOM listbox that an earlier phase
built (`ReasonSelect`) stays where it is.

**The mechanism is the shape, not the implementation.** The design export gives
one form for anything clickable: a pill at `--radius-pill`, a one-pixel
`--lx-border`, body type at 12px/500, a control around 28–30px tall. That shape
is now defined once, in `panelStyles.js`, and every control wears it — the
action-type `<select>`, both `datetime-local` inputs, the panel's buttons, and
the header controls. A control that sits in a row with a button now looks like
it belongs in that row, which is what the review asked for.

**Why native rather than converting everything to the listbox.** A native select
is keyboard- and screen-reader-correct without work, behaves properly on touch,
and can express an unavailable option through `option:disabled`, which the
stylesheet now styles. `ReasonSelect` is not kept out of stubbornness: it renders
a description and an unavailability explanation *per option*, which a native
`<option>` cannot carry. Collapsing it to a native select would lose information
the earlier phase deliberately added.

The native select also carried `outline: none`, which removed its focus ring
entirely. That is gone; the panel now has one focus ring, on `--lx-accent-text`,
which stays visible against every surface in both themes.

## 3. The media viewer reuse decision

**Decision.** Matched deliberately, not reused. `AdminMediaViewer` is new code in
the admin feature.

**Why the application's viewer could not be reused.** The viewer the app opens
for a post is `PostDetailScreen` in overlay form. It is a route-level component
in the `luvax` feature that resolves a post from the path, loads its comments,
and offers liking, saving and commenting. Mounting it inside the panel would
have done three forbidden things at once: imported across features, which the
frontend rules prohibit; fired requests this phase is not allowed to add; and
handed a moderation surface the ability to comment on and like the content it is
judging.

**What "matched" means concretely.** The behaviour and appearance were copied
from that overlay and from `PostMedia`, the carousel inside it:

- a full-viewport overlay over `--lx-scrim`, the application's own scrim
- Escape closes it, through `useEscapeKey` — the same shared hook the post
  overlay uses, not a second implementation
- arrow keys move between items; forward and back controls appear only where
  there is somewhere to go
- a position counter and position dots
- controls drawn as light frosted chips with a dark glyph, which is what the
  post carousel uses so a quiet control stays legible on top of any photograph

Two divergences from `PostMedia`, both deliberate. It uses fixed hex values for
those chips; this phase may not introduce a hex, so the chip is `--lx-white-75`
and the glyph `--lx-black` — both theme-invariant, which is the property the
original was reaching for. And focus returns to the thumbnail the viewer was
opened from, which the inline carousel has no need to do.

No dependency was added. Nothing about it is a lightbox library.

## 4. The theme mechanism

**Decision.** One storage contract, centralised — not a second mechanism.

The product already had a contract: `lxDarkManual` is a flag recording that a
choice was made, and `lxDark` carries the value. `LuvaxApp` and `SettingsScreen`
both write it correctly. `main.jsx`, which applies the theme before React mounts,
read the *flag* as though it were the *value*, so any manual choice resolved to
light. In the user-facing application `LuvaxApp` mounted a moment later and
corrected it — a flash. In the panel, where `LuvaxApp` never mounts, nothing
corrected it, so the panel could not render dark at all. That single misread is
the whole of the review's fourth finding.

`main.jsx` now reads both keys exactly as the application writes them.
`useThemeChoice` is a small shared hook that encapsulates the same two keys for
the panel's own control; it centralises the existing contract rather than
introducing a rival one. System preference remains the default until a choice is
stored, and keeps steering while none is.

## 5. Patterns derived rather than taken from the export

The export covers a reading surface. The panel is a dense working surface, and
several of its pieces have no equivalent to copy. Each is built from the
export's own tokens and is labelled as derived in the source:

- **The split layout** (`SplitView`, `.lx-admin-split`) — two regions, each with
  its own scroll, collapsing to one at a narrow width. Built from the surface,
  border and spacing tokens.
- **The record table** (`RecordTable`) — already derived before this phase; this
  phase changed its header colour and size and added selection and keyboard
  operation.
- **The filter bar** (`FilterBar`) — each condition on its own bounded, labelled
  plate. Derived; the export has no filter bar.
- **The status badge** (`StatusBadge`) — already derived; this phase moved the
  tone from the text into the fill and border for legibility.
- **The empty detail region** — states what the region is for. Derived.
- **The media viewer** — see section 3.

## 6. What the review implied should change and was left alone

- **The record table's own horizontal scroll at narrow widths.** Wide content
  scrolling inside its container, rather than scrolling the page, is the
  established pattern here and the page body itself never scrolls sideways at
  any width. Changing it would mean dropping columns a reviewer needs.
- **`--lx-ink-3` itself.** It is still the right token for a genuinely decorative
  mark and is untouched outside the panel. The fix was to stop using it for
  content, not to redefine it.
- **The panel's 26px screen title.** Above the export's 22px maximum, but the
  export has no page-title role — its 22px is a wordmark. Left as derived work
  rather than shrunk to match a value that means something else.
