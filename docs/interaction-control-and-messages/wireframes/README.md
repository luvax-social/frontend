# Interaction control and direct messages - wireframes

Desktop wireframes at 1440 by 900 for the phase 1 interaction control and direct message features.
Open `index.html` in a browser for the annotated set, or read the rendered frames in `png/`.

Colours, typography, radii and shadows are the live tokens from `src/index.css`, and copy follows the casing rules in `DESIGN.md`.
Square and round outlines stand in for `LxIcon` glyphs; gold-tinted callouts and the "new" tags in menus are annotations, not interface.
Emoji appear only as reactions people chose, which is user content rather than product copy.

| Frame | Surface | Kind | Requirements |
|---|---|---|---|
| 01 | Post menu additions and the inline undo row | Modified menu, new row | P1-A2-R1, P1-A2-R3, P1-A2-R5 |
| 02 | Mute dialog with posts and stories toggles | New | P1-A2-R5 |
| 03 | Settings, muted accounts | New | P1-A2-R7 |
| 04 | Settings, hidden words | New | P1-D1-R3, P1-D1-R4, P1-D1-R5 |
| 05 | Settings, limit interactions, form and active state | New | P1-D5-R2, P1-D5-R3, P1-D5-R4 |
| 06 | Settings, privacy, who can message you | Modified, layout changes | P1-B2-R1 |
| 07 | Post detail, hidden comments review for the owner | New | P1-D1-R6, P1-D1-R7, P1-D5-R4 |
| 08 | Messages, primary and requests tabs, hidden requests folder, reaction preview | Modified, layout changes | P1-B2-R6, P1-B2-R7, P1-B1-R4 |
| 09 | Request thread, recipient decision bar and delete confirmation | New | P1-B2-R4, P1-B2-R5 |
| 10 | Pending thread, sender view | New | P1-B2-R4, P1-B2-R5 |
| 11 | Reactions, reaction picker and server reply quotes | New | P1-B1-R1, P1-B1-R2, P1-B1-R5 |
| 12 | Admin, system hidden words registry | New | P1-D1-R1 |
| 13 | Admin, reported message reaction | New | Rule 7 for P1-B1 |

## Decisions the wireframes encode

A dismissed post collapses in place into an undo row, so content below never jumps while the person is reading.
"Show fewer" is offered on for you and explore only, because following is unaffected by it.
Muting is two independent toggles in one dialog, and turning both off is the unmute, so there is no separate state to keep in sync.
The hidden words field previews the normalised form it will match, so accent, case and number-swapped spellings are understood before saving.
Limit interactions names every effect it has, and its active state shows the end time in the viewer's local time with an early off.
"Who can message you" says where messages land for each option, and "no one" states that mutual followers can still message.
Hidden comments are reviewed in the post detail side column, keeping the media in view, with the reason each was hidden.
Requests have their own tab and count, the hidden folder carries no count, and neither adds to the main messages badge.
The recipient decides through an explicit accept, delete or block bar, and deleting states that the sender is not told.
The sender's pending view is identical whether the request is pending or was deleted, and shows no read state.
Reactions use a six-option picker with an any-emoji fallback, the caller's current reaction is highlighted, and tombstoned messages show neither chip nor picker.
Reply quotes render from the server preview, and an unavailable parent shows "message unavailable".
Both admin screens reuse the existing registry and report detail patterns, and every write asks for a reason because it writes an audit row.
