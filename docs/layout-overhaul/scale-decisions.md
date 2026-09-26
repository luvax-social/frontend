# Scale Decisions

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

How the scale was changed at the root, what the new values are, and what it did to the frozen pages.

## The instrument

The scale is a single root value applied as CSS `zoom` on the document element, driven by `--lx-scale` and set to 1.14.
It is set when the authenticated app mounts and cleared when it unmounts, so it is scoped to the app and never reaches the auth or landing routes.

## Why zoom rather than a token multiplier

The task asked for the scale to be changed at the root, not per component, so that everything grows together with its proportions intact and nothing is pinned to a hand-tuned value.
The luvax screens express type and spacing as inline pixel literals in JavaScript, and only colour is read from CSS custom properties.
There is therefore no type or spacing token a component reads, so multiplying a token would change nothing, and the only way to reach every component through a token would be to edit every component, which the task forbids.
A single root `zoom` is the one instrument that grows body text, captions, navigation, the logo, hashtags, story avatars, buttons, and the spacing between all of them in one place, keeping every existing proportion, with no component pinned to compensate.
This is a deliberate divergence from the definition of done's phrase "at the token level" and is recorded in `design-divergences.md`.

## What grows, and by how much

Everything inside the app grows by the same factor, 1.14.
Body text, post captions, the navigation, the logo, hashtags, avatars, buttons, and every gap and padding scale together.
Post captions grow one step further on top of the root scale: the feed caption moved from 14 to 15 pixels and a text post's caption from 16 to 17 pixels before the root scale is applied.
The owner said the caption text was hard to read, and a wider column at the same size would only lengthen the lines, so the caption gets a size increase of its own in addition to the root growth.

## The frozen pages

The auth pages and the landing page were not edited.
The root scale is scoped to the authenticated app by the mount and unmount of that subtree, so it is cleared before either frozen route renders.
Confirmed in the browser at all three widths: on the landing and login route the root has no `zoom` and no `--lx-scale`, and the page renders exactly as the design draws it.
The scale change therefore reaches the frozen pages through no shared token and does not alter them.
Nothing about them broke, so nothing had to be compensated for and nothing was edited.
