# Deferred Findings

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found and deliberately not acted on, with the phase it belongs to.

## Named by the brief as out of scope

Recorded, no action taken.

| Finding | Belongs to |
|---------|-----------|
| The realtime client | A realtime phase |
| A comment sort control | A comment phase |
| Private account states, follow requests, and block on the profile screen | A social graph phase |
| Mock data in messages and stories | A messages and stories phase |
| The design system port and any pixel-perfect work | A design conformance phase |
| Post like state living in component-local state | A post state phase |
| Escape-key dismissal for modals | An accessibility phase |
| The global query error handler logging expected outcomes as errors | An observability or error handling phase |
| Lint | Explicitly out of scope for this brief |

## Found during this work

### The post detail screen has a save handler with no control

`PostDetailScreen` defines `handleSaveToggle` and never renders a button wired to it.

The post detail overlay therefore has no save control at all, and a post cannot be saved or unsaved from the screen that shows it in full.

Found while trying to unsave a post from the saved screen by opening it: clicking every button in the action row left the server-side saved count unchanged.

Worked around rather than fixed, by putting an unsave control on the saved grid tiles, which is what the brief actually asked for.

The dead handler was left in place, because removing it is a change to a screen this phase otherwise does not touch.

**Belongs to:** a post interactions phase, alongside the post like state item above, which is the same class of problem in the same file.

### `UserCard` in compact mode always reads "follow"

The label is `compact ? 'follow' : (isFollowing ? 'following' : 'follow')`.

In compact mode the follow state is computed and then discarded, so the control reads "follow" for accounts the viewer already follows.

This is exactly the failure the brief calls out for search results.

Avoided rather than fixed, by using the default mode on the search screen.

Any existing caller using compact mode has this defect today.

**Belongs to:** a social graph phase.

### The explore screen sends a literal `a` as the search term

`getExplorePosts` substitutes `q = 'a'` when no term is supplied, to avoid the `400` that a blank `q` returns.

The explore grid is therefore not a browse of everything; it is a search for posts matching `a`, and any post whose caption does not stem to that term cannot appear.

Not touched, because the explore screen is not in scope and changing what explore shows is a product decision.

**Belongs to:** an explore phase, or whichever phase gives explore a real browse endpoint.

### The trending rail is hardcoded

`shell.jsx` renders `['light', 'analog', 'morning', 'silence', 'film', 'observation']` from a literal array.

The real `GET /hashtags/trending` endpoint exists, works, and returns different tags, `luvax` and `film` among them.

Found because `#silence` appears in the rail while a hashtag search for `silence` correctly returns nothing: no such tag exists.

Clicking a rail entry therefore leads to a search for a tag that is not there.

Not fixed, because the trending rail is not one of the four surfaces in this brief.

**Belongs to:** a hashtag phase. It is a small change; the endpoint is verified and documented in `endpoint-verification.md`.

### The hashtag identifier is named inconsistently

`GET /hashtags/search` returns the identifier as `id`.

`GET /hashtags/trending` returns the same concept as `hashtagId`.

No shared component consumes both today, so nothing needed to change.

Worth knowing before anything renders rows from both endpoints.

**Belongs to:** a hashtag phase.

### Search result tabs could not be paged for hashtags

The whole database holds six hashtags, which is under one page.

Post and people pagination were proven by creating the rows needed.

The same was not done for hashtags, because inventing tags purely to exercise a third instance of the same code path was not worth the data it would leave in the development database.

The tags half uses the same hook factory, the same cursor helper, and the same sentinel as the two halves that were proven.

This is a gap in evidence, not a known defect, and it is stated as such in `verification-evidence.md`.

**Belongs to:** whichever phase next has reason to create hashtag volume.

### The profile posts query polls on an interval

`useUserPosts` carries `refetchInterval: 60000` and `refetchOnWindowFocus: true`, inherited from the feed hooks.

The brief requires that switching tabs does not refetch a tab that is already loaded, and that was verified: switching between all three tabs issued one request in total.

The interval is a separate behaviour that will still refetch a profile grid once a minute while it is open.

Left alone, because changing the polling policy affects the feed and explore screens too.

**Belongs to:** a caching policy phase.

### Two reconnaissance documents remain wrong about the profile tabs

`docs/reconnaissance/open-decisions.md` and `docs/reconnaissance/design-conformance-gaps.md` both claim the profile screen has only a `posts` tab, citing `ProfileScreen.jsx:12`.

The tab list holds three entries and that line reference does not point at it.

The brief said not to trust them, and they were not trusted.

They were also not edited, per the standing instruction not to rewrite earlier reports.

Note also that those documents live on branches not merged into `develop`, so they are not present in this branch's `docs/` tree at all.

**Belongs to:** a documentation cleanup phase, if one is ever run.

### The whole authenticated application still hangs off one guard

Not a finding of this phase so much as a standing constraint that shaped it.

Every screen added here is a row in `APP_SCREENS` and gets a real address, which is the pattern the routing phase established.

Nothing here regresses it.

Recorded only so the next reader knows the pattern was followed deliberately.

**Belongs to:** nothing outstanding.
