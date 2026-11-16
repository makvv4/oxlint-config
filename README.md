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

The default configuration enables correctness checks, disallows `var` and `debugger`, prefers `const`, checks unused variables, and includes TypeScript rules for `T[]` and type-only imports. Unused parameters and variables prefixed with `_` are allowed. The `any` type is not banned by default.

All presets ignore `**/node_modules/**`, including nested dependencies in monorepos. This also works in projects without a `.gitignore` file.

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

The Nuxt preset enables Vue script checks and ignores `.nuxt/**` and `.output/**`. It does not register auto-imported globals; keep `nuxt typecheck` in your project. It does not explicitly enable `no-undef`.

Standalone presets are also available: `base`, `typescript`, `vue`, `nuxt`, and `node`.

```ts
import { vue } from '@makvv4/oxlint-config'

export default vue
```

| `createConfig` option | Default | Purpose                                           |
| --------------------- | ------- | ------------------------------------------------- |
| `typescript`          | `true`  | TypeScript rules                                  |
| `vue`                 | `false` | Native rules for Vue script blocks                |
| `nuxt`                | `false` | Enables Vue and ignores Nuxt build directories    |
| `node`                | `false` | Node.js globals and rules for imports and exports |

`nuxt: true` enables Vue even when `vue: false`. The `node` preset also includes TypeScript; for plain JavaScript, use `createConfig({ node: true, typescript: false })`.

### Overriding configuration

The second argument is a regular Oxlint configuration object:

- `rules`, `env`, `globals`, and `categories` are merged by key. Values such as `off` and `false` are preserved.
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

Style: two-space indentation, single quotes, no semicolons, trailing commas, LF line endings, and a print width of 100 characters. Import sorting and package.json field sorting are disabled by default.

To configure Tailwind CSS 4 and import sorting:

```ts
import { createFormatterConfig } from '@makvv4/oxlint-config/formatter'

export default createFormatterConfig({
  sortImports: true,
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

- Oxlint does not currently lint Vue templates: a missing `key` on `v-for` may pass linting. The Vue preset does not claim to be equivalent to eslint-plugin-vue.
- Oxfmt formats Vue files but does not check template correctness. It also does not reproduce every Antfu rule, such as `reasonable-newline` and `top-level-function`.
- Class sorting does not replace the other checks in eslint-plugin-tailwindcss, such as shorthand usage, the position of `!`, and unnecessary arbitrary values.
- Type-aware linting and `oxlint-tsgolint` are not enabled. Keep `tsc`, `vue-tsc`, or `nuxt typecheck` in your project.
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

`npm pack` builds JavaScript and type declarations into `dist`. The tarball contains only `dist`, package.json, README, and LICENSE. Publishing is a separate manual step. There are no install or postinstall scripts.

## References

- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html)
- [Oxlint / Oxfmt compatibility](https://oxc.rs/compatibility.html)
- [Oxfmt sorting](https://oxc.rs/docs/guide/usage/formatter/sorting.html)

MIT © Vlad Makarov
