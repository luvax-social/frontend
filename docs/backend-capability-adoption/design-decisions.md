# Design Decisions

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Decisions taken in this phase, the reasoning, and what was rejected.

Every derived visual treatment is recorded here, since the design export defines none of them.

## 1. An already-reported item states a fact rather than disabling a control

**Decision**

Where `hasReported` is true, the actionable row is replaced by a non-interactive row reading "Reported".

**Reasoning**

The project has already settled that a control which looks interactive and always fails is unacceptable.

A disabled control is also wrong here, but for a different reason: disabling says "not now", which is a claim about a future state that has to be reachable. A report does not reverse. There is no later moment at which the control becomes usable, so promising one would be a lie told by the interface.

What is left is a statement of fact. The viewer reported this; that is the whole of it.

**Rejected**

- *Leave the control actionable and let the duplicate error explain.* This is the behaviour being replaced. It spends four interactions to deliver information the item already carried.
- *Disable the control.* Claims a future state that never arrives.
- *Remove the row entirely.* Loses the information. A viewer who reported something and sees no trace of it cannot tell whether the report registered, and would reasonably try again.

**Derived treatment**

The row keeps the flag icon and the menu's row layout, and takes the muted `ink3` foreground already used for secondary text, with the danger tone dropped. Cursor is `default` rather than `pointer`.

That combination is what the rest of the interface already uses to mean "text, not a target", so nothing new was invented.

The row is rendered as a `div` rather than a disabled `button`, so assistive technology is not offered a control at all.

## 2. The duplicate error stays, and both paths refresh the item

**Decision**

The duplicate handling is untouched. The submit mutation refetches the reported item on success and also on a duplicate rejection.

**Reasoning**

The up-front state can be stale: a second tab, or another device, can report the same item after this page loaded. The duplicate error is the backstop for exactly that race, so removing it would trade a rare wrong-looking control for a rare dead end.

Refreshing on the duplicate answer is what makes the two agree. A duplicate means the server holds a report and the cached copy is the one that is wrong, so the fix is to refetch, not to special-case the UI.

## 3. The edited marker reads only `editedAt`

**Decision**

The marker is driven by `editedAt` alone. `updatedAt` is not consulted.

**Reasoning**

`updatedAt` moves when a comment is liked or replied to. Verified directly: a like moved `updatedAt` while `editedAt` stayed null. Using it would mark comments as edited that never were.

**Derived treatment**

The marker is the lowercase word "edited", placed in the existing meta row beside the timestamp, inheriting that row's mono font, 10px size and `ink3` colour. It carries a `title` of "this comment was edited".

The design export defines no edited state, so this is derived: it introduces no new colour, size or weight, and reuses the row that already carries a comment's secondary facts.

**Rejected**

- *A separate badge or pill.* Would need a colour and a shape the design export does not define, for a fact that is minor.
- *Appending "(edited)" to the body text.* Puts interface text inside user content, where it could be imitated by a comment that literally ends in "(edited)".

## 4. Deletion still refetches, and the count is not used to patch counters

**Decision**

The affected lists are still invalidated and refetched after a delete. The authoritative count is used only to drop the deleted subtree's own replies cache entry.

**Reasoning**

This was called out for a decision, so the reasoning is stated in full.

Knowing *how many* rows went does not tell you *which* rows went. The descendants are spread across nested `commentReplies` entries the client never enumerated, so there is nothing to remove them by. A count cannot be turned into a set.

Patching the post's comment count by subtracting the number would also mean maintaining a denormalised counter on the client. The workspace rules reserve those counters to database triggers and require the frontend to display counter values from API responses only. Doing the subtraction would break that rule to save one request.

So the count does not change the cache strategy. What it does change is the message shown before the user commits, which is where the real problem was.

The one place it earns its keep after the fact is the deleted comment's own replies entry: when the count is greater than one, that subtree existed and its cache entry is now unfetchable, so it is removed rather than left to expire.

**Rejected**

- *Patch the lists using the count.* Not possible without the ids, as above.
- *Adjust `post.commentCount` by the count.* Forbidden by the counter policy, and wrong the moment anything else changed the count concurrently.

