# @makvv4/oxlint-config

Shared **Oxlint + Oxfmt** configuration for JavaScript, TypeScript, Vue, Nuxt, and Node.js. Uses only native Oxlint rules, with no runtime dependencies on ESLint, Antfu, TypeScript ESLint, or deepmerge.

The package is not yet published to npm. Until then, use a tarball created with `npm pack`.

## Requirements

- Node.js `^22.18.0 || >=24.0.0` to load TypeScript configuration files.
- Oxlint `^1.93.0`.
- Oxfmt `^0.78.0` for formatting. It is an optional peer dependency and is not required when using only Oxlint.
- ESM package. CI covers Node.js 22 and 24.

Once published:

```sh
npm install -D @makvv4/oxlint-config oxlint oxfmt
```

## Oxlint

Create `oxlint.config.ts`:

```ts
import { createConfig } from '@makvv4/oxlint-config'

export default createConfig()
```

The defaults approximate Antfu 10 with explicitly selected native JavaScript, TypeScript, import, Unicorn, Node, JSDoc, and Vitest rules. They disallow `var`, `debugger`, and ordinary `console.log` calls; allow `console.warn` and `console.error`; prefer `const`, interfaces, and separate type imports; and check unused variables. Unused parameters and variables prefixed with `_` are allowed. Both `T[]` and `Array<T>` are accepted, and `any` is not banned.

Browser and Node globals are available by default. `no-undef` checks JavaScript; TypeScript files rely on your typecheck. TypeScript rules are scoped to TS/TSX and enabled Vue files. Vitest rules apply only to test/spec/bench/benchmark files and `__tests__`; set `test: false` for other test frameworks, including `node:test`.

All presets ignore dependencies, build output, coverage, caches, generated declarations, and other Antfu-like exclusions, including nested `node_modules`, `dist`, `.nuxt`, and `.output` directories. This also works without a `.gitignore`. Scripts, CLI files, and configuration files allow console output and top-level await.

For Nuxt:

```ts
import { createConfig } from '@makvv4/oxlint-config'

export default createConfig(
  { nuxt: true },
  {
    rules: {
      'typescript/no-explicit-any': 'warn',
    },
  },
)
```

The Nuxt preset enables Vue script checks. It does not register Nuxt auto-imported globals; keep `nuxt typecheck` in your project. JavaScript files using Nuxt auto-imports need consumer-supplied `globals` or a `no-undef` override.

Standalone presets are also available: `base`, `typescript`, `vue`, `nuxt`, and `node`.

```ts
import { vue } from '@makvv4/oxlint-config'

export default vue
```

| `createConfig` option | Default | Purpose                                         |
| --------------------- | ------- | ----------------------------------------------- |
| `typescript`          | `true`  | TypeScript rules                                |
| `vue`                 | `false` | Native rules for Vue script blocks              |
| `nuxt`                | `false` | Enables Vue and ignores Nuxt build directories  |
| `node`                | `true`  | Node.js globals and available native Node rules |
| `imports`             | `true`  | Native import checks and named-member sorting   |
| `unicorn`             | `true`  | Unicorn rules and selected modernization checks |
| `jsdoc`               | `true`  | Available JSDoc checks at warning severity      |
| `test`                | `true`  | Vitest checks scoped to test files              |

`nuxt: true` enables Vue even when `vue: false`. The `node` preset also includes TypeScript; for plain JavaScript, use `createConfig({ node: true, typescript: false })`.

### Overriding configuration

The second argument is a regular Oxlint configuration object:

