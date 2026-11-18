# Project context: @makvv4/oxlint-config

Snapshot: 2026-11-18, updated after the Antfu compatibility work. Recheck Git state, package versions, and upstream limitations before future implementation.

## Purpose and scope

Build an independent, reusable configuration package for native Oxlint and Oxfmt, inspired by the convenience of `@antfu/eslint-config`. The goal is to remove the ESLint / TypeScript ESLint dependency chain while keeping useful defaults for JavaScript, TypeScript, Vue, Nuxt, and Node.js.

The package approximates Antfu 10 defaults but does not provide full Antfu compatibility. Native rules and explicit limitations take priority over restoring ESLint plugins through `jsPlugins`. It has no runtime dependencies; Oxlint is a peer dependency and Oxfmt and oxlint-tsgolint are optional peers.

The original SURGAZ application motivated this work. It has not been migrated to this package, and no application runtime behavior has changed. Work on this repository must not implicitly change that application.

## Repository and release status

- Repository: https://github.com/makvv4/oxlint-config
- Local project: `/Users/vladislavmakarov/projects/oxlint-config`
- Public repository, MIT license, ESM package.
- Package version: `0.1.0`; not yet published to npm.
- `main` was rebuilt as a single English root commit, `7c61a5c`, at the handoff snapshot. The user explicitly requested a clean initial history without Cyrillic content.
- Verified CI for Node.js 22 and 24: https://github.com/makvv4/oxlint-config/actions/runs/43807456831
- Git authentication through SSH works. The GitHub connector returned HTTP 403 for write operations; use the working Git workflow where appropriate. No credentials belong in repository files or handoff notes.

Russian is allowed in chat; every repository file, comment, document, and commit message must remain English. Chat with the user in Russian, but keep all library artifacts free of Cyrillic characters. Preserve this explicit preference in future work.

## Current implementation

`src/index.ts` exports `createConfig(options, overrides)`, the default factory export, and
standalone `base`, `typescript`, `vue`, `nuxt`, `node`, `lib`, `typeAware`, `react`, `nextjs`, and `accessibility` presets. `src/rules.ts` contains
reviewable native rule groups adapted from Antfu 10.0.0, with MIT attribution in
`THIRD_PARTY_NOTICES`.

TypeScript, Node, import, Unicorn, JSDoc, JSX style, and Vitest support are enabled by default. Vue/Nuxt
remain explicit; Nuxt enables Vue even when `vue: false`. Native correctness defaults are
replaced with explicit rule selection. Browser and Node globals are enabled. JavaScript uses
`no-undef`; TypeScript scopes defer to typechecking. Nuxt's generated auto-import registry is
not reconstructed, so JavaScript auto-imports need caller globals or a rule override.

Defaults now match many more Antfu choices: smart equality, restricted console calls,
interfaces, separate type imports, property-style method signatures, strict TS syntax checks,
Node protocol imports, selected modernization checks, and scoped test rules. Both array
notations and `any` are allowed. JSDoc and selected Vue checks preserve warning severity.
Generated/cache/build/dependency directories are excluded, including nested node_modules,
dist, coverage, .nuxt, and .output. Scripts, CLI files, configs, declarations, and test files
receive scoped exceptions. Native JSX style checks normalize literal and element props; they do not enable a React framework preset. Set `test: false` for a framework other than Vitest, including node:test.

Merge behavior remains part of the API contract:

- `rules`, `env`, `globals`, and `categories` merge by key, preserving `off` and `false`.
- Caller global rules also replace conflicting preset file-scope values, using native rule names.
- Caller file `overrides` append after preset overrides and therefore run last.
- Explicit `plugins`, `ignorePatterns`, `settings`, `jsPlugins`, and `extends` replace preset values,
  including empty arrays. `options` also uses normal replacement semantics.
- `ignorePatterns: []` removes the preset exclusions.
- Inputs are not mutated; each call creates fresh internal rule options. Nested caller-owned
  objects are not deep-cloned.

Use the imported result directly in `oxlint.config.ts`. The factory returns a complete
configuration because tested Oxlint 1.93.0 object inheritance through `extends` lost some
configuration fields. JSON `extends` does not resolve npm package names.

