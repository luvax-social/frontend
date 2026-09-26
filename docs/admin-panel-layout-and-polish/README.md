# What changed, for someone who knew the previous panel

> Record of work done on 2026-08-24. Not maintained; it is correct as of that date and is not updated as the code moves.

The panel does the same things it did before. It does not look the same doing
them, and one screen no longer makes you go back and forth.

## You can get into it now

There is a `panel` entry in the side rail, directly above `settings`, if your
account is a moderator or an administrator. Ordinary accounts do not see it.
There is a `back to luvax` control in the panel header, so it is not a one-way
door any more.

## Reports and accounts are now two panes

On **reports** and **accounts**, the list stays on the left and the record you
open fills the right. Clicking another row swaps the right pane; you do not go
back to the list first, and the list does not reload or lose your place.

- The open record still has its own URL — it is now `?selected=<id>` on the list
  screen. Paste it anywhere and you get the same view.
- **The old URLs still work.** `/admin/reports/<id>` and `/admin/users/<id>` open
  exactly as they always did, full width, with their back links. Nothing you have
  bookmarked has broken.
- Back walks from record to record, then to the bare list. It does not throw you
  out of the panel.
- With nothing open, the right pane tells you what it is for instead of sitting
  blank.
- On a phone it is not two panes: the list is the screen, and opening a record
  gives you a full-width record with a way back.

The other screens — escalated, my escalations, actions, hashtags, statistics,
activity — keep their single column. They now use the whole window rather than
stopping short of it. Why each did or did not take the split is in
`design-decisions.md`.

## The window is no longer half empty

The content column was capped at 1120px. It is not any more.

## Dark mode actually works

This is the big one. If you ever chose dark and found the panel stubbornly light,
that was not you. A stored choice was being read wrong, so **every** manual theme
choice resolved to light — the application flashed the wrong theme on load and
corrected itself, and the panel, which has nothing to correct it, just stayed
light forever.

Fixed at the source. There is now a theme control in the panel header too, your
choice survives a reload with no flash, and your system preference is still the
default until you pick something.

## You can read the small text

Every muted label — column headers, field labels, the section headings in the
rail, timezone suffixes — was on a grey that measured between 2.8 and 3.7 against
its background, where 4.5 is the bar. They are all on the readable ink now, and
the 10px ones are 11px. Nothing in the panel fails the bar in either theme any
more; the numbers are in `contrast-audit.md`.

Status badges changed shape slightly as part of this: the colour moved into the
fill and a border, and the word itself is now dark. Pale amber on pale amber was
the worst offender at 2.85.

## The controls match each other

The dropdown on the action log and the date fields were rectangles sitting next
to pill-shaped buttons, and the dropdown lost its focus outline entirely when you
tabbed to it. Every select, date field and button in the panel now shares one
shape, one focus ring and one disabled treatment.

## Filters are separated

The filter conditions used to run together as one strip of chips, easy to misread
and easy to misclick. Each condition now sits in its own labelled box. On a
narrow screen they stack and wrap — previously the last few options were clipped
out of reach entirely.

## Images open

Thumbnails on a report and on an account's content are clickable now. They open
into a full viewer with arrows across that record's media, exactly like the post
viewer in the app: Escape closes it, arrow keys move, and focus goes back to the
thumbnail you came from.

## What did not change

No request. Not one — same URLs, same parameters, same timing. Nothing new was
added that you can do, no endpoint, no filter, no action. The only control that
behaves differently is a list row on reports and accounts, which now selects in
place instead of navigating away, which is the entire point.
