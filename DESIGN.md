---
spec_version: alpha
brand: "Luvax"
description: |
  Luvax is a quiet social network built on a single promise: pure social, no noise.
  The design philosophy is warm restraint — cream paper, warm ink, generous whitespace,
  and a single gold accent. Every decision biases toward calm, taste, and the deliberate
  absence of engagement mechanics. The visual voice is lowercase, plain-spoken, and
  confident in what it chooses not to do.

colors:
  primary: "#C8A97E"    # --lx-accent
  secondary: "#7A9E7A"  # --lx-success, avatar 1, brand alternate
  canvas: "#F9F7F4"     # --lx-base
  canvas-subtle: "#F0EDE8"  # --lx-surface
  ink: "#1A1816"
  muted: "#9B9088"      # --lx-ink-3
  brand-alt-rose: "#C4847A"
  error: "#C47168"      # --lx-error

typography:
  display:
    family: "Syne"
    size: "48px (lg) / 64px (xl) / 38px (md)"
    weight: "700–800"
    line_height: "1.1"
  heading:
    family: "Syne"
    size: "30px (h1) / 24px (h2) / 20px (h3)"
    weight: "600"
    line_height: "1.25"
  body:
    family: "DM Sans"
    size: "15px (default) / 17px (lg) / 13px (sm)"
    weight: "400"
    line_height: "1.5"

spacing:
  xs: "4px  (--space-1)"
  sm: "8px  (--space-2)"
  md: "16px (--space-4)"
  lg: "32px (--space-8)"
  xl: "64px (--space-16)"

shapes:
  rounded-sm: "4px  (--radius-sm)  — tags, tiny chips"
  rounded-md: "8px  (--radius-md)  — inputs, menus"
  rounded-lg: "12px (--radius-lg)  — cards, post media"
---

## 1. Overview & Design Principles

### Visual Character
Luvax reads as **warm minimalism** — analogue in feel, disciplined in execution. The palette is a cream-paper daylight system: never pure white, never pure black. A single gold-tan accent (`--lx-accent: #C8A97E`) carries all primary interactions. Two brand alternates — sage (`#7A9E7A`) and dusty rose (`#C4847A`) — are used sparingly for theming and the logo mark only.

Structure comes from **hairlines and whitespace**, not boxes or fills. No decorative gradients, no textures, no patterns.

### Light / Dark Mode
- **Light (default):** Cream base `#F9F7F4`, warm near-black ink `#1A1816`.
- **Dark:** Warm charcoal base `#1A1816`, never pure black. Surfaces step up through `#25211D` → `#2F2A25`. Applied via `html[data-theme="dark"]`; all tokens remap automatically.
- **Rule:** both themes share the same accent `#C8A97E` and border logic. Do not invent theme-specific accent overrides.

### Voice
No exclamation marks; no hype copy; no emoji anywhere.

Casing is split, and the split is deliberate rather than drift:

- **Navigation, tabs, section labels and in-shell chrome are lowercase.** This is the brand voice and it holds.
- **Sentences are sentence case.** Auth screens, support screens, form labels, validation messages, empty states and any copy that reads as a sentence take a capital first letter. An all-lowercase sentence read as a stylistic tic rather than as voice, and it made error copy harder to scan at the moment it mattered most.

Capitals otherwise only for proper nouns and the logotype asset. Nothing is Title Case.

---

## 2. Component Specifications

