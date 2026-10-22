# Post creation - wireframes

Desktop wireframes at 1440 by 900 for the post creation features: drafts and scheduling, alt text, locations, people tags, collaborative posts, caption mentions and the owner archive.
Open `index.html` in a browser for the annotated set, or read the rendered frames in `png/`.

Colours, typography, radii and shadows are the live tokens from `src/index.css`, and copy follows the casing rules in `DESIGN.md`.
Square and round outlines stand in for `LxIcon` glyphs; gold-tinted callouts are annotations, not interface.
The tinted gradients are image placeholders, the one place the design system allows a gradient.

| Frame | Surface | Kind | Requirements |
|---|---|---|---|
| 01 | Composer with option rows, alt chips, drafts and save draft | Modified, layout changes | P2-C1-R2, P2-C1-R3, P2-C2-R1, P2-C4-R1, P2-A5-R1, P2-A5-R6 |
| 02 | Alt text editor | New | P2-C2-R1, P2-C2-R4 |
| 03 | Drafts and scheduled drawer | New | P2-C1-R2, P2-C1-R3, P2-C1-R5 |
| 04 | Schedule picker, valid and error states | New | P2-C1-R3 |
| 05 | Place picker | New | P2-C4-R1, P2-C4-R3, P2-C4-R5 |
| 06 | Tag people dialog | New | P2-A5-R1, P2-A5-R2, P2-A5-R3 |
| 07 | Invite collaborators dialog | New | P2-A5-R6 |
| 08 | Archive screen with the posts tab | New | P2-C1-R7 |
| 09 | Location page and its unavailable state | New | P2-C4-R4, P2-C4-R5, P2-C4-R7 |
| 10 | Settings, tags | New | P2-A5-R2, P2-A5-R3, P2-A5-R4 |
| 11 | Post detail with co-authors, place, tag markers, mention links and menu | Modified, layout changes | P2-C4-R4, P2-A5-R4, P2-A5-R6, P2-A5-R10, P2-C2-R2 |
| 12 | Edit alt text after publishing | New | P2-C2-R2, P2-C2-R3 |
| 13 | Profile with the tagged tab | Modified, layout changes | P2-A5-R5, P2-A5-R7 |
| 14 | Notifications, six new row kinds | Modified | P2-A5-R11, P2-C1-R5, P2-A5-R10 |
| 15 | Admin, places registry and ban dialog | New | P2-C4-R5, rule 7 |

## Decisions the wireframes encode

The composer keeps its single feed-width column, and every new capability is one option row under the caption, so a plain post stays as quick as it is today.
Each image carries an "alt" chip that fills in once text exists; leaving it empty is a visible choice, and the neutral label readers get is stated in the dialog.
Drafts and scheduled posts live in one drawer opened from the composer, share a limit of 50 that is stated in words, and a scheduled post that failed returns there with its reason.
The schedule picker works in the person's own time zone, states both limits (at least a minute ahead, at most 30 days), and turns the primary button into "schedule".
The place picker searches as you type, offers to add the typed name last, and says plainly that places are shared; an unavailable name never recreates the place.
Tagging happens over the image, per image, with a count against 20; a refusal caused by someone's tag setting is stated, and a block never is.
Co-authors are invited from search, limited to three, and the copy states that they appear only after accepting and that the author keeps editing and deleting.
The archive is built from a tab registry with a single "posts" tab now, so the stories tab added in a later phase is one more entry and the layout does not change.
The location page copies the hashtag page and adds "report", because a place name is typed by people; a banned or deleted place shows the same style of unavailable state.
The tags settings page lists what each "who can tag you" option means, explains review-first, notes the effect of limit interactions, and holds the waiting requests.
The post detail names every accepted co-author, links the place, shows tag markers (a waiting tag only to its two people) and renders stored mentions as links to the current username.
The menu gains "edit alt text" and "manage tags and collaborators" for the author and "remove me from this post" for a tagged person.
The profile gains a "tagged" tab for everyone, and a quiet line on your own profile points to waiting requests and invitations.
Notification rows reuse the existing layout; tag requests and collaboration invitations are decided inline, and the scheduled failure is an actorless system row linking to the draft.
The admin places registry reuses the hashtag registry pattern, every action asks for a reason because it writes an audit row, and "unban" also brings back a deleted place.

## Glyphs to add to `LxIcon`

The wireframes use placeholder outlines.
Building them needs these glyphs in the existing 24 by 24, 1.5 stroke style: `tag`, `calendar`, `archive`, `users`, `mapPin` and `alt`.
`pin` already exists and stays reserved for pinned hashtags.
