# Deferred findings

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

Noticed during this phase and deliberately not acted on. Each is tagged with who owns it.

---

## Design system

### The design export's small-label role fails contrast product-wide — DESIGN / OWNER

`--lx-ink-3` is the export's own colour for small labels and placeholders. Measured against the
surfaces it sits on it comes out at roughly **2.8–3.74:1**, below the 4.5:1 a readable text role
needs, in both themes. The previous phase found this across the panel; this phase found it again
on the user-facing side, and DESIGN.md still specifies it as the placeholder colour.

**Not fixed here, by instruction.** Nothing this phase adds uses it — verified by grep, count
zero, including the one input placeholder the export specifies it for, which uses `--lx-ink-2`
instead. It remains in use elsewhere in the application.

**Owner:** whoever owns the design export. The fix is either to redefine the token or to retire
it as a text role and say so in DESIGN.md. Patching it per-screen, which is what two phases have
now done, does not scale.

### `--space-5` is documented but not defined — DESIGN / FRONTEND

DESIGN.md's spacing scale lists `--space-5: 20px`. The stylesheet does not define it. Any rule
using `var(--space-5)` in a shorthand silently drops the **whole declaration** — this phase lost
a region's entire padding to it before it was caught by measuring, not by looking.

`--space-10` and `--space-16` are also listed in DESIGN.md; only `--space-1`, `-2`, `-3`, `-4`,
`-6`, `-8` and `-12` were confirmed present.

**Owner:** frontend, to define the missing tokens or correct DESIGN.md. Low effort, and it
removes a failure mode that is invisible in review.

### `Luvax_Auth.html` does not exist — OWNER / PLANNER

The brief names it as the design export for the authentication surface and requires the pages to
follow it. It is not in either working tree and not anywhere in the workspace; only
`docs/design/Luvax.html` exists.

The authentication pages therefore follow the implemented auth surface — the composition and CSS
the unified auth page already uses — which is the closest thing to an authority that exists.

**Owner:** whoever holds the design exports, to supply the file or confirm there isn't one.

---

## Backend

Both of these are written up properly in `docs/admin-panel/backend-request.md`, items 11 and 12.
Listed here so this phase's findings are complete in one place.

### A cancelled Google sign-in ends on a server error page with a Java stack trace — BACKEND

Reproduced in a browser. The person lands on the backend's own address with **HTTP 500** and a
whitelabel page carrying `java.lang.StackOverflowError`. The frontend is not in the chain and
cannot intercept it. No workaround was attempted.

### A suspended account is never told when its suspension ends — BACKEND

Every authenticated read answers 401 and sign-in is refused **403** with no end date, so there is
no surface on which the frontend could show one. The sign-in screen states the suspension plainly
and says nothing about *until when*, because nothing is returned to say it with.

---

## Frontend, this application

### The profile pill was labelled `edit profile` and went to the settings index — FIXED, noted for the record

Found during the §3.6 walk. Fixed in passing this phase: the pill now says `settings`, which is
where it always went.

### `websiteUrl` accepts anything the server will store — FRONTEND

`PATCH /users/me` applied no format check when probed: `{"websiteUrl":"not a url"}` returned
**200** and stored it verbatim, and it renders on the profile.

The client validator deliberately mirrors this — length only — because a validator stricter than
the contract it exists to mirror would reject values the server accepts. But the result is that a
person can save a link that cannot be followed.

**Owner:** frontend, if the product wants a link that is always clickable; or backend, if the
constraint belongs in the contract. Not decided here because it is a product question, not a bug.

### A server field-rule message can still reach a field, in the product's second voice — FRONTEND

A `VALIDATION_ERROR` carries a field-name-to-message map, and the profile form renders it against
the field when the client validator did not catch the rule first. Those messages are the server's
own wording ("size must be between 3 and 30").

In practice the Zod validators mirror the server's constraints, so this path is a fallback that
should not normally be reached — and it renders a field rule, not a code or a stack trace. Left
as the honest fallback rather than swallowed.

**Owner:** frontend, if a full mapping of server field rules to the product's voice is ever
wanted.

### The panel's split view and the settings split are two implementations of one pattern — FRONTEND / ARCHITECTURE

`SplitView` + `panelStyles` in the admin feature, and `SettingsScreen` + `settingsStyles` in the
luvax feature, now implement the same master-and-detail behaviour twice. This phase could not
share them: a feature may not import another feature's internals, and extracting the file to a
shared location is a move, which this phase was not permitted to make.

**Owner:** frontend architecture. If a third surface ever wants this pattern, extract it to
`src/components/` first. Two is tolerable; three is not.

### `SavedPostsScreen` draws its own header inside the settings region — FRONTEND

It renders a sticky "saved" bar of its own. The settings category suppresses its heading there
(`ownsHeading`) so the word does not appear twice, but the result is one category whose heading
looks different from the other six.

**Owner:** frontend. Fixing it properly means giving that screen an embedded mode, which is more
change than this phase's mandate covers.

### The theme choice has no server behind it — PRODUCT

Removed from the settings screen this phase, because rendering it beside settings the server
actually stores would have implied it was of the same kind. It remains a browser-local
preference and still works where it already lived, including the panel's own header control.

**Owner:** product, to decide whether a device preference deserves a place on a settings screen
that is otherwise entirely server-backed. Adding a `theme` field to the settings record would
settle it.
