import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig from '../dist/index.js'
import { readCases } from '../scripts/behavior-cases.mjs'

const { included, excluded } = readCases('typescript-file-selection')
const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))

function lintFiles(t, config) {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-ts-exclusions-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(join(directory, '.oxlintrc.json'), JSON.stringify(config))
  for (const file of [...included, ...excluded]) {
    const path = join(directory, file)
    mkdirSync(dirname(path), { recursive: true })
    let source = 'debugger\n'
    if (file.endsWith('.vue')) source = '<script setup lang="ts">\ndebugger\n</script>\n'
    if (file.includes('.d.')) source = 'declare var value: string\n'
    writeFileSync(path, source)
  }
  const run = spawnSync(process.execPath, [oxlintBin, '--format', 'json', '.'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 20_000,
  })
  assert.ifError(run.error)
  assert.equal(run.status, 1, run.stderr || run.stdout)
  const report = JSON.parse(run.stdout)
  const paths = report.diagnostics.map(diagnostic => {
    assert.equal(
      diagnostic.code,
      diagnostic.filename.includes('.d.') ? 'eslint(no-var)' : 'eslint(no-debugger)',
    )
    return diagnostic.filename
  })
  assert.equal(report.number_of_files, paths.length)
  return paths.sort()
}

test('ignoreTypeScript skips TypeScript files but still lints JS, JSX and Vue scripts', t => {
  assert.deepEqual(
    lintFiles(t, createConfig({ ignoreTypeScript: true, vue: true })),
    [...included].sort(),
  )
})

test('typescript: false still lints TypeScript sources, including when callers clear the opt-in exclusions', t => {
  // Oxlint does not select .mtsx and .ctsx even without ignore patterns.
  const supported = [...included, ...excluded.filter(path => !/\.[mc]tsx$/.test(path))].sort()
  const options = { typescript: false, vue: true }
  assert.deepEqual(lintFiles(t, createConfig(options)), supported)
  assert.deepEqual(
    lintFiles(t, createConfig({ ...options, ignoreTypeScript: true }, { ignorePatterns: [] })),
    supported,
  )
})
