# Changes Applied

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Every value below was read from `docs/design/Luvax.html`, not from the audit.

The design source is minified JavaScript inside the export's bundler manifest.
Offsets given are into the decompressed main chunk `ed9a0c12-9a80-4cca-94ad-0719b3a2539b.js`.

## 1. The icon set

File: `src/components/ui/lx-icon.jsx`

### 1.1 The filled table

The design declares `var ICONS_FILLED` with exactly seven entries, in this order: `home`, `explore`, `chat`, `bell`, `profile`, `heart`, `bookmark`.
Every shape in it sets `fill` explicitly and sets `stroke: "none"` explicitly.

| Glyph | Design | Previously | Now |
|-------|--------|------------|-----|
| `home` | `path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"` filled, plus `rect x=9 y=13 width=6 height=9 rx=1` filled `var(--lx-base)`, both `stroke="none"` | A hardcoded special case with a different path, `M3 10.25 12 3l9 7.25V20...`, and a door drawn as a path rather than a rect | The design's artwork, reached through the table rather than a special case |
| `explore` | `circle cx=11 cy=11 r=7` filled `stroke="none"`, plus `path d="m21 21-4.35-4.35"` with `fill="none" stroke="currentColor" strokeWidth=2.5 strokeLinecap="round"` | Outline artwork with a fill applied to the whole SVG, so the handle became a filled sliver and the lens grew | The design's artwork; the handle stays a stroked line over a filled lens |
| `chat` | One `path` filled, `stroke="none"` | Outline artwork plus SVG fill, stroke retained | The design's artwork |
| `bell` | `path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"` filled `stroke="none"`, plus `path d="M13.73 21a2 2 0 0 1-3.46 0"` with `fill="none" stroke="currentColor" strokeWidth=2 strokeLinecap="round"` | Both paths filled, which turned the open clapper arc into a solid wedge | The design's artwork; the clapper is an open arc again |
| `profile` | `circle cx=12 cy=7 r=4` filled, plus `path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"` filled, both `stroke="none"` | Outline artwork plus SVG fill, stroke retained | The design's artwork |
| `heart` | One `path` filled, `stroke="none"` | Outline artwork plus SVG fill, stroke retained | The design's artwork |
| `bookmark` | One `path` filled, `stroke="none"` | Outline artwork plus SVG fill, stroke retained | The design's artwork |

### 1.2 The component

The design's `LxIcon` selects `(filled && ICONS_FILLED[name]) ? ICONS_FILLED[name] : ICONS[name]`, and always sets `fill: 'none'` on the SVG, because the filled shapes carry their own fill.

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Node selection | Lookup in the filled table, falling back to the outline table | `ICONS[name]` only, with a hardcoded `if (name === 'home' && filled)` branch above it | Lookup in the filled table, matching the design |
| SVG `fill` | Always `'none'` | `filled ? (color \|\| v.ink) : 'none'` | Always `'none'` |
| SVG `style.color` | `{ color: color \|\| v.ink }` | Absent | Present |

The `style.color` line is required rather than cosmetic.
The design's filled artwork paints with `currentColor`, which resolves against the element's colour, and without it the shapes inherit whatever colour happens to be in scope.

### 1.3 The outline home

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Roof | `path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"` | `path d="M3 10.25 12 3l9 7.25V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"` | The design's path |
| Door | `polyline points="9 22 9 12 15 12 15 22"` | `path d="M10 22v-6h4v6"` | The design's polyline |

The task brief described the outline door as a rectangle at a specific position and size.
It is not: the outline door is a polyline, and the rectangle belongs to the filled variant.
Both are recorded in `deferred-findings.md` as audit statements that did not survive re-reading.

### 1.4 The three missing glyphs

Added verbatim from the design's outline table.

| Glyph | Design artwork |
|-------|----------------|
| `mail` | `rect x=2 y=4 width=20 height=16 rx=2`, plus `path d="m22 7-10 5L2 7"` |
| `userMinus` | `path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"`, plus `circle cx=9 cy=7 r=4`, plus `line x1=22 y1=11 x2=16 y2=11` |
| `ban` | `circle cx=12 cy=12 r=10`, plus `line x1=4.93 y1=4.93 x2=19.07 y2=19.07` |

