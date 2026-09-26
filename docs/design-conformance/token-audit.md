# Token Audit

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

An earlier audit claimed the token layer was fully conformant.
That claim was not carried over.
The comparison below was redone from both sources and then checked against both running applications.

The claim survives for the static layer, with one important correction about what the static layer actually controls.

## Where the tokens live

Design: a stylesheet injected by the first line of the main chunk.
It declares 31 custom properties on `:root` and overrides 22 of them on `html[data-theme="dark"]`.

Frontend: `src/index.css`.
It declares 80 custom properties on `:root` and overrides 52 on `html[data-theme="dark"]`.

Both sides also expose a JavaScript alias object named `v` that maps camel-case keys to `var(--lx-*)` strings.
Design: `main.js`, 24 keys.
Frontend: `src/config/tokens.js`, 53 keys.
The alias object is a convenience, not the token layer; the CSS is authoritative on both sides.

## Result of the static comparison

**[source]** Normalised comparison of every declaration in both blocks.

| Direction | Light | Dark |
|-----------|-------|------|
| Design tokens missing from the frontend | none | none |
| Design tokens whose value differs | none | none |
| Frontend tokens the design does not define | 49 | 30 |

Every one of the 31 design tokens is present in the frontend at a byte-identical normalised value, in both themes.
The static token layer conforms.

## Tokens the frontend adds

These are additions, not divergences.
The design hardcodes the same values inline where it needs them, so the frontend has tokenised things the design left as literals.

| Group | Tokens | What the design does instead |
|-------|--------|------------------------------|
| Opaque white and alpha whites | `--lx-white`, `--lx-white-75` through `--lx-white-04` (13) | Writes `#fff` and `rgba(255,255,255,...)` inline |
| Black and alpha blacks | `--lx-black`, `--lx-black-78` through `--lx-black-35` (6) | Writes `rgba(0,0,0,...)` inline |
| Ink-tinted shadows | `--lx-ink-shadow-18`, `-25`, `-12` | Writes `rgba(26,24,22,...)` inline |
| Avatar hues | `--lx-avatar-0` through `--lx-avatar-6` | Holds the identical seven hex values in an `AVATAR_COLORS` array |
| Story surface | `--lx-story-surface` | Inline literal |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | No equivalent; every design shadow is written inline |
| Spacing scale | `--space-1` through `--space-16` (8) | No equivalent; every design spacing value is a numeric literal |
| Radius scale | `--radius-sm` through `--radius-pill` (5) | No equivalent; every design radius is a numeric literal |
| Motion | `--ease-out`, `--duration-fast`, `--duration-normal` | No equivalent; every design transition is written inline |

The seven avatar hues were checked value by value against the design's `AVATAR_COLORS` array and match exactly: `#C8A97E`, `#7A9E7A`, `#9B7EA8`, `#7A9EB8`, `#C47168`, `#B89468`, `#5E8260`.

The spacing, radius, elevation, and motion scales are the frontend's own invention.
Nothing in the design constrains them, and nothing in the frontend consistently uses them either: almost every component writes numeric literals in inline styles exactly as the design does.
They are declared and largely unused.

## The runtime override, and a correction

**[source]** Reading the design alone suggests three accent tokens diverge.
The design's `App` effect writes inline custom properties onto the root element on every render:

```
--lx-accent      = tweaks.accent
--lx-accent-dim  = color-mix(in srgb, {accent} 28%, var(--lx-base))   (22% in dark)
--lx-accent-dark = color-mix(in srgb, {accent} 78%, #000)
--lx-accent-text = color-mix(in srgb, {accent} 60%, #000)             (#fff in dark)
```

These inline declarations beat the `:root` block, so the three derived accent tokens as rendered are **not** the values written in either stylesheet.

| Token | Value in both stylesheets | Value actually rendered |
|-------|---------------------------|-------------------------|
| `--lx-accent-dim` | `#F2EAD9` | `#EBE1D3` |
| `--lx-accent-dark` | `#A8885A` | `#9C8462` |
| `--lx-accent-text` | `#7A5C34` | `#78654C` |

**[observed]** The frontend was then measured and reverses the apparent divergence.
`src/features/luvax/LuvaxApp.jsx` lines 89 to 98 reproduce the same four `setProperty` calls with the same percentages, including the dark-mode variants.
Both applications were probed at the root element at a 1440 x 900 desktop viewport and returned identical resolved colours:

```
--lx-accent-dim   color(srgb 0.922667 0.88298  0.827294)
--lx-accent-dark  color(srgb 0.611765 0.516941 0.385412)
--lx-accent-text  color(srgb 0.470588 0.397647 0.296471)
```

There is no accent divergence between the design and the frontend inside the authenticated shell.

