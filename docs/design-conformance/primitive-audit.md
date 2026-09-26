# Primitive Audit

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Every primitive in the design export, its prop surface, its variants, its states, and what the frontend has instead.

All findings are **[source]** unless marked otherwise.

## Roster

The design defines 20 primitives across the three chunks.

| Design primitive | Frontend equivalent | Location |
|------------------|--------------------|-----------|
| `LxIcon` | `LxIcon` | `src/components/ui/lx-icon.jsx` |
| `LxAvatar` | `LxAvatar` | `src/components/ui/lx-avatar.jsx` |
| `LxTag` | `LxTag` | `src/features/luvax/components/primitives.jsx` |
| `LxBtn` | `LxBtn` | same |
| `LxDivider` | `LxDivider` | same |
| `LxBottomSheet` | `LxBottomSheet` | same |
| `LxTopBar` | none | Dead in the design too; never rendered |
| `LxTopTabs` | `LxTopTabs` | `src/features/luvax/components/shell.jsx` |
| `LxAppBar` | `LxAppBar` | same |
| `LxBottomNav` | `LxBottomNav` | same |
| `LxSidebar` | none | Dead in the design too; never rendered |
| `LxRightRail` | `LxRightRail` | same |
| `LxShell` | `LxShell` | same |
| `LxMenu` | `LxDropdownMenu` | `src/components/ui/lx-dropdown-menu.jsx` |
| `ConfirmModal` | none | Replaced ad hoc by `LxModal` |
| `ReportModal` | `ReportModal` | `src/features/luvax/components/ReportModal.jsx` |
| `CommentModal` | none | Replaced by the post detail overlay route |
| `LxHeaderSearch` | `LxHeaderSearch` | `src/features/search/components/LxHeaderSearch.jsx` |
| `toast` / `LxToast` | none | No toast mechanism exists in the frontend |
| `SettingsRow`, `Toggle`, `SectionHeader` | same names | `src/features/luvax/components/SettingsScreen.jsx` |

The frontend adds one primitive the design does not have: `LxModal`.

## LxIcon

### Prop surface

Identical on both sides.

| Prop | Default | Design | Frontend |
|------|---------|--------|----------|
| `name` | required | yes | yes |
| `size` | `20` | yes | yes |
| `color` | `undefined` | yes | yes |
| `filled` | `false` | yes | yes |
| `stroke` | `1.5` | yes | yes |

### SVG element differences

| Attribute | Design | Frontend |
|-----------|--------|----------|
| `viewBox` | `0 0 24 24` | `0 0 24 24` |
| `fill` on the svg | always `none`; fill is set per path inside the filled artwork | `filled ? (color \|\| v.ink) : 'none'` |
| `stroke` on the svg | `color \|\| v.ink` | `color \|\| v.ink` |
| `style.color` on the svg | set to `color \|\| v.ink` | **not set** |
| `strokeWidth` | `stroke` | `stroke` |
| `strokeLinecap` / `strokeLinejoin` | `round` / `round` | `round` / `round`, except the bespoke filled `home` branch which sets neither |

The missing `style.color` matters because the design's filled artwork uses `fill="currentColor"`.
The frontend does not use `currentColor` in any glyph except `alert`, so the omission has no effect today, but it blocks porting the design's filled artwork verbatim.

### Glyph inventory

Design: 27 outline glyphs.

`home`, `explore`, `plus`, `profile`, `bell`, `back`, `close`, `heart`, `reply`, `share`, `image`, `video`, `type`, `hash`, `bookmark`, `settings`, `chevronRight`, `send`, `more`, `check`, `eye`, `mail`, `flag`, `link`, `userMinus`, `ban`, `chat`

Frontend: 29 outline glyphs.

`home`, `explore`, `plus`, `message`, `chat`, `profile`, `bell`, `back`, `edit`, `close`, `heart`, `reply`, `share`, `link`, `image`, `video`, `type`, `hash`, `bookmark`, `settings`, `chevronRight`, `send`, `more`, `check`, `eye`, `flag`, `trash`, `alert`, `chevronLeft`

| Direction | Glyphs |
|-----------|--------|
| In the design, missing from the frontend | `mail`, `userMinus`, `ban` |
| In the frontend, not in the design | `message`, `edit`, `trash`, `alert`, `chevronLeft` |

`message` is a byte-identical duplicate of `chat` under a second name.

The three missing glyphs are not cosmetic.
The design's `LxMenu` uses `userMinus` for unfollow and `ban` for block.
The frontend's post menu substitutes `profile` for unfollow and `close` for block, so two destructive menu rows carry semantically wrong icons.

### Outline artwork differences

Only one outline glyph differs between the two sides.

