# Antfu compatibility

Reference checked on 2026-11-16: `@antfu/eslint-config@10.0.0`, upstream commit
[`bb2013690a517ea9b369d36d79a5708356326a64`](https://github.com/antfu/eslint-config/tree/bb2013690a517ea9b369d36d79a5708356326a64).
Native tools are pinned to Oxlint 1.93.0 and Oxfmt 0.78.0. This is a native approximation
of Antfu's default application configuration for JavaScript, TypeScript, and Vue, not an
ESLint-compatible API or a full port of every optional framework integration.

## What is implemented

| Area                    | Native configuration                                                                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript              | 99 explicit core rules, plus native equivalents for top-level await and unnecessary escapes. Includes smart equality, console restrictions, empty catches, shorthand, callbacks, use-before-define, and unused-variable options.                                                               |
| TypeScript              | 31 enabled entries in the TypeScript scope, including shared core rules. Strict syntax checks, interfaces, separate type imports, property method signatures, documented `@ts-expect-error`, and const-enum restrictions. `any`, non-null assertions, and both array notations remain allowed. |
| Unicorn / modernization | All 15 rules in Antfu's default Unicorn subset, plus native date, array-some, and own-property checks approximating three e18e rules.                                                                                                                                                          |
| Imports                 | Six native import rules plus named-member sorting. The native type-specifier option is `prefer-top-level`, whereas Antfu uses `top-level`.                                                                                                                                                     |
| Node                    | Callback errors, exports assignment, constructor require, and path concatenation. Node globals are enabled by default, alongside browser and ECMAScript globals.                                                                                                                               |
| JSDoc                   | Ten available checks at warning severity.                                                                                                                                                                                                                                                      |
| Tests                   | Six native Vitest checks, scoped to test/spec/bench/benchmark files and `__tests__`. Includes focused tests, titles, `it` consistency, and hook order.                                                                                                                                         |
| Vue                     | 33 enabled native script rules, preserving Antfu's warning levels and opt-outs for duplicate keys, default props, and required prop types. Vue remains opt-in; Nuxt enables it.                                                                                                                |
| File scopes             | TypeScript checks are scoped to TS/TSX and enabled Vue files. Scripts, CLI files, configs, declarations, and tests receive appropriate exceptions. Generated/dependency/cache directories are ignored.                                                                                         |
| Formatting              | Single quotes, no semicolons, two spaces, trailing commas, and LF. Imports use Antfu-like type/builtin/external/internal/relative groups. Package field/dependency sorting is enabled; script order and side-effect import order are preserved.                                                |

Counts describe configured entries, not independent rule equivalence or a percentage of Antfu
coverage. Core entries can occur in more than one scope. The `correctness` category is disabled
and rules are explicitly selected, avoiding unrelated Oxlint defaults such as `no-unassigned-vars`.

JavaScript uses `no-undef`; TypeScript scopes disable it and rely on project typechecking.
The Vue preset supplies common Vue globals, but the Nuxt preset does not reconstruct Nuxt's
generated auto-import registry. JavaScript files using other auto-imports need consumer globals
or a `no-undef` override.

## Tests and actual results

Antfu has [factory snapshots, API/CLI tests, and fixture tests](https://github.com/antfu/eslint-config/tree/bb2013690a517ea9b369d36d79a5708356326a64/test).
Its [fixture runner](https://github.com/antfu/eslint-config/blob/bb2013690a517ea9b369d36d79a5708356326a64/test/fixtures.test.ts)
runs ESLint with fixes and compares complete files. Those snapshots test formatting as well as rules;
they are not a standalone rule-conformance suite that can be pointed at another linter unchanged.

Three complementary checks are included here:

1. `fixtures/antfu-behavior.json` contains 36 focused positive/negative expectations. They were
   checked against the actual Antfu 10.0.0 configuration and the native CLI: **36/36 agree** on the
   selected rule. Other diagnostics are not counted as parity by this test.
2. An isolated installation of Antfu 10.0.0 and ESLint 10.0.3 reproduced **6/6 original snapshots**:
   JavaScript, TypeScript, JSX, TSX, Vue JavaScript, and Vue TypeScript. This validates the chosen
   reference; it does not claim to run Antfu's complete Vitest/API/CLI/framework suite.
3. The 18 upstream inputs and their `all` snapshots are vendored unchanged with MIT attribution.
   Oxlint checks eight JS/TS/JSX/TSX/Vue files; Oxfmt formats 14 supported files idempotently.
   **2/18 files match the upstream snapshot exactly** (`angular.component.ts`, `tsconfig.json`).
   The initial package also matched 2/18: that formatting metric did not improve. After native safe
   fixes, one diagnostic remains: `prefer-template` in `typescript.ts`, where Oxlint does not apply
   the same fix as ESLint. The earlier configuration left five `no-unassigned-vars` diagnostics
   that Antfu does not enable.

The two exact files also show why a snapshot count is not a rule-coverage metric: they are
unchanged upstream inputs. None of the six core source snapshots is byte-for-byte identical to
Antfu after the native pipeline. Tests explicitly retain this distinction.

`astro.astro`, `svelte.svelte`, `svg.svg`, and `xml.xml` are unsupported by the pinned Oxfmt API.
Other formatted documents are not linted by Oxlint. The upstream `all` suite enables additional
frameworks and document linting, but does not enable Antfu's optional CSS/HTML formatters.
Consequently some differences reflect scope as well as formatter choices.

Run all native behavior, integration, and fixture checks without ESLint dependencies:

```sh
npm ci
npm test
npm run compare:antfu
# Optional JSON report, written to a caller-selected path:
npm run compare:antfu -- /tmp/antfu-comparison.json
```

To verify the reference again, install it outside this repository:

```sh
oracle_dir=$(mktemp -d)
npm install --prefix "$oracle_dir" --ignore-scripts --no-audit --no-fund --save-exact \
  @antfu/eslint-config@10.0.0 eslint@10.0.3
npm run test:antfu-reference -- "$oracle_dir"
```

The oracle is a developer-only comparison tool, excluded from the published package. Antfu's
transitive version ranges may resolve differently later; a snapshot failure requires investigation,
not automatic acceptance of new output. Normal CI uses vendored fixtures and needs no oracle.

## Remaining differences

- **Vue templates:** no native template validation, including `v-for` keys, directives, component
  usage, prop mutation in templates, and template accessibility. Oxfmt only formats them.
- **Stylistic:** Oxfmt has its own wrapping rules and brace layout. It cannot implement Antfu's
  Stroustrup braces, top-level function conversion, `reasonable-newline`, conditional braces,
  chaining/list rules, Vue block/attribute ordering, or every JSX convention. The 100-column
  formatter width is our policy; Antfu's default Stylistic configuration has no equivalent width.
- **Sorting:** import groups are close, but Oxfmt's boolean newline policy cannot reproduce
  Perfectionist's `ignore` behavior. Side effects remain barriers. Named imports use native lexical
  ordering rather than natural ordering (`item10` versus `item2`). Native export sorting and
  Antfu's tsconfig field sorting are unavailable. Package field order is Oxfmt's built-in order,
  not a copy of Antfu's custom JSONC order.
- **Rule implementations:** matching names/options do not guarantee identical diagnostics or fixes.
  Native unused-variable checking consolidates Antfu's core/unused-import plugin checks; unused
  import fixing can differ. `no-focused-tests` covers native Vitest patterns, not every framework
  recognized by `eslint-plugin-no-only-tests`. e18e approximations are not exhaustive.
- **Unavailable checks:** most regexp and e18e rules, some Node/JSDoc rules, ESLint-comment rules,
  custom Antfu import restrictions, and generic ESTree selector restrictions have no complete
  native equivalent here. The const-enum selector is covered; TypeScript export assignment is not.
  `dot-notation` in this Oxlint version requires type-aware linting and is not enabled.
- **Other languages/frameworks:** no JSON/JSONC/YAML/TOML/Markdown semantic lint, embedded Markdown
  code lint, pnpm catalog rules, or optional React/Next/Svelte/Astro/Solid/Angular presets.
  Formatting a file is not equivalent to those checks.
- **API and types:** explicit booleans and a plain object replace auto-detection and
  FlatConfigComposer. `typescript: false` disables TS-specific rules rather than ignoring TS files.
  Antfu's `type: 'lib'`, editor-specific severity changes, and opt-in type-aware rules are not
  reproduced. Keep `tsc`, `vue-tsc`, or `nuxt typecheck`.

For each remaining area, full parity requires either upstream native capabilities, a separately
scoped feature, or bringing ESLint plugins back. This package retains zero runtime dependencies
and does not load ESLint plugins through `jsPlugins`.

## Changes from the initial 0.1.0 implementation

The package is still unpublished, but existing local consumers should review these changes:
Node, import, JSDoc, Unicorn, and Vitest defaults are broader; `console.log` and undefined JS
names now fail; interfaces are preferred; the array-notation restriction is removed; more generated
files are ignored; and import/package sorting is enabled. Explicit `false`, `off`, and empty arrays
remain effective. Global caller rules also replace conflicting preset file-scope values; caller
file overrides are appended last. All inherited preset rule options are fresh for each factory call.
