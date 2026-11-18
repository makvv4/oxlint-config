import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readCases } from './behavior-cases.mjs'

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
const defaults = { typescript: true, vue: true, isInEditor: false, gitignore: false }
const frameworks = readCases('frameworks')
async function checkCases(name, cases, options = {}, { typed = false } = {}) {
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'antfu-reference-cases-')))
  try {
    if (options.nextjs) mkdirSync(join(project, 'pages'))
    for (const entry of cases) {
      const filename = join(project, entry.id, entry.file)
      mkdirSync(dirname(filename), { recursive: true })
      writeFileSync(filename, entry.source)
    }
    if (typed) {
      writeFileSync(
        join(project, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'NodeNext' } }),
      )
      options = {
        ...options,
        typescript: { tsconfigPath: 'tsconfig.json', parserOptions: { tsconfigRootDir: project } },
      }
    }
    const linter = new ESLint({
      cwd: project,
      overrideConfigFile: true,
      overrideConfig: await antfu({ ...defaults, ...options }),
    })
    for (const entry of cases) {
      const [result] = await linter.lintFiles([join(project, entry.id, entry.file)])
      const details = `${entry.id}: ${JSON.stringify(result.messages)}`
      assert.equal(result.fatalErrorCount, 0, details)
      assert.ok(
        result.messages.every(message => message.ruleId !== null),
        details,
      )
      const matches = result.messages.filter(message => message.ruleId === entry.upstream)
      assert.equal(matches.length > 0, entry.report, details)
      if (entry.report && entry.severity)
        assert.ok(
          matches.every(message => message.severity === entry.severity),
          details,
        )
    }
    console.log(`Antfu 10.0.0: ${cases.length} ${name} behavior expectations verified`)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
}
await checkCases('default', readCases('behavior'))
await checkCases('library', readCases('lib'), { type: 'lib' })
await checkCases('type-aware', readCases('type-aware'), {}, { typed: true })
await checkCases('accessibility', readCases('accessibility'), { jsx: { a11y: true } })
for (const profile of ['react', 'nextjs'])
  await checkCases(
    profile,
    frameworks.filter(entry => entry.profile === profile),
    { [profile]: true },
  )

const fixtureRoot = fileURLToPath(new URL('../fixtures/antfu/', import.meta.url))
async function referenceLinter(options = {}, fix = false) {
  return new ESLint({
    cwd: resolve(directory),
    overrideConfigFile: true,
    fix,
    overrideConfig: await antfu({ ...defaults, ...options }),
  })
}
const fixer = await referenceLinter({}, true)
const importFixes = readCases('unused-import-fixes')
for (const { file, source, expected } of importFixes) {
  const [result] = await fixer.lintText(source, { filePath: file })
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages))
  assert.equal(result.output ?? source, expected, file)
}
console.log(`Antfu 10.0.0: ${importFixes.length} unused-import fixes verified byte for byte`)
async function checkSelection(fixture, linter) {
  const { included, excluded } = readCases(fixture)
  for (const file of included) assert.equal(await linter.isPathIgnored(file), false, file)
  for (const file of excluded) assert.equal(await linter.isPathIgnored(file), true, file)
  console.log(`Antfu 10.0.0: ${included.length + excluded.length} paths verified (${fixture})`)
}
await checkSelection('file-selection', fixer)
await checkSelection('typescript-file-selection', await referenceLinter({ typescript: false }))

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

const modeCases = readCases('editor')
for (const isInEditor of [false, true]) {
  const linter = await referenceLinter({ isInEditor })
  for (const { file, source, upstream, editorSeverity, cliSeverity } of modeCases) {
    const [result] = await linter.lintText(source, { filePath: file })
    const severity = result.messages.find(m => m.ruleId === upstream)?.severity
    assert.equal(severity, isInEditor ? editorSeverity : cliSeverity, file)
  }
}
const editorFixer = await referenceLinter({ isInEditor: true }, true)
for (const { file, source } of modeCases) {
  const [result] = await editorFixer.lintText(source, { filePath: file })
  assert.equal(result.fatalErrorCount, 0, file)
  assert.equal(result.output ?? source, source, file)
}
console.log(
  `Antfu 10.0.0: editor/CLI severities and editor fixes verified for ${modeCases.length} files`,
)
