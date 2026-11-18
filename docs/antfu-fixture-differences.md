# Antfu fixture differences

This audit covers the 16 files that did not produce a successful exact match in the first
comparison. Reference: Antfu 10.0.0, commit
[`bb2013690a517ea9b369d36d79a5708356326a64`](https://github.com/antfu/eslint-config/tree/bb2013690a517ea9b369d36d79a5708356326a64),
`fixtures/output/all`. Tools: Oxlint 1.93.0 and Oxfmt 0.78.0. Checked on 2026-11-16.
The upstream input and expected files remain unchanged.

## Results and corrections

The refined default pipeline produces **3 exact matches among 14 formatted files**, from
18 total inputs. `angular-inline.component.ts` now joins the already matching
`angular.component.ts` and `tsconfig.json`. Ten files receive native script lint, including
Astro and Svelte. All 14 formatted results are stable on a second formatter run. Two safe
Oxlint passes change files; a subsequent pass makes no further changes. There are no remaining
native diagnostics after fixes and formatting in this corpus.

The optional framework run formats 16 of the 18 inputs and still has **3 exact processed
matches**. It uses the same ten native script-lint targets, two changing safe-fix passes, and
finishes with no native diagnostics. Enabling more formatting support does not make its markup
policies identical to Antfu's.

The earlier report confused several distinct cases:

- The remaining `prefer-template` diagnostic was **not a missing fix**. Its edit overlaps
  `no-var` in the first CLI invocation; another ordinary `--fix` invocation applies it.
  The runner now repeats safe fixes until stable, with a bounded failure condition.
- Astro and Svelte are **not intrinsically unsupported**. Oxlint extracts their scripts
  natively. Oxfmt supports them when enabled and their optional compiler packages are
  installed. The initial target list omitted them, and the formatter options were disabled.
- The Oxfmt `format()` API receives already resolved format options. It does not apply the
  full configuration's file overrides, associations, or ignore rules. The comparison now
  uses the real CLI and configuration resolver.
- SVG and XML remain unchanged and are byte-equal to upstream's untouched inputs. They are
  reported as not selected, not as successful formatter matches.
- Antfu's `all` suite enables additional framework linting, but **does not enable its optional
  CSS/HTML/XML formatters**. A difference from an untouched input is not evidence of an Oxfmt
  defect. Removing useful formatting merely to increase the match count would hide this scope
  difference.

## Changes applied

- JS/TS/JSX/TSX formatter overrides disable embedded HTML/CSS/GraphQL formatting, matching
  Antfu's default source-file scope. Vue stays outside this override so its script blocks are
  formatted. This resolves the Angular inline fixture completely. An explicit caller
  `embeddedLanguageFormatting` value takes precedence, and caller `overrides` still replaces
  the default scope array.
- Native `react/jsx-curly-brace-presence` supplies the JSX style check corresponding to
  Antfu's Stylistic rule. It converts the TSX template-literal attribute ``bar={`foo`}`` to `bar="foo"` and is
  scoped to JSX/TSX files. This does not enable a React framework preset.
- The overbroad `no-useless-escape` approximation was removed. It changed ordinary strings
  such as the JSX fixture's `\grey`, whereas Antfu's regexp rule concerns regular expressions.
- `quoteProps: 'consistent'` and `experimentalOperatorPosition: 'start'` now match Antfu's
  relevant style choices. These defaults are validated separately; the original fixture
  corpus is not a comprehensive exercise of either option.
- The runner includes Astro/Svelte script targets, converges safe fixes, records separate
  processing and byte-equality statuses, and can retain complete expected/actual outputs.

## The 16 original mismatches

| File                          | What changed or remains                                                                                                                                                                                                                                                                                                     | Classification                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `angular-inline.component.ts` | Exact match after disabling embedded formatting for source files. Previously Oxfmt self-closed the embedded `img` and indented the closing template literal; Antfu left that template text alone.                                                                                                                           | Fixed configuration/scope mismatch.                                                                   |
| `angular.component.html`      | Oxfmt writes `<img ... />`; Antfu `all` leaves the original `<img ...>` unchanged.                                                                                                                                                                                                                                          | Formatting scope difference; Angular HTML is supported.                                               |
| `astro.astro`                 | Native lint now fixes `let` to `const` in the script. Formatting is opt-in. With the optional formatter enabled, remaining differences include frontmatter semicolons, collapsed conditional markup, blank lines, and script indentation.                                                                                   | Corrected target selection; optional compiler setup; remaining formatter policy differences.          |
| `css.css`                     | Oxfmt expands blocks and normalizes leading zeros, selector spacing/quotes, and semicolons. Antfu `all` leaves the input untouched.                                                                                                                                                                                         | Formatting scope difference.                                                                          |
| `html.html`                   | Oxfmt normalizes doctype/tag/attribute casing, void tags, paragraph wrapping, and script layout. Antfu `all` leaves the input untouched.                                                                                                                                                                                    | Formatting scope difference.                                                                          |
| `javascript.js`               | Both tools fix `var`. Remaining differences are array/call/condition wrapping, conditional arrow parentheses, a multiline ternary inside a template literal, and Stroustrup `catch` placement.                                                                                                                              | Formatter policy and unavailable Antfu style rules.                                                   |
| `jsx.jsx`                     | Native fixes normalize the exponent's case, and the original ordinary string escape is preserved. Antfu removes the regexp's redundant `i` flag; Oxfmt retains it. Remaining formatting differs in exponent spelling (`1e+7`/`1e7`), chaining, JSX expression spacing, text/wrapping, and an extra semicolon after a block. | Missing regexp simplification plus formatter/style differences.                                       |
| `markdown.md`                 | The JS code fence matches in this fixture. Oxfmt additionally formats the CSS fence and normalizes emphasis, tables, list markers, the horizontal rule, and reference spacing. Antfu preserves those parts.                                                                                                                 | Mixed scope and formatter policy differences.                                                         |
| `svelte.svelte`               | Native script lint is included. With the optional formatter enabled, the remaining difference is `<script lang='ts'>` becoming `<script lang="ts">`.                                                                                                                                                                        | Optional compiler setup; bundled Svelte formatter's attribute quote policy.                           |
| `svg.svg`                     | Default Oxfmt selection skips this extension; Antfu `all` also leaves its contents unchanged. An HTML association formats this SVG, but then differs from the untouched reference.                                                                                                                                          | Not selected by default; optional association, not an exact-match improvement.                        |
| `toml.toml`                   | Oxfmt collapses arrays, retains quoted key/table names, and preserves the interleaved dotted-key order. Antfu removes unnecessary key quotes and groups `apple.*` before `orange.*`.                                                                                                                                        | No exposed native equivalents for those TOML layout/key transformations.                              |
| `tsx.tsx`                     | Native JSX fixes now match the string-valued attribute transformation. Remaining differences are multiline props, component/text wrapping, and placement of adjacent JSX text/elements.                                                                                                                                     | Fixed rule gap; remaining formatter policy differences.                                               |
| `typescript.ts`               | Repeated safe fixes now produce the same template literal. Remaining differences are collapsed call arguments, class-member blank lines, and Antfu converting a top-level arrow function into a function declaration.                                                                                                       | Fixed invocation issue; remaining formatter/custom-rule differences.                                  |
| `vue-ts.vue`                  | Oxfmt retains the original template-before-script order, uses different button wrapping, and formats the CSS/SCSS blocks that Antfu leaves untouched. The native result also retains the arrow function and the `let` ref declaration.                                                                                      | Block/style scope and formatting differences; Oxlint deliberately skips `prefer-const` for Vue files. |
| `vue.vue`                     | Native import and template-literal fixes agree. Remaining differences include template-before-script order, button wrapping, the arrow function, `let` declarations, and ref arithmetic: Antfu writes `.value` where the native result retains `doubled + counter`.                                                         | Block/formatting differences and missing script transformations; see the rule analysis below.         |
| `xml.xml`                     | Default Oxfmt selection skips it; bytes equal the untouched upstream input. No XML language/formatter is exposed. Treating arbitrary XML as HTML is not a sound replacement.                                                                                                                                                | Native XML capability limit; unchanged bytes are not processing coverage.                             |

The expected and actual TSX fixtures were also transpiled with TypeScript 6.0.3 and evaluated
with a test JSX factory: their element/props/children trees agree, including mixed inline text.
The remaining line wrapping in that fixture does not change rendered children.

The two existing exact matches were unchanged upstream inputs. The newly exact Angular inline
fixture is different: both engines now make the same source-code formatting change while
preserving the embedded template.

## Why the remaining settings cannot make an exact clone

Oxfmt exposes a printer's options, not Antfu's collection of independent ESLint style rules.
It has no Stroustrup brace option, conditional arrow-parentheses mode, general preservation of
array/call line breaks, top-level arrow-to-function transformation, or Antfu's class/chaining/list
newline conventions. Smaller widths or fixture-specific formatting exclusions can move individual
lines closer while moving other lines farther away; they do not implement the missing policies.
The shared 100-column width remains a project choice, not an Antfu equivalence claim.

The formatter cannot provide semantic regexp flag analysis or Vue ref-operand validation.
Native checks and their scope must be evaluated independently from printed output. In Oxlint
1.93.0, `prefer-const` explicitly skips all Vue and Svelte files because template assignments are
not visible to its script analysis. The same JavaScript code is fixed in a `.js` file, but no
rule option overrides the component-file exclusion. The `let` differences are therefore a
deliberate native rule limitation, not an Oxfmt problem. The additional Vue arithmetic difference
comes from the absence of a native `vue/no-ref-as-operand` counterpart: formatting cannot insert
the missing `.value` accesses. These are script-analysis gaps, not merely template style.

For Markdown, turning embedded formatting off preserves the CSS fence but also leaves the JS
fence unformatted. It does not stop prose/table/list normalization. For Vue, disabling embedded
formatting globally would stop the script formatting needed for parity. Neither broad switch
solves the mixed-language fixture as a whole.

Astro and Svelte use Oxfmt's bundled formatter adapters for markup and require optional compilers;
they need no ESLint installation. Isolated probes used `@astrojs/compiler-rs@0.5.3` and
`svelte@5.57.3`. Both the API and CLI succeeded, with identical outputs. Svelte's script-tag quote
difference remained with `singleQuote`, `jsxSingleQuote`, and the exposed Svelte options. Astro's
mixed frontmatter semicolon state cannot be preserved by one `semi` setting.

SVG can be associated with HTML using the normal Oxfmt configuration:

```ts
createFormatterConfig({
  associations: [{ files: ['**/*.svg'], language: 'html' }],
})
```

This successfully formats the valid SVG fixture, including its SVG attribute casing. It is an
explicit formatting choice, not general XML support, and is not enabled just to change the
comparison denominator.

## Reproduce and inspect every diff

Run the default comparison and retain the outputs in a new directory:

```sh
npm run compare:antfu -- --details-dir /tmp/antfu-default-review
diff -u /tmp/antfu-default-review/expected/typescript.ts \
  /tmp/antfu-default-review/actual/typescript.ts
```

The report directory must not already exist. It contains `report.json`, `expected/`, and
`actual/`. `referenceChanged`, `formatterStatus`, `byteEqual`, and `exactMatch` distinguish
upstream changes, processing status, literal equality, and successful formatted matches.

To exercise the optional framework formatters without changing this package's dependency graph:

```sh
formatter_dir=$(mktemp -d)
npm install --prefix "$formatter_dir" --ignore-scripts --no-audit --no-fund --save-exact \
  oxfmt@0.78.0 @astrojs/compiler-rs@0.5.3 svelte@5.57.3
npm run compare:antfu -- --framework-formatters \
  --oxfmt-bin "$formatter_dir/node_modules/oxfmt/bin/oxfmt" \
  --details-dir /tmp/antfu-framework-review
```

## Sources

- [Pinned Antfu fixture runner](https://github.com/antfu/eslint-config/blob/bb2013690a517ea9b369d36d79a5708356326a64/test/fixtures.test.ts)
- [Oxfmt configuration options](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html)
- [Oxfmt language support and optional compilers](https://oxc.rs/docs/guide/usage/formatter/language-support.html)
- [Oxfmt embedded formatting](https://oxc.rs/docs/guide/usage/formatter/embedded-formatting.html)
- [Pinned Oxlint `prefer-const` component-file exclusion](https://github.com/oxc-project/oxc/blob/oxlint_v1.93.0/crates/oxc_linter/src/rules/eslint/prefer_const.rs#L192)

Configuration claims were also checked against the pinned package's installed type definitions
and real CLI/API runs; current web documentation alone is not the versioned test oracle.