`src/formatter.ts`, exported through `@makvv4/oxlint-config/formatter`, provides `formatter`
and `createFormatterConfig`. Defaults: single quotes, no semicolons, trailing commas, two
spaces, LF, print width 100, omitted arrow parentheses where possible, preserved prose wrapping,
and no extra indentation for Vue script/style blocks. Object key quotes are consistent and wrapped
operators start their lines. Embedded HTML/CSS in JS/TS strings is preserved by a file override;
Vue script/style formatting stays active. An explicit caller `embeddedLanguageFormatting` wins,
and caller formatter `overrides` replaces the default array, including `[]`. Import grouping and package.json sorting
are now enabled. Side-effect import order and package script order are preserved. Caller options
replace defaults, including `false`. Tailwind class sorting remains opt-in.

## Antfu comparison and validation

Read [the full compatibility report](antfu-compatibility.md) for provenance, covered rules,
remaining gaps, test methodology, and reproduction commands. Reference: Antfu 10.0.0 at
`bb2013690a517ea9b369d36d79a5708356326a64`; Oxlint 1.93.0; Oxfmt 0.78.0.

- 95 focused behavior expectations agree between real Antfu and the native CLI: 36 defaults and 59 for the optional modes.
- The isolated Antfu/ESLint oracle reproduces 6/6 original core source fixture snapshots.
- The refined native comparison uses all 18 upstream input files: ten script lint targets,
  14 default formatter targets, and three exact processed matches. Optional Astro/Svelte
  compilers increase formatter targets to 16, with the same three exact matches.
- Safe fixes converge after two changing passes; no native diagnostic remains. The old
  `prefer-template` claim was corrected: overlapping fixes needed another ordinary `--fix` run.
- The runner now uses the Oxfmt CLI, not the low-level API that ignores file overrides.
  It distinguishes processed matches from unchanged, skipped SVG/XML inputs and can export
  complete actual/expected outputs with `--details-dir`.
- Read [the per-file audit](antfu-fixture-differences.md) for all 16 initial mismatches.
  `prefer-const` deliberately skips Vue/Svelte, and native `vue/no-ref-as-operand` is missing;
  zero diagnostics does not establish semantic coverage.
- Native tests also cover overrides, environments/globals, dependency ignores, rule scopes,
  input isolation, formatter sorting, and Vue's template limitation.

Antfu's custom style, Vue template lint, most regexp checks, document lint, several Node/JSDoc
rules, export/tsconfig sorting, framework auto-detection, and FlatConfigComposer are not reproduced.
Library mode adds return-type checks. Opt-in type-aware lint uses the optional `oxlint-tsgolint` peer; React, Next and JSX accessibility use built-in Oxlint plugins. Keep project typechecking.
The original SURGAZ application did not enable Antfu type-aware lint; its Nuxt auto-import
globals and Tailwind lint rules came from separate integrations.

The first implementation passed 15 tests plus tarball-consumer checks and had zero reported
vulnerabilities in an isolated development consumer at that time. Those are historical results,
not a current audit of the package or SURGAZ.

CI uses Ubuntu, Node 22/24, npm, lint, typecheck, formatting, tests, and npm pack. Normal tests
use vendored fixtures and require no ESLint installation. The optional reference runner uses an
isolated external Antfu/ESLint installation, not this package's dependency graph.

`npm pack` builds JavaScript and declarations through `prepack`. The tarball contains `dist`,
package.json, README, LICENSE, and THIRD_PARTY_NOTICES. Generated output, dependencies, logs,
and tarballs are not tracked. There are no install/postinstall scripts.

## Authorization and remaining scope

The user requested making the native configuration as close to Antfu as possible and testing
against Antfu. The resulting implementation and comparison are local work, not a release.
Publishing to npm, migrating SURGAZ, adding ESLint runtime plugins, and rewriting history remain
separate actions. No publication, application migration, or history rewrite is implied.

## References

- [Antfu configuration](https://github.com/antfu/eslint-config)
- [Oxlint and Oxfmt compatibility](https://oxc.rs/compatibility.html)
- [Oxfmt sorting](https://oxc.rs/docs/guide/usage/formatter/sorting.html)
