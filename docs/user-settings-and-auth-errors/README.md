# What changed, for someone who knew the previous settings screen

> Record of work done on 2026-08-25. Not maintained; it is correct as of that date and is not updated as the code moves.

## The list

Each entry is an icon and a name, with a search field above them. The one you have open sits
on a slightly lighter fill with its name in a heavier weight; hovering lifts a row a little
less. What a setting is for is written at the top of the setting itself, not under its name in
the list.

The list begins immediately beside the navigation rail, so hovering the rail expands it over
the list rather than over what you are reading or typing.

## The screen you remember

One long scrolling list at `/app/settings`, in five labelled sections. Four of its rows were
not settings at all but doors: `edit profile`, `change password`, `saved` and `blocked users`
each replaced the whole screen with another one, and getting back meant the back button. To
compare two settings you opened one, read it, went back, and opened the other.

## The screen now

The list of groups stays on screen. Choosing a category swaps only the region beside it.

```
how you use luvax          │
  profile                  │   ← the chosen category fills this region
  notifications            │
  saved posts              │
                           │
who can see your content   │
  privacy                  │
  follow requests          │
  blocked accounts         │
                           │
your account               │
  account                  │
```

Nothing replaces the screen any more, so nothing needs a back button to undo. The group list
keeps its scroll position while you move between categories.

## What moved where

| You used to find it | It is now in |
|---|---|
| `edit profile` (a separate screen) | **profile**, edited in place |
| `change password` (a screen saying "coming soon") | **account** — "send me a reset link", which is the only password path the server actually has |
| `saved` (a separate screen) | **saved posts** |
| `blocked users` (a separate screen) | **blocked accounts**, with unblock in place |
| `private account` | **privacy** |
| `show activity status`, `allow story replies`, `allow message requests` | **privacy** |
| the five notification toggles | **notifications** |
| `email` | **account**, as information — it has no endpoint to change it |
| `dark mode` | removed from settings; the theme is a device preference with no server behind it, and it still works where it already did |
| `sign out` | **account** |

## What is gone, and why

- **`delete account`.** It was a red button with no click handler and no endpoint anywhere in
  the API. It never did anything.
- **`story views`.** A toggle that was permanently disabled and labelled "coming soon". The
  server's notification settings cover likes, comments, follows, mentions and messages and
  nothing else.
- **`help center`, `terms & privacy`, `about luvax`.** Three rows whose click handlers were
  empty functions.
- **The green tick beside your email.** It rendered whether or not anything was verified,
  because it read a field the session object does not carry. The account category now states
  the verified badge plainly, as yes or not verified.

## Two new things you could not see before

- **Your standing.** If a moderator has issued a warning against your account, the account
  category shows it: the reason, the note in the moderator's own words, and the date. This was
  always readable from the server and was never shown.
- **Follow requests.** The list of people waiting to follow you, with approve and decline. On
  a public account it says so, because a public account does not accumulate them.

## Addresses

Every category has one, and pasting it opens that category:

```
/app/settings                 the group list, nothing open
/app/settings/profile
/app/settings/notifications
/app/settings/saved
/app/settings/privacy
/app/settings/requests
/app/settings/blocked
/app/settings/account
```

`/app/settings/profile`, `/app/settings/blocked` and `/app/settings/saved` are the same
addresses as before. `/app/settings/password` still resolves — it opens the account category,
where the password action now lives. An address that names no category shows the group list
and says the link has moved.

## At phone width

The group list is the whole screen. Choosing a category gives the category the whole screen,
with `all settings` at the top to go back. Settings is still reached the way it always was
there — from the button on your own profile — except that the button now says `settings`
instead of `edit profile`, which is where it always went.

If your account can reach the moderation panel, a `panel` button now sits beside it. It was
previously only in the desktop rail, so at phone width there was no way in at all.

## Signing in

Sign-in, sign-up, email verification and password reset used to print whatever the server
said, in the server's own voice — "Email verification token is invalid or has expired",
"Username is already taken". They now say what happened in the application's voice and offer a
way onward. An expired verification link, for instance, now states that links expire and can
only be used once, and puts the resend button under it.

**A cancelled Google sign-in still ends on a server error page.** That page is served by the
backend on its own address, not by this application, so nothing here can intercept it. It is
recorded as a backend request item with what the frontend needs in order to handle it.
