import type { OxlintConfig } from 'oxlint'
import type { ReactPresetOptions } from './frameworks.js'
import { accessibilityRules } from './accessibility.js'
import { isEditorEnvironment } from './editor.js'
import { createReactRules, nextjsRules } from './frameworks.js'
import { scriptIgnorePatterns } from './ignores.js'
import {
  createJavascriptRules,
  importsRules,
  jsdocRules,
  jsxRules,
  nodeRules,
  testRules,
  typescriptRules,
  unicornRules,
  vueRules,
} from './rules.js'
import { typeAwareRules } from './type-aware.js'

export type { OxlintConfig } from 'oxlint'
export type { ReactPresetOptions } from './frameworks.js'

export interface PresetOptions {
  type?: 'app' | 'lib'
  typeAware?: boolean
  /** Overrides editor environment detection, including in CI and Git hooks. */
  isInEditor?: boolean
  react?: boolean | ReactPresetOptions
  nextjs?: boolean
  accessibility?: boolean
  /** TypeScript is enabled by default. */
  typescript?: boolean
  /** Excludes TypeScript files from linting independently of the TypeScript rules. */
  ignoreTypeScript?: boolean
  /** Checks Vue script blocks; Oxlint does not lint templates. */
  vue?: boolean
  /** Enables Vue checks and excludes generated Nuxt directories. */
  nuxt?: boolean
  /** Node.js globals and rules are enabled by default, as in Antfu. */
  node?: boolean
  /** Native import checks are enabled by default. */
  imports?: boolean
  /** Native Unicorn and modernization checks are enabled by default. */
  unicorn?: boolean
  /** Supported JSDoc checks are enabled by default at warning severity. */
  jsdoc?: boolean
  /** Native JSX style checks are enabled by default for JSX/TSX files. */
  jsx?: boolean
  /** Vitest checks in test/spec/bench files are enabled by default. */
  test?: boolean
}

/** Accepts every Oxlint configuration field, including extends and settings. */
export type ConfigOverrides = OxlintConfig

