# What Changed, For Someone Who Knew The Previous Panel

> Record of work done on 2026-08-22. Not maintained; it is correct as of that date and is not updated as the code moves.

If you used the panel before this phase, this is what is different. Everything here exists because
the backend gained a capability the panel had been working around.

---

## A reported story or message can now be taken down

Before, a story or message report was read-only and the screen said so: *a {type} cannot be taken
down from this panel.* That sentence is gone, because it is no longer true.

Story and message targets now carry **remove** and **restore**, behind the same reason-carrying
confirmation as posts and comments, and available to moderators as well as administrators.

**Two of these restores cannot promise what a post restore promises, and both say so before you
confirm:**

- **A story restore lifts the removal and nothing else.** If the story has already passed its expiry
  it stays out of every feed regardless, and restoring does not extend its lifetime. The panel cannot
  tell you whether *this particular* story has expired — the payload carries no expiry — so it tells
  you the rule instead of guessing.
- **A message restore lifts moderation's removal only.** If the sender had also deleted the message,
  it stays hidden for both participants: those are two separate deletions and moderation only undoes
  its own.

Removing a message withholds its text, media, and any shared post or story **from both
participants**. Your own view of the target still shows the text, marked removed — that is
deliberate, so you can still see what you acted on.

---

## Names resolve in one request instead of one per person

Nothing looks different. Every screen that showed a resolved username still shows one.

Underneath, the panel used to fetch each account id separately — a page of twenty audit rows
referencing five people cost five requests. It now resolves up to a hundred ids in a single call. The
same page costs **one**.

An id the server does not recognise still renders as a shortened id, and is asked for exactly once
rather than retried.

---

## "My escalations" is a screen now

Escalating a report used to be where your view of it ended: it leaves your queue, and a closed report
answers not-found to a moderator. The workaround was to hunt through your own action log for the
report id.

**Moderation → my escalations** lists the reports you escalated **and what became of them**. A report
an administrator has since resolved or dismissed still appears, with the status it ended in. That is
the point of the screen, not an oversight.

Administrators have it too: it shows *your own* escalations, which is a different and smaller list
than the escalated queue.

Consequently, an `escalate_report` row in the action drawer no longer links to its report — it points
you here, where you also get the outcome. Other action types still link.

---

## Sessions end one at a time

The session list has an **end** column. Ending one session leaves every other session on the account
signed in; the account-wide action is still there, still named for what it does.

**Your own session is marked.** One row carries a `THIS SESSION` badge. This is correlated through a
dedicated endpoint, not guessed — and where the server cannot determine it, no row is marked and the
list says so rather than letting you read the absence as "none of these is mine".

Ending your own session says plainly that it signs you out immediately. A double click is safe. A
revoked session cannot be un-revoked; signing in again is the recovery path.

---

## The warning dialogue tells you where the account stands

It used to state a rule: *three active warnings issue a strike.* It now states **this account's
number**, and when the warning you are about to issue is the third, what that actually does:

> this account has 2 active warnings. this one will be the third, which issues a strike
> automatically and resets the count to zero. a strike suspends the account — seven days for a first
> strike, thirty for a second — and a third strike bans it outright.

As a moderator you cannot read the count at all — that read is administrator-only — and the dialogue
says so instead of showing a number it does not have.

---

## Revoked warnings and strikes can be seen again

The violations list has an **include revoked records** checkbox, off by default. Turning it on brings
back revoked records, each marked `REVOKED` with who revoked it and when.

Toggling restarts the list from the first page. That is deliberate: the two listings use different
pagination cursors and the server rejects one used against the other.

---

## The action log filters by target and by time window

Alongside the action-type and actor filters there are now a **target** picker and a **from / to**
window, and they compose. Every filter lives in the URL, so a filtered view is a link you can share.

The window is half-open: **from is included, to is not**, and the control says so. Setting an exact
end time and not finding the row that sits on it is correct, not a missing record.

These narrow what you can already see; they do not widen it. As a moderator, filtering by an account
another administrator acted on returns nothing rather than that administrator's rows.

---

## Suspension can have no end date

The suspend form offers **for a set number of days** or **indefinitely**. An indefinite suspension
has no end date, never lifts on its own, and lasts until an administrator lifts it by hand.

An indefinitely suspended account reads as *suspended indefinitely — there is no end date, and it
lasts until an administrator lifts it*, never as unsuspended.

---

## A restored post tells you about the post, not about the action

The message after restoring a post changed, because the field behind it changed meaning:

> post restored. its caption still carries banned hashtags: #tag, #other

This describes the post's **present state**. Restore the same post twice and you will see the same
names twice — that is correct. It used to read "dropped: #tag", which would have described an event
that did not happen the second time.

The action drawer labels the same data *banned hashtags still in the caption*.

---

## Post rows show their media

An account's post rows now render their attached images. Comment rows do not, because comments have
no media in this schema.

---

## The activity log's filter depends on where you are

In a **development** build the event-type filter offers seven types. In a **production** build it
offers three.

This is not a bug. Four engagement types — post like, save, view, comment — are written by a service
that runs in the local stack and in no production deployment. Offering them where they can never
match would leave you concluding the log is broken. The unfiltered list still shows whatever type a
row carries.

---

## Smaller things

- The statistics screen already enforced the one-year window limit and the separate thirty-day
  fine-bucket horizon; both were re-checked against the server and are correct. A combination the
  server would refuse still cannot be selected.
- A date-range preset button no longer leaves a stale "enter both a start and an end" message behind
  it — it was submitting the form as well as applying the preset.
- The user-facing settings page loads again for seeded accounts. That was a backend defect and it is
  fixed.
