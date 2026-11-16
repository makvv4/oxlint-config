import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The oracle is deliberately installed outside this package and its dependency graph.
const directory = process.argv[2]
if (!directory)
  throw new Error(
    'Usage: node scripts/check-antfu-reference.mjs /absolute/path/to/isolated-antfu-install',
  )
const requireOracle = createRequire(resolve(directory, 'package.json'))
const { default: antfu } = await import(
  pathToFileURL(requireOracle.resolve('@antfu/eslint-config'))
)
const { ESLint } = await import(pathToFileURL(requireOracle.resolve('eslint')))
assert.equal(requireOracle('@antfu/eslint-config/package.json').version, '10.0.0')
const linter = new ESLint({
  cwd: resolve(directory),
  overrideConfigFile: true,
  overrideConfig: await antfu({ typescript: true, vue: true, isInEditor: false, gitignore: false }),
})
const cases = JSON.parse(
  readFileSync(new URL('../fixtures/antfu-behavior.json', import.meta.url), 'utf8'),
)
for (const entry of cases) {
  const [result] = await linter.lintText(entry.source, { filePath: entry.file })
  assert.equal(
    result.messages.some(message => message.ruleId === entry.upstream),
    entry.report,
    `${entry.id}: ${JSON.stringify(result.messages)}`,
  )
}
console.log(`Antfu 10.0.0: ${cases.length} behavior expectations verified`)

const fixtureRoot = fileURLToPath(new URL('../fixtures/antfu/', import.meta.url))
const fixer = new ESLint({
  cwd: resolve(directory),
  overrideConfigFile: true,
  fix: true,
  overrideConfig: await antfu({ typescript: true, vue: true, isInEditor: false, gitignore: false }),
})
const files = ['javascript.js', 'typescript.ts', 'jsx.jsx', 'tsx.tsx', 'vue.vue', 'vue-ts.vue']
for (const file of files) {
  const input = readFileSync(resolve(fixtureRoot, 'input', file), 'utf8')
  const [result] = await fixer.lintText(input, { filePath: file })
  const snapshot = resolve(fixtureRoot, 'expected', file)
  assert.ok(existsSync(snapshot), file)
  assert.equal(result.errorCount, 0, JSON.stringify(result.messages))
  assert.equal(result.output ?? input, readFileSync(snapshot, 'utf8'), file)
}
console.log(
  `Antfu 10.0.0: ${files.length}/${files.length} original JS/TS/JSX/TSX/Vue snapshots reproduced`,
)
