# Design System Reference

> Superseded by `DESIGN.md` at the repository root. Record of work done on 2026-08-01; not maintained.

Extracted from the Claude Design export `Luvax.html`.

## Locating and extracting the export

**The file is not in either repository.**
It was found at `C:\Users\minhg\OneDrive\Desktop\Luvax.html`, outside both working trees, and used
from there.
This is a risk: the pixel-perfect conformance target depends on a 1,071,864-byte file that exists
on one machine and is in no version control.

Extraction, reproducible with `python`:

1. Read the file as UTF-8.
2. Find `<script type="__bundler/manifest">` and parse its contents as JSON. The manifest is a
   dictionary keyed by UUID.
3. Each entry has `mime` and a base64 `data` field.
4. Entries whose mime is `application/javascript` or `text/javascript` are gzip-compressed after
   base64 decoding.
5. Write each decompressed chunk out and read it as source.

The manifest holds 29 entries:

| Count | Type | Note |
|-------|------|------|
| 6 | `image/jpeg` | Photographic mock content |
| 3 | `application/javascript` | One is the application, 177 KB |
| 3 | `text/javascript` | React 19 production, React DOM production, and a design-tool runtime |
| 17 | `font/woff2` | The bundled webfonts |

The three source chunks that matter:

| Chunk | Size | Contents |
|-------|------|----------|
| `ed9a0c12-...` | 176,988 B | Tokens, `LxIcon` and its icon tables, every primitive, every screen except messages, `App` |
| `9bffeb59-...` | 30,633 B | `lx-additions.js`: `LxMenu`, `ReportModal`, `CommentModal`, `LxHeaderSearch`, `ConfirmModal`, toast |
| `3b513cf1-...` | 44,507 B | `lx-messages.js`: `MessagesScreen`, `ConvRow`, `ConvOptionsMenu`, `MsgMenu` |

The three chunks load in sequence with polling guards: `lx-additions` waits for
`window.React && window.LxIcon`, `lx-messages` waits for `window.React && window.LuvaxApp`.

## Tokens

50 `--lx-` and `--font-` custom properties, light under `:root` and dark under
`html[data-theme="dark"]`.

**All 50 are already present in `src/index.css` with identical values.**
A diff of the token declarations in both directions found zero differences in the design's
direction. See `design-conformance-gaps.md`.

### Light, `:root`

| Token | Value |
|-------|-------|
| `--lx-base` | `#F9F7F4` |
| `--lx-surface` | `#F0EDE8` |
| `--lx-surface-raised` | `#E8E3DC` |
| `--lx-surface-sunken` | `#EAE6E0` |
| `--lx-ink` | `#1A1816` |
| `--lx-ink-2` | `#574F47` |
| `--lx-ink-3` | `#9B9088` |
| `--lx-ink-inverse` | `#F9F7F4` |
| `--lx-border` | `#DDD7CF` |
| `--lx-border-strong` | `#C4BCB2` |
| `--lx-border-subtle` | `#ECEAE5` |
| `--lx-accent` | `#C8A97E` |
| `--lx-accent-dark` | `#A8885A` |
| `--lx-accent-dim` | `#F2EAD9` |
| `--lx-accent-text` | `#7A5C34` |
| `--lx-error` | `#C47168` |
| `--lx-error-dim` | `#F5E8E7` |
| `--lx-error-text` | `#A55B52` |
| `--lx-success` | `#7A9E7A` |
| `--lx-success-dim` | `#EAF0EA` |
| `--lx-success-text` | `#5E8260` |
| `--lx-warning` | `#C4A85A` |
| `--lx-warning-dim` | `#F5EED8` |
| `--lx-warning-text` | `#A88A3A` |
| `--lx-glass-bg` | `rgba(249,247,244,0.88)` |
| `--lx-glass-border` | `rgba(255,255,255,0.4)` |
| `--lx-glass-blur` | `10px` |
| `--lx-scrim` | `rgba(26,24,22,0.45)` |

### Dark, `html[data-theme="dark"]`

Only the tokens that change are redeclared.
`--lx-accent`, `--lx-accent-dark`, `--lx-error`, `--lx-success`, `--lx-warning`, and
`--lx-glass-blur` are **not** overridden and carry through from light.

