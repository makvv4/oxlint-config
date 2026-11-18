import type { OxfmtConfig } from 'oxfmt'

export type { OxfmtConfig } from 'oxfmt'

/** User options replace preset values, including false. */
export function createFormatterConfig(options: OxfmtConfig = {}): OxfmtConfig {
  return {
    singleQuote: true,
    quoteProps: 'consistent',
    semi: false,
    trailingComma: 'all',
    arrowParens: 'avoid',
    tabWidth: 2,
    useTabs: false,
    endOfLine: 'lf',
    printWidth: 100,
    experimentalOperatorPosition: 'start',
    proseWrap: 'preserve',
    vueIndentScriptAndStyle: false,
    sortImports: {
      groups: [
        'type-import',
        ['type-parent', 'type-sibling', 'type-index', 'type-internal'],
        'value-builtin',
        'value-external',
        'value-internal',
        ['value-parent', 'value-sibling', 'value-index'],
        'side_effect',
        'unknown',
      ],
      internalPattern: ['~/'],
      newlinesBetween: false,
      order: 'asc',
      ignoreCase: true,
      sortSideEffects: false,
    },
    sortPackageJson: true,
    // Antfu's default JS/TS lint does not format embedded HTML/CSS/GraphQL.
    // Vue remains outside this scope so its script and style blocks are formatted.
    overrides: [
      {
        files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
        options: { embeddedLanguageFormatting: options.embeddedLanguageFormatting ?? 'off' },
      },
    ],
    ...options,
  }
}

export const formatter = createFormatterConfig()
export default formatter