`mail` has no call site yet.
It exists because the design defines it and the brief asked for it.

### 1.5 The destructive menu rows

File: `src/features/luvax/components/PostCard.jsx`

| Row | Previously | Now |
|-----|-----------|-----|
| Unfollow / Follow | `icon: 'profile'` in both directions | `icon: following ? 'userMinus' : 'profile'` |
| Block | `icon: 'close'` | `icon: 'ban'` |

This mapping is a derivation, not a port.
The design defines all three glyphs but no design screen references any of them, so the design does not state which row uses which.
`userMinus` is applied only in the destructive direction because the design ships no `userPlus` counterpart, verified absent from all six extracted chunks.

## 2. The button primitive

File: `src/features/luvax/components/primitives.jsx`

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Primary text colour | `v.inkInverse` | `v.ink` | `v.inkInverse` |
| Active tag border | `1px solid transparent` | `1px solid ${v.accentDim}` | `1px solid transparent` |

The inactive tag border is `var(--lx-border)` in the design and `v.border` here, which resolve to the same value, so it is unchanged.

### 2.1 The composer's inline copy

File: `src/features/luvax/components/ComposerScreen.jsx`

The composer reimplements the primary button inline instead of using the primitive.

| Property | Previously | Now |
|----------|-----------|-----|
| Enabled text colour | `v.ink` | `v.inkInverse` |
| Disabled text colour | `v.ink3` | `v.ink3`, unchanged, and matching the design's disabled primary |

### 2.2 Left alone

The report modal's submit button already used `v.inkInverse` on `v.accent` and was not touched, as instructed.
Verified at `src/features/luvax/components/ReportModal.jsx:224`.

`textTransform: 'lowercase'` on the button primitive is retained.
The design's button carries no `textTransform` at all, but removing it changes every label at once and needs a per-surface copy decision.

## 3. The shell

File: `src/features/luvax/components/shell.jsx`

Only the desktop and mobile branches were touched.
Every value below is conditional so the tablet branch keeps exactly what it had.

### 3.1 Desktop app bar

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Backdrop blur | `blur(12px)` | `blur(10px)` | `blur(12px)` |
| Inner padding | `'0 16px'` | `'0 28px'` | `'0 16px'` |
| Inner gap | `12` | `20` | `12` |
| Logo font size | `22` | `24` | `22` |
| Logo letter spacing | `'-0.03em'` | `'-0.045em'` | `'-0.03em'` |
| Right group gap | `10` | `14` | `10` |
| Bell background | `v.surface` | `'none'` | `v.surface` |
| Bell border | `'none'` | `1px solid ${v.border}` | `'none'` |
| Bell border radius | `'50%'` | `'999px'` | `'50%'` |
| Bell size | `36 x 36` | `32 x 32` | `36 x 36` |
| Bell glyph size | `18` | `19` | `18` |
| Unread dot size | `7 x 7` | `6 x 6` | `7 x 7` |
| Unread dot inset | `top 6, right 6` | `top 5, right 5` | `top 6, right 6` |
| Avatar size | `32` | `32` | `32`, already conformant |

The design's `innerMaxWidth` is 1280 and its `sideWidth` is 300, against 1260 and 280 here.
Those are layout widths rather than the chrome values this item lists, and the desktop layout was measured conformant and placed out of scope, so they are unchanged and recorded in `deferred-findings.md`.

### 3.2 Desktop top tabs

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Container gap | `4` | `74` | `4` |
| Container max width | `560` | `596` | `560` |
| Container flex | `1` | `'0 0 auto'` | `1` |
| Button flex | `1` | `'0 0 auto'` | `1` |
| Button width | not set, capped by `maxWidth: 110` | fixed `44`, `minWidth: 44` | `maxWidth: 110`, no fixed width |
| Button vertical alignment | `justifyContent: 'center'`, `gap: 2` | `justifyContent: 'flex-start'`, `paddingTop: 16` | `justifyContent: 'center'`, `gap: 2` |
| Icon size | `22` | `23` | `22` |
| Active underline | absent | a 12 x 1.5 span pinned to the bottom | removed at desktop, retained at tablet |

