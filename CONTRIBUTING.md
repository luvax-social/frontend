# Contributing

## Ways to contribute

- Report bugs with the GitHub bug report template.
- Propose features or UX improvements with the feature request template.
- Open pull requests for code, documentation, or tooling changes.

## Project setup

**Prerequisites**

- Current Node.js LTS
- npm

**Install dependencies**

```bash
npm install
```

**Start the development server**

```bash
npm run dev
```

The app runs through Vite. By default it expects the API at `VITE_API_URL`, falling back to `http://localhost:8080/api/v1`.

## Branch naming

Use:

```text
<type>/<scope>/<short-description>
```

Examples:

```text
feat/auth/add-login-validation
fix/routes/redirect-after-logout
chore/build/update-vite-config
```

Recommended scopes for this repository:

- `app`
- `auth`
- `dashboard`
- `routes`
- `layouts`
- `pages`
- `ui`
- `hooks`
- `services`
- `stores`
- `config`
- `assets`
- `build`
- `deps`
- `docs`
- `ci`

## Commit and PR titles

Follow Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types:

- `feat`
- `fix`
- `refactor`
- `test`
- `chore`
- `docs`
- `perf`
- `ci`

PR titles are linted by `.github/workflows/pr-lint.yml`, so use the same format there.

Examples:

```text
feat(auth): add persisted login session
fix(ui): prevent button overflow in auth form
chore(deps): update react-query packages
```

## Before opening a pull request

Run the project checks locally:

```bash
npm run lint
npm run build
```

If your change affects API integration, verify the relevant flow against the configured backend as well.

## Pull request process

1. Create a branch that follows the naming convention above.
2. Keep the PR focused enough to review comfortably.
3. Run `npm run lint` and `npm run build`.
4. Fill out the pull request template.
5. Open the PR against `main` using a Conventional Commit title.
6. Wait for CI and required review approval before merging.

## Code expectations

- Follow the existing feature-based structure under `src/`.
- Reuse shared UI primitives from `src/components/ui/` before adding new component patterns.
- Keep route definitions in the three tables that hold them: `src/routes/index.jsx` for the root router, `src/routes/appScreens.jsx` for the authenticated screens, and `src/features/admin/adminRoutes.jsx` for the panel. Do not add an ad-hoc `<Routes>` tree elsewhere.
- Put API calls behind service modules instead of scattering `axios` calls in components.
- Keep environment-specific values behind `import.meta.env`.

## Testing

Vitest is configured and CI runs it. `.github/workflows/ci-fe.yml` runs `npm run lint`, `npm test` and `npm run build` on every PR, and all three must pass.

| Command | What it runs |
|---------|--------------|
| `npm run test` | The unit suite under `tests/unit/`, via `vitest.config.js`. This is what CI runs. |
| `npm run test:watch` | The same suite in watch mode. |
| `npm run test:live` | The suite under `tests/live/`, via `vitest.live.config.js`. It needs a running backend and is not part of CI. |
| `npm run test:all` | `test` then `test:live`. |

There are 26 test files in total: 21 under `tests/unit/` and 5 under `tests/live/`.

## Security issues

Do not open public issues for vulnerabilities. Use the process in [SECURITY.md](SECURITY.md).
