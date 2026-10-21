# Frontend TypeScript

The frontend uses strict TypeScript for every application module, unit/live/E2E test,
Vite/Vitest/Playwright configuration and Node script. The migration starts from
`origin/develop` at `aaa86d2` on `chore/common/migrate-frontend-typescript`.

## Development and checks

Use Node 24 LTS and `npm ci`. Run `npm run dev` for the existing development runner.
Node executes `.mts` scripts using its native type stripping; keep their syntax erasable
and use explicit `.ts`/`.mts` extensions in Node ESM dependency chains.

- `npm run typecheck` checks application, tests and Node tooling separately.
- `npm run lint` checks TypeScript and the ESLint configuration.
- `npm test` runs all unit tests without a backend.
- `npm run build` runs typecheck before the Vite production bundle and SEO assets.
- `npm run test:e2e` runs Chromium with API stubs and the real Turnstile always-pass key.
- `npm run test:live` requires the backend and Mailpit; its preflight fails when either
  service is unreachable. See the live helpers for configurable service URLs.

CI runs lint, typecheck, unit tests and build. `allowJs` is removed; application and test
source contains no JS/JSX. `eslint.config.js` remains JavaScript because ESLint's TypeScript
configuration loader would add a separate loader requirement. Shell scripts, CSS, JSON,
HTML and generated browser bundles retain their formats.

## Contracts

Shared contracts live in `src/types/`: API envelopes/pages, authentication, backend domain
DTOs, admin/support DTOs, notification events, social views and composer state. UUIDs and
timestamps remain strings. Type-only imports disappear at runtime. Use `unknown` at error
and third-party boundaries and narrow it through the shared error helpers.

Types do not replace runtime validation. Existing Zod validation and request field selection
remain active. Axios clients still own refresh concurrency, cookies, normalized errors and
authentication headers. Session persistence still stores only identity without role and the
authentication flag; it never stores tokens or role.

TanStack Query uses explicit envelope/page data, mutation inputs and rollback snapshots.
Message UI contracts distinguish message/separator/album rows and resolved media from wire
DTOs. Nullable/deleted data keeps its existing presentation and fallback behavior.

## Migration decisions

- Used the clean frontend checkout on a dedicated branch after checking worktrees, locks
  and active Codex chats. The native worktree tool targeted the aggregator repository.
  Cost if that ownership check was incomplete: another editor could share the checkout.
- Kept the migration ledger under the project-required, ignored `.workspace/` directory
  until completion. Cost: scratch evidence is local; this document preserves durable choices.
- Pinned TypeScript 6.0.3 with typescript-eslint 8.71.1, whose peer range excludes TypeScript
  6.1 and later. Cost: compiler upgrades must be coordinated with the lint parser.
- Converted remaining tests after application contracts stabilized, retaining all original
  assertions and checking the same 43 unit files / 397 tests from the selected develop base.
  Cost: strict checking of those test fixtures arrived at the final phase.
- Removed the redundant React plugin from Vitest's config: Vitest 3 embeds Vite 6 while the
  production React plugin targets Vite 8. Explicit esbuild automatic JSX runs the unit suite.
  Cost: tests requiring plugin-specific transforms would need an updated test toolchain.
- Preserved the existing `allowMessageRequests` settings view, separately from the backend's
  `messagePermission` contract. This pre-existing mismatch needs a dedicated behavior change;
  migration does not invent a backend field. Cost: that legacy toggle's contract drift remained
  until the privacy settings replaced it with the `messagePermission` radio group.

## Verification

The migration retained all original 43 unit files / 397 tests. Final review restored
deliberately missing-field fixtures and added four conversation subtitle regressions,
bringing the unit suite to 44 files / 401 tests. The 2 E2E files / 35 Chromium tests pass.
Strict typecheck and production build pass, including lazy chunks and SEO outputs.
Native syntax checks pass for both `.mts` scripts; E2E also exercises the native development
runner. All 5 live suites / 62 tests are discovered, but live execution stops at preflight
because `localhost:8080` is unavailable. Backend/Mailpit integration remains unverified.
The SEO HTTP matrix also remains unverified: Docker's engine is unavailable and automatic
approval review rejected the isolated Nginx launch command with “blocked by policy,” without
further detail. Native script syntax checks and SEO build/unit checks passed.

One independent whole-branch review identified the subtitle separator regression and
fixture defaults masking missing-field coverage. Seven focused failures reproduced the
findings before the fixes; the final suite passes all 401 tests. The original separator-row
property observation is also preserved. Real STOMP delivery/reconnect, cookie rotation and
media uploads require the unavailable backend; exhaustive pixel comparison across themes
was not performed. E2E covers notification behavior and overflow at five viewport widths.
