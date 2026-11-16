import type { OxfmtConfig } from 'oxfmt'

export type { OxfmtConfig } from 'oxfmt'

/** User options replace preset values, including false. */
export function createFormatterConfig(options: OxfmtConfig = {}): OxfmtConfig {
  return {
    singleQuote: true,
    semi: false,
    trailingComma: 'all',
    arrowParens: 'avoid',
    tabWidth: 2,
    useTabs: false,
    endOfLine: 'lf',
    printWidth: 100,
    proseWrap: 'preserve',
    vueIndentScriptAndStyle: false,
    sortImports: false,
    sortPackageJson: false,
    ...options,
  }
}

export const formatter = createFormatterConfig()
export default formatter
