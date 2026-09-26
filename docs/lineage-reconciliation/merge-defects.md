# Merge Defects

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Defects the merge itself introduced, and how they were fixed.

## None found at runtime

Every capability listed in section 7.1 of the task, and every interaction in section 7.2, was exercised after the merge and behaved correctly.
The two interactions most likely to have broken each other were confirmed working:

- The realtime post-like broadcast against the optimistic like update.
  The viewer's own like is not double-counted and a remote like still moves the count.
  This was the resolution that combined B's optimistic patch with A's in-flight guard, and it holds at runtime.
- Live comment events arriving into the comment list that carries its own creation, editing, deletion and pinned block.
  A live comment lands at the bottom, and the pinned block does not reorder.

No defect attributable to the merge was found, so nothing was fixed under this heading.

## Resolution-time correction, not a runtime defect

During the resolution of `ProfileScreen.jsx` the auto-merge left the file internally inconsistent in two places, which would have been defects had they been committed unexamined.
They were corrected as part of the resolution, before the build, and are recorded here because they are the kind of thing the merge produced rather than something either branch shipped:

- The auto-merge kept both B's `profileMenuItems` array and A's `menuItems` array, and referenced `setReportTarget` while A's state did not declare `reportTarget`.
  Resolved by folding the two menus into one that carries A's block loop and B's real report, and by carrying the `reportTarget` state and the `ReportModal` over.
  Confirmed at runtime: the profile overflow menu offers both block and report.
- The auto-merge left A's background-cover grid in the file, which loses B's media conformance on the profile grid.
  Resolved by porting B's `MediaThumb` grid onto A's screen.
  Confirmed at runtime: the profile grid shows video as video, carousels with a count, and text as a caption tile.

Both were resolved before any build or verification, so neither reached a committed, running state as a defect.
The full reasoning is in `conflict-resolutions.md`.
