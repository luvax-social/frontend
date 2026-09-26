# Design Divergences

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

Every place this task now deliberately differs from the design export, and why.

Where this task and the design disagree, this task wins, and the divergence is recorded here rather than argued.
Where this task is silent, the design still governs.

## Feed layout

The design's feed is a two-column masonry.
This task replaces it with one centred column, on the owner's direction.

## Scale

The design ships at its own fixed scale.
This task grows the whole authenticated app by a root factor of 1.14, on the owner's direction.

## The scale instrument versus "the token level"

The definition of done asks for the scale to be applied "at the token level".
It is applied with a root `zoom` instead.
The components express type and spacing as inline pixel literals, so there is no type or spacing token to multiply, and reaching every component through a token would mean editing every component, which the task forbids.
A root `zoom` is the only instrument that grows everything together with no component pinned, which is the actual intent of the token-level phrasing.

## Post caption size

The design sets the feed caption at 14 pixels.
This task grows it to 15, and a text post's caption to 17, before the root scale, because the owner said the caption text was hard to read and a wider column at the same size would only lengthen the lines.

## Dividers and card chrome

The design draws a card behind each post and a rule down each side of the centre column.
This task removes the card background, border, radius, and shadow, and both column rules, so the feed is one continuous surface, on the owner's direction.

## Motion

The design has almost no motion and no Escape handling.
This task adds a motion vocabulary across overlays, menus, the carousel, toasts, likes, content loading, and screen changes, and closes overlays on Escape, on the owner's direction to add more motion with restraint.

## Scrim strength

The design's overlay scrim is weak.
This task strengthens it so an open post holds attention, on the owner's direction.

## Trending grid

The design shows a populated trending grid.
This task shows a deliberate empty state instead, because the recommendation module that would rank it is still being built and fabricating a ranking is worse than an honest empty state.
This is the same position the design would take if it knew the data source was absent; it is recorded here because the rendered result differs from the design's populated grid.

## Report description limit

The design caps the report description at 500 characters and shows a 500 counter.
This task keeps the backend's real limit of 2000, so the counter reads out of 2000.
The counter's warning threshold is kept at the design's ninety percent ratio, which lands at 1800 rather than 450.

## Out-of-scope markers on settings

The design's settings section headers carry no note.
This task keeps the frontend's "coming soon" markers on the privacy and notifications sections, because the toggles there are not wired and the marker is an honest signal, which the task directs be kept.