| Glyph | Design | Frontend |
|-------|--------|----------|
| `home` | `path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"` plus `polyline points="9 22 9 12 15 12 15 22"` | `path d="M3 10.25 12 3l9 7.25V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"` plus `path d="M10 22v-6h4v6"` |

Different roof pitch, different body height, different door width and position.
Every other shared outline glyph matches path data exactly, including the `settings` gear, which is a long path and matches character for character.

### Filled variants

The design defines a separate `ICONS_FILLED` table with 7 entries: `home`, `explore`, `chat`, `bell`, `profile`, `heart`, `bookmark`.

Three of them are genuinely different artwork rather than the outline filled in.

| Glyph | What the design's filled variant actually does |
|-------|-----------------------------------------------|
| `home` | Fills the body, then punches a door as `rect x=9 y=13 w=6 h=9 rx=1` painted in `var(--lx-base)` |
| `explore` | Fills the lens circle with `stroke="none"`, then redraws the handle stroked at `strokeWidth 2.5` |
| `bell` | Fills the bell body with `stroke="none"`, then redraws the clapper stroked at `strokeWidth 2` |
| `profile` | Fills both the head circle and the shoulders path, both with `stroke="none"` |
| `heart` | Same path as the outline, filled, `stroke="none"` |
| `bookmark` | Same path as the outline, filled, `stroke="none"` |
| `chat` | Same path as the outline, filled, `stroke="none"` |

The frontend has no `ICONS_FILLED` table.
It has one hardcoded branch for `home` with bespoke artwork, and for every other name it sets `fill` on the `<svg>` element while leaving the stroke on.

The earlier finding is **confirmed and is more consequential than "filling the outline path"**, because the design explicitly turns the stroke off on every filled glyph and the frontend never does.

| Glyph | Rendered difference in the frontend |
|-------|-------------------------------------|
| `bell` filled | The clapper path `M13.73 21a2 2 0 0 1-3.46 0` is an open arc. Filling it closes it into a solid lens under the bell, which the design does not draw. Additionally the clapper keeps a 1.5 stroke where the design uses 2. |
| `explore` filled | The handle keeps a 1.5 stroke where the design specifies 2.5, so the active magnifier reads thinner than the reference |
| `profile`, `heart`, `bookmark`, `chat` filled | Fill plus a retained 1.5 stroke makes each shape approximately 1.5px larger in every direction than the design's fill-only shape |
| `home` filled | Bespoke frontend artwork. The door is `M10 22v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V22`, a 4-wide 6.5-tall rounded shape starting at y=15.5. The design's door is a 6-wide 9-tall rect starting at y=13. Different size, different position, different corner treatment |

Every one of these glyphs appears in the primary navigation in its filled state, so this is visible on every screen at every viewport.

## LxAvatar

| Prop | Design | Frontend |
|------|--------|----------|
| `size` | `36` | `36` |
| `idx` | `0` | `0` |
| `ring` | `false` | `false` |
| `hasStory` | `false` | `false` |
| `viewed` | `false` | `false` |
| `src` | **absent** | added, `null` |

`src` is the deliberate backend-contract addition: the design has no real avatars and paints a flat colour from `AVATAR_COLORS[idx % 7]`.

States and rendering are otherwise identical.
Story ring: outer `size + 6` circle, `padding: 2`, background `v.accent` or `v.border` when viewed, inner circle with a `2px solid v.base` border.
Ring: `outline: 2px solid v.accent` with `outlineOffset: 2`.
Both match.

One divergence: when `src` is set the frontend replaces the colour background entirely, so a user with an avatar loses the `idx` hue as a loading backdrop.

## LxTag

| Prop | Design | Frontend |
|------|--------|----------|
| `children`, `active`, `onClick`, `size` | same | same |
| Sizes | `sm` 11px `3px 9px`, `md` 12px `5px 12px` | identical |

| Property | Design | Frontend |
|----------|--------|----------|
| Border when `active` | `1px solid transparent` | `1px solid var(--lx-accent-dim)` |
| Border when inactive | `1px solid var(--lx-border)` | `1px solid var(--lx-border)` |
| Transition | none | `background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out` |

The active border differs.
The design lets the parent background show through a 1px ring; the frontend paints it in the same colour as the fill.
Against `v.base` the design's active tag reads 2px narrower in effective fill.

## LxBtn

| Prop | Design | Frontend |
|------|--------|----------|
| `children`, `variant`, `size`, `onClick`, `disabled`, `style` | same | same |
| Sizes | `sm` 12px `5px 14px`, `md` 14px `9px 20px`, `lg` 16px `12px 28px` | identical |

