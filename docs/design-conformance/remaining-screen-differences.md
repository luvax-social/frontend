# Remaining Screen Differences

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

The three screens the first audit could not measure: the report modal, post detail, and the composer.

All three now have concrete difference lists and real sizes.

All findings are **[source]** unless marked **[observed]**.

---

## Report modal

Design reference: `additions.js:168-227`.
Frontend: `src/features/luvax/components/ReportModal.jsx`, 474 lines.

This is the **closest reproduction of any surface in the application**, closer even than settings.

### What matches exactly

Verified value by value, not assumed.

Overlay geometry: panel `width 480`, `maxWidth 100%`, `maxHeight 90vh`, column with `gap 14`, scrim on `v.scrim`, click-to-dismiss, body card on `v.base` with `1px solid v.border` and `borderRadius 12` under `overflow hidden`.

Preview card: `v.surface`, `1px solid v.border`, `borderRadius 12`, `padding 13px 15px`, avatar 30, author 13 weight 600, entity label mono 10 uppercase at `0.06em`, a `reporting` pill in `var(--lx-warning-text)` on `var(--lx-warning-dim)` at `borderRadius 999` and `padding 3px 9px`, body text clamped to 3 lines.

Step 1: header `padding 18px 20px 14px`, title in `v.fontDisplay` 18 weight 700 at `-0.02em` reading `report {entity}`, sub `why are you reporting this?` at 13 in `v.ink3` with `marginTop 2`, reason list capped at `maxHeight 340` and scrolling, each row `padding 13px 20px` with `gap 14` and a `1px solid v.borderSubtle` divider, radio 20 x 20 with a `2px` border and a 10 x 10 dot, label 14 weight 500 at `lineHeight 1.3`, description 12 in `v.ink3` at `marginTop 1`, `chevronRight` at size 13 in `v.borderStrong`, and a `Continue` button at 15 weight 500, `padding 13px 20px`, `borderRadius 999`.

Step 2: header `padding 14px 20px` with a `back` icon at 18, title `add details` at display 18 weight 700, `Selected reason` and `Additional context` labels in mono 10 uppercase at `0.08em` with `marginBottom 6`, the reason chip on `v.accentDim` in `v.accentText` at `padding 4px 12px`, textarea `minHeight 96` on `v.surfaceSunken` with `1px solid v.border`, `borderRadius 10`, `padding 11px 13px`, `lineHeight 1.5`, `resize none`.

Step 3: `padding 40px 24px 36px`, `gap 18`, a 64 x 64 circle on `var(--lx-success-dim)`, heading at display 20 weight 700 with `marginBottom 8`, body 14 in `v.ink3` at `lineHeight 1.55` and `maxWidth 300`, a mono 11 disclaimer on `v.surface` at `borderRadius 8`, `padding 10px 14px`, `maxWidth 340`, left-aligned, and a `Done` button at `padding 10px 32px` with a `1px solid v.border` outline.

Notably, both primary buttons here use `color: v.inkInverse`, which is what the design specifies and what `LxBtn` gets wrong. This modal is correct; the shared primitive is the outlier.

### Differences

| # | Property | Design | Frontend |
|---|----------|--------|----------|
| 1 | Character counter warning | red at `desc.length > 450`, i.e. 90% of 500 | see below, **never turns red** |
| 2 | Success panel entry animation | `fadeSlideUp 280ms cubic-bezier(0.16,1,0.3,1) both` on the whole step-3 block | **absent** |
| 3 | Success check animation | `checkPop 420ms cubic-bezier(0.16,1,0.3,1) both` on the 64px circle | **absent** |
| 4 | Success check stroke | `stroke: 2.2` | default `1.5` |
| 5 | Step 2 sub-copy | `optional — helps our team review faster` with an em dash | `optional - helps our team review faster` with a hyphen |
| 6 | Submit button pending state | none; the design cannot fail | `Sending...` with `opacity 0.7` and `disabled` |
| 7 | Failure alert on step 2 | none | a `role="alert"` block on `v.errorDim` in `v.errorText`, `borderRadius 10`, `padding 10px 13px`, with a bold title line |
| 8 | Duplicate outcome | none | a whole alternate step-3 branch: `flag` icon, warning palette instead of success, heading `you already reported this` |
| 9 | Overlay z-index | `2147483300` | `2000` |
| 10 | Accessibility attributes | none | `role="dialog"`, `aria-modal`, `aria-label`, `aria-pressed` on reason rows, `aria-label="Back"` |
| 11 | Description limit | 500 | 2000, settled and correct |

