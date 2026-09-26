# Layout Decisions

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

Every layout value chosen in this task, and the reasoning for each.

## Content width

The feed is one centred column with a base width of 412 pixels.
The root scale multiplies it, so the rendered column reads at roughly 470 pixels, which is the photo-first target the owner asked for.
The value is expressed before the scale so it moves with the scale rather than being pinned against it.
The column is centred inside the main region and the space on either side is expected, not a defect.

## Spacing ratio

Posts are separated by spacing alone, with no divider, no card, and no border.
The gap between one post and the next is 56 pixels on a wide viewport and 44 pixels on a phone.
The gaps inside a post, between the media, the author line, the caption, and the actions, sit between 10 and 12 pixels.
The ratio between the between-post gap and the largest within-post gap is therefore about 5 to 1.
The eye reads a post as one group because the gap around it is clearly larger than any gap inside it, which is what lets the divider go without the posts running together.

## Media height cap

Media is capped by aspect ratio, never by a fixed pixel height, and is never cropped.
The frame keeps the media's own ratio but clamps it to a minimum width-to-height ratio of 0.8, so the box never grows taller than five to four.
A taller portrait is not cropped to fit.
It is contained inside the clamped box and letterboxes against the page, which on the flat feed reads as breathing room rather than a boxed frame.
A pixel cap was rejected because stage 2 established that a fixed pixel cap is the wrong instrument and that cropping is not acceptable.

## Post detail breakpoint

The post detail uses two panes only for a media post on a desktop viewport, which is 1200 pixels and wider.
A text post is a single column at every width.
A media post on a tablet or a phone stacks, with the media inline above the comments in one scrolling column.
The breakpoint is the existing desktop viewport boundary rather than a new one, so the post detail agrees with the rest of the app about what counts as wide.
In two panes the media pane holds the left side and stays put while the comment pane on the right scrolls, which also resolves the earlier defect where the media sat inside the scrolling comment column and scrolled away.

## Grid column counts

The feed is the only surface that became one column.
The profile grid, the explore results, the saved grid, and the search results are grids and stay grids.
The profile and saved grids keep three columns; the explore and saved grids keep three on desktop and two below.
Re-checked at the new scale, the tiles read at a comfortable size and no column count needed to change.

## Card chrome removal

The desktop and tablet shells previously drew a left and right border around the centre column and each post sat on a raised card with its own background, radius, and shadow.
All of that is removed.
The centre column has no rules, the posts have no card, and the feed is one continuous surface on the page background.
The photo in a post keeps a rounded frame on a wide viewport and runs edge to edge on a phone, which is the only chrome that remains and belongs to the media rather than to a card.
