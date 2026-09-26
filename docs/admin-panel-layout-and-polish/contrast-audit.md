# Contrast audit

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

Every text role in the panel, measured against the surface it actually sits on,
in both themes, before and after.

## Method

Measured, not judged. A script walked every leaf element carrying text on every
panel screen and, for each, read the computed colour, composited the full stack
of background layers beneath it (correctly, including translucent layers and
their resulting alpha), and computed the WCAG 2.1 contrast ratio. Roles were
grouped by `size / weight / colour / composited background`, so one row here is
one role, not one element.

Thresholds: **4.5:1** for body text, **3:1** for large text (≥24px, or ≥18.66px
at weight ≥700). Disabled controls are excluded, as WCAG excludes them.

The audit ran over: reports, my escalations, actions, escalated, accounts,
hashtags, statistics, activity — in both themes.

> One correction worth recording: the first version of the compositing helper
> assumed a layer was opaque after a single composite step, which reported a
> false failure of 1.31:1 for a badge sitting on a translucent selected row. The
> helper was fixed to carry the resulting alpha; the finding disappeared. The
> tool was wrong, not the panel. Every number below comes from the corrected
> helper.

## Before

### Dark theme — reports screen

| Role | Size / weight | Colour | On | Ratio | Needs | Result |
|---|---|---|---|---|---|---|
| Navigation section heading | 10px / 400 | `--lx-ink-3` | `--lx-surface-sunken` | **3.58** | 4.5 | fail |
| Table column header | 10px / 500 | `--lx-ink-3` | `--lx-surface-sunken` | **3.58** | 4.5 | fail |
| Timezone suffix | 11px / 400 | `--lx-ink-3` | `--lx-surface-sunken` | **3.58** | 4.5 | fail |
| Header `@username` | 10px / 400 | `--lx-ink-3` | `--lx-base` | **3.74** | 4.5 | fail |
| Screen subtitle | 14px / 400 | `--lx-ink-3` | `--lx-base` | **3.74** | 4.5 | fail |
| Active nav link | 14px / 500 | `--lx-accent-text` | `--lx-accent-dim` | 6.58 | 4.5 | pass |
| Status badge (pending) | 11px / 500 | `--lx-warning-text` | `--lx-warning-dim` | 7.09 | 4.5 | pass |
| Filter chip | 11px / 500 | `--lx-ink-2` | `--lx-surface` | 7.15 | 4.5 | pass |
| Nav link, table cell | 14px / 500, 11px / 400 | `--lx-ink-2` | `--lx-surface-sunken` | 7.59 | 4.5 | pass |
| Sign out | 13px / 400 | `--lx-ink-2` | `--lx-base` | 7.92 | 4.5 | pass |
| Escalated count badge | 11px / 600 | `--lx-ink-inverse` | `--lx-accent` | 7.95 | 4.5 | pass |
| Brand, row primary text | 18px / 700, 13px | `--lx-ink` | `--lx-surface-sunken` | 14.52 | 4.5 | pass |
| Screen title | 26px / 700 | `--lx-ink` | `--lx-base` | 15.16 | 3 | pass |

**Five failing roles, all of them `--lx-ink-3`.** One token accounted for every
failure in the dark theme.

### Light theme — all eight screens

| Role | Size / weight | Colour | On | Ratio | Needs | Result |
|---|---|---|---|---|---|---|
| Escalated count badge | 11px / 600 | `--lx-ink-inverse` | `--lx-accent` | **2.08** | 4.5 | fail |
| Primary button (`apply`) | 12px / 500 | `--lx-ink-inverse` | `--lx-accent` | **2.08** | 4.5 | fail |
| Status badge (pending) | 11px / 500 | `--lx-warning-text` | `--lx-warning-dim` | **2.85** | 4.5 | fail |
| Status badge (active) | 11px / 500 | `--lx-success-text` | `--lx-success-dim` | **3.75** | 4.5 | fail |
| every `--lx-ink-3` text role | 10–14px | `--lx-ink-3` | base / sunken | **~2.8** | 4.5 | fail |

## After

Re-measured over the same eight screens in both themes.

