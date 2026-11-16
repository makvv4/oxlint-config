# Agent instructions

## Project

This is the standalone `@makvv4/oxlint-config` package. It provides native Oxlint presets and an optional Oxfmt configuration. It has its own Git repository, package manifest, lockfile, tests, and CI.

- Keep all project files, documentation, comments, examples, and commit messages in English. Do not introduce Cyrillic text.
- Use npm and preserve `package-lock.json`. Check `package.json` for supported Node.js versions and dependency ranges.
- Keep the package free of runtime dependencies on ESLint and its plugins.
- `src/index.ts` exports the Oxlint factory and presets; `src/formatter.ts` is the separate optional formatter entry point.
- Preserve the documented override semantics and the distinction between Vue script checks and template linting.
- Do not edit generated `dist/` files or `node_modules/` manually.
- Inspect Git status before editing and preserve unrelated user changes.

## Validation

Use `npm ci` to install dependencies. Before publishing changes, run:

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
npm pack
```

Tests exercise the real Oxlint CLI and Oxfmt API. `npm pack` builds JavaScript and declarations through `prepack`. Publishing to npm is a separate action and requires an explicit request.