**[source]** `checkPop` and `fadeSlideUp` are defined in the design's injected stylesheet.
Neither exists anywhere in the frontend: `src/` declares only `auth-spin`, `lxEnter`, `lx-heart-bump` and `lx-popover-in`.
So both animations are missing outright, not merely retimed.

### The counter threshold question, answered

**The frontend has no working warning threshold.**

`ReportModal.jsx:234` computes:

```js
const overLimit = description.length > REPORT_DESCRIPTION_MAX_LENGTH;
```

and `ReportModal.jsx:301` colours the counter `overLimit ? v.errorText : v.ink3`.

But `ReportModal.jsx:278` clamps the input on every keystroke:

```js
onChange={(e) => setDescription(e.target.value.slice(0, REPORT_DESCRIPTION_MAX_LENGTH))}
```

`description.length` can therefore never exceed 2000, so `overLimit` is never true and the counter is permanently `v.ink3`.

The design's equivalent is a proportional warning at 90 percent of its limit, which does fire.
The frontend's is an exact-overflow check on a value that cannot overflow: dead code, not a scaled equivalent.

The faithful port is `description.length > REPORT_DESCRIPTION_MAX_LENGTH * 0.9`, which would warn at 1800.
The composer already uses exactly that idiom at `ComposerScreen.jsx:362` (`caption.length > MAX_CHARS * 0.9`), so the convention exists in the codebase and this one site diverges from it.

### Size: **small**

Eleven differences, of which six are deliberate additions to keep.
The real work is two keyframes, two number changes, one stroke value and one string.
Nothing structural moves.

---

## Post detail

Design reference: `PostDetailScreen` at `main.js:3298-3562`, `CommentModal` at `additions.js:264-344`, `CommentRow` and `CommentsSheet` at `main.js:3123-3298`.
Frontend: `src/features/luvax/components/PostDetailScreen.jsx`, 810 lines.

The surface choice, an overlay route rather than a modal, is settled and is not reopened here.
What follows is composition inside the surface.

Note that the design's own `PostDetailScreen` is effectively dead: `PostCard` and `NotifRow` both call `window.LX.openComments`, which mounts `CommentModal`. The live design reference is therefore `CommentModal`, and that is what the comparison below uses.

### Container

| Property | Design `CommentModal` | Frontend |
|----------|----------------------|----------|
| Desktop with image media | two panes: `min(940px, 94vw)` x `min(680px, 88vh)`, media pane `flex 1.1`, comment pane `width 400, maxWidth 46%` with a left border | **single column always**; no two-pane layout exists |
| Desktop without media | `min(540px, 96vw)` x `min(720px, 90vh)` | `min(556px, calc(100vw - 32px))` x `min(84vh, 728px)` |
| Mobile | `min(540px, 96vw)` x `92vh`, bottom-anchored, radius `16px 16px 0 0` | same single desktop geometry at every viewport |
| Radius | 14 | 16 |
| Border | none | `1px solid v.border` |
| Shadow | `0 24px 70px rgba(0,0,0,0.32)` | `0 24px 80px rgba(26,24,22,0.34)` |
| Entry animation | `lxModalUp 280ms cubic-bezier(.22,1,.36,1)` on mobile, `lxModalIn 220ms` scale 0.93 elsewhere | **none** |
| Layout mechanism | nested flex columns | CSS grid, `gridTemplateRows: auto auto minmax(0,1fr) auto` |

The missing two-pane layout is the largest single difference on this screen.
Every image post in the design gets its media beside the comments at desktop; in the frontend the media is stacked above them.

### Header