- `rules`, `env`, `globals`, and `categories` are merged by key. Values such as `off` and `false` are preserved.
- Global caller rules also override conflicting preset file-scope rules. Use the native rule names shown in `src/rules.ts` (for example, `typescript/consistent-type-definitions`).
- `overrides` are appended after the preset's overrides.
- `plugins`, `ignorePatterns`, `settings`, `jsPlugins`, and `extends` are replaced by explicitly supplied values, including empty arrays. When replacing plugins, make sure the enabled rules match the resulting plugin list. Prefer disabling an unwanted preset through the first argument.
- When replacing `ignorePatterns`, include `**/node_modules/**` in your list if dependencies should remain ignored. An explicit `[]` removes this default exclusion as well.
- The factory does not mutate its inputs and returns a new base configuration on each call. Nested objects supplied by the caller are not cloned.

Import the package from `oxlint.config.ts` and export the result directly. `.oxlintrc.json` does not resolve npm package names in `extends`. In the tested Oxlint version, 1.93.0, inheriting configuration objects through `extends` drops some environment fields. The factory returns a fully assembled object and does not rely on that inheritance behavior.

## Oxfmt

Create `oxfmt.config.ts`:

```ts
import formatter from '@makvv4/oxlint-config/formatter'

export default formatter
```

Style: two-space indentation, single quotes, no semicolons, trailing commas, LF line endings, and a print width of 100 characters. Import sorting uses Antfu-like groups; package.json field/dependency sorting is enabled. Side-effect imports and package scripts retain their order. Set `sortImports: false` or `sortPackageJson: false` to disable sorting.

To configure Tailwind CSS 4 while keeping the preset's import groups:

```ts
import { createFormatterConfig } from '@makvv4/oxlint-config/formatter'

export default createFormatterConfig({
  sortTailwindcss: {
    stylesheet: './app/assets/css/tailwind.css',
    functions: ['cn'],
  },
  ignorePatterns: ['.nuxt/**', '.output/**'],
})
```

The stylesheet path refers to a file in the consuming project. The factory returns a new object, with supplied options replacing the preset's values. Tailwind support comes from Oxfmt and does not require eslint-plugin-tailwindcss.

Add these scripts to your project:

```json
{
  "scripts": {
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "format": "oxfmt .",
    "format:check": "oxfmt --check ."
  }
}
```

## Limitations

- This is a native approximation, not full Antfu compatibility. See the [rule comparison and measured test results](docs/antfu-compatibility.md).
- Oxlint does not currently lint Vue templates: a missing `key` on `v-for` may pass linting. The Vue preset does not claim to be equivalent to eslint-plugin-vue.
- Oxfmt formats Vue files but does not check template correctness. It also does not reproduce every Antfu rule, such as `reasonable-newline` and `top-level-function`.
- Class sorting does not replace the other checks in eslint-plugin-tailwindcss, such as shorthand usage, the position of `!`, and unnecessary arbitrary values.
- Type-aware linting and `oxlint-tsgolint` are not enabled. Keep `tsc`, `vue-tsc`, or `nuxt typecheck` in your project.
- Export sorting, natural named-import ordering, tsconfig sorting, and semantic linting for JSON/YAML/TOML/Markdown are not reproduced. Oxfmt's wrapping and brace layout differ from Antfu.
- Loading existing ESLint plugins through `jsPlugins` can bring back their transitive dependencies. This package does not guarantee a clean audit for your entire project.

## Development

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run format:check
npm pack
```

`npm run compare:antfu` runs the real native tools on 18 vendored Antfu fixtures and reports exact matches and remaining diagnostics. Normal tests include 36 behavior expectations verified against Antfu 10.0.0. An optional isolated Antfu reference runner is documented in the comparison; ESLint is not added to this package's dependencies.

`npm pack` builds JavaScript and type declarations into `dist`. The tarball contains only `dist`, package.json, README, LICENSE, and THIRD_PARTY_NOTICES. Publishing is a separate manual step. There are no install or postinstall scripts.

## References

- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html)
- [Oxlint / Oxfmt compatibility](https://oxc.rs/compatibility.html)
- [Oxfmt sorting](https://oxc.rs/docs/guide/usage/formatter/sorting.html)

MIT © Vlad Makarov
