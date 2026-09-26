# Deferred Findings

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and not acted on, with where it belongs.

## The ConfirmModal titles are lower case

The design's confirmation dialogue uses a sentence-case heading, such as "Unfollow @name?", with lowercase buttons.
The frontend's `ConfirmModal` titles are lower case: "block user", "delete post", "delete comment".
This was left unchanged.
The copy task named the two categories to fix, the empty states and the overflow menu, and did not list the confirm titles, and an earlier phase deliberately preserved the block dialogue wording unchanged.
Changing the titles was judged out of the stated scope and against the instruction to keep the block wording intact.

**Belongs to:** a copy pass that is explicitly scoped to include dialogue titles.

## Realtime was not exercised

The frontend has a realtime client from the reconciliation, but this pass ran a single session, so a remote comment arriving and the remote-like count reconciliation were not observed.

**Belongs to:** a verification pass with two independent sessions.

## The media pane leaves large margins for landscape media

In the two-pane post detail, a landscape image sits centred in a full-height dark pane, so there is generous empty space above and below it.
This is the "media stays put" ground and is not a crop, but the empty area is sizable for wide media.
It was left as is because narrowing the pane to the media's height would reintroduce a per-shape resize, which the no-crop rule exists to avoid.

**Belongs to:** a later refinement of the two-pane geometry if the empty ground reads as too much.

## The feed full-page screenshot artifact

The post edit bottom sheet stays mounted when closed so it can animate, and the full-page screenshot tool re-renders it mid-page.
It is invisible to a user.
No change was made, because unmounting the sheet to satisfy a screenshot tool would remove its exit animation.

**Belongs to:** nothing; recorded so the images are not misread.

## Carried forward from earlier phases, still true

- The `photos` profile filter includes a carousel that mixes in a video, because the type is a property of the post rather than of its items.
- The story composer still hardcodes a duration limit rather than reading it from the server.
- Messages, stories, and onboarding remain out of scope and unbuilt.
- No poster frame is produced for video, and no blurhash is rendered.