| Token | Dark value |
|-------|-----------|
| `--lx-base` | `#1A1816` |
| `--lx-surface` | `#25211D` |
| `--lx-surface-raised` | `#2F2A25` |
| `--lx-surface-sunken` | `#1F1C19` |
| `--lx-ink` | `#F0EDE8` |
| `--lx-ink-2` | `#B5ACA3` |
| `--lx-ink-3` | `#7A7268` |
| `--lx-ink-inverse` | `#1A1816` |
| `--lx-border` | `#3A342E` |
| `--lx-border-strong` | `#4A433B` |
| `--lx-border-subtle` | `#2E2925` |
| `--lx-accent-dim` | `rgba(200,169,126,0.18)` |
| `--lx-accent-text` | `#D8BC92` |
| `--lx-error-dim` | `rgba(196,113,104,0.18)` |
| `--lx-error-text` | `#D89189` |
| `--lx-success-dim` | `rgba(122,158,122,0.18)` |
| `--lx-success-text` | `#9DBE9D` |
| `--lx-warning-dim` | `rgba(196,168,90,0.18)` |
| `--lx-warning-text` | `#DBC57E` |
| `--lx-glass-bg` | `rgba(26,24,22,0.85)` |
| `--lx-glass-border` | `rgba(255,255,255,0.08)` |
| `--lx-scrim` | `rgba(0,0,0,0.65)` |

Note the dark theme keys off `html[data-theme="dark"]`, an explicit attribute.
The settled decision is light by default following `prefers-color-scheme` with no manual toggle,
which means something must set that attribute from the media query.
The export itself provides no such wiring.

### The token object in JavaScript

Components never write hex directly.
They read a `v` object that maps camelCase names onto `var(--lx-*)`:

```js
var v = { base, surface, surfaceRaised, surfaceSunken, ink, ink2, ink3, inkInverse,
          border, borderStrong, borderSubtle, accent, accentDark, accentDim, accentText,
          error, errorDim, errorText, success, successText, scrim,
          fontDisplay, fontBody, fontMono };
```

`v` does not expose `warning*`, `successDim`, `glass*`. Those are referenced as raw
`var(--lx-...)` strings at the few call sites that need them, such as the "reporting" chip in
`ReportModal`.

## Typography

| Role | Token | Family |
|------|-------|--------|
| Display | `--font-display` | `'Syne', sans-serif` |
| Body | `--font-body` | `'DM Sans', sans-serif` |
| Mono | `--font-mono` | `'DM Mono', monospace` |

35 `@font-face` blocks in the export, backed by the 17 bundled woff2 files.
`Instrument Serif` also appears in the HTML but is not referenced by any `--font-*` token and is not
used by any component; it is design-tool chrome.

The export defines no named type scale.
Sizes are literal numbers at each call site.
Observed values, all in pixels:

| Context | Size | Weight | Family |
|---------|------|--------|--------|
| Post body, text post | 16 | default | body |
| Post body, media post | 14 | default | body |
| Post author name | 13 | 600 | body |
| Post timestamp and separator dot | 10 | default | mono |
| Post like and reply counters | 11 | default | mono |
| Button, sm / md / lg | 12 / 14 / 16 | 500 | body |
| Tag, sm / md | 11 / 12 | 500 | body |
| Report modal reason label | 14 | 500 | body |
| Report modal entity kind chip | 10 | default | mono, uppercase, `letter-spacing 0.06em` |

Global letter-spacing on body copy is `-0.01em`.
`html, body` set `-webkit-font-smoothing: antialiased`.

## Breakpoints

From `useViewport`, measured on `document.documentElement.clientWidth`:

| Name | Range |
|------|-------|
| `mobile` | below 640 |
| `tablet` | 640 to 1023 |
| `desktop` | 1024 and up |

## Icon inventory

