# TypeScript

The frontend is being converted incrementally to TypeScript. Application behavior and backend contracts remain the same. JavaScript imports are temporarily permitted; every converted module is checked with `strict: true`.

Run `npm run typecheck` to check application, test, and Node-tooling configurations. `npm run build` runs these checks before bundling. CI also runs lint and unit tests.

TypeScript is pinned to 6.0.3 because the installed TypeScript ESLint release supports TypeScript versions below 6.1. Keep the compiler and linter's supported ranges aligned when upgrading.

Shared wire contracts belong in `src/types/` and reflect the backend DTOs and OpenAPI document. Feature-specific props and view models belong alongside their consumers. Keep Zod validation at runtime; infer form types from schemas instead of copying their fields.

Convert dependencies before consumers. Preserve the return shape of existing services, including response envelopes, until their consumers are converted together. Convert tests alongside their modules and check that renamed suites remain discovered.

The application config uses Vite bundler resolution. Directly executed Node scripts use NodeNext resolution and explicit ESM import extensions. A successful browser bundle does not prove a script can run directly under Node.

Do not bypass strict checking with file-wide suppressions, unchecked module declarations, or blanket `any`. Use `unknown` and narrow untrusted input at the boundary.

At the end of migration, remove application/test JavaScript allowances and document any tooling files that must retain JavaScript for loader compatibility.