| Property | Design | Frontend |
|----------|--------|----------|
| Padding | `16px 16px 12px` | `16px 16px 12px` |
| Gap | 10 | 10 |
| Avatar | 38 | **40** |
| Author name | 14 weight 600 | **15** weight 600, `lineHeight 1.15` |
| Timestamp | mono 10, `{time} ago` in one node | mono 10, split into two `<span>`s with `gap 4` |
| Overflow menu | `LxMenu`, trigger icon 16 | bespoke 24 x 24 button, icon **14** |
| Close button | icon 20 in `v.ink2` | 24 x 24 button, icon **14** in `v.ink3` |

### Caption block

| Property | Design | Frontend |
|----------|--------|----------|
| Padding | `14px 16px` | `16px 16px 14px` |
| Font size | `post.type === 'text' ? 18 : 15` | `mainMedia ? 18 : 17` |
| Font weight | not set, so 400 | **600** |
| Line height | 1.5 | **1.52** |
| Letter spacing | `-0.01em` | **`-0.025em`** |
| Tag gap | 5 | **8** |
| Tag margin top | 10 | **12** |

Two things here are more than drift.
The caption is **semibold in the frontend and regular in the design**, which changes the whole visual weight of the screen.
And the size rule is inverted: the design gives text posts the larger 18px and media posts 15px; the frontend gives media posts 18px and text posts 17px.

### Media placement

| Property | Design | Frontend |
|----------|--------|----------|
| Position | a fixed left pane beside the comments at desktop, or a 160px strip above them | **inside the scrolling comments pane**, so it scrolls out of view |
| Image sizing | `objectFit cover` filling the pane | `width: 100%`, no cap, true aspect ratio |
| Radius | none, clipped by the container | 14 |
| Caption over media | a gradient overlay with the caption on it, desktop two-pane only | none |

**[observed]** Confirmed at 1440: the image measured 516 x 387 against a natural 1400 x 1050, an exact ratio match, and scrolled with the comments.

### Action bar

| Property | Design | Frontend |
|----------|--------|----------|
| Padding | `10px 16px` | `12px 16px` |
| Gap | 18 | 18 |
| Heart size | 20 | **22** |
| Like count colour | `v.ink3` always | `liked ? HEART_COLOR : v.ink3` |
| Share icon colour | `v.ink` | `v.ink3` |
| Border | `borderTop 1px v.borderSubtle` | `borderBottom 1px v.borderSubtle` |
| Bookmark | absent | absent, matching |

### Reply bar

| Property | Design | Frontend |
|----------|--------|----------|
| Padding | `8px 14px` | `8px 14px 7px` |
| Background | `v.accentDim` | `color-mix(in srgb, var(--lx-accent) 14%, var(--lx-surface))` |
| Border | `borderTop 1px v.border` | `borderBottom 1px v.borderSubtle` |
| Label size | mono 10 | mono **11** |
| Dismiss control | 20 x 20 circle on `v.surfaceRaised` with an `LxIcon close` at 10 | **18 x 18** circle on `rgba(0,0,0,0.14)` with a literal `×` character at 11px |

### Comment composer

| Property | Design | Frontend |
|----------|--------|----------|
| Padding | `10px 12px 14px` | `10px 12px 12px` |
| Avatar | 28 | **30** |
| Input | direct `<input>` on `v.surfaceSunken`, `1px solid v.border`, `borderRadius 999`, `padding 9px 14px` | a wrapper div at fixed `height 40`, `borderRadius 999`, `1px solid v.border`, **`background: transparent`**, with the input inside |
| Send affordance | `send` icon at 20 in `v.accent`, `opacity 0.4` when empty | present, geometry not compared |

The input background differs: sunken in the design, transparent in the frontend.

### Comment row