`LxIcon` renders inline SVG on a `0 0 24 24` viewBox with
`fill="none"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.

```js
function LxIcon({ name, size = 20, color, filled = false, stroke = 1.5 })
```

`filled` falls back to the outline node when no filled variant exists for that name, so passing
`filled` on an unsupported icon is safe and silently renders the outline.
An unknown `name` returns `null`, rendering nothing.

### Outline icons, 27 total

`back`, `ban`, `bell`, `bookmark`, `chat`, `check`, `chevronRight`, `close`, `explore`, `eye`,
`flag`, `hash`, `heart`, `home`, `image`, `link`, `mail`, `more`, `plus`, `profile`, `reply`,
`send`, `settings`, `share`, `type`, `userMinus`, `video`

### Icons with a filled variant, 7

`bell`, `bookmark`, `chat`, `explore`, `heart`, `home`, `profile`

### Icons with no filled variant, 20

`back`, `ban`, `check`, `chevronRight`, `close`, `eye`, `flag`, `hash`, `image`, `link`, `mail`,
`more`, `plus`, `reply`, `send`, `settings`, `share`, `type`, `userMinus`, `video`

The filled set is exactly the navigation and engagement set: the five bottom-nav destinations plus
`heart` and `bookmark`.

## Primitives

### `LxIcon`

Covered above.

### `LxAvatar`

```js
LxAvatar({ size = 36, idx = 0, ring = false, hasStory = false, viewed = false })
```

| Prop | Effect |
|------|--------|
| `size` | Diameter in px |
| `idx` | Index into `AVATAR_COLORS`, modulo the palette length. The avatar is a flat colour circle, not an image |
| `ring` | `outline: 2px solid var(--lx-accent)` with `outlineOffset: 2` |
| `hasStory` | Wraps in a `size + 6` circle with `padding: 2`, background `--lx-accent` unviewed or `--lx-border` viewed, and an inner `2px solid var(--lx-base)` ring |
| `viewed` | Only meaningful with `hasStory` |

The export's avatar takes **no image source**.
`AVATAR_PHOTOS`, a list of Unsplash URLs, exists in the chunk but `LxAvatar` does not consume it.
Real avatars are undesigned; see `design-conformance-gaps.md`.

`hasStory` and `ring` are mutually exclusive in the implementation: `hasStory` returns early and
never reads `ring`.

### `LxBtn`

```js
LxBtn({ children, variant = 'primary', size = 'md', onClick, disabled = false, style = {} })
```

Always `borderRadius: 999`, `fontFamily: --font-body`, `fontWeight: 500`,
`letterSpacing: -0.01em`, `transition: all 150ms ease-out`.

| `size` | fontSize | padding |
|--------|----------|---------|
| `sm` | 12 | `5px 14px` |
| `md` | 14 | `9px 20px` |
| `lg` | 16 | `12px 28px` |

| `variant` | background | color | border |
|-----------|-----------|-------|--------|
| `primary` | `--lx-accent` | `--lx-ink-inverse` | none |
| `secondary` | `--lx-surface` | `--lx-ink` | `1px solid --lx-border` |
| `ghost` | transparent | `--lx-ink` | `1px solid --lx-border` |
| `danger` | transparent | `--lx-error` | `1px solid --lx-error` |

`disabled` overrides **only the primary variant** to background `--lx-surface-raised` and colour
`--lx-ink-3`, and sets `cursor: default`.
Disabling `secondary`, `ghost`, or `danger` changes nothing but the cursor.
This matters directly for the settled decision to render out-of-scope bottom-nav tabs disabled.

There is no `loading` state, no icon slot, and no `type` prop.

### `LxTag`

```js
LxTag({ children, active = false, onClick, size = 'md' })
```

Renders a `span`, not a button.
`borderRadius: 999`, `fontWeight: 500`, `display: inline-flex`, `gap: 3`, `whiteSpace: nowrap`.

| `size` | fontSize | padding |
|--------|----------|---------|
| `sm` | 11 | `3px 9px` |
| `md` | 12 | `5px 12px` |

| State | background | color | border |
|-------|-----------|-------|--------|
| default | `--lx-surface` | `--lx-ink-2` | `1px solid --lx-border` |
| `active` | `--lx-accent-dim` | `--lx-accent-text` | `1px solid transparent` |

`cursor` is `pointer` only when `onClick` is supplied.

### `LxDivider`

```js
LxDivider({ mx = 0 })
```

A 1px `--lx-border` rule with `margin: 0 {mx}px`.

### `LxBottomSheet`

```js
LxBottomSheet({ open, onClose, children, height = '70vh' })
```

Fixed scrim at `--lx-scrim`, `opacity` transition `200ms ease-out`, `pointerEvents` gated on
`open`, `zIndex: 999`.
The sheet is fixed to the bottom, `maxWidth: 640` centred, `--lx-base` background, top corners
`16px`, `boxShadow: 0 -8px 30px rgba(0,0,0,0.18)`, `zIndex: 1000`.
Transform is `translateY(0)` open and `translateY(100%)` closed with
`transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1)`.
A 36 by 4 grab handle at `--lx-border` with `borderRadius: 2` sits at the top.
`document.body.style.overflow` is locked while open.

Closed state stays mounted rather than unmounting, which is what makes the slide animation work in
both directions.

### `LxTopBar`

```js
LxTopBar({ left, center, right })
```

A three-slot layout. No further behaviour.

### `LxTopTabs`

```js
LxTopTabs({ active, navigate })
```

Five tabs, `height: 56`, `gap: 4`, `flex: 1`, `maxWidth: 560`, each item `maxWidth: 110`.

| id | icon | label |
|----|------|-------|
| `feed` | `home` | home |
| `explore` | `explore` | explore |
| `messages` | `chat` | chats |
| `compose` | `plus` | post |
| `notifications` | `bell` | activity |

Active state is colour `--lx-accent`, `stroke: 1.8`, `filled: true`.
Inactive is `--lx-ink-3`, `stroke: 1.5`, outline.
`transition: color 150ms ease-out`.
The labels are defined but not rendered; only the icon is drawn.

### `LxBottomNav`

```js
LxBottomNav({ active, navigate })
```

**Six tabs**: the five above plus `profile` with icon `profile` and label `you`.

Fixed to the bottom, full width, `zIndex: 100`, `height: 56` per item,
`background: var(--lx-glass-bg)`, `backdropFilter: blur(12px)` with the `-webkit-` prefix,
`borderTop: 1px solid --lx-border`, `justifyContent: space-around`.
Same active treatment as `LxTopTabs`.

Note the blur here is a literal `12px`, not the `--lx-glass-blur` token, which is `10px`.
The token is unused by this component.

### `LxSidebar`

```js
LxSidebar({ active, navigate })
```

Desktop only. Fixed `width: 220`.

### `LxRightRail`

```js
LxRightRail()
```

No props. Fixed `width: 300` with an `18` inner gap.
Content is hardcoded mock; there is no data contract.

### `LxShell`

```js
LxShell({ screen, navigate, params, children, showRightRail = true })
```

Column `maxWidth: 640`, and a `680` width appears for the wider desktop arrangement.

### `LxAppBar`

```js
LxAppBar({ screen, navigate, params, viewport })
```

The only primitive that branches on all three viewports.
Documented in the source as rendered once at `App` level and kept mounted so navigation does not
flicker.
It has a scroll-hide behaviour driven by CSS: `header.lx-bar` transitions
`transform 220ms ease, opacity 220ms ease`, and `header.lx-bar.lx-bar-hidden` is
`translateY(-100%)` with `opacity: 0`.

### `MiniCard`

```js
MiniCard({ p, navigate })
```

The Explore grid cell.

### `SectionHeader`

```js
SectionHeader({ children })
```

### `LxMenu`

```js
LxMenu({ target, comment, navigate, style })
```

From `lx-additions`.
`target` is `{ entityType, id, author, idx, text }` where `entityType` is `post`, `comment`, or
`user`.
Opens the overflow menu on a post or comment and is the entry point to `ReportModal` and
`ConfirmModal`.

### `ConfirmModal`

```js
ConfirmModal({ config, onClose })
```

`config` carries the title, body, and confirm action.
Rendering is driven entirely by `config` being non-null.

### `ReportModal`

```js
ReportModal({ target, onClose, onSubmitted })
```

A three-step flow held in one state object `{ step, reason, desc }`, reset whenever `target`
changes.

- Step 1: reason selection. A full-width button per reason with a 20px radio circle
  (`2px solid --lx-accent` and `--lx-accent-dim` fill when selected, containing a 10px
  `--lx-accent` dot; `2px solid --lx-border-strong` when not), a 14px 500 label, a description
  line, and `1px solid --lx-border-subtle` between rows. Row padding `13px 20px`, `gap: 14`.
- Step 2: optional free-text description.
- Step 3: confirmation. `onSubmitted` fires with `target.key` or `entityType:id`.

A preview card sits above the flow: `--lx-surface` background, `1px solid --lx-border`,
`borderRadius: 12`, padding `13px 15px`, a 30px avatar, a 13px 600 author line, a 10px uppercase
mono entity-kind line with `letter-spacing 0.06em`, and a "reporting" chip in
`--lx-warning-text` on `--lx-warning-dim` at `borderRadius: 999`, padding `3px 9px`.
The reported text is clamped to three lines with `-webkit-line-clamp`.

`entityLabel` maps `comment` to "comment", `user` to "account", and everything else to "post".

**The eight reasons match the backend `report_reason` enum exactly**, ids and all:

| id | label | description |
|----|-------|-------------|
| `spam` | Spam | Fake engagement, scams, repetitive posts |
| `nudity` | Nudity or sexual content | Explicit or suggestive material |
| `violence` | Violence or threats | Graphic, dangerous, or threatening content |
| `hate_speech` | Hate speech | Promotes discrimination or hostility |
| `harassment` | Harassment or bullying | Targeting or intimidating individuals |
| `false_information` | False information | Misleading or unverified claims |
| `scam` | Scam or fraud | Deceptive schemes or financial fraud |
| `other` | Something else | Doesn't fit the above categories |

A shorter `REASON_LABELS` map exists for compact display.

### `CommentModal`

```js
CommentModal({ post, onClose, navigate, viewport })
```

The overlay that opens over the feed when a post's comment affordance is used, rather than
navigating to a detail screen.
It is opened through a global `window.LX.openComments(post)` API that `PostCard` calls in
preference to `navigate('post', ...)`.

### `LxHeaderSearch`

```js
LxHeaderSearch({ navigate })
```

The app-bar search control.

### `CommentRow` and `CommentsSheet`

```js
CommentRow({ r, depth = 0 })
CommentsSheet({ open, onClose })
```

`CommentRow` takes an explicit `depth` prop, so the design does model nesting visually.
`CommentMenuPortal({ btnRef, items, onClose })` renders the per-comment menu into a portal
anchored on a button ref.

Hover behaviour is CSS-driven:

```css
.lx-comment-row .lx-hover-menu { opacity: 0; transition: opacity 140ms; }
.lx-comment-row:hover .lx-hover-menu { opacity: 1; }
@media (hover: none) { .lx-comment-row .lx-hover-menu { opacity: 1; } }
```

So on touch devices the menu is permanently visible.
The same pattern is used for `.msg-dot`, `.conv-hover-acts`, `.conv-row:hover`, `.user-row:hover`,
and `.member-row:hover`.

### Toast

A helper in `lx-additions`, not a component with a prop surface.

## Motion

The complete set defined in the export's stylesheet.

| Name | Definition |
|------|-----------|
| `checkPop` | `0% scale(0) opacity 0`, `70% scale(1.18)`, `100% scale(1) opacity 1` |
| `fadeSlideUp` | `from opacity 0 translateY(12px)`, `to opacity 1 translateY(0)` |
| Tap feedback | `[data-lxtap] { transition: transform 220ms cubic-bezier(.3,.7,.4,1); }` |
| App bar hide | `transform 220ms ease, opacity 220ms ease` |
| Bottom sheet | `transform 250ms cubic-bezier(0.16, 1, 0.3, 1)`, scrim `opacity 200ms ease-out` |
| Nav and button colour | `150ms ease-out` |
| Hover menus | `opacity 140ms`, or `120ms` for message and conversation rows |

`data-lxtap` is also a functional marker, not only a style hook: `PostCard`'s card-level click
handler checks `e.target.closest('[data-lxtap]')` and bails out, so action buttons do not also
trigger navigation.

Scrollbars are restyled globally to 6px wide with a `--lx-border` thumb at `borderRadius: 3` on a
transparent track.

## Screens present in the export

| Screen | Chunk | In scope |
|--------|-------|----------|
| `FeedScreen` | main | yes |
| `ExploreScreen` | main | yes |
| `PostDetailScreen` | main | yes |
| `ProfileScreen` | main | yes |
| `ComposerScreen` | main | yes |
| `NotificationsScreen` | main | no |
| `SettingsScreen` | main | no |
| `OnboardingScreen` | main | no |
| `StoryViewScreen`, `StoryComposerScreen` | main | no |
| `MessagesScreen` | messages | no |

Supporting screen-level pieces: `StoriesCarousel`, `PostCard`, `StoryStage`, `StoryLikeBtn`,
`NotifRow`, `SettingsRow`, `Toggle`, `MiniCard`, `SectionHeader`.

There is **no followers screen, no following screen, no blocked-users screen, no search results
screen, and no follow-request screen** anywhere in the export.
Those are the derived surfaces named in the settled decisions.

## The design-tool tweaks panel

The main chunk contains `TweaksPanel`, `TweakSection`, `TweakRow`, `TweakSlider`, `TweakToggle`,
`TweakRadio`, `TweakSelect`, `TweakText`, `TweakNumber`, `TweakColor`, `TweakButton`, and
`MyTweaks`.

These are the design tool's live-editing chrome, not product UI.
They must not be ported.
`TWEAK_DEFAULTS`, `ACCENT_PALETTES`, and `FONT_MAP` already exist in the frontend at
`src/features/luvax/constants/data.js`, which means some of this chrome has already leaked across.

## Global state the export relies on

The export uses browser globals as an ad-hoc store.
None of this is a design decision worth porting, but it explains prop surfaces that otherwise look
incomplete.

| Global | Purpose |
|--------|---------|
| `window.__lxStore` | `{ likes: Set, listeners: Map }`. `PostCard` subscribes so every rendering of the same post shares one liked state |
| `window.LX.openComments(post)` | Opens `CommentModal` instead of navigating |
| `window.LxMenu` | Presence check before rendering the post overflow menu |
| `window.__luvaxAdditions`, `window.__luvaxMessages` | Load-order flags |

`_lxToggleLike(postId)` is the mutation entry point, and the like colour is a hardcoded `#D15B5B`,
**not** a token and not `--lx-error` (`#C47168`).
