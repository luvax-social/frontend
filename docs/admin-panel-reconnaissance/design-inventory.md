# Design Inventory

> Record of work done on 2026-08-21. Not maintained; it is correct as of that date and is not updated as the code moves.

Work Item 6, sections 6.5 and 6.6.
All from the code on branch `chore/admin/panel-reconnaissance`.

## 6.5 Primitives

The panel is built from these.
Two button systems exist; use `LxBtn`, not the shadcn `Button`.

| Primitive | File | Props | Variants / notes |
|---|---|---|---|
| `LxBtn` | `src/features/luvax/components/primitives.jsx` | `children, variant='primary', size='md', onClick, disabled=false, style={}` | variant: `primary` (accent fill), `secondary` (surface + border), `ghost` (transparent + border), `danger` (transparent, error text + border); size: `sm`, `md`, `lg`; pill radius, `textTransform: lowercase` |
| `LxTag` | same file | `children, active=false, onClick, size='md'` | pill chip; `active` toggles fill; the raw material for filter chips and status badges |
| `LxDivider` | same file | `mx=0` | 1px border-colored rule |
| `LxModal` | same file | `open, onClose, title, children, actions` | centered modal; `actions` is the footer button row; escape-to-close |
| `LxBottomSheet` | same file | `open, onClose, children, height='70vh'` | slide-up sheet; escape-to-close |
| `ConfirmModal` | `src/components/common/ConfirmModal.jsx` | `config = { title, message (node), onConfirm, confirmLabel, confirmDisabled }, onClose` | destructive-confirm dialog; see arming delay below; destructive button uses `v.error`; labels `cancel` / `confirm` lowercase |
| `LxAvatar` | `src/components/ui/lx-avatar.jsx` | `size=36, ...` | exports `AVATAR_COLORS`; hue chosen from the 7 avatar tokens |
| `LxDropdownMenu` | `src/components/ui/lx-dropdown-menu.jsx` | `items` (each `{ label, icon, onClick, danger, separator }`), positioned relative to a trigger | reads `LxIcon`; repositions on resize; `.lx-popover-item.is-danger` styling |
| `LxToggle` | `src/components/ui/lx-toggle.jsx` | `on, onChange, disabled=false` | switch |
| `toast` / `ToastHost` | `src/features/luvax/components/Toast.jsx` | `toast(message)` imperative; `<ToastHost />` mounted once | auto-dismiss via timeout; `lx-toast-in` / `lx-toast-out` animations |
| shadcn `Button` | `src/components/ui/button.jsx` | cva | variant: `default, destructive, outline, secondary, ghost, link`; size: `default, sm, lg, icon`; LEGACY, not used by luvax screens; do not adopt for the panel |

The confirmation modal's arming delay: `ConfirmModal.jsx`, constant `ARMING_DELAY_MS = 500`.
The confirm button is inert for 500 ms after the dialog appears (`disabled={delayed || config.confirmDisabled}`), so a second click aimed at the control that opened it cannot land on the destructive action.
A reopen counter (`openCount`) prevents an earlier timer from arming a re-opened dialog early.
There is no free-text reason input on `ConfirmModal`; `message` accepts a node, but the panel's 2000-character reason field would have to be added.

### Icon component

`src/components/ui/lx-icon.jsx`.
An icon is selected by name: `<LxIcon name="flag" size={16} color={v.ink3} />`.
Icons are inline SVG paths in a single `ICONS` map; there is no external icon library.

Icon names currently available (outline set): `home, explore, plus, message, chat, profile, bell, back, edit, close, heart, reply, share, link, image, video, type, hash, settings, send, more, eye, lock, flag, trash, alert, mail, userMinus, ban, pin, bellOff`.
A small set of filled variants also exists (`home, explore, chat, bell, profile, heart, bookmark, pin`).

Moderation-relevant icons already present: `flag, ban, trash, alert, userMinus, lock, eye, hash`.
Not present, and likely needed by the panel: a shield, a chart or statistics glyph, a filter glyph, a calendar or date-range glyph, and a check or success glyph.
Adding an icon is one entry in the `ICONS` map.

## 6.6 Design tokens

Defined in `src/index.css` as CSS custom properties, exposed to JS through the `v` shorthand in `src/config/tokens.js`.
Light values are on bare `:root`; dark values are on `html[data-theme="dark"]` (an explicit attribute stamped before mount by `applyTheme()` in `main.jsx`, from `localStorage.lxDarkManual` or `prefers-color-scheme`).

### Colour tokens

