import type { OxlintConfig } from 'oxlint'

export type { OxlintConfig } from 'oxlint'

export interface PresetOptions {
  /** TypeScript is enabled by default. */
  typescript?: boolean
  /** Checks Vue script blocks; Oxlint does not lint templates. */
  vue?: boolean
  /** Enables Vue checks and excludes generated Nuxt directories. */
  nuxt?: boolean
  /** Adds Node.js globals and rules. */
  node?: boolean
}

/** Accepts every Oxlint configuration field, including extends and settings. */
export type ConfigOverrides = OxlintConfig

/**
 * Returns a new self-contained configuration with no ESLint dependencies.
 * Maps are merged by key; file overrides are appended.
 * Explicit plugins and ignorePatterns replace preset values, including empty arrays.
 */
export function createConfig(
  options: PresetOptions = {},
  overrides: ConfigOverrides = {},
): OxlintConfig {
  const useTypescript = options.typescript ?? true
  const useVue = options.vue === true || options.nuxt === true
  const plugins: NonNullable<OxlintConfig['plugins']> = ['eslint', 'unicorn', 'oxc']
  const rules: NonNullable<OxlintConfig['rules']> = {
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-constant-binary-expression': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  }

  if (useTypescript) {
    plugins.push('typescript')
    Object.assign(rules, {
      'typescript/array-type': ['error', { default: 'array' }],
      'typescript/consistent-type-imports': 'error',
      'typescript/no-import-type-side-effects': 'error',
    })
  }

  if (useVue) {
    plugins.push('vue')
    Object.assign(rules, {
      'vue/no-export-in-script-setup': 'error',
      'vue/no-async-in-computed-properties': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/no-lifecycle-after-await': 'error',
      'vue/no-watch-after-await': 'error',
      'vue/no-expose-after-await': 'error',
    })
  }

  if (options.node) {
    plugins.push('node')
    Object.assign(rules, {
      'node/no-exports-assign': 'error',
      'node/no-new-require': 'error',
      'unicorn/prefer-node-protocol': 'error',
    })
  }

  // Leave no-undef disabled: the project typecheck handles Nuxt auto-imports.
  const config: OxlintConfig = {
    plugins,
    categories: { correctness: 'error' },
    rules,
    env: options.node ? { builtin: true, node: true } : { builtin: true },
    ignorePatterns: ['**/node_modules/**', ...(options.nuxt ? ['.nuxt/**', '.output/**'] : [])],
  }

  return {
    ...config,
    ...overrides,
    categories: { ...config.categories, ...overrides.categories },
    rules: { ...rules, ...overrides.rules },
    env: { ...config.env, ...overrides.env },
    globals: { ...config.globals, ...overrides.globals },
    overrides: [...(config.overrides ?? []), ...(overrides.overrides ?? [])],
  }
}

export const base = createConfig({ typescript: false })
export const typescript = createConfig()
export const vue = createConfig({ vue: true })
export const nuxt = createConfig({ nuxt: true })
export const node = createConfig({ node: true })

export default createConfig
