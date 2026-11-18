import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readCases } from '../scripts/behavior-cases.mjs'

const cases = readCases('editor')
const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))
const packageUrl = new URL('../dist/index.js', import.meta.url).href
const env = { ...process.env }
for (const name of [
  'CI',
  'GIT_PARAMS',
  'VSCODE_GIT_COMMAND',
  'npm_lifecycle_script',
  'VSCODE_PID',
  'VSCODE_CWD',
  'JETBRAINS_IDE',
  'VIM',
  'NVIM',
  'ZED_ENVIRONMENT',
  'ZED_TERM',
])
  delete env[name]

function project(t, options = {}, overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-editor-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(
    join(directory, 'oxlint.config.mjs'),
    `import createConfig from ${JSON.stringify(packageUrl)}\nexport default createConfig(${JSON.stringify(options)}, ${JSON.stringify(overrides)})\n`,
  )
  for (const { file, source } of cases) writeFileSync(join(directory, file), source)
  return {
    read: file => readFileSync(join(directory, file), 'utf8'),
    run(extraEnv = {}, fix = false) {
      const result = spawnSync(
        process.execPath,
        [
          oxlintBin,
          '--config',
          'oxlint.config.mjs',
          '--format',
          'json',
          ...(fix ? ['--fix'] : []),
          ...cases.map(entry => entry.file),
        ],
        { cwd: directory, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 20_000 },
      )
      assert.ifError(result.error)
      assert.ok([0, 1].includes(result.status), result.stderr || result.stdout)
      const report = JSON.parse(result.stdout)
      assert.equal(report.number_of_files, cases.length)
      return report.diagnostics
    },
  }
}

function assertSeverities(diagnostics, editor) {
  for (const entry of cases) {
    const matches = diagnostics.filter(d => d.filename === entry.file && d.code === entry.native)
    const level = editor ? (entry.nativeEditorSeverity ?? entry.editorSeverity) : entry.cliSeverity
    assert.deepEqual(
      matches.map(d => d.severity),
      [level === 1 ? 'warning' : 'error'],
      entry.file,
    )
  }
}

test('forced editor and CLI modes report Antfu severities and apply native fixes', t => {
  for (const editor of [true, false]) {
    const consumer = project(t, { isInEditor: editor })
    const environment = editor ? { CI: '1' } : { NVIM: '1' }
    assertSeverities(consumer.run(environment), editor)
    consumer.run(environment, true)
    for (const { file, source, native } of cases) {
      let expected = source
      if (native === 'eslint(prefer-const)') expected = source.replace('let value', 'const value')
      if (!editor && file.startsWith('imports.')) expected = "import './setup.js'\n"
      assert.equal(consumer.read(file), expected, file)
    }
  }
})

test('editor environment is detected outside CI, Git hooks, lint-staged and the Zed terminal', t => {
  const consumer = project(t)
  for (const [environment, editor] of [
    [{}, false],
    [{ VSCODE_PID: '1' }, true],
    [{ VSCODE_CWD: '/project', CI: '1' }, false],
    [{ NVIM: '1', GIT_PARAMS: 'hook' }, false],
    [{ JETBRAINS_IDE: 'true', npm_lifecycle_script: 'lint-staged --quiet' }, false],
    [{ VIM: '1', VSCODE_GIT_COMMAND: 'commit' }, false],
    [{ ZED_ENVIRONMENT: '1' }, true],
    [{ ZED_ENVIRONMENT: '1', ZED_TERM: 'true' }, false],
  ])
    assertSeverities(consumer.run(environment), editor)
})

test('caller global and file overrides still apply in editor mode', t => {
  const consumer = project(
    t,
    { isInEditor: true },
    {
      rules: { 'prefer-const': 'off', 'vitest/no-focused-tests': 'error' },
      overrides: [{ files: ['typed.ts'], rules: { 'prefer-const': 'warn' } }],
    },
  )
  const diagnostics = consumer.run()
  assert.deepEqual(
    diagnostics.filter(d => d.code === 'eslint(prefer-const)').map(d => [d.filename, d.severity]),
    [['typed.ts', 'warning']],
  )
  assert.equal(diagnostics.find(d => d.code === 'vitest(no-focused-tests)')?.severity, 'error')
})
