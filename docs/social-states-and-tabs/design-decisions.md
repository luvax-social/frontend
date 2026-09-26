# Design Decisions

> Record of work done on 2026-08-13. Not maintained; it is correct as of that date and is not updated as the code moves.

Every decision below records what was chosen, why, and what was rejected.
Treatments the design export does not define are labelled as derived.

## 1. What the photos tab asks for

**Decision: `image` and `carousel`. Not `video`. Not `text`.**

The backend deliberately left the meaning of "photos" to the client.

`text` is excluded because it carries no media at all.

`video` is excluded because "photos" is a claim about the format.
A viewer who opens a tab named photos and is shown video has been told something untrue by the label.
The cost of excluding it is that video posts are unreachable from the profile grid, which is a gap to fill with a video tab later rather than by making this tab dishonest.

### The carousel question, answered as a product decision

**Decision: carousels are included.**

The backend flagged this because a carousel can mix images and video, so including it means the photos tab can contain a video frame.

It is included because of how people author and look for these posts.
Someone browsing a profile for pictures expects the multi-image posts to be there.
A carousel is an image-first format: it is what a person picks when they have several photographs, and it is understood as a photo post by the person who made it and the person looking at it.

Excluding carousels would empty the tab of exactly the posts it exists to show, and the tab would be least useful for the accounts that post the most pictures.

The failure mode of including them is mild and visible: a viewer occasionally meets a video inside a carousel they opened from the photos tab, in a post that is mostly photographs.
The failure mode of excluding them is silent and worse: photographs the account definitely posted are missing from the tab, and nothing tells the viewer why.

**Rejected:** filtering carousels by inspecting their media client-side and keeping only image-only ones.
It would break pagination, because the server chooses the page boundary before the client removes rows, so pages would shrink unpredictably and the counts would never settle.
It also cannot be done for posts on pages not yet fetched.

**Rejected:** renaming the tab to "media" and including video.
It is a defensible product, but it is a different one, and the tab label in the design is photos.
Recorded as an option rather than taken unilaterally.

## 2. The liked tab appears on the viewer's own profile only

**Decision: two tabs on someone else's profile. No third tab, not even disabled.**

`GET /posts/liked` takes no path parameter for another account.
It always answers for the authenticated caller.
There is no way to show another person's likes, and there is no partial version of the feature to offer.

**Rejected: a disabled third tab on other people's profiles.**
A disabled control says "this exists and you cannot have it right now".
That is a false statement here twice over: the list does not exist for that person as far as this API is concerned, and no future state of the session would enable it.
It would also invite the reading that someone else's likes are private-but-present, which is a claim about their privacy settings that nobody made.

Two tabs on another profile is not a degraded version of three.
It is the correct shape for a surface where the third thing is not a thing.

## 3. Reason the cursor cannot be replayed across a tab switch

**Decision: the type filter is part of the React Query key.**

The requirement was to reset the cursor when the user switches tabs.
Rather than resetting it as a step that could be forgotten, the filter and the cursor sequence are bound together: a different filter is a different query, and a different query starts from a null cursor.

Replaying a foreign cursor is not merely avoided, it is unrepresentable.

**Rejected:** keeping one query and clearing the cursor in the tab click handler.
It works until someone changes the filter from somewhere other than that handler.

## 4. Blocked profiles are recognised from the blocked list, not from viewer state

**Decision: the profile screen reads `GET /social/blocked` to know whether the viewer has blocked the account being viewed.**

The obvious approach is `viewerState.isBlocking` on the profile.
It cannot work: blocking makes the profile answer 404, so there is no response left to carry that field.
See `endpoint-verification.md` section 6.

A blocked account and a deleted account both answer 404.
The blocked list is the only readable record that distinguishes them, and it also carries the username, which is how the blocked state can still name the account whose profile it cannot read.

**Rejected:** remembering the block in component state after the mutation succeeds.
It would show the right thing for the rest of that render and the wrong thing after a reload, and it would show nothing at all for a block made from a post overflow menu or from another device.

**Known limitation:** the blocked list is read as a single page. A viewer with more blocked accounts than one page holds could open the profile of a blocked account beyond that page and see the generic 404 treatment. Recorded in `deferred-findings.md`.

## 5. What the block confirmation says

**Decision: state all four consequences, and state plainly that unblocking does not restore the follows.**

Every line was verified against the running backend before being written.
The follow destruction was verified specifically: Ava and Dan followed each other, and after block then unblock, both directions were gone and the counts had dropped to zero.

The confirmation leads with the four immediate effects and closes with the irreversible one, in an error-toned block, because reversibility is the thing a viewer is most likely to assume wrongly.
"You can always unblock" is true and misleading. The dialog does not say it.

**Rejected:** a short "are you sure?" confirmation.
It confirms intent without informing it, which is the failure this requirement exists to prevent.

**Derived treatment.** The design export defines modal radius, scrim, shadow and a danger button variant, but no confirmation dialog composition. The layout reuses those tokens.

## 6. Unblocking is not confirmed

**Decision: block is confirmed, unblock is not.**

Blocking destroys state that unblocking will not restore, so it deserves a gate.
Unblocking restores access only, creates nothing, and can be undone by blocking again.
Confirming both would train the viewer to dismiss the dialog that matters.

## 7. Private accounts

**Decision: the private state replaces the tabs and the grid entirely, and the follow control reads the server's viewer state.**

A non-follower gets identity and nothing else. Posts, followers and following all answer 403.
Rendering tabs over a surface where all three requests are certain to fail would produce three error states for a situation that is not an error.

The button reads `follow`, `requested`, or `following`, driven by `viewerState.isFollowRequested` and `viewerState.isFollowing`.
It is never driven by having clicked, so it is correct on a cold load and after the request is approved elsewhere.

The private notice changes with the request state: a viewer with a pending request is told it is waiting rather than being invited to follow again.

**Counts.** The three counts arrive as `null` for a non-follower, and render as `-`.
A `null` count is withheld, not zero, and rendering `0` would be a specific false claim about the account.
The counts are also not clickable in that state, because the lists behind them answer 403.

## 8. The disabled navigation treatment

**Derived treatment.** The design export defines no disabled state for navigation items.

It defines a disabled state for buttons: opacity 0.4 and `cursor: not-allowed`.
The navigation tab is a button, so that treatment is reused rather than invented: opacity 0.4, `cursor: not-allowed`, the `disabled` attribute so it is not focusable or clickable, and a title of "chats are not part of this build".

The design export's rule that active navigation uses the gold accent and a hairline underline is untouched.

**Rejected:** removing the tab.
The settled decision is that out-of-scope tabs render disabled, and a missing tab hides the shape of the product from a reviewer.

## 9. Fabricated data was deleted, not hidden

**Decision: delete it.**

Hidden mock data comes back.
A flag gets flipped, a panel gets re-enabled, and the invented strangers return.
Deleting it means the only way to put a conversation or a story on those screens is to read one from the server, which is what building the feature would involve anyway.

Full reasoning and the complete inventory are in `fabricated-data-removal.md`.