What remains is a real and narrower finding.
`LuvaxApp` mounts only under `/app`.
On every route outside the authenticated shell, which is the landing page, all three auth pages, email verification, password reset, and the OAuth callback, no override runs and the static `:root` values apply.
Those pages therefore paint `--lx-accent-dim`, `--lx-accent-dark`, and `--lx-accent-text` at values the design never renders anywhere.

Auth and landing are frozen, so this is recorded rather than planned.
It matters for the implementation phase in one way only: if the static values are ever "corrected" to match the runtime derivation, the authenticated shell will not change at all and only the frozen pages will shift.

## Theme mechanism

**[source]** Both sides switch on `html[data-theme="dark"]`, not on `prefers-color-scheme` in CSS.

The design reads the OS preference once into its tweak defaults, then syncs on change unless `localStorage.lxDarkManual` is set.
The frontend does the same, and additionally applies `data-theme` synchronously in `src/main.jsx` before React mounts so the first paint is never wrong.
The frontend also sets `color-scheme: light` on `html` and `color-scheme: dark` in the dark block; the design sets neither.

This matches the settled position of light by default following the system preference.
The frontend adds a manual override through the settings screen, which the design also has through its tweaks panel.

## Density

**[source]** The design sets `data-density` on the root element and never defines a single CSS rule keyed off it.
The attribute is inert in the design; density is implemented entirely through JavaScript branching inside `PostCard` and `FeedScreen`.

The frontend declares `[data-density="cozy"]` and `[data-density="dense"]` blocks defining `--lx-row-pad`, `--lx-card-pad`, and `--lx-feed-gap`.
None of those three variables is referenced anywhere in `src/`.
The frontend also branches in JavaScript, exactly as the design does.

Three declared and unused variables on the frontend side, matching three attribute values that do nothing on the design side.
Harmless, and worth deleting rather than wiring up.

## Redundant dark declarations

**[source]** The frontend's dark block re-declares 30 tokens at values identical to the light block: every white, every black, every shadow, every avatar hue, and `--lx-story-surface`.
Re-declaring a value as itself has no effect.
This is noise, not a defect, and no rendered colour depends on it.

## Hardcoded values where a token exists

**[source]** Every colour literal in `src/` outside `index.css` and `tokens.js`.

| Location | Literal | Token that already covers it |
|----------|---------|------------------------------|
| `PostCard.jsx:235` | `rgba(26,24,22,0.06)` | none exactly; `--lx-ink-shadow-12` is the nearest and differs in alpha |
| `PostDetailScreen.jsx:613` | `rgba(26,24,22,0.34)` | none; ink-tinted but off-scale |
| `PostDetailScreen.jsx:713` | `rgba(0,0,0,0.14)` | none; `--lx-black-35` is the nearest |
| `PostDetailScreen.jsx:749` | `rgba(10, 8, 6, 0.18)` | none; not even the ink hue |
| `ProfileScreen.jsx:241` | `#d8d1c4` | none; an unexplained warm grey used in a `color-mix` for empty grid tiles |
| `shell.jsx:62` | `rgba(200, 169, 126, 0.78)` | `--lx-accent` at 78 percent. This is the accent hardcoded, so it will not follow an accent change, unlike every other accent usage |
| `MessagesScreen.jsx:405,406,424` | `#2c2621`, `#c4b9a8`, `#fff5f2` | none; three colours outside the palette entirely |
| `MessagesScreen.jsx:129`, `mockThreads.js` (6 sites) | `rgba(200,169,126,...)`, `rgba(122,158,122,...)`, `rgba(196,132,122,...)`, `rgba(168,136,90,...)` | accent, success, and error hardcoded at various alphas |
| `LuvaxApp.jsx:93,96,97` | `#000`, `#fff` | Correct as written. These are the `color-mix` endpoints and match the design line for line |
| `constants/data.js` (20 sites) | assorted | Mock data mirroring the design's mock arrays. Not styling |
| `AuthPage.jsx:75-87` | `#EA4335`, `#4285F4`, `#FBBC05`, `#34A853` | Correct as written. Google brand colours in the sign-in button glyph |

The one worth acting on is `shell.jsx:62`, the active-tab underline.
It hardcodes the default accent, so it silently stops matching if the accent changes, and the design has no underline there at all.
The messages colours are the largest cluster but sit in an out-of-scope module.

## Summary

| Question | Answer |
|----------|--------|
| Design tokens missing from the frontend | None |
| Design token values that differ | None in the static layer, none at runtime in the authenticated shell |
| Tokens the frontend adds | 49 light, 30 dark, all additive |
| Static accent values that are never rendered in the shell | 3, overridden at runtime on both sides identically |
| Frontend token scales declared and unused | spacing (8), radius (5), elevation (3), motion (3), density (3) |
| Hardcoded colours where a token would do | 1 material case, plus 10 in out-of-scope messages |

The token layer is conformant.
The earlier claim holds, and now has evidence behind it.
