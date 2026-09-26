# Deferred findings

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

Noticed during this phase, deliberately not acted on. Each is tagged with who
owns it.

---

## 1. No entry point to the panel at phone width

**Owner: the next panel phase, or whoever owns the application's navigation.**

The `panel` entry was added to the side rail, which is the desktop and tablet
navigation. At phone width the application shows a bottom bar instead, and that
bar has no `settings` entry for the new entry to sit above — settings is reached
from the profile screen there.

A privileged account on a phone therefore still has no way into the panel except
typing the URL. Closing it means choosing a placement the review did not specify,
in an application that is finished and in review, so it was left rather than
guessed at.

---

## 2. The disabled primary button is below AA

**Owner: whoever owns the application's design system.**

`LxBtn`'s disabled `primary` variant uses `--lx-ink-3` on `--lx-surface-raised`,
which measures roughly **2.6:1** in the light theme.

Not fixed here for two reasons: WCAG explicitly exempts disabled controls from
the contrast requirement, so it is not a failure against this phase's bar; and it
is an application-wide primitive, where this phase's remit was the panel. Worth
someone's attention as a usability matter even though it is not a conformance one.

---

## 3. The design export's own small-label role fails AA

**Owner: whoever owns the design system.**

`docs/design/Luvax.html` renders `TRENDING`, `SUGGESTED` and `TODAY` at 10px in
`--lx-ink-3` on `--lx-base` — about **2.8:1** in the light theme.

The panel diverged from the export here deliberately, and that divergence is
recorded in `contrast-audit.md`. But the export is the source of truth for the
product's visual language, and the same role presumably appears throughout the
user-facing application at the same failing ratio. Either the export's muted tone
or the role's token wants revisiting at the system level; the panel fixing it
locally leaves the rest of the product where it was.

---

## 4. Cross-feature imports from `admin` into `luvax`

**Owner: whoever owns the frontend structure rules.**

The frontend rules state that a feature must not import from another feature's
internals. The panel already breaks this in several places that predate this
phase — `AdminShell` imports `ToastHost` and `toast` from
`@/features/luvax/components/Toast`, and `FilterBar`, `ReportDetailScreen` and
`AccountContent` import `LxTag` / `LxBtn` from
`@/features/luvax/components/primitives`.

This phase added no new cross-feature import and deliberately built
`AdminMediaViewer` inside `admin` rather than reaching for the application's post
viewer. But the existing ones are still there, and the honest fix is to promote
those shared primitives into `src/components/ui/` — a refactor with a wide blast
radius that does not belong in an appearance phase.

---

## 5. The panel does not apply the application's viewport zoom

**Owner: the next panel phase.**

`LuvaxApp` sets `documentElement.style.zoom` between 1.14 and 1.6 depending on
viewport width. The panel renders outside that shell, so it always renders at
zoom 1. The practical consequence is that identical token sizes render visibly
smaller in the panel than anywhere else in the product — which is part of why the
panel's type read as too small.

This phase addressed the symptom by moving the panel's 10px labels onto 11px. It
did not adopt the zoom, because doing so would change every dimension on every
panel screen at once, well beyond what the review asked for. Whether the panel
should share the application's scale is a real question for someone to settle.

---

## 6. The record table scrolls horizontally inside its container at narrow widths

**Owner: nobody yet — recorded as a known, accepted behaviour.**

At 414px the tables scroll sideways within their own container. The page body
never does, which is what the brief required and what was measured on all eight
screens.

The alternative — dropping columns below a breakpoint — hides information a
reviewer may need and was not asked for. Recorded so the next person knows it is
a decision rather than an oversight.

---

## 7. The seeded fixture is not the documented one

**Owner: whoever maintains the development environment.**

Two things were out of date. `docs/reconnaissance/seed-data.md` records the seed
password as `ReconPass123!`; the script actually uses `SeedPass123!`. And the
brief gives the seed script's path as `scripts/seed-dev-data.sh`, while it lives
at `backend/scripts/seed-dev-data.sh`.

Separately, the environment as found held a richer dataset (16 accounts, 70
posts) than the seed script produces, with no moderator and an empty report
queue. Rather than destroy it with `--reset`, the missing pieces were added
additively — a moderator account, a known administrator password, and a queue of
21 reports. Anyone re-running `--reset` will get the smaller documented dataset
and should expect the screenshots here not to match.
