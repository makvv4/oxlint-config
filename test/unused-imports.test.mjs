import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig from '../dist/index.js'
import { readCases } from '../scripts/behavior-cases.mjs'

const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))
const cases = readCases('unused-import-fixes')

function fix(t, config) {
  const cwd = mkdtempSync(join(tmpdir(), 'antfu-unused-imports-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  writeFileSync(join(cwd, '.oxlintrc.json'), JSON.stringify(config))
  for (const { file, source } of cases) writeFileSync(join(cwd, file), source)
  const run = spawnSync(process.execPath, [oxlintBin, '--fix', '--format', 'json', '.'], {
    cwd,
    encoding: 'utf8',
    timeout: 20_000,
  })
  assert.ifError(run.error)
  assert.ok([0, 1].includes(run.status), run.stderr || run.stdout)
  const report = JSON.parse(run.stdout)
  assert.equal(report.number_of_files, cases.length)
  return { report, read: file => readFileSync(join(cwd, file), 'utf8') }
}

test('--fix removes unused value and type imports but preserves bare imports and local declarations', t => {
  const { report, read } = fix(t, createConfig())
  for (const { file, expected } of cases) assert.equal(read(file), expected, file)
  assert.deepEqual(
    report.diagnostics.map(d => [d.filename, d.code]),
    [['source.js', 'eslint(no-unused-vars)']],
  )
})

test('--fix preserves imports when the consumer disables no-unused-vars', t => {
  const { report, read } = fix(t, createConfig({}, { rules: { 'no-unused-vars': 'off' } }))
  for (const { file, source } of cases) assert.equal(read(file), source, file)
  assert.deepEqual(report.diagnostics, [])
})
