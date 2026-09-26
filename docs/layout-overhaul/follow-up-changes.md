# Follow-up Changes

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

A second round of changes the owner asked for after reviewing the layout overhaul.
Recorded here so the decisions, and the reasons behind them, are on the record.

## What the owner asked for, and what was done

### Story rail restored

The owner asked for the story section back at the top of the feed, like Instagram.

For the record: the story rail was not removed by the layout overhaul.
It was removed in an earlier phase as fabricated data, which left the frontend with no stories data layer at all.
The overhaul only deleted a dead reference to that already-removed component.

On the owner's direction, the story rail and the story viewer were restored from the pre-removal version in git history and grafted onto the current feed.
They are interface only, running on presentation data, with no live data wiring, which is the state the owner asked for.
A pre-existing render bug in the restored viewer, where navigation ran inside a state updater, was fixed while restoring it.

This reverses the earlier project stance of removing fabricated data, on the owner's explicit direction.

### Messaging restored

The owner asked for the messaging section back, unchanged in its interface.

Messaging was in the same state as stories: the carefully-built interface had been removed as fabricated data, leaving a notice and a disabled tab.
On the owner's direction, the messages screen and its sample threads were restored from git history and the navigation tab was re-enabled.
The message panel components were never removed, so the restored screen runs on them directly.
It is interface only, with no live data wiring, as asked.

### Post popup follows a portrait's aspect ratio

For a portrait image, taller than wide, the popup now takes the image's own aspect ratio so the media fills it rather than sitting in a wide dark pane.
For a landscape image, the roomier frame is kept and the media's border hugs the image at its height.

### The comment field shows the viewer's avatar

The blank default avatar in the comment input is now the current user's avatar.

### The options menu no longer drifts

The three-dot menu on a post or comment was landing away from its button.
The cause was the layout overhaul's root scale: it uses a CSS zoom, and a fixed-position element inside a zoomed subtree has its offsets multiplied by the zoom a second time.
The menu now compensates for the zoom when it positions itself, so it lands on its anchor at any scale, and behaves normally when there is no scale.

### The pointer cursor signals clickable elements

The owner first asked to remove the pointer cursor, then corrected that: clickable elements should show the hand cursor as an affordance.
A single rule now gives buttons, links and role-based controls the pointer cursor, while disabled controls keep the default arrow.

### The navigation bar stays visible, and the duplicate bell is gone

The header search opened a separate search page that dropped the navigation bar.
The header search now opens the explore search, which keeps the bar, so there is one search experience rather than two.
The bar also now stays visible on the list and results subpages, leaving only the settings-area pages and messaging with their own chrome.
The notification bell that sat next to the profile avatar was removed on wide viewports, where it duplicated the navigation's own activity tab beside it.

### Nested comments

Several problems were addressed.

A single reply sometimes registered as two.
The root cause was the live update channel: the broadcast echo of the viewer's own reply was applied to the cache on top of the create mutation's own refetch, counting the same reply twice.
A self-authored comment broadcast is now skipped, since the viewer's own create already updates the cache.
Verified in the browser: one reply now moves the count by exactly one.

Replies were a diagonal staircase that could nest without limit.
They are now two levels, like Instagram: a reply to a reply attaches to the same thread root and stays at one level, marked by a single vertical line rather than a staircase.

Replying to a reply now prepends an editable @mention of the person answered.
The backend already parses @mentions and sends a mention notification, and a reply already notifies the thread's author, so the person answered is notified without any backend change.

## Backend was not touched

No backend file was created, modified, or deleted in this round.
The reply notification and mention parsing were used as the backend already implements them.
