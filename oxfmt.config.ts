import { createFormatterConfig } from './src/formatter.ts'

export default createFormatterConfig({
  ignorePatterns: ['dist/**', 'node_modules/**', 'package-lock.json', '*.log', 'fixtures/antfu/**'],
})