### Buttons
| Property | Value |
|---|---|
| Border radius | `--radius-pill` (999px) — all variants |
| Padding | `10px 20px` (default) · `8px 16px` (sm) · `12px 24px` (lg) |
| Font | `--font-body`, `--fw-medium` (500), `--text-body` (15px), `--tracking-label` |
| **Primary** background | `--lx-accent` (#C8A97E) |
| **Primary** text | `--lx-ink` (#1A1816) |
| **Primary** hover | background → `--lx-accent-dark` (#A8885A) |
| **Ghost** background | transparent · border `1px solid --lx-border` |
| **Ghost** hover | background → `--lx-surface-raised` |
| **Danger** background | `--lx-error` (#C47168) · text `--lx-ink-inverse` |
| Transition | `background var(--duration-fast) var(--ease-out)` |
| Disabled | opacity 0.4, `cursor: not-allowed` |
| Text casing | lowercase for chrome and short labels; sentence case for anything that reads as a sentence (see §1 Voice) |

### Cards / Containers
| Property | Value |
|---|---|
| Background | `--lx-surface` (#F0EDE8) |
| Border radius | `--radius-lg` (12px) |
| Shadow | `--shadow-card` = `0 2px 8px rgba(26,24,22,0.06)` |
| Inner padding | `--lx-card-pad` (16px default, 12px dense) |
| Border | none by default; dividers use `1px solid --lx-border` (#DDD7CF) |
| Media bleed | images bleed to card edge (no inner radius on media) |
| Gap between cards | `--lx-feed-gap` (12px) |

### Inputs / Forms
| Property | Value |
|---|---|
| Background | `--lx-surface-sunken` (#EAE6E0) |
| Border | `1px solid --lx-border` (#DDD7CF) |
| Border radius | `--radius-md` (8px) |
| Padding | `10px 14px` |
| Font | `--font-body`, `--fw-regular`, `--text-body` |
| Placeholder color | `--lx-ink-3` (#9B9088) |
| Focus border | `--lx-accent` (#C8A97E) · no box-shadow ring |
| Error border | `--lx-error` (#C47168) · helper text in `--lx-error-text` |
| Error background | `--lx-error-dim` (#F5E8E7) |
| Label | `--font-body`, `--fw-medium`, `--text-label` (13px), `--tracking-label` |
| Microcopy style | sentence case, human ("That doesn't look like an email") |

### Modals / Sheets
| Property | Value |
|---|---|
| Border radius | `--radius-xl` (16px) sheets · `--radius-2xl` (20px) auth modals |
| Shadow | `--shadow-xl` |
| Scrim | `--lx-scrim` = `rgba(26,24,22,0.45)` |
| Background | `--lx-base` or `--lx-surface` |

### Glass Chrome (sticky nav, bottom bar)
Apply the `.lx-glass` utility class:
```css
background: var(--lx-glass-bg);   /* rgba(249,247,244,0.88) */
backdrop-filter: blur(10px);
border: 1px solid var(--lx-glass-border);
```
Reserved for floating-over-content surfaces only — never for static cards.

### Icons
- Lucide-style, 24×24 grid, `currentColor` stroke, **1.5px default weight**.
- Use `<LxIcon name="…" />` from `src/components/ui/lx-icon.jsx`. Never hand-roll inline SVG paths. There is no design-system global on `window`; an earlier revision of this file named one.
- Active states: bump stroke to 1.8–2px; `heart` and `bookmark` switch to filled variant.
- Active nav item: gold accent color + thin underline. **Never** a filled pill highlight.

---

## 3. Layout & Grid Rules

### Page Structure
```
┌────────────────── max 1200px (--width-page) ──────────────────┐
│  300px rail  │  680px feed (--width-feed)  │  300px rail  │
└───────────────────────────────────────────────────────────────┘
```
- Feed column: `--width-feed` = 680px, centered.
- Side rails: `--width-rail` = 300px (sticky nav left, suggestions/trending right).
- Marketing / prose: `--width-reading` = 720px max measure.
- Page outer: `--width-page` = 1200px.

### Safe Padding
- Page horizontal padding: `--space-6` (24px) at ≥ 1200px; `--space-4` (16px) at tablet; `--space-3` (12px) at mobile.
- Section vertical rhythm: `--space-12` (48px) between major sections on marketing pages.
- Feed gap: `--lx-feed-gap` (12px default, 8px dense).

### Responsive Breakpoints
| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | < 600px | Single column. Side rails collapse. Bottom nav replaces sidebar. |
| Tablet | 600px – 959px | Feed + one rail (left nav only). Right rail hidden. |
| Desktop | ≥ 960px | Three-column layout: left rail + feed + right rail. |
| Wide | ≥ 1200px | Centered within `--width-page`; outer gutters grow. |

### Grid / Flex Conventions
- Use `display: flex` + `gap` for all row/column groupings of sibling elements. Never rely on inline flow spacing.
- Masonry post grid (Explore): CSS `columns` or JS masonry, `--space-3` (12px) gap.
- Story rail: horizontal flex, `overflow-x: auto`, `scrollbar-width: none`, `gap: --space-3`.

---

## 4. Do's and Don'ts

### ✓ Do

1. **Always reference design tokens.** Use `var(--lx-accent)`, `var(--font-body)`, `var(--space-4)`, etc. Never hardcode raw hex values, pixel sizes, or font strings in component styles.

2. **Use pill radius for all interactive affordances.** Buttons, avatars, chips, toggles, and search inputs always use `--radius-pill` (999px). Reserve `--radius-lg` for cards and `--radius-md` for form inputs.

3. **Follow the casing split.** Chrome and short labels are lowercase; anything that reads as a sentence is sentence case. Title Case breaks brand voice immediately and is never correct.

4. **Keep shadows warm.** All shadow values use `rgba(26,24,22,…)` (the ink hue), never `rgba(0,0,0,…)`. Always pull from the named `--shadow-*` tokens.

5. **Apply motion with restraint.** Use `--ease-out` (`cubic-bezier(0.16,1,0.3,1)`) and durations of 150–250ms. Fades and gentle translates only. No bounces, no spins, no infinite decorative loops.

6. **Use `--lx-surface-sunken` for inset fields** (inputs, wells, code blocks) and `--lx-surface` for raised surfaces (cards, chips). This maintains the tactile depth hierarchy.

---

### ✗ Don't

1. **Don't use decorative gradients.** The only acceptable gradient is a subtle warm tonal fill inside image *placeholders*. No gradient backgrounds, hero fills, button fills, or card fills — ever.

2. **Don't use emoji.** Not in copy, not in UI, not in notifications. Use the `Icon` component exclusively for visual communication.

3. **Don't use pure black (`#000000`) or pure white (`#FFFFFF`).** All surfaces and ink values are warm-toned. The darkest ink is `--lx-ink` (#1A1816); the lightest base is `--lx-base` (#F9F7F4).

4. **Don't add a filled-pill active state to nav items.** Active navigation uses the gold accent color + a thin hairline underline. The filled-pill pattern is reserved for buttons only.

5. **Don't use a color not in the palette for borders.** All hairlines must use `--lx-border` (#DDD7CF), `--lx-border-strong` (#C4BCB2), or `--lx-border-subtle` (#ECEAE5). Never invent new border colors.

6. **Don't import external icon libraries.** All icons come from `<LxIcon name="…" />`. If a glyph is missing, add it to the `ICONS` map in `src/components/ui/lx-icon.jsx` in the same 24×24 / 1.5-stroke Lucide style rather than importing a second icon set. "Lucide style" is a drawing convention here, not a dependency: the 38 declared packages contain no icon library.

7. **Don't use Title Case or ALL CAPS in UI text.** The mono eyebrow exception (`DM Mono`, `text-transform: uppercase`, `--tracking-caps`) exists only for metadata labels, timestamps, and section dividers — applied via the `.t-mono-sm` utility class, never hand-rolled.

---

## 5. Token Quick Reference

### Color tokens (CSS custom properties)
```
--lx-base             #F9F7F4   page background
--lx-surface          #F0EDE8   cards, chips
--lx-surface-raised   #E8E3DC   hover fills
--lx-surface-sunken   #EAE6E0   inputs, wells
--lx-ink              #1A1816   primary text
--lx-ink-2            #574F47   secondary text
--lx-ink-3            #9B9088   placeholder / tertiary
--lx-ink-inverse      #F9F7F4   text on accent/dark
--lx-border           #DDD7CF   hairlines
--lx-border-strong    #C4BCB2   emphasized borders
--lx-accent           #C8A97E   gold — primary brand action
--lx-accent-dark      #A8885A   hover / press state
--lx-accent-dim       #F2EAD9   tint backgrounds
--lx-accent-text      #7A5C34   accent text on paper
--lx-sage             #7A9E7A   brand green alternate
--lx-rose             #C4847A   brand rose alternate
--lx-error            #C47168   error state
--lx-success          #7A9E7A   success state
--lx-warning          #C4A85A   warning state
```

### Typography tokens
```
--font-display   'Syne'              display / headlines
--font-body      'DM Sans'           body / UI text
--font-mono      'DM Mono'           metadata / labels
--font-serif     'Instrument Serif'  editorial pull-quotes

--text-display-xl  64px    --text-h1  30px
--text-display-lg  48px    --text-h2  24px
--text-display-md  38px    --text-h3  20px
--text-body-lg     17px    --text-body 15px   --text-body-sm 13px

--tracking-display  -0.03em    --tracking-body   -0.01em
--tracking-tight    -0.02em    --tracking-caps    0.1em
```

### Spacing tokens
```
--space-1   4px    --space-6   24px
--space-2   8px    --space-8   32px
--space-3   12px   --space-10  40px
--space-4   16px   --space-12  48px
--space-5   20px   --space-16  64px
```

### Effects tokens
```
--radius-sm    4px     --radius-xl    16px
--radius-md    8px     --radius-2xl   20px
--radius-lg    12px    --radius-pill  999px

--shadow-card  0 2px 8px rgba(26,24,22,0.06)
--shadow-md    0 2px 8px rgba(26,24,22,0.09)
--shadow-xl    0 20px 60px rgba(26,24,22,0.25), 0 4px 16px rgba(26,24,22,0.12)

--ease-out         cubic-bezier(0.16, 1, 0.3, 1)
--duration-fast    150ms
--duration-normal  200ms
--duration-slow    250ms
```