| Variant | Design | Frontend |
|---------|--------|----------|
| `primary` | background `v.accent`, colour **`v.inkInverse`**, no border | background `v.accent`, colour **`v.ink`**, no border |
| `secondary` | `v.surface`, `v.ink`, `1px solid v.border` | identical |
| `ghost` | transparent, `v.ink`, `1px solid v.border` | identical |
| `danger` | transparent, `v.error`, `1px solid v.error` | identical |
| `primary` disabled | `v.surfaceRaised`, `v.ink3`, no border | identical |

Two differences, both material.

**Primary button text colour.** The design uses `--lx-ink-inverse`, which is `#F9F7F4` in light mode, so primary buttons are near-white text on the accent. The frontend uses `--lx-ink`, `#1A1816`, so they are near-black text on the accent. This affects every primary button in the application: follow, accept, continue, submit report, save changes.

**Forced lowercase.** The frontend adds `textTransform: 'lowercase'`, which the design does not have. This is why design labels written in Title Case render lowercase wherever they pass through `LxBtn`, and it is the mechanism behind the case inconsistency described in `known-divergences.md`.

Both sides share `fontWeight: 500`, `borderRadius: 999`, `letterSpacing: -0.01em`, and `transition: all 150ms ease-out`.

## LxDivider

`mx = 0`, height 1, `background: v.border`, `margin: 0 {mx}px`.
Identical on both sides.

## LxBottomSheet

| Prop | Design | Frontend |
|------|--------|----------|
| `open`, `onClose`, `children`, `height` | same, `height` defaults to `'70vh'` | identical |

Both lock `document.body.style.overflow` while open, both animate `transform: translateY` over `250ms cubic-bezier(0.16, 1, 0.3, 1)`, both cap at `maxWidth: 640`, both draw a 36 x 4 grabber at radius 2.
The frontend uses `boxShadow: 0 -20px 60px var(--lx-ink-shadow-18)`; the design's value was not compared line by line.
No behavioural difference found.

## LxMenu against LxDropdownMenu

These are different components solving the same problem, so the comparison is behavioural rather than prop by prop.

| Aspect | Design `LxMenu` | Frontend `LxDropdownMenu` |
|--------|-----------------|---------------------------|
| Shape | Owns its trigger button, its items, and its confirm modal | Pure popover; the caller supplies the trigger ref and the items array |
| Props | `target`, `comment`, `navigate`, `style` | `anchorRef`, `open`, `onClose`, `items`, `width`, `align`, `zIndex` |
| Width | `216` fixed | `196` default; `248` from the post card, `214` from the profile |
| Container | inline styles, `border 1px solid v.border`, `borderRadius 12`, `padding 6px 0`, `boxShadow 0 12px 40px rgba(26,24,22,0.22)` | CSS class `.lx-popover-menu`, `borderRadius 14`, `padding 7`, `backdrop-filter blur(16px)`, `box-shadow 0 14px 30px rgba(26,24,22,0.16), 0 4px 12px rgba(26,24,22,0.09)` |
| Item | `padding 9px 14px`, `fontSize 13.5`, `gap 11` | `.lx-popover-item`, `min-height 44px`, `padding 0 12px`, `fontSize 13`, `gap 11`, `borderRadius 10` |
| Item hover | none | `background: var(--lx-surface)` |
| Danger item | colour `v.errorText` | colour `var(--lx-error)`, hover `color-mix(in srgb, var(--lx-error) 10%, transparent)` |
| Divider | 1px `v.borderSubtle`, `margin 4px 0` | `.has-separator` pseudo-element, `color-mix(in srgb, var(--lx-border-strong) 78%, transparent)`, inset 12px each side |
| Entry animation | none | `lx-popover-in`, 200ms, translateY 6px plus scale 0.96 |
| Placement | flips above when space below is short, clamps to viewport | same logic, different gap constants |
| Escape closes | no | **yes** |
| Disabled item | `disabled` plus `opacity 0.55`, colour `v.ink3` | `disabled` attribute, plus a separate `readOnly` row type rendered as a `div` |

The frontend menu is a more considered component than the design's.
Its radius, padding, blur, shadow, hover, and animation are all inventions.
They are internally consistent and better than the reference, but they are not the reference, and "pixel-perfect for everything the design defines" makes them divergences.

The `readOnly` row type has no design equivalent and exists because a report cannot be reversed. See `derived-treatments.md`.

## ConfirmModal

Defined by the design, absent from the frontend.

