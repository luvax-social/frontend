# Stale Findings

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Audit claims acted on in this stage that turned out to be wrong, already closed, or contradicted by the design source.

The brief warned that the audits are several stages old and that two had already been caught stating something false.
Each finding below was confirmed against the running application or the extracted design source before any code was written.

## The frontend has no realtime consumer at all

**The claim.**
The brief states: "The realtime post like event, which carries an absolute count, must not fight the viewer's own optimistic update. The realtime work already handled this once; confirm what it does and keep it working."

**What is actually true.**
There is no realtime code in the frontend.

```
$ grep -rn "WebSocket\|SockJS\|stomp\|EventSource" src/
(no matches)
```

The backend does publish post like events to a live tier.
Its commit log carries `feat(post): deliver post like events over the realtime channel` and `feat(post): publish an event when a post is liked or unliked`, and its topology declares a `post.live.events` fanout exchange.

**None of it is consumed by this frontend.**
No subscription exists, so no absolute count arrives, and there is nothing for an optimistic update to fight.

The instruction to "confirm what it does and keep it working" could not be carried out, because there is nothing there to keep working.
Nothing was built to defend against a message the application never receives.

This is recorded rather than acted on, and it is carried into `deferred-findings.md` as work for whichever phase connects the frontend to the live tier.

## Post detail never showed the viewer's own like state

**Found while doing the work rather than stated by any audit.**

`PostDetailScreen` declared its like state as `useState(false)` for `liked` and `saved`, and only `likeCount` was ever synchronised from the server:

```js
const [liked, setLiked] = useState(false);
const [likeCount, setLikeCount] = useState(0);
const [saved, setSaved] = useState(false);

useEffect(() => {
  setLikeCount(post.likeCount ?? 0);
}, [post.id, post.likeCount]);
```

Nothing ever set `liked` or `saved` from `post.isLiked` or `post.isSaved`.

So opening post detail on a post the viewer had already liked showed an empty heart, and the save control showed unsaved, regardless of the truth.
The count was right while the state beside it was wrong.

This is worse than the staleness the brief describes, and it is fixed by the same change: both now read from the query data.

## The design's own menu confirms before blocking

**The claim.**
The brief describes the post overflow menu blocking immediately as a divergence to fix, framed as an internal inconsistency with the profile.

**What is actually true.**
It is that, and it is also a divergence from the design.

The design's menu calls `confirmDestructive` for both unfollow and block, at chunk `9bffeb59-152c-49f9-ae0d-96c787e34723.js` lines 112 to 125:

```js
{ label:'Block @'+target.author, icon:'ban', danger:true, onClick:function(){
  confirmDestructive(
    'Block @'+target.author+'?',
    'They won\'t be able to see your profile or content, and you won\'t see theirs.',
    function(){ toast('blocked @'+target.author); }
  );
}},
```

Gating the frontend's menu behind a confirmation therefore moves it toward the design rather than away from it.
The brief's framing understated the case for the change.

## The audit's capitalisation rule is contradicted by the design source

**The claim.**
The brief states the audit established the design's voice as: "menu items Title Case, button labels lowercase, modal headings lowercase, modal buttons Title Case."

**What is actually true, for the two halves that were checked.**

The first half holds.
The design's menu rows read `Share`, `Copy link`, `View author's profile`, `Unfollow @name`, `Block @name`, `Report`, all Title Case.

The last two halves are the wrong way round for `ConfirmModal`.
Its buttons are lowercase and its headings are capitalised:

```js
h('button', { ... }, 'cancel'),
h('button', { ... }, cfg.confirmLabel || 'confirm')
```

```js
confirmDestructive('Unfollow @'+target.author+'?', 'You will no longer see their posts in your feed.', ...)
```

So in the design's own destructive dialogue, the heading is `Unfollow @name?` with a capital and the buttons are `cancel` and `confirm` in lowercase.
That is the opposite of "modal headings lowercase, modal buttons Title Case".

**This finding is recorded but the copy work it belongs to was not completed in this stage.**
See `README.md` for what was and was not done.
The rule should be re-derived across every modal in the design before it is applied, rather than taken from the audit.

## The photos tab does not filter, and the backend supports filtering

**The claim.**
Two documents disagree: one phase reported wiring the tab to a server-side type filter, a later stage reported that the tab only moves an underline.

**What is actually true.**
The later stage was right.
Before this stage, `ProfileScreen` rendered the three tabs and passed no type parameter:

```
$ grep -n "'posts', 'photos', 'liked'" src/features/luvax/components/ProfileScreen.jsx
212:          {['posts', 'photos', 'liked'].map(t => (
```

`useUserPosts(user?.id)` was called with no parameters, so all three tabs requested the same list.

The backend has supported the filter for some time.
`PostApi.listUserPosts` declares `@RequestParam(value = "type", required = false) List<String> type`, documented as accepting repeated values or a single comma-delimited value.

There is also a `/posts/liked` endpoint that the frontend had no service for at all.

Both are now used.
Observed after the change: 12 posts unfiltered, 9 with `type=image,carousel`, correctly excluding two text posts and one video.

## The liked endpoint returns a different shape

**Found while doing the work.**

`/posts/liked` does not return bare posts.
Each row is `{ likedAt, post }`, so a consumer that treats the rows as posts renders nothing.

```
$ curl -s -H "Authorization: Bearer <token>" .../posts/liked | ...
count: 1
keys: ['likedAt', 'post']
```

The profile grid now lifts `row.post` out before rendering, so both list shapes reach the grid identically.

## Two verification attempts failed for reasons that were not defects

Recorded so the evidence is not misread.

The video pause check initially reported the video still playing after a scroll.
The video had not moved: post detail is a fixed overlay whose pane scrolls only 91 pixels, and at the desktop window size the feed did not scroll at all because its content fit the viewport.
Neither attempt moved the element out of the viewport, so neither tested the behaviour.

The check was rerun at a 390 by 560 viewport with a video post placed in the feed, where the element genuinely left the viewport and did pause.