| Token | Light | Dark |
|---|---|---|
| `--lx-base` | `#F9F7F4` | `#1A1816` |
| `--lx-surface` | `#F0EDE8` | `#25211D` |
| `--lx-surface-raised` | `#E8E3DC` | `#2F2A25` |
| `--lx-surface-sunken` | `#EAE6E0` | `#1F1C19` |
| `--lx-ink` | `#1A1816` | `#F0EDE8` |
| `--lx-ink-2` | `#574F47` | `#B5ACA3` |
| `--lx-ink-3` | `#9B9088` | `#7A7268` |
| `--lx-ink-inverse` | `#F9F7F4` | `#1A1816` |
| `--lx-border` | `#DDD7CF` | `#3A342E` |
| `--lx-border-strong` | `#C4BCB2` | `#4A433B` |
| `--lx-border-subtle` | `#ECEAE5` | `#2E2925` |
| `--lx-accent` | `#C8A97E` | (unchanged) |
| `--lx-accent-dark` | `#A8885A` | (unchanged) |
| `--lx-accent-dim` | `#F2EAD9` | `rgba(200,169,126,0.18)` |
| `--lx-accent-text` | `#7A5C34` | `#D8BC92` |
| `--lx-error` | `#C47168` | (unchanged) |
| `--lx-error-dim` | `#F5E8E7` | `rgba(196,113,104,0.18)` |
| `--lx-error-text` | `#A55B52` | `#D89189` |
| `--lx-success` | `#7A9E7A` | (unchanged) |
| `--lx-success-dim` | `#EAF0EA` | `rgba(122,158,122,0.18)` |
| `--lx-success-text` | `#5E8260` | `#9DBE9D` |
| `--lx-warning` | `#C4A85A` | (unchanged) |
| `--lx-warning-dim` | `#F5EED8` | `rgba(196,168,90,0.18)` |
| `--lx-warning-text` | `#A88A3A` | `#DBC57E` |
| `--lx-story-surface` | `#2A2622` | `#2A2622` |
| `--lx-scrim` | `rgba(26,24,22,0.45)` | `rgba(0,0,0,0.65)` |
| `--lx-glass-bg` | `rgba(249,247,244,0.88)` | `rgba(26,24,22,0.85)` |
| `--lx-glass-border` | `rgba(255,255,255,0.4)` | `rgba(255,255,255,0.08)` |
| `--lx-avatar-0..6` | `#C8A97E, #7A9E7A, #9B7EA8, #7A9EB8, #C47168, #B89468, #5E8260` | same |

There are also white and black opacity ramps (`--lx-white-04` through `--lx-white-75`, `--lx-black-35` through `--lx-black-78`) and ink-shadow tokens (`--lx-ink-shadow-12/18/25`).

Gap for the panel: `--lx-warning` (and its dim/text) exists in CSS but is NOT exposed in the `v` object in `tokens.js`.
A status indicator that needs a distinct warning colour (for example a suspended account) must either add `warning` to `v` or reference the CSS variable directly.
The full set for a status vocabulary is present: accent, error, warning, success, plus their `-dim` and `-text` variants.

### Typography

Fonts are loaded from Google Fonts in `index.css` (Syne, DM Sans, DM Mono, Instrument Serif, Inter).

| Role | Family | Token |
|---|---|---|
| Display | `Syne` | `--font-display` / `v.fontDisplay` |
| Body | `DM Sans` | `--font-body` / `v.fontBody` |
| Mono (eyebrows, labels) | `DM Mono` | `--font-mono` / `v.fontMono` |

There is no formal type-scale token set.
Font sizes are set per component inline; the sizes observed run 40-44 px (page display headings), 18 px (modal title), 16/15/14/13 px (body and controls), and 11 px (mono eyebrows, uppercase with wide letter-spacing).
The panel will need to keep to these observed sizes by hand, since there is no `--font-size-*` scale to reference.

### Spacing and radius

Spacing scale (CSS variables): `--space-1:4px --space-2:8px --space-3:12px --space-4:16px --space-6:24px --space-8:32px --space-12:48px --space-16:64px`.
Radius: `--radius-sm:4px --radius-md:8px --radius-lg:12px --radius-xl:16px --radius-pill:999px`.
Density tokens: `[data-density="cozy"]` and `[data-density="dense"]` set `--lx-row-pad`, `--lx-card-pad`, `--lx-feed-gap`.
Shadows: `--shadow-sm/md/lg`.
Note: many components set spacing with raw pixel values inline rather than referencing the `--space-*` variables.

### Motion

Durations: `--duration-fast:150ms`, `--duration-normal:200ms`, `--duration-slow:300ms`.
Easings: `--ease-out: cubic-bezier(0.16,1,0.3,1)` (entry, decelerate), `--ease-in: cubic-bezier(0.4,0,1,1)` (exit, accelerate).
Named keyframes in `index.css`: `lx-popover-in`, `lx-overlay-in`, `lx-modal-in`, `lx-scrim-in`, `lx-sheet-in`, `lx-toast-in`, `lx-toast-out`, `lx-fade-in`, `lx-story-fade-in`, `lx-heart-bump`, `lx-story-heart-pop`, `lx-comment-flash`, `fadeSlideUp`, `checkPop`.
Reduced motion is honoured: `@media (prefers-reduced-motion: reduce)` sets all animation and transition durations to `0.001ms` and disables smooth scroll, with a source comment stating it was verified with the emulated preference.

### Raw hex in the styling layer

The token definitions in `index.css` (lines 4-169) are the legitimate home of raw hex and rgba; that is the single source and is expected.
Outside the token definitions, raw colour values do appear:

- `src/components/common/ConfirmModal.jsx`: inline `boxShadow: '0 20px 60px rgba(26,24,22,0.26)'` (line ~78).
- `src/index.css` `.dashboard-card` rules use `rgba(249,247,244,0.92)`, `rgba(255,255,255,0.8)`, `rgba(26,24,22,0.08)` and similar (lines ~670-710).
- `src/index.css` `.lx-popover-menu` box-shadow uses `rgba(26,24,22,0.16)` and `rgba(26,24,22,0.09)` (line ~313).

These are almost all shadow rgba values, not new brand colours.
The panel should reference tokens (`v.*` or `--lx-*`) rather than adding new raw hex, and should add `warning` to `v` rather than inlining `#C4A85A`.
