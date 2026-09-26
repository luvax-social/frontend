# Fabricated Data Removal

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything invented that was rendering anywhere in the application, what happened to it, and confirmation that no navigation path now leads somewhere that does not exist.

## Why it was deleted rather than hidden

Hidden mock data comes back.
A flag gets flipped or a panel gets re-imported, and the invented strangers return.

Deleting it means the only way to put a conversation, a story or a trending tag on those screens is to read one from the server, which is what building the feature would involve anyway.

## The inventory

### 1. Invented conversations and the people in them

**File:** `src/features/messages/data/mockThreads.js`, 132 lines. **Deleted.**

Six invented people holding invented conversations, with invented shared files, invented shared posts and unread badges.

This was the worst instance for two reasons beyond being fabricated.

Their avatars were **photographs of real people** loaded from an external image host.
Real strangers were presented as users of this application.

And it was reachable.
`ConversationInfoPanel.jsx:75` offered "view profile" on the active conversation and navigated to `routeTo.userProfile(activeThread.id)`, where `activeThread.id` was a string like `priya`.
That is not a user id, so it resolved to a profile that cannot exist and landed the viewer on an error.
This is the exact defect the requirement called out.

**What replaced it:** `MessagesScreen.jsx` now renders a state saying messages are not part of this build, and that nothing has been sent and nothing is hidden.

### 2. Invented stories

**Export:** `STORIES` in `src/features/luvax/constants/data.js`. **Deleted.**

Six invented people with stories, rendered as the story rail at the top of the feed.

Reachable the same way: each rail item linked to `routeTo.storyView(s.id)` with ids like `s1`.

`StoryViewScreen` was worse than the rail feeding it.
When handed a story id it did not recognise, it **fell back to inventing one**:

```js
const story = STORIES.find((entry) => entry.id === storyId)
  || { author: 'sol.r', idx: 1, type: 'photo', bg: v.surfaceRaised, caption: 'morning' };
```

So every address in the story range rendered a plausible story that never existed.

**What replaced it:** the rail is removed from `FeedScreen` entirely, and both story screens render a state saying stories are not part of this build. The routes are kept so an address already shared resolves to an explanation rather than a fabrication or a crash.

An empty rail was rejected: a row of empty rings still asserts that stories are something this build does.

### 3. Invented trending tags

**Location:** `shell.jsx`, a `trending` array hardcoded inside `LxRightRail`. **Deleted.**

Six invented tags rendered in the desktop right rail, numbered `01` to `06` as though ranked, each row carrying `cursor: pointer` with no click handler at all.

A fabricated ranking presented with the confidence of a real one, and a control that looked interactive and did nothing.

A real trending endpoint exists (`GET /hashtags/trending`).
Wiring it is not part of this phase, and a fabricated ranking is worse than an absent rail.

### 4. Invented explore topics

**Export:** `TOPICS` in `constants/data.js`, consumed by `ExploreScreen`. **Deleted.**

Ten invented topics rendered as filter chips.
Selecting one set `activeTopic` and filtered nothing, so the chips were controls that lied about what they did.

Hashtag search is the real way to reach a tag.

### 5. Invented bios on explore

**Location:** `SEARCH_BIOS` in `ExploreScreen.jsx`. **Deleted.**

A lookup mapping the invented usernames to invented bios, with a fallback of `'quiet notes, passing thoughts'` applied to **any** user whose username was not in the map.

This is the subtlest instance found.
It attached an invented biography to real accounts returned by a real API.
Anyone without a bio appeared to have written one.

Replaced with the account's actual `bio`, empty when there is none.

### 6. Invented composer tag suggestions

**Export:** `SUGGESTED_TAGS` in `constants/data.js`, consumed by `ComposerScreen`. **Deleted.**

Ten invented tags offered as suggestions, presented as though the server had suggested them.
Nothing suggests tags.

Tags typed into the caption still count, which is what the hashtag counter above them reports.

### 7. Invented onboarding interests

**Export:** `INTEREST_CATEGORIES` in `constants/data.js`, consumed by `OnboardingScreen`. **Deleted.**

Sixteen invented interest categories, with copy reading "pick at least 3. we'll use these to shape your feed."

Two problems.
The list was invented, and the promise could not be kept: nothing stores a selection, and the feed is built from who the viewer follows.
The step also gated progress on `data.interests.length >= 3`, so removing only the chips would have blocked onboarding permanently.

The interests step is gone and the step now asks for a bio, which is a field that is actually stored.

### 8. Dead invented exports

Three exports in `constants/data.js` were fabricated data that nothing imported any more: `PROFILE_POSTS` (nine coloured rectangles standing in for a profile grid), `TRENDING` (eight invented posts by invented authors) and `NOTIFS` (six invented notifications).

**Deleted.** They were not rendering, but they were the obvious thing to reach for the next time a screen needed filler.

### 9. What was kept in `constants/data.js`

`ACCENT_PALETTES`, `FONT_MAP` and `TWEAK_DEFAULTS`.

These are presentation configuration, not stand-ins for server data.

## Confirmation that nothing leads anywhere that does not exist

### The two paths that did

| Path | Was | Now |
|------|-----|-----|
| messages, "view profile" on an invented person | `routeTo.userProfile('priya')`, a profile that cannot exist, landing on an error | The panel offering it is unreachable. `MessagesScreen` renders a notice and imports none of the panels |
| feed story rail, tapping any story | `routeTo.storyView('s1')`, a story that cannot exist, silently replaced with an invented one | The rail is removed. Both story screens state that stories are not part of this build |

### Sweep for invented identifiers

Searched the whole of `src/` for every invented username and the deleted data structures:

```
sol.r  jo.x  ren.ko  lea.p  noa.b  mara.v  kai.o  eli.w  priya
THREADS  mockThreads
```

The only matches are the prop name `filteredThreads` inside the messages panel components, which is a parameter name and holds no data.

Searched for external image hosts: no matches anywhere in `src/`.
The photographs of real people are gone.

### The unreachable panels

`ConversationListPanel`, `ChatCenterPanel`, `ConversationInfoPanel`, `ConvRow`, `MessageBubble`, `AvatarVisual` and `MediaPlaceholder` remain in `src/features/messages/components/`.

They are imported only by each other. No reachable screen imports any of them, verified.
They are real UI with no data source and no route to them.

They were left in place because deleting them is a restructuring this phase does not take on, and because they are the starting point for building the feature properly.
Recorded in `deferred-findings.md`.

### Verified in the browser

The navigation renders `chats` as `[disabled]`, confirmed in the accessibility tree:

```
button "chats are not part of this build" [disabled]
```

The feed renders with no story rail.
No console errors were produced by any of these screens.