| Property | Design `CommentRow` | Frontend `CommentRow` |
|----------|--------------------|-----------------------|
| Indent per depth | `16 + depth * 42`, a **42px** step | `indent + 30`, a **30px** step |
| Row padding | `paddingTop 10, paddingBottom 6, paddingRight 48` | not directly comparable; different structure |
| Avatar | 32 | 32 |
| Author and text | author node then text node | inline flex, `gap 7`, `lineHeight 1.42`, both at **12.5px** |
| Heart | absolutely pinned `right 16, top 10`, 28 x 28 button, icon **14** | absolutely pinned `right 0, top 16`, no button size, icon **16** |
| Meta row | time and likes | `gap 12`, mono 10: time, `edited`, `{n} likes`, then a `Reply` button at body 11.5 weight 500 |
| Overflow trigger | `more` **icon**, revealed by the `lx-hover-menu` CSS class | a literal **`...` text character** at 14px weight 600, mounted only while hovered |
| Menu items, own comment | `Edit` and `Delete`, both **no-op stubs** | fully implemented, with inline editing |
| Menu items, other | Like, Share, Copy link, View author's profile, divider, Report | same set |
| Menu item metrics | `gap 10`, `padding 8px 14px`, 13px weight 500, icon 15 | `LxDropdownMenu` defaults, `min-height 44`, `padding 0 12px`, 13px |
| Replies | `repliesOpen` state, rendered inline | `View replies (n)` / `Hide replies` with a chevron rotating over `160ms` |
| Inline edit | none | textarea, save and cancel buttons, `{n}/{max}` counter, error line |
| `top comment` badge | none | filled `heart` at 9px in `v.accent` with a label |
| Like state | `window.__lxStore`, shared across instances | **derived from `comment.isLiked`**, which is correct |

### Where the like state lives, confirmed

The first audit recorded divergence 8 against `PostCard` and only inferred it here.
It is now confirmed directly.

**[source]** `PostDetailScreen.jsx:362-363`:

```js
const [liked, setLiked] = useState(false);
const [likeCount, setLikeCount] = useState(0);
```

Both are component-local, seeded to `false` and `0` rather than from the post, and reconciled afterwards by an effect at lines 421-422 keyed on `[post.id, post.likeCount]`.

**[observed]** Opening post detail from the feed leaves the feed card mounted behind the overlay, so the same post is rendered twice with two independent copies of this state.

There is a sharper point.
The same file gets it **right** for comments: `PostDetailScreen.jsx:59-60` reads

```js
const liked = Boolean(comment.isLiked);
const likeCount = comment.likeCount ?? 0;
```

straight from query data, with no local mirror.
The correct pattern is already present in the file that has the defect, twenty lines from the code that repeats it.

### Size: **medium**

Not large, which is the correction to the provisional estimate.

The 810 lines are mostly the comment row's editing, deletion, reply threading and reporting behaviour, all of which are additions with no design counterpart and are staying.
The conformance work is: a two-pane desktop layout for image posts, an entry animation, the caption typography, and roughly twenty measured value changes.

The like-state fix is separate engineering and is sized on its own.

---

## Composer

Design reference: `main.js:2817-3093`, 277 lines.
Frontend: `src/features/luvax/components/ComposerScreen.jsx`, 370 lines.

### Is the extra length capability or divergence?

**Both, and the split is roughly even.**

About 45 lines are genuine capability the design has no equivalent for.
About 35 lines are the tablet treatment, which is pure divergence.

### What matches exactly

`MAX_CHARS = 280`. Hashtag auto-extraction by `/#(\w+)/g` lowercased. The `allTags` union of caption tags and selected tags. Header at `padding 10px 16px` with `new post` at 13 weight 500 in `v.ink2`. Post button at 14 weight 600, `borderRadius 999`, `padding 7px 16px`. Three tabs from `[['text','type','text'],['photo','image','photo'],['video','video','video']]` with `flex 1`, `gap 6`, icon 16, 13px, weight 600 when active. Media drop zone on `v.surfaceSunken` at `borderRadius 12` with a `1px dashed v.border`, `gap 8`, `marginBottom 14`. The strings `tap to add a photo`, `tap to add a video`, `jpg, png · max 10MB`, `mp4 · max 60s · 50MB`. Textarea at `fontSize type === 'text' ? 17 : 14`, `lineHeight 1.55`, `letterSpacing -0.01em`, `minHeight 120` or `60`. Hashtag label in mono 9 uppercase at `0.1em` with a `hash` icon at 12. The counter ring: 22 x 22, `conic-gradient(var(--lx-accent) {n}deg, var(--lx-surface-raised) 0deg)` with a 17px `v.base` core. The counter warning at `caption.length > MAX_CHARS * 0.9`. Footer at `padding 14px 16px` with `auto-tagged: {n}` in mono 11.

