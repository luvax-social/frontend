# Lint Baseline

> Record of work done on 2026-08-09. Not maintained; it is correct as of that date and is not updated as the code moves.

The goal of this work item was an accurate count, not a lower one.

`npm run lint` reported 9,863 problems before this branch, of which 9,812 were a single repeated message.
That volume made every genuine problem unreadable.

---

## Before

Measured by stashing this branch and running `npx eslint src`:

```
line-ending errors : 9812
other problems     :   51
total              : 9863
```

Rules behind the 51:

| Count | Rule |
|-------|------|
| 24 | `no-unused-vars` |
| 10 | `react-hooks/set-state-in-effect` |
| 7 | `react-hooks/exhaustive-deps` |
| 4 | `react-refresh/only-export-components` |
| 4 | `react-hooks/rules-of-hooks` |
| 1 | `prefer-const` |
| 1 | `react-hooks/immutability` |

Note that `prettier/prettier` does not appear here at all.
That is not because the formatting was clean.

---

## The cause

Three settings that cannot all be satisfied at once:

- `git config core.autocrlf` is `true`, so every file is checked out with CRLF on Windows.
- There was no `.gitattributes`, so the repository stated no convention of its own and each developer's local git configuration decided.
- `.prettierrc` set `"endOfLine": "lf"`.

Every line of every file therefore violated the rule on a Windows working copy.

There is a second effect that matters more than the raw count.
`eslint-plugin-prettier` reports one error per line, and on a CRLF line that error is always `Delete ␍`.
The genuine formatting problem on the same line, an indentation or a line break, never gets reported, because the line-ending difference is found first.

The 9,812 were not merely noise around the real problems.
They were hiding them.

---

## What was changed

Two files, no source code.

**`.gitattributes`, added.**

```
* text=auto eol=lf

docs/design/Luvax.html binary

*.png binary
*.jpg binary
...
```

The repository now declares its own convention instead of deferring to each developer's git configuration.

`docs/design/Luvax.html` is marked `binary` rather than `-text`.
It is a Claude Design export whose payload is base64 and gzip data embedded in markup, and it is the pixel-perfect reference for the whole project.
`-text` alone still left it staged for conversion, so `binary` was used, which also suppresses diffing it.

Verified after the change that the file is byte-identical to its committed state and that the documented extraction procedure still works: 29 manifest entries, chunks of 176,988, 30,633, and 44,507 bytes, matching the sizes recorded during reconnaissance.

**`.prettierrc`, one line.**

```
- "endOfLine": "lf"
+ "endOfLine": "auto"
```

**Working tree renormalised to LF.**

`endOfLine: "auto"` alone was not sufficient.
ESLint normalises source text to LF internally before handing it to `eslint-plugin-prettier`, so the plugin compares LF-formatted output against the original CRLF file and reports `Delete ␍` regardless of the setting.

The tree was therefore renormalised with `git add --renormalize .`, applying the new attributes.
This changes line endings only.

Verified by diffing the staged change while ignoring whitespace:

```
$ git diff --cached --ignore-all-space --stat
 .gitattributes | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Only `.gitattributes` differs once whitespace is ignored.
The other 5,283 changed lines across 19 files are line endings and nothing else.

No formatter was run across the repository, and no file was reformatted.
The normalisation is a separate commit, `chore(ci): renormalise line endings to lf`, so it can be skipped when reading history.

---

## After

```
line-ending errors :    0
other problems     : 1045
total              : 1045
```

By rule:

| Count | Rule |
|-------|------|
| 994 | `prettier/prettier` |
| 24 | `no-unused-vars` |
| 10 | `react-hooks/set-state-in-effect` |
| 7 | `react-hooks/exhaustive-deps` |
| 4 | `react-refresh/only-export-components` |
| 4 | `react-hooks/rules-of-hooks` |
| 1 | `prefer-const` |
| 1 | `react-hooks/immutability` |

By file, the fifteen heaviest:

| Count | File |
|-------|------|
| 126 | `src/features/luvax/components/StoryScreens.jsx` |
| 101 | `src/features/luvax/components/shell.jsx` |
| 81 | `src/features/luvax/components/NotificationsScreen.jsx` |
| 65 | `src/features/luvax/components/PostDetailScreen.jsx` |
| 58 | `src/features/luvax/components/ProfileScreen.jsx` |
| 56 | `src/features/luvax/components/OnboardingScreen.jsx` |
| 53 | `src/features/luvax/components/FeedScreen.jsx` |
| 52 | `src/config/tokens.js` |
| 46 | `src/features/luvax/components/SettingsScreen.jsx` |
| 40 | `src/features/luvax/components/ExploreScreen.jsx` |
| 39 | `src/features/luvax/LuvaxApp.jsx` |
| 34 | `src/features/luvax/constants/data.js` |
| 28 | `src/components/ui/lx-icon.jsx` |
| 28 | `src/features/messages/components/MessageBubble.jsx` |
| 26 | `src/features/luvax/components/FollowersScreen.jsx` |

---

## Reading the numbers honestly

The total fell from 9,863 to 1,045, but `prettier/prettier` rose from 0 to 994.

That increase is not a regression.
Those 994 problems existed before and were unreportable: each affected line was already consuming its one error slot on `Delete ␍`.
Removing the line-ending conflict let the underlying formatting problem on each line surface for the first time.

The genuine, non-formatting count is unchanged at 51.
This branch introduced none of them and fixed none of them.

So the accurate baseline is:

- **51** logic and correctness warnings, unchanged by this branch.
- **994** pure formatting deviations, newly visible, concentrated in the luvax screen components.
- **0** line-ending problems.

---

## Not fixed, deliberately

Section 6.2 asked for an accurate count and explicitly not for the remaining problems to be fixed.

The 994 formatting problems are mechanically fixable with `npx prettier --write src`, but that is a repository-wide reformat, which section 2.3 forbids, and it would land on top of a shape audit and a session investigation in one unreviewable branch.

The 51 genuine warnings deserve individual judgement rather than a bulk pass.
`react-hooks/rules-of-hooks` in particular is a correctness rule, and its four occurrences should be looked at properly rather than silenced.

Both are recorded in `deferred-findings.md`.