## 5. The estimate has a deadline, and the deadline is about waiting only

**Decision**

The dialogue waits at most 1500 ms for the estimate. The deadline is armed only while the request is outstanding. Once an answer arrives it stays, and once the deadline passes the unnumbered wording stays for the life of the dialogue.

**Reasoning**

Two failure modes had to be avoided and they pull in opposite directions.

The dialogue must not block on a number it does not need, so there is a deadline and a wording that works without one.

The wording must also not change while someone is reading it and deciding. Swapping "its reply" for "removes 11 comments" under the cursor, after the reader has already started moving toward a button, is worse than either wording alone.

Latching in both directions is what satisfies both. The first version armed the deadline unconditionally, which discarded an estimate that had arrived instantly; that was a defect and is recorded as such in `changes-applied.md`.

**Rejected**

- *Spinner until the estimate resolves.* Blocks a confirmation dialogue on a nicety.
- *Show the number whenever it arrives, however late.* Changes the text under the reader.
- *No deadline at all.* Leaves the dialogue at the mercy of a slow or hanging request.

## 6. The password rules live in the shared field, not a registration-only one

**Decision**

The six rules went into the shared `passwordField`, which is used by registration and both password-reset schemas. The login schema is untouched.

**Reasoning**

The instruction named the registration form, so the shared field was only the right home if the server enforces the same policy on the other two.

It does: `POST /auth/reset-password` answers `VALIDATION_ERROR` for a policy-violating new password and only reaches the token check once the password is compliant. Verified before making the change.

Login is deliberately excluded. Existing accounts predate the policy and their passwords remain valid, so validating the login field against the policy would lock out exactly the users the grandfathering protects.

## 7. The client mirrors the server's rule order, one message at a time

**Decision**

The rules are evaluated in the server's order inside a single refinement that reports at most one message.

**Reasoning**

The server's validator returns the first failure and the exception handler keys field errors by field name, so a second violation on the same field would replace the first. The client naming a different rule than the server would for the same value is a contradiction the user has no way to resolve.

The lengths are counted in code points, and the byte ceiling is measured on the UTF-8 encoding, because that is what the server measures. Zod's own `min` and `max` count UTF-16 units and would disagree on astral characters.

**Rejected**

- *Chained Zod validators.* Cannot express the code-point and byte rules faithfully, and accumulate issues rather than stopping at the first.
- *Restating the policy in the placeholder or a hint.* A layout change, and the visual freeze applies.

## 8. Server field errors are shown against the field, not in the banner

**Decision**

A rejected registration places each `errors` entry beside the field it names. The banner is used only when the failure is not field-level.

**Reasoning**

The specific rule is what the user needs, and the field is where they will look for it. The generic envelope message says only that validation failed.

The message lands in the existing per-field error slot, so no layout, spacing or structure changed, which the visual freeze on the auth slice requires.

## 9. Every media failure is retryable, and the file is kept

**Decision**

All new rejection cases map to specific copy that invites a retry, and the composer keeps the selected file when an upload fails.

**Reasoning**

None of these outcomes is permanent. A missing object, a size disagreement and unreachable storage are all resolved by sending the file again. Presenting them as fatal would be false, and clearing the selection would make the user find the file again to act on advice the interface just gave them.

The messages distinguish the cases because the right next step differs: a failed transfer means retry as-is, whereas an unreadable file means choose another.

**Derived treatment**

None. The messages reuse the composer's existing error line, unchanged in placement and styling.

## 10. Verification that would have written to shared infrastructure was raised first

**Decision**

The media failure path was exercised with the direct upload stubbed to report success without transferring anything, which triggers the server's new "object is not there" check while writing nothing.

The successful path was run only after confirming it was wanted, since it writes a real object into a real bucket.

**Reasoning**

The failure path is what this phase changed, and it was reachable without any external side effect, so it was done first and unconditionally.

The successful path cannot be verified without a real write. That is an outward-facing action, so it was raised rather than assumed. It was approved, and the upload went to the `luvax-develop` bucket.

It is worth having done: it is the first time in this project that a post's media has actually resolved, where the seed data's asset has always 404ed.
