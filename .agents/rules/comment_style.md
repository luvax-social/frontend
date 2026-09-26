---
trigger: model_decision
description: Load when writing or reviewing frontend code. Defines comment and JSDoc conventions for this React repository.
---

# Comment Style — Frontend

**Scope**: All source files under `src/`
**Language**: JavaScript (React 19, JSX). There is no TypeScript in this repository.
**Comment language**: English only.

Until this revision, this file was a copy of the backend's: it declared its scope as
`src/main/java/com/app/`, its language as Java 21, and it carried Javadoc tables, `@Transactional`
guidance, JPA annotations and a set of cache keys for an AI module this project does not have.
It was the file an agent loaded before writing a React comment. The backend's rules live in
`backend/.claude/rules/comment_style.md` and apply there; this file applies here.

---

## 1. Documentation Comments (JSDoc)

JSDoc is used where the shape of a value or the contract of a function is not obvious from
reading it. It is not required everywhere, and a block that only restates the signature is worse
than none.

Apply a JSDoc block to:

| Target | Required |
|--------|---------|
| An exported hook whose return shape is not obvious from its name | Yes |
| An exported service function that wraps an API call | Yes — say which endpoint and what it unwraps |
| A Zod schema whose rules mirror a backend constraint | Yes — name the backend rule it mirrors |
| A component whose props carry non-obvious semantics or invariants | Yes |
| A module-level constant table other files read back (`ROUTES`, `APP_SCREENS`) | Yes, on the object |

Not required on:

- A component whose props are self-describing
- A one-line helper whose name says what it does
- Test files
- Anything Prettier or ESLint already enforces

```js
/**
 * One-sentence summary ending with a period.
 *
 * @param {string} userId - what this parameter represents
 * @returns {{ posts: Post[], isLoading: boolean }} what the caller gets back
 */
```

- No `@author`, `@version`, or `@since` — Git history is authoritative.
- Document *what* the function does and *why* (invariants, side effects). Never document *how*.
- Multi-sentence summaries: the second sentence starts on a new line after a blank `*` line.

---

## 2. Inline Comments

Use `//` only for non-obvious logic that cannot be made clear by renaming. Place it on its own
line **above** the code — never at the end of a line, except for an object literal entry or a
constant whose name is ambiguous.

```js
// Lands before the paint so the shell does not flash the signed-out header on reload.
useLayoutEffect(() => hydrateFromStorage(), []);

// The backend returns the envelope; feature code must never see it.
return response.data.data;
```

Inside JSX, use `{/* ... */}` on its own line above the element it describes.

Forbidden:

```js
// Call the service        ← restates what the code does
// Get user by id          ← restates the function name
// Map over the array      ← restates the code
// TODO fix this later     ← no issue reference, FORBIDDEN
// TODO(#123): fix this    ← ALLOWED (must reference a GitHub issue in this repository)
// Created by agent v2     ← no attribution comments
```

---

## 3. Section Dividers — Forbidden

```js
// ===================== DO NOT USE =====================
// *** Forbidden ***
/* ---- Also forbidden ---- */
```

Enforced by code review, not by tooling. There is no pre-commit hook in this repository: an
earlier revision of this file named `hooks/pre-commit-lint.sh` as the enforcer, and no such file
has ever existed here. A mechanical heuristic for this pattern also flags legitimate multi-line
explanatory prose, which is why the backend chose review over tooling and why this repository
does the same.

`npm run lint` runs ESLint with `eslint-plugin-prettier`, which enforces formatting from
`.prettierrc`. It says nothing about comment content.

---

## 4. Comment Placement

- Inline comments sit on their own line **above** the code they describe, with no blank line
  between them.
- A trailing same-line comment is allowed only on an object literal entry or a constant whose
  name is ambiguous:

```js
export const STALE_TIME = {
  SHORT: 30_000, // 30 seconds
  MEDIUM: 5 * 60_000, // 5 minutes
  LONG: 30 * 60_000, // 30 minutes
};
```

---

## 5. Removed / Commented-Out Code

Dead code must be deleted, not commented out. Enforced by code review, not by tooling, for the
same reason as section 3: a heuristic flagging three or more consecutive `//` lines also fires on
a legitimate multi-sentence explanation. If reactivation is uncertain, create a Git branch or a
GitHub issue in this repository.

---

## 6. Layer-Specific Rules

| Layer | Rule |
|-------|------|
| `src/api/`, `src/services/` | Say which endpoint the function calls and what it unwraps from the `ApiResponse<T>` envelope. |
| `src/features/*/hooks/` | Document the query key, what invalidates it, and any optimistic update's rollback path. |
| `src/features/*/components/` | Comment only where a layout or interaction decision is not visible in the markup. |
| `src/components/ui/` | Document a prop that changes behaviour rather than appearance. |
| `src/store/` | Document what is persisted and what is deliberately not, and why. |
| `src/config/` | Document a constant whose value encodes a backend contract, naming the contract. |
| `src/routes/` | Document why an address exists where it does when the placement is not obvious. |

### Optimistic updates

An optimistic update must carry a comment naming what it rolls back to on failure, because the
rollback is the part a reader cannot infer from the happy path:

```js
// Rolls back to the snapshot taken in onMutate; the counter is trigger-maintained server-side,
// so a failed like must not leave the client's number ahead of the database.
onError: (_error, _variables, context) => queryClient.setQueryData(key, context.previous),
```

---

## 7. Framework Idioms — No Comment Required

```jsx
useState, useEffect, useMemo, useCallback, useRef
useQuery, useMutation, useQueryClient, useInfiniteQuery
useNavigate, useParams, useSearchParams, <Link>, <Outlet>
useForm, zodResolver
className={cn(...)}
```

Exception: add a comment when a dependency array is deliberately narrower or wider than it looks,
or when an effect exists for ordering rather than for its body.

---

## 8. Enforcement Checklist

Before committing any source file, verify:

- [ ] No commented-out code exists.
- [ ] No decorative dividers (`====`, `----`, `***`).
- [ ] No `TODO` / `FIXME` / `HACK` without a GitHub issue reference (`#123`).
- [ ] No attribution comments (`// added by`, `// agent`, `// created`, `// author`).
- [ ] Every optimistic update names its rollback.
- [ ] Every service function says which endpoint it calls.
- [ ] Inline comments explain *why*, never *what*.
- [ ] Comment language is English throughout.
- [ ] No `console.log` left in application code.
- [ ] `npm run lint` passes.
