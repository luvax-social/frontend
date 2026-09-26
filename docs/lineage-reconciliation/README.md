# Lineage Reconciliation

> Record of work done on 2026-08-14. Not maintained; it is correct as of that date and is not updated as the code moves.

Two lines of development ran in parallel without either being merged into develop.
This work reconciles both into develop and then verifies, by using the application, that no capability from either line was lost.

## The two lineages

Both lineages are fully chained, so merging the tip of each brings the whole line.

### Lineage A, forked from the comment interactions merge `4d551ad`

| Order | Branch | Phase | Docs |
|-------|--------|-------|------|
| A1 | `feat/post/search-saved-and-profile-tabs` | search results and saved posts | `docs/search-saved-and-tabs` |
| A2 | `feat/social/profile-tabs-and-social-states` | social states and profile tabs | `docs/social-states-and-tabs` |
| A3 | `feat/comment/realtime-and-verification-gaps` | the realtime client | `docs/realtime` |

A1 is an ancestor of A2, which is an ancestor of A3, confirmed with `git merge-base --is-ancestor`.
The tip A3 therefore carries all three phases.

### Lineage B, forked from the stage 1 conformance merge `c04cdd6`

| Order | Branch | Phase | Docs |
|-------|--------|-------|------|
| B1 | `feat/post/design-conformance-feed-profile` | design conformance stage 2 | `docs/design-conformance-stage-2` |
| B2 | `feat/post/composer-rework` | the composer rework | `docs/composer-rework` |
| B3 | `feat/common/design-conformance-stage-3` | design conformance stage 3 | `docs/design-conformance-stage-3` |

B1 is an ancestor of B2, which is an ancestor of B3, confirmed the same way.
The tip B3 carries all three phases.

## Why the order was B then A

Develop already contains lineage B's fork point, the stage 1 conformance merge `c04cdd6`, plus one later docs commit.
Lineage B therefore merges into develop cleanly, because it shares develop's recent ancestry.
Lineage A forks from the older `4d551ad`, before any conformance work, so it is the merge that surfaces the conflicts where the two lines touched the same lines.

Merging B first and A second concentrates every conflict into one place, the A merge, and resolves each one against a develop that already holds all of B's conformance and composer work.

## What was merged, in what order

1. `merge(common): reconcile lineage B ...` merged B3 into develop. Clean, no conflicts.
2. `merge(common): reconcile lineage A ...` merged A3 into develop. 18 conflict hunks across 7 files, resolved under the rules recorded in `conflict-resolutions.md`.

The full per-hunk resolution is in `conflict-resolutions.md`.
The re-verification of every capability is in `re-verification.md`.
Anything the merge broke and how it was fixed is in `merge-defects.md`.
Defects the merge did not cause, and anything left undone, are in `deferred-findings.md`.

## Branch target

The run configuration named a working branch, but the definition of done is explicit and repeated: merge the six phases into develop, push develop, and make local and remote develop match.
The reconciliation was therefore performed on develop directly, which is the only way those three requirements can all hold.

## Final state of develop

- Local develop HEAD: `4beabb0` docs(common): record the reconciliation re-verification and findings.
- Remote origin/develop HEAD: `4beabb0`, identical.
- Match confirmed: local and remote develop point at the same commit.
- No conflict markers remain anywhere in the tree.
- No branch was deleted; all six lineage branches and every other branch are still present.
- Nothing was force pushed and no history was rewritten.

The commit sequence on develop for this work:

1. `merge(common): reconcile lineage B ...` merged lineage B, clean.
2. `docs(common): catalogue the lineage conflicts before resolving them` recorded the pre-resolution analysis.
3. `merge(common): reconcile lineage A (search, saved, social, realtime)` merged lineage A with the nine-plus conflicts resolved.
4. `docs(common): record the applied conflict resolutions` recorded what was done per hunk.
5. `docs(common): record the reconciliation re-verification and findings` recorded the verification and the deferred findings, and the changelog entry.

## Backend repository was not touched

The task forbids modifying the backend repository.
The backend was inspected read-only and never written.

Backend `git status` at the start of this task, recorded verbatim:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

The staged `Makefile` predates this task and was not created, staged, or altered by it.
It is a pre-existing change in the backend working tree.
This task left it exactly as found.

The backend `git status` at the end of the task, recorded verbatim, is identical to the above:

```
On branch develop
Your branch is up to date with 'origin/develop'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   Makefile
```

The backend was run for verification (`docker compose up` for the infrastructure and `mvnw spring-boot:run` for the application), which produces only gitignored build artifacts under `target/`.
No tracked backend file was modified, and the backend HEAD is unchanged at `26d986d`.