const sourceExtension = '{js,mjs,cjs,jsx,ts,mts,cts,tsx}'
const tsFiles = '**/*.{ts,mts,cts,tsx}'
const scriptFiles = `**/scripts/**/*.${sourceExtension}`
const configFiles = [`**/*.config.${sourceExtension}`, `**/*.config.*.${sourceExtension}`]
const testFiles = [
  `**/__tests__/**/*.${sourceExtension}`,
  `**/*.{test,spec,bench,benchmark}.${sourceExtension}`,
]

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
  const useNode = options.node ?? true
  const isInEditor = options.isInEditor ?? isEditorEnvironment()
  // The node plugin also supplies the native equivalent of antfu/no-top-level-await.
  const plugins: NonNullable<OxlintConfig['plugins']> = ['eslint', 'node', 'oxc']
  const rules = createJavascriptRules(isInEditor)
  rules['node/no-top-level-await'] = 'error'
  const fileOverrides: NonNullable<OxlintConfig['overrides']> = []

  if (options.unicorn !== false) {
    plugins.push('unicorn')
    Object.assign(rules, structuredClone(unicornRules))
  }
  if (options.imports !== false) {
    plugins.push('import')
    Object.assign(rules, structuredClone(importsRules))
  }
  if (options.jsdoc !== false) {
    plugins.push('jsdoc')
    Object.assign(rules, structuredClone(jsdocRules))
  }
  if (useNode) Object.assign(rules, structuredClone(nodeRules))

  if (useTypescript) {
    plugins.push('typescript')
    if (options.type === 'lib') {
      fileOverrides.push({
        files: [tsFiles],
        excludeFiles: [scriptFiles, ...configFiles, ...(options.test !== false ? testFiles : [])],
        rules: {
          'typescript/explicit-function-return-type': [
            'error',
            { allowExpressions: true, allowHigherOrderFunctions: true, allowIIFEs: true },
          ],
        },
      })
    }
    if (options.typeAware) {
      fileOverrides.push({ files: [tsFiles], rules: structuredClone(typeAwareRules) })
    }
    fileOverrides.push({
      files: [tsFiles, ...(useVue ? ['**/*.vue'] : [])],
      rules: structuredClone(typescriptRules),
    })
    fileOverrides.push({
      files: ['**/*.d.{ts,mts,cts}'],
      rules: { 'no-unused-vars': 'off', 'oxc/no-const-enum': 'off' },
    })
  }

  if (useVue) {
    plugins.push('vue')
    fileOverrides.push({
      files: ['**/*.vue'],
      env: { vue: true },
      globals: Object.fromEntries(
        [
          'computed',
          'defineEmits',
          'defineExpose',
          'defineProps',
          'onMounted',
          'onUnmounted',
          'reactive',
          'ref',
          'shallowReactive',
          'shallowRef',
          'toRef',
          'toRefs',
          'watch',
          'watchEffect',
        ].map(name => [name, 'readonly'] as const),
      ),
      rules: { ...structuredClone(vueRules), 'node/no-top-level-await': 'off' },
    })
  }

  if (options.react || options.jsx !== false) plugins.push('react')
  if (options.react) {
    fileOverrides.push({
      files: [`**/*.${sourceExtension}`],
      rules: createReactRules(options.react === true ? {} : options.react, options.nextjs === true),
    })
  }
  if (options.nextjs) {
    plugins.push('nextjs')
    fileOverrides.push({ files: [`**/*.${sourceExtension}`], rules: structuredClone(nextjsRules) })
  }
  if (options.accessibility) {
    plugins.push('jsx-a11y')
    fileOverrides.push({ files: ['**/*.{jsx,tsx}'], rules: structuredClone(accessibilityRules) })
  }
  if (options.jsx !== false) {
    fileOverrides.push({
      files: ['**/*.{jsx,tsx}'],
      rules: structuredClone(jsxRules),
    })
  }

  if (options.test !== false) {
    plugins.push('vitest')
    fileOverrides.push({
      files: [...testFiles],
      rules: {
        ...structuredClone(testRules),
        'vitest/no-focused-tests': isInEditor ? 'warn' : 'error',
        'node/no-top-level-await': 'off',
        'no-unused-expressions': 'off',
      },
    })
  }

  fileOverrides.push({
    files: [
      scriptFiles,
      `**/cli/**/*.${sourceExtension}`,
      `**/cli.${sourceExtension}`,
      ...configFiles,
    ],
    rules: { 'no-console': 'off', 'node/no-top-level-await': 'off' },
  })

  const config: OxlintConfig = {
    plugins,
    // Select rules explicitly: Oxlint's correctness category adds rules Antfu does not enable.
    categories: { correctness: 'off' },
    rules,
    env: { builtin: true, browser: true, node: useNode },
    options: {
      reportUnusedDisableDirectives: 'error',
      ...(useTypescript && options.typeAware ? { typeAware: true } : {}),
    },
    ignorePatterns: [
      ...scriptIgnorePatterns,
      ...(options.ignoreTypeScript ? ['**/*.{ts,tsx,mts,cts,mtsx,ctsx}'] : []),
    ],
    overrides: fileOverrides,
  }

  return {
    ...config,
    ...overrides,
    categories: { ...config.categories, ...overrides.categories },
    rules: { ...rules, ...overrides.rules },
    env: { ...config.env, ...overrides.env },
    globals: { ...config.globals, ...overrides.globals },
    // A caller's global rule takes precedence over preset file-specific values too.
    // Caller file overrides still run last, retaining ordinary Oxlint precedence.
    overrides: [
      ...fileOverrides.map(override => ({
        ...override,
        rules: {
          ...override.rules,
          ...Object.fromEntries(
            Object.entries(overrides.rules ?? {}).filter(
              ([name]) => name in (override.rules ?? {}),
            ),
          ),
        },
      })),
      ...(overrides.overrides ?? []),
    ],
  }
}

export const base = createConfig({ typescript: false })
export const typescript = createConfig()
export const vue = createConfig({ vue: true })
export const nuxt = createConfig({ nuxt: true })
export const node = createConfig({ node: true })

export const lib = createConfig({ type: 'lib' })
export const typeAware = createConfig({ typeAware: true })
export const react = createConfig({ react: true })
export const nextjs = createConfig({ nextjs: true })
export const accessibility = createConfig({ accessibility: true })

export default createConfig
