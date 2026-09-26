# Design Decisions

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

The decisions behind the report modal, its entry points, and the duplicate handling.

Each records what was chosen, why, and what was rejected.
Anything not specified by the design export is marked **derived**.

## Source of the design

The design export at `docs/design/Luvax.html` specifies the report modal.
Its source lives in the `lx-additions.js` chunk of the bundle and was extracted using the procedure
in `docs/design/README.md`.

The component is `window.ReportModal`, about 8,800 characters, and it specifies the three-step
structure, the reason list, and the copy.

## The modal

### One component for all three target types

The modal takes a target type and an identifier.
Nothing else about it varies by target.

This follows the design, which derives everything from a single `target` object, and it matches the
backend, where one endpoint serves all five target types.

Rejected: three separate modals per target type.
There is nothing type-specific beyond one noun, so three copies would have to be kept in step for
no benefit.

### The visible label for the target

The design derives the noun from the target type:

```js
target.entityType === 'comment' ? 'comment' : target.entityType === 'user' ? 'account' : 'post'
```

So the wording is "report post", "report comment", and "report account".
"account" for a user report is the design's word and is kept.

This is used in the step 1 heading, in the preview card's type label, and in the modal's
accessible name.

### The reason list

Rendered from the eight backend enum identifiers.
Each row shows the design's label and its one-line description.

Where the design's wording and the backend identifier differ, the design supplies the words on
screen and the backend supplies the value on the wire.
For example `hate_speech` is shown as "Hate speech", and `other` is shown as "Something else".

The design carries two label sets and both are reproduced, because it uses them in different
places: the longer `REPORT_REASONS[].label` in the step 1 list ("Nudity or sexual content"), and
the shorter `REASON_LABELS` on the step 2 chip ("Nudity").

Rejected: inventing labels, or sending the design's display text as the wire value.

### The description step

Optional, matching the backend, where `description` has no `@NotNull` and the OpenAPI required list
omits it.
The design agrees: its subtitle reads "optional" and it offers a "skip and submit without details"
control.

The client limit is the backend's 2000, not the design's 500.
See `report-contract.md` for that disagreement.

A blank description is omitted from the payload rather than sent as an empty string, so skipping the
step stores `null` rather than `""`. **Derived**; neither source specifies it.

### The confirmation step

The design's copy is kept:

> report submitted
> We'll review this content and take action if it violates our community guidelines.
> You won't be notified of the outcome. Misuse of reporting may result in account restrictions.

This was checked against the instruction not to promise an outcome, a timeline, or a notification
the product does not deliver.
It promises no timeline, and it states plainly that the reader will not be notified, which is
accurate: there is no notification type for report outcomes and no endpoint a regular user could
read one from.
The review claim is conditional rather than a guarantee, and a moderation workflow does exist in
the backend behind a role.

Rejected: rewriting copy the design already specifies.

### Cancelling and going back

Cancelling at any step submits nothing.
The request is only ever issued from an explicit submit control, so dismissing the modal cannot
send anything.

Going back from the details step to the reason step preserves both the chosen reason and any text
already typed, because both live in state that the back control does not clear.

Opening the modal on a different target resets it, keyed on the target type and identifier.
Without that reset a previous target's reason and text would still be present.
**Derived**; the design resets on `target` identity, which behaves the same way.

### Dismissal

By clicking the overlay, which is what `LxModal` and `LxBottomSheet` in this application already do,
and what the design's own modal does.

No new pattern was introduced.
No Escape-key handler was added, because no other modal in this application has one; adding it here
alone would make the report modal inconsistent with every other dialog.
Recorded in `deferred-findings.md` as an application-wide gap rather than fixed here.

### No way to view your own reports

Not built.
The backend exposes no endpoint a regular user could read, so there is nothing to show.

## Entry points

### Report a post

The post menu already existed in two places, and both now carry a working report action.

`PostCard`, used by the feed and explore, already listed a report item behind a `!isOwner` guard,
with `onClick: () => {}`. It was inert. It is now wired.

`PostDetailScreen`'s post menu had no report item at all; it listed only Like, Share, and Copy link.
One was added, guarded by `isSelf`, so the action is consistent between the feed and the detail
view. **Derived**, in the sense that the design places the action in the post menu and this is the
same menu on another surface.

### Report a comment

`PostDetailScreen`'s comment menu already listed a report item for other people's comments, inside
the existing `isOwn` branch, with `onClick: () => {}`. It was inert. It is now wired.

The item stays inside that branch, so it remains absent on the viewer's own comments, matching how
the like control was handled in the previous phase.

### Report an account

The profile screen had **no overflow menu at all**.
It carried only a follow button.

The brief anticipated that the report action would join a block action already living in that menu.
That is not the case here: the profile screen has no menu, and the block action lives in the post
menu (`PostCard`), not on the profile.
So there is no interaction between the two to resolve; the profile menu was created with the report
action as its only item.

A menu with a single item is the smallest thing that satisfies the requirement without inventing
capabilities. Block was deliberately not added to it, because blocking is named as out of scope for
this phase.

The button is rendered inside the existing `!isSelf` branch, so neither the menu nor the action can
appear on the viewer's own profile.

**Derived**: the button's appearance. The design was not measured for this control; it uses the
existing `more` icon and the existing border and ink tokens.

### Consistency

All three use the same label, "Report", the same `flag` icon, the same danger tone, and the same
position: last in an overflow menu.

## Duplicate handling

### Discovered on submission only

A regular user cannot read their own reports, so the control cannot be pre-disabled and the
duplicate is only discoverable when the request is made.

No client-side memory of submitted reports was added.
A reload would forget it, so the interface would contradict itself between sessions, which is worse
than handling the response.

### Treated as an ordinary outcome, not an error

A `409` moves the modal to its terminal step, styled as a neutral result rather than a failure:

> you already reported this
> This is already with our review team, so there is nothing more to send.
> A report covers the whole item, so it cannot be sent again under a different reason.

The reader did nothing wrong, so the copy does not suggest they did, and the terminal step gives
them a **Done** control rather than leaving them on a step whose button would keep failing.

**Derived** in full. The design has no error state of any kind.

### The wording is accurate to the backend rule

The second line is the part that had to be checked rather than assumed.

Because the uniqueness key excludes the reason, a second report of the same target fails whatever
reason is chosen. The copy therefore says so explicitly.

Wording it as "you already reported this for that reason" would have implied that another reason
would work, which is false. That was verified, not assumed: reporting a post for `spam` and then for
`scam` returned `409` both times.

### Other failures stay on the details step

A `404` or any unexpected failure shows an inline message on the details step, leaving the reader's
reason and text intact so they can retry or cancel.

Only the duplicate is terminal, because only the duplicate is a state that retrying cannot change.

The messages branch on the backend's `code` field, not on message text, because the axios error
normalizer rewrites `error.message` but leaves `code` untouched.
