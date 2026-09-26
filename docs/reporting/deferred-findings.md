# Deferred Findings

> Record of work done on 2026-08-12. Not maintained; it is correct as of that date and is not updated as the code moves.

Everything found during this phase and deliberately not acted on, with the phase it belongs to.

## Named out of scope by this phase

These were confirmed to be missing or partial and were left alone because the brief excludes them.

| Finding | Belongs to |
|---------|-----------|
| No moderator or administrator surface exists. `GET /reports`, `GET /reports/pending`, `GET /reports/{id}`, and `PATCH /reports/{id}/status` all require `MODERATOR` or `ADMIN`, and the API grants no route to that role | A moderation phase, if the product ever grants the role |
| No way to view your own report history. The backend exposes no endpoint for it | Blocked on the backend |
| Blocking is partly built. It exists in the post menu and has a blocked-users screen, but is absent from the profile screen where the design places it | The blocking phase |
| Search, saved posts, private accounts, follow requests | Their own phases |
| The design system port and pixel-perfect work | The design conformance phase |
| Realtime | The realtime phase |
| Mock data still used by messages and stories | Their own phases |
| Lint | Explicitly out of scope |

## Found while building, not acted on

### The backend accepts reports for targets the reporter cannot see

Observed: one account blocked another, then reported the blocked account's post.
The report returned `201 Created`, while `GET /posts/{id}` for that same post returned `403`.

`ReportTargetRepositoryImpl.findOwnerId` is native SQL filtering only on `deleted_at`.
It applies no visibility gate and no block check, unlike the post, comment, and story read paths.

Not acted on. The backend is read-only in this phase, and the state is unreachable from the
interface: a viewer who cannot see a post has no menu from which to open the report modal.

Belongs to: a backend phase, if it is judged worth closing.
It is arguably intentional, since a reporter blocking someone should not stop them reporting
what they saw earlier.

### An expected duplicate is logged to the console as an error

`src/main.jsx:53` logs every mutation error through a global query error handler:

```js
console.error('[QueryClient]', error?.message ?? error);
```

A duplicate report is an outcome the interface handles deliberately and presents as ordinary, yet it
still reaches the console as an error.

Not acted on. The handler is pre-existing, applies to every mutation in the application, and
changing it would alter behaviour well outside reporting.

Belongs to: whichever phase revisits global error handling.

### No modal in this application closes on Escape

`LxModal`, `LxBottomSheet`, and the design's own report modal all dismiss by overlay click only.
None binds the Escape key.

The report modal follows the existing pattern rather than introducing a new one, so it does not
close on Escape either.

Not acted on, because fixing it here alone would make the report modal behave differently from
every other dialog. It is an application-wide accessibility gap, not a reporting one.

Belongs to: an accessibility or design system phase, applied to the shared primitives at once.

### The design export's description limit contradicts the backend

The design caps the description at 500 characters; the server accepts 2000.
The server's limit was used, so the visible counter reads `0/2000` rather than the design's `0/500`.

Recorded in full in `report-contract.md`.

Belongs to: the design conformance phase, which should decide whether the design is updated to 2000
or the product deliberately wants a stricter client limit.

### The design export specifies no failure states

The design's `submit()` performs no network call and has no error state: no duplicate handling, no
failure message, no pending state.

Every failure state in the delivered modal is therefore derived, and marked as such in
`design-decisions.md`.

Belongs to: the design conformance phase, if these states are to be specified rather than derived.

## Environment findings

### The backend does not start from a dirty build directory

`./mvnw spring-boot:run` on current `develop` failed with:

```
The bean 'mailTaskExecutor', defined in class path resource
[com/app/modules/mail/config/MailAsyncConfig.class], could not be registered.
A bean with that name has already been defined in class path resource
[com/app/common/config/mail/MailConfig.class]
```

This is not a source defect.
`MailConfig.java` was deleted by commit `32a4bd9`, but its compiled class was still present at
`target/classes/com/app/common/config/mail/MailConfig.class`, so component scanning saw both.

`./mvnw clean` resolved it and the application started normally.

No backend file was modified. `target/` is gitignored, confirmed with `git check-ignore`.

Belongs to: nowhere in particular, but it is worth a line in the runbook, since anyone who pulls
across that refactor without cleaning will hit it.

### The seeded accounts still need a manual SQL step

Unchanged from `docs/reconnaissance/local-environment-runbook.md`.
The seed script cannot verify email addresses because the mail provider rejects the seed domain, so
the documented `UPDATE user_credentials` step is still required before any account can log in.

A `mailpit` container now runs alongside the other services, which the runbook does not mention; it
was not investigated here and may offer a route to a real verification link.

Belongs to: an environment phase, if the manual step is to be removed.

## Not a finding, recorded to prevent re-investigation

The eight report reason identifiers in the design export match the backend `ReportReason` enum
exactly, including the underscored `hate_speech` and `false_information`.

There is no disagreement to resolve, and no mapping layer is needed between the two.
