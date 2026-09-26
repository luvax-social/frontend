# Verification Evidence

> Record of work done on 2026-08-15. Not maintained; it is correct as of that date and is not updated as the code moves.

How the work was checked, screen by screen and capability by capability, and a plain statement of what was not verified.

## Environment

Both applications ran throughout.
The backend ran under docker compose for Postgres, Redis, RabbitMQ, Mailpit, and Elasticsearch, with the Spring Boot application on port 8080.
The frontend ran on the Vite dev server on port 5173.
The database was seeded with five accounts, nine posts across image, carousel, text, and video, a follow graph including one pending request to a private account, and real likes, comments, and saves that generated real notifications through the event pipeline.
Media was uploaded through the real Cloudflare R2 pre-signed flow, not faked.

## Widths

- Phone: 390 pixels.
- Tablet: 820 pixels.
- Desktop: 1440 pixels.

These sit inside the app's own breakpoints of mobile below 768, tablet from 768, and desktop from 1200.

## Screenshots

Before and after images are under `screenshots/before` and `screenshots/after`.
Interaction evidence that is not a plain screen, such as the two-pane detail, the stronger scrim, the block confirm, the report completion, and the explore empty states, is under `screenshots/evidence`.
The frozen auth page at all three widths is under `screenshots/after` as `frozen-auth-*`.

A note on the feed full-page captures: a closed bottom sheet, the post edit sheet, stays mounted and is re-rendered mid-page by the full-page screenshot tool, so it appears as a stray "edit post" block in some full-page feed images.
It is not visible to a user and not present in the viewport captures.
The motion work did not change this, because the sheet is intentionally kept mounted so it can animate.

## Section 12 regression, item by item

| Capability | Result |
|-----------|--------|
| Search | Verified. Posts and people return for a query; the people list is no longer capped at one; Enter commits the query to the address; the tags tab is present. The follow state is correct including pending: the private account read "requested". |
| Saved posts | Verified. Three saved posts listed; unsaving one dropped the list to two with no reload. |
| Profile tabs | Verified. Three tabs, each firing its own request; "liked" returned the two posts the viewer liked and is shown only on the viewer's own profile. |
| Block loop | Partially verified. The block confirm dialog opened from a post menu with the exact wording and the armed destructive button; the full block-through-unblock loop was not run to preserve the seeded feed for later checks. |
| Private accounts | Partially verified. The pending "requested" state was confirmed against the private account in search. The private profile treatment and placeholder counts were not separately opened. |
| Follow requests | Not exercised. The seeded pending request is outgoing from the viewer to a private account, so the viewer had no incoming request to approve or reject. |
| Realtime | Not exercised in the browser. It needs two independent sessions to observe a remote comment or like arriving, which this single-session pass did not set up. |
| Like state | Verified for the two-rendering case. A seeded like showed as liked in both the feed card and the post detail at once, which is the defect the earlier phase describes. The remote-like reconciliation was not exercised, as it needs the realtime channel above. |
| Carousel | Verified. The counter, the arrows, and keyboard left and right all work; confirmed in the two-pane detail, where arrow keys moved 1/2 to 2/2 and back. |
| Media | Partially verified. Video renders in the feed and in the grid; the ratio cap and the reserved box are in place. A cropped portrait was not exercised because the seed media is landscape; the broken-media fallback was not forced. |
| Composer | Verified. No type tabs; the constraints come from the server; a carousel of three files created during seeding rendered in the composer's order. |
| Confirm dialog | Verified. The arming delay leaves the destructive button muted on open; the block wording is intact and unchanged. |
| Escape | Verified. The post detail overlay now closes on Escape, which it did not before; the modal and sheet primitives already carried the shared hook. |
| Video pause | Not exercised by scrolling. The IntersectionObserver that pauses an off-screen video is present and unchanged in `PostMedia`. |

## Console

No React render error appeared on any surface opened during this pass: feed, explore, notifications, profile, settings, saved, composer, post detail in both layouts, the report flow, and the block confirm.

## Frozen pages

Confirmed at all three widths that the landing and login route carries no root `zoom` and no `--lx-scale`, so the scale did not reach it.
The page renders as the design draws it.
Neither the auth pages nor the landing page was edited.

## What was not verified

Stated plainly, so the evidence is not misread.

- The full block-through-unblock loop.
- The incoming follow-request approve and reject path.
- The realtime channel, a remote comment arriving, and the remote-like count reconciliation, all of which need a second session.
- A cropped portrait in the feed, since the seed media is landscape.
- The broken-media fallback, which was not forced.
- Video pausing on scroll, checked in code rather than by scrolling.
- Mobile and tablet interaction beyond layout: the phone and tablet passes captured layout at 390 and 820 but did not repeat every interaction check at those widths.