The design renders no label in the tab, only the icon, which the frontend already matched.

The underline span was shared by the desktop and tablet branches, so removing it outright also removed
it from tablet, which is out of scope.
It was restored behind the tablet conditional in a follow-up commit, so desktop has no underline and
tablet keeps the one it had.

The hit target grew.
Measured in the browser at 1440px wide: 109 x 56, against a previous 44 x 56.
The audit recorded this as a drop from 109 to 44, which is the change inverted.

### 3.3 Mobile bottom nav

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Backdrop blur | `blur(12px)` | `blur(10px)` | `blur(12px)` |
| Icon size | `22` | `20` | `22` |
| Active bar | absent | a 2px span pinned to the top, inset 28% each side | removed |

Everything else in the design's bottom nav already matched: `flex: 1`, `height: 56`, `gap: 2`, `justifyContent: 'space-around'`, `position: 'fixed'`, `zIndex: 100`.

The unread badge is retained.
See `design-decisions.md` for why.

### 3.4 Right rail

| Property | Design | Previously | Now |
|----------|--------|------------|-----|
| Trending label letter spacing | `'0.1em'` | `'0.12em'` | `'0.1em'` |
| Trending label bottom margin | `12` | `14` | `12` |
| Trending row gap | `8` | `12` | `8` |
| Tag font size | `14` | `15` | `14` |
| Tag font weight | `500` | `600` | `500` |
| Rail width | `300` | `280` | `280`, unchanged, see below |
| Rail padding | `'20px 20px'` | `'20px 20px'` | already conformant |
| Rail gap | `24` | `24` | already conformant |
| Rank column font size and width | `11` and `18` | `11` and `18` | already conformant |
| Suggested block | three hardcoded users | absent | composition added, not mounted |

### 3.5 Header hide-on-scroll

File: `src/index.css`, plus the trigger in `shell.jsx`

The design's CSS, ported verbatim:

```css
header.lx-bar { transition: transform 220ms ease, opacity 220ms ease; }
header.lx-bar.lx-bar-hidden { transform: translateY(-100%); opacity: 0; }
```

The header now carries `data-lx-bar="1"` and `className="lx-bar"`, matching the design's own markup, and gains `lx-bar-hidden` from a scroll hook.

The trigger is a derivation.
The design defines these rules and the `lx-bar` hook but never adds `lx-bar-hidden` anywhere, verified across all six extracted chunks.

## 4. Video

One rule, four call sites.

| File and line | Previously | Now |
|---------------|-----------|-----|
| `ComposerScreen.jsx:275` | `controls`, unmuted | `controls muted playsInline` |
| `ExploreScreen.jsx:38` | `muted`, no controls | `muted playsInline` |
| `PostCard.jsx:270` | `controls muted` | `controls muted playsInline` |
| `PostDetailScreen.jsx:664` | `controls`, unmuted | `controls muted playsInline` |

The explore grid keeps no controls.
The rule decided in `design-decisions.md` is about mute, and adding controls to a grid thumbnail is explore screen work, which is out of scope.

## Files touched

| File | Why |
|------|-----|
| `src/components/ui/lx-icon.jsx` | The icon tables and the component |
| `src/features/luvax/components/primitives.jsx` | Button primary colour, tag active border |
| `src/features/luvax/components/shell.jsx` | App bar, top tabs, bottom nav, right rail, hide-on-scroll |
| `src/index.css` | The hide-on-scroll rules |
| `src/features/luvax/components/PostCard.jsx` | Two menu row icons, one video attribute |
| `src/features/luvax/components/ComposerScreen.jsx` | The inline primary button, one video attribute |
| `src/features/luvax/components/PostDetailScreen.jsx` | One video attribute |
| `src/features/luvax/components/ExploreScreen.jsx` | One video attribute |

The last four are screen files.
They were touched only for the shared concerns this stage owns, the primary button colour, the two menu glyphs and the video attributes.
No screen layout or copy was changed.

No file was moved, renamed or deleted.