| Screen | Dark: roles / lowest ratio | Dark: failures | Light: roles / lowest ratio | Light: failures |
|---|---|---|---|---|
| reports | 18 / 6.58 | 0 | 18 / 5.15 | 0 |
| my escalations | 15 / 6.58 | 0 | 15 / 5.15 | 0 |
| actions | 17 / 6.58 | 0 | 17 / 5.15 | 0 |
| escalated | 14 / 6.58 | 0 | 14 / 5.15 | 0 |
| accounts | 20 / 6.58 | 0 | 20 / 5.15 | 0 |
| hashtags | 14 / 6.58 | 0 | 14 / 5.15 | 0 |
| statistics | 19 / 6.58 | 0 | 19 / 5.15 | 0 |
| activity | 17 / 6.58 | 0 | 17 / 5.15 | 0 |

**Zero failing text roles, on every screen, in both themes.** The worst role in
the panel now measures 6.58:1 in dark and 5.15:1 in light, against a 4.5:1 bar.

### Role-by-role, after

| Role | Colour, after | On | Dark | Light |
|---|---|---|---|---|
| Navigation section heading | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Table column header | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Timezone suffix | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Header `@username` | `--lx-ink-2` (was ink-3) | `--lx-base` | 7.92 | 6.4 |
| Screen subtitle | `--lx-ink-2` (was ink-3) | `--lx-base` | 7.92 | 6.4 |
| Field label (detail) | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Filter group label | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Chart axis label | `--lx-ink-2` (was ink-3) | `--lx-surface-sunken` | 7.59 | 5.9 |
| Escalated count badge | `--lx-black` (was ink-inverse) | `--lx-accent` | 9.9 | 9.9 |
| Primary button label | `--lx-black` (was ink-inverse) | `--lx-accent` | 9.9 | 9.9 |
| Status badge, every tone | `--lx-ink` (was the tone's own text token) | tone's dim fill | 12–15 | 14–15 |
| Active nav link | `--lx-accent-text` (unchanged) | `--lx-accent-dim` | 6.58 | 5.15 |
| Row primary text | `--lx-ink` (unchanged) | `--lx-surface-sunken` | 14.52 | 15.1 |
| Screen title | `--lx-ink` (unchanged) | `--lx-base` | 15.16 | 16.1 |

## What changed, and why each was the correct existing token

No token was invented and no hex value was introduced. Three substitutions:

1. **`--lx-ink-3` → `--lx-ink-2` for every text role in the panel** (147 sites).
   `--lx-ink-3` is the decorative muted tone; it fails 4.5:1 on every panel
   surface in both themes. `--lx-ink-2` is the existing secondary *content* ink,
   which is what these labels are on a dense working surface.

2. **`--lx-ink-inverse` → `--lx-black` for text on the accent fill.** The accent
   is the same colour in both themes, so a label on it cannot use a token that
   flips with the theme — `--lx-ink-inverse` is near-white in light and failed at
   2.08:1. `--lx-black` is theme-invariant and clears 9:1 on the accent in both.

3. **Status badge label → `--lx-ink`, with the tone moved into a border.** In the
   light theme every semantic `-text` token on its own `-dim` fill falls short,
   because both are pale (warning 2.85, success 3.75). No darker semantic token
   exists, and inventing one was forbidden. So the hue moved: the fill and a new
   matching border carry the status colour, and the word itself is ink. The badge
   is still colour-coded and is now also readable.

## Deliberate divergence from the design export

`docs/design/Luvax.html` renders its own small uppercase labels — `TRENDING`,
`SUGGESTED`, `TODAY` — at 10px DM Mono in `--lx-ink-3` on `--lx-base`. Measured,
that pairing is about **2.8:1** in the light theme: the export itself does not
clear AA for this role.

The panel does not follow it there. The export's labels decorate a reading
surface; the panel's label a control a moderator has to act on, and illegible
small labels were one of the four things the review named. Where the export and
the 4.5:1 bar disagree, this phase takes the bar. This is recorded rather than
silent, per the instruction that a divergence from the export needs a reason.

`--lx-ink-3` remains defined and in use elsewhere in the product; nothing was
removed.

## Type scale

Measured from the rendered design export, the product's type scale is
**10, 11, 12, 13, 14, 16, 22px**. The panel's small labels sat at 10px, the
floor of that scale, and — because the panel renders outside the user-facing
shell, which applies a viewport zoom of 1.14 and up — those 10px labels rendered
*smaller in the panel than the same size renders anywhere else in the product*.
Every 10px label in the panel was moved to 11px (33 sites), the smaller end of
the scale without being its floor. No size below the scale remains.
