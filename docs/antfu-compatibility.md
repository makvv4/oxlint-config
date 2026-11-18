# Antfu compatibility

Reference checked on 2026-11-16: `@antfu/eslint-config@10.0.0`, upstream commit
[`bb2013690a517ea9b369d36d79a5708356326a64`](https://github.com/antfu/eslint-config/tree/bb2013690a517ea9b369d36d79a5708356326a64).
Native tools are pinned to Oxlint 1.93.0 and Oxfmt 0.78.0. This is a native approximation
of Antfu's default application configuration for JavaScript, TypeScript, and Vue, not an
ESLint-compatible API or a full port of every optional framework integration.

## What is implemented

| Area                    | Native configuration                                                                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript              | 99 explicit core rules, plus a native equivalent for top-level await. Includes smart equality, console restrictions, empty catches, shorthand, callbacks, use-before-define, and unused-variable options.                                                                                      |
| TypeScript              | 31 enabled entries in the TypeScript scope, including shared core rules. Strict syntax checks, interfaces, separate type imports, property method signatures, documented `@ts-expect-error`, and const-enum restrictions. `any`, non-null assertions, and both array notations remain allowed. |
| Unicorn / modernization | All 15 rules in Antfu's default Unicorn subset, plus native date, array-some, and own-property checks approximating three e18e rules.                                                                                                                                                          |
| Imports                 | Six native import rules plus named-member sorting. The native type-specifier option is `prefer-top-level`, whereas Antfu uses `top-level`.                                                                                                                                                     |
| JSX style               | Native `react/jsx-curly-brace-presence` with Antfu's `propElementValues: always`, scoped to JSX/TSX. Disable with `jsx: false`; the full React option is separate.                                                                                                                             |
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

See the [file-by-file audit](antfu-fixture-differences.md) for all 16 original mismatches, the corrected measurement method, and tool-versus-scope limitations.

Three complementary checks are included here:

1. `fixtures/antfu-behavior.json` contains 36 focused positive/negative expectations. They were
   checked against the actual Antfu 10.0.0 configuration and the native CLI: **36/36 agree** on the
   selected rule. A further **59/59** expectations agree for library mode (11), typed lint (27), React (7), Next (5), and accessibility (9). These checks compare selected diagnostics, not complete diagnostic output.
2. An isolated installation of Antfu 10.0.0 and ESLint 10.0.3 reproduced **6/6 original snapshots**:
   JavaScript, TypeScript, JSX, TSX, Vue JavaScript, and Vue TypeScript. This validates the chosen
   reference; it does not claim to run Antfu's complete Vitest/API/CLI/framework suite.
3. The 18 upstream inputs and their `all` snapshots are vendored unchanged with MIT attribution.
   The refined comparison uses the real Oxfmt CLI so file overrides and associations apply.
   Oxlint checks ten script-bearing files, including Astro and Svelte. Two safe fix passes change
   files; a third makes no changes. Oxfmt formats 14 files idempotently by default. **3/14 processed
   files (18 total inputs) match exactly**: `angular-inline.component.ts`, `angular.component.ts`,
   and `tsconfig.json`. With optional Astro/Svelte compilers and settings, **3/16 processed files**
   match. There are no remaining native diagnostics in either run.

The initial comparison matched only 2/18. Its `prefer-template` residual was an invocation problem,
not a missing fixer: a second ordinary safe-fix pass resolves overlapping edits. Its unsupported
format claim was also too broad: Astro/Svelte are opt-in formats requiring compiler packages.
The initial API-only formatter call did not resolve full configuration overrides.

The two original exact files are unchanged upstream inputs; the newly matching Angular inline
fixture tests a real transformation. Unprocessed SVG/XML bytes also equal the untouched upstream
input, but are recorded separately and are not counted as formatter matches. Zero diagnostics is
not evidence of full coverage: for example, native Vue ref-operand checking is still absent.

The upstream `all` suite leaves standalone CSS/HTML/SVG/XML unchanged. Oxfmt's additional
formatting of CSS/HTML is a scope difference, not a tool defect. Astro/Svelte formatting can be
exercised separately through the runner's `--framework-formatters` and `--oxfmt-bin` options;
see the detailed audit for the isolated compiler installation and reproduction commands.

Run all native behavior, integration, and fixture checks without ESLint dependencies:

```sh
npm ci
npm test
npm run compare:antfu
# Retain expected/actual output in a new directory for inspecting each diff:
npm run compare:antfu -- --details-dir /tmp/antfu-review
# Optional JSON report, written to a caller-selected path:
npm run compare:antfu -- /tmp/antfu-comparison.json
```

To verify the reference again, install it outside this repository:

```sh
oracle_dir=$(mktemp -d)
npm install --prefix "$oracle_dir" --legacy-peer-deps --ignore-scripts --no-audit --no-fund --save-exact \
  @antfu/eslint-config@10.0.0 eslint@10.0.3 typescript@6.0.3 @vue/compiler-sfc@3.5.44 \
  @eslint-react/eslint-plugin@5.28.6 @next/eslint-plugin-next@16.4.2 \
  eslint-plugin-react-refresh@0.5.7 eslint-plugin-jsx-a11y@6.10.2
npm run test:antfu-reference -- "$oracle_dir"
```

The oracle is a developer-only comparison tool, excluded from the published package. Antfu's
transitive version ranges may resolve differently later; a snapshot failure requires investigation,
not automatic acceptance of new output. Normal CI uses vendored fixtures and needs no oracle.

## Optional presets

| Option                | Native coverage compared with Antfu 10                                                                                                                 | Known boundary                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type: 'lib'`         | Explicit TypeScript function return types, including Antfu's callback, IIFE and path exceptions.                                                       | No e18e `prefer-static-regex` or editor-only module replacement checks.                                                                                                                                |
| `typeAware: true`     | All 19 enabled rules in Antfu's typed TypeScript group, including its strict-boolean and return-await options. Tested with `oxlint-tsgolint` 7.0.2007. | Uses Oxlint project discovery, not Antfu's parser API; excludes Vue SFCs and does not run `tsc`.                                                                                                       |
| `react: true`         | Selected rules for hooks, JSX, DOM, class lifecycles, compiler checks and Fast Refresh.                                                                | No equivalent for the full upstream set, including web API cleanup and server-component checks. Native lifecycle and children diagnostics may differ in severity. No Vite/Remix/Router auto-detection. |
| `nextjs: true`        | 21 of 22 rules from the pinned Next.js recommended + Core Web Vitals sets at their upstream severity.                                                  | Oxlint lacks `no-location-assign-relative-destination`.                                                                                                                                                |
| `accessibility: true` | All 31 active JSX accessibility rule names from Antfu's `jsx: { a11y: true }`, including its role and handler options.                                 | Applies to JSX/TSX only. Matching names do not guarantee identical analyzers or autofixes.                                                                                                             |

The optional oracle installs plugins only in its isolated comparison directory. `--legacy-peer-deps` is needed there because the reference JSX accessibility package does not declare ESLint 10 in its peer range. The native presets never import those plugins.

## Remaining differences

- **Vue scripts and templates:** no native template validation, including `v-for` keys, directives, component
  usage, prop mutation in templates, and template accessibility. Native `vue/no-ref-as-operand` is
  also absent, leaving some script arithmetic incorrect. Oxlint 1.93.0 deliberately skips
  `prefer-const` in Vue/Svelte because template assignments are not visible to its analysis.
- **Stylistic:** Oxfmt has its own wrapping rules and brace layout. Consistent property quotes, wrapped
  operators before operands, and the native JSX literal/element-prop brace check are configured. It cannot implement Antfu's
  Stroustrup braces, top-level function conversion, `reasonable-newline`, conditional braces,
  chaining/list rules, Vue block/attribute ordering, or every JSX convention. The 100-column
  formatter width is our policy; Antfu's default Stylistic configuration has no equivalent width.
- **Sorting:** import groups are close, but Oxfmt's boolean newline policy cannot reproduce
  Perfectionist's `ignore` behavior. Side effects remain barriers. Named imports use native lexical
  ordering rather than natural ordering (`item10` versus `item2`). Native export sorting and
  Antfu's tsconfig field sorting are unavailable. Package field order is Oxfmt's built-in order,
  not a copy of Antfu's custom JSONC order.
- **Rule implementations:** matching names/options do not guarantee identical diagnostics or fixes.
  Overlapping safe edits can need multiple CLI invocations. Core `no-useless-escape` is intentionally
  absent: it changes ordinary strings Antfu leaves alone and is not a regex-only substitute.
  Native unused-variable checking consolidates Antfu's core/unused-import plugin checks; unused
  import fixing can differ. `no-focused-tests` covers native Vitest patterns, not every framework
  recognized by `eslint-plugin-no-only-tests`. e18e approximations are not exhaustive.
- **Unavailable checks:** most regexp and e18e rules, some Node/JSDoc rules, ESLint-comment rules,
  custom Antfu import restrictions, and generic ESTree selector restrictions have no complete
  native equivalent here. The const-enum selector is covered; TypeScript export assignment is not.
  `dot-notation` in this Oxlint version requires type-aware linting and is enabled only in the opt-in TS scope.
- **Other languages/frameworks:** no JSON/JSONC/YAML/TOML/Markdown semantic lint, embedded Markdown
  code lint, pnpm catalog rules, or dedicated Svelte/Astro/Solid/Angular lint presets.
  Formatting a file is not equivalent to those checks.
- **API and types:** explicit booleans and a plain object replace auto-detection and
  FlatConfigComposer. `typescript: false` disables TS-specific rules rather than ignoring TS files.
  Editor-specific severity changes and framework auto-detection are not reproduced. Keep `tsc`, `vue-tsc`, or `nuxt typecheck`.

For each remaining area, full parity requires either upstream native capabilities, a separately
scoped feature, or bringing ESLint plugins back. This package retains zero runtime dependencies
and does not load ESLint plugins through `jsPlugins`.

## Changes from the initial 0.1.0 implementation

The package is still unpublished, but existing local consumers should review these changes:
Node, import, JSDoc, Unicorn, JSX style, and Vitest defaults are broader; `console.log` and undefined JS
names now fail; interfaces are preferred; the array-notation restriction is removed; more generated
files are ignored; and import/package sorting is enabled. Embedded HTML/CSS in JS/TS strings is preserved by default;
Vue script/style formatting remains enabled. Explicit `embeddedLanguageFormatting` and formatter
`overrides` can change that policy. Explicit `false`, `off`, and empty arrays
remain effective. Global caller rules also replace conflicting preset file-scope values; caller
file overrides are appended last. All inherited preset rule options are fresh for each factory call.