| Property | Design |
|----------|--------|
| Width | `340` |
| Background | `v.base`, `borderRadius 16`, `boxShadow 0 20px 60px rgba(26,24,22,0.26)` |
| Padding | `28px 24px 22px`, column, `gap 16` |
| Title | `v.fontDisplay`, 18, weight 700, `letterSpacing -0.02em`, `marginBottom 8` |
| Message | `v.fontBody`, 14, `v.ink3`, `lineHeight 1.55` |
| Buttons | two, `flex: 1` each, `gap 10`, `padding 11px 0`, `borderRadius 999` |
| Cancel | `v.surface`, `v.ink2`, weight 500, label `cancel` |
| Confirm | `v.error`, `#fff`, weight 600, label from config or `confirm` |
| Confirm while delayed | `v.surfaceRaised`, `v.ink3`, `opacity 0.5`, `cursor default` |
| **Delay** | **500 ms after open before confirm becomes usable**, transitioned over 0.25s |
| Scrim | `v.scrim`, click closes |

The 500 ms arming delay is a deliberate anti-misclick affordance and is the most substantive single behaviour the frontend is missing.

The frontend's substitute is `LxModal`: `maxWidth 320`, `borderRadius 12`, title in `v.fontDisplay` at 16 weight 600, body 14 in `v.ink2`, actions right-aligned in a `v.surfaceRaised` footer strip.
It arms immediately, has no scrim animation, and does not close on Escape.
Each destructive flow configures it separately, so delete-post and block-user do not look or behave alike.

## CommentModal

Defined by the design, replaced on the frontend by the post detail overlay route.
This is a recorded decision rather than an oversight; see `known-divergences.md`.

The design modal's own shape, for whoever implements the overlay:

| Viewport and content | Geometry |
|----------------------|----------|
| Desktop with image media | Two pane, `min(940px, 94vw)` x `min(680px, 88vh)`, radius 14, media pane `flex 1.1`, comment pane `width 400, maxWidth 46%` with a left border |
| Desktop or tablet without media | Single column, `min(540px, 96vw)` x `min(720px, 90vh)`, radius 14 |
| Mobile | Single column, `min(540px, 96vw)` x `92vh`, radius `16px 16px 0 0`, anchored to the bottom |
| Shadow | `0 24px 70px rgba(0,0,0,0.32)` |
| Entry | `lxModalUp` 280ms `cubic-bezier(.22,1,.36,1)` on mobile, `lxModalIn` 220ms scale 0.93 elsewhere |

## LxHeaderSearch

| Property | Design | Frontend |
|----------|--------|----------|
| Element | `form`, submits to explore with the query | present, not compared property by property |
| Height | `36` | not measured |
| Width | `200` | not measured |
| Background | `v.surface`, `borderRadius 999`, `padding 0 12px` | not measured |
| Icon | `explore` at 15, `v.ink3` | not measured |
| Placeholder | `search` | not measured |

**[observed]** The design's search box measured 200 x 36 at x=977 in a 1440 viewport.
The frontend's was not measured.
This is a gap; determining it needs one render measurement of the frontend header at the same viewport.

## toast

The design has a global toast: appended to `#lx-toast-host` fixed at `bottom: 24px`, `background var(--lx-ink)`, `color var(--lx-ink-inverse)`, 13px weight 500, `padding 10px 18px`, `borderRadius 999`, `boxShadow 0 6px 24px rgba(0,0,0,.22)`, fading in over 0.2s and out after 1700 ms.

It fires on: link copied, sharing, unfollowed, blocked, comment posted.

The frontend has no toast mechanism at all.
Those five confirmations are silent.

## Settings primitives

| Primitive | Design | Frontend | Difference |
|-----------|--------|----------|------------|
| `SettingsRow` | `label`, `sub`, `control`, `onClick`; `padding 14px 16px`, `gap 12`, `borderBottom 1px v.borderSubtle`; label 14 `v.ink`; sub 12 `v.ink3` `marginTop 2` | identical | none found |
| `SectionHeader` | `children` only; plain div, mono 10, `v.ink3`, `letterSpacing 0.1em`, uppercase, `padding 20px 16px 8px` | adds a `note` prop; wraps in flex with `gap 8` and `alignItems baseline`; label span keeps the same type | `note` is an addition used for the "coming soon" labels |
| `Toggle` | `on`, `onChange`; 38 x 22, radius 999, `v.accent` or `v.surfaceRaised`; knob 18 x 18 at `left 2 / 18`, `background #fff`, `boxShadow 0 1px 3px rgba(0,0,0,0.18)` | adds `disabled`; knob background `var(--lx-white)`, shadow `0 1px 3px var(--lx-ink-shadow-18)` | Knob shadow colour differs: design `rgba(0,0,0,0.18)`, frontend `rgba(26,24,22,0.18)`. Disabled state is an addition |

Settings is the closest match of any surface in the application.

## LxModal

Frontend only, no design equivalent.
Props: `open`, `onClose`, `title`, `children`, `actions`.
Documented above under `ConfirmModal` as the substitute.
