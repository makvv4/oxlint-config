import formatter from './src/formatter.ts'

export default {
  ...formatter,
  ignorePatterns: [...(formatter.ignorePatterns ?? []), '*.log', 'fixtures/antfu/**'],
}