### Capability the frontend adds

| Addition | Lines |
|----------|-------|
| Real `<input type="file">` with `accept` switched by tab | 248 |
| Local preview: `<img>` for photo, `<video controls>` for video | 270-276 |
| Remove-file button, 8/8 inset, `v.black50` circle, `close` icon 16 in `v.white` | 277-279 |
| Upload through `useMediaUpload`, then post with `mediaIds` | 74-85 |
| Post button progress label, `uploading {n}%` then `posting...` | 162 |
| Form error surface at 13px in `v.error` | 179-190 |
| Media-required guard before submit | 68-71 |
| Tag toggle: clicking an active tag **removes** it from the caption by regex | 54-61 |

The design's `insertTag` only ever appends, and guards with `if (!caption.includes('#'+tag))`, so a tag can never be removed once added.
Its `toggleTag` is defined at line 2831 and never called.
The frontend's toggle is a genuine improvement.

### Divergence

| # | Property | Design | Frontend |
|---|----------|--------|----------|
| 1 | Post button text colour when enabled | `v.inkInverse` | **`v.ink`**, the same error as `LxBtn` |
| 2 | Header bottom border | `1px solid v.border` | **`1.5px solid v.borderStrong`** |
| 3 | Tab strip bottom border | `1px solid v.border` | **`1.5px solid v.borderStrong`** |
| 4 | Tab active underline | `2px solid v.ink` | **`2.5px`** |
| 5 | Tab padding | `10px 0` | `10px 0 11px` |
| 6 | Avatar row padding | `20px 16px 0` | `18px 16px 0` |
| 7 | `you` label margin bottom | 8 | **12** |
| 8 | Media box height | fixed `height: 160` | `minHeight` 160 desktop, **176** elsewhere |
| 9 | Media box icon size | 36 | **32** |
| 10 | Media box overflow | not set | `hidden`, needed for the preview |
| 11 | Post enabled condition | `caption.trim().length > 0` only | also requires a file for media types, and blocks while pending |
| 12 | Tablet layout | none; the design's tablet is a single 640px column | a bespoke treatment: a vertical rule at `left: 150`, body padding `166px` left and `24px` right, and three absolutely positioned `1.5px` rules |

Item 12 is the bulk of the divergent length.
It exists to serve the frontend's own tablet design, which is settled as kept, so it is not conformance work.
It is listed because it explains the line count.

Items 2, 3 and 4 are a consistent pattern: the frontend thickens every rule on this screen from 1px to 1.5px and the tab underline from 2px to 2.5px, and swaps `v.border` for `v.borderStrong`. That reads as a deliberate choice rather than drift, but no document records it.

### Carousel

The composer cannot create one.

**[source]** `handleFileChange` takes `event.target.files[0]`, the input has no `multiple`, and `handlePost` builds `mediaIds = [mediaAsset.id]`, a single-element array.
`postType` can only be `TEXT`, `IMAGE` or `VIDEO`.

The backend accepts carousels of 2 to 10 items.
The design has no carousel either, so this is a product gap rather than a conformance gap, but it means **no user can create a carousel through the interface**.
The two carousels used in this audit had to be created through the API.

### Size: **small**

Twelve differences, of which one is the shared `LxBtn` colour bug, one is the settled tablet treatment, and the rest are single values.
No structure moves.

Adding carousel authoring would be **large**, but that is new capability rather than conformance, and no design defines it.

---

## Sizes, replacing the provisional estimates

| Screen | Provisional | Measured | What changed |
|--------|-------------|----------|--------------|
| Report modal | medium | **small** | Nearly exact already. Two missing keyframes and four values |
| Post detail | large | **medium** | Most of the 810 lines are additions with no design counterpart. The conformance work is the two-pane layout, the caption typography and about twenty values |
| Composer | medium | **small** | Structurally identical. Twelve value differences, one of which is the shared button bug |
