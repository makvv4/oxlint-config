import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig from '../dist/index.js'
import { compareAntfu } from '../scripts/compare-antfu.mjs'

const cases = JSON.parse(
  readFileSync(new URL('../fixtures/antfu-behavior.json', import.meta.url), 'utf8'),
)
const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))

test('native diagnostics reproduce behavior checked against Antfu 10.0.0', async t => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-antfu-behavior-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const configPath = join(directory, '.oxlintrc.json')
  writeFileSync(configPath, JSON.stringify(createConfig({ vue: true })))
  for (const entry of cases) {
    const filename = join(directory, entry.id, entry.file)
    mkdirSync(dirname(filename), { recursive: true })
    writeFileSync(filename, entry.source)
  }
  const result = spawnSync(
    process.execPath,
    [oxlintBin, '-c', configPath, '--format', 'json', '.'],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 20_000,
    },
  )
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  assert.ok([0, 1].includes(result.status), result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.number_of_files, cases.length)
  for (const entry of cases) {
    await t.test(entry.id, () => {
      const diagnostics = report.diagnostics.filter(d => d.filename === `${entry.id}/${entry.file}`)
      assert.equal(
        diagnostics.some(d => d.code === entry.native),
        entry.report,
        JSON.stringify(diagnostics),
      )
    })
  }
})

test('upstream fixture comparison runs real fixes and stable formatting without hiding gaps', async () => {
  const report = await compareAntfu()
  assert.equal(report.files.length, 18)
  assert.equal(report.files.filter(row => row.linted).length, 8)
  assert.equal(report.files.filter(row => row.formatted).length, 14)
  for (const row of report.files.filter(row => row.formatted))
    assert.equal(row.idempotent, true, row.file)
  assert.deepEqual(
    report.files.filter(row => row.exactMatch).map(row => row.file),
    ['angular.component.ts', 'tsconfig.json'],
  )
  assert.deepEqual(
    report.diagnosticsAfter.map(d => [d.filename, d.code]),
    [['typescript.ts', 'eslint(prefer-template)']],
  )
})
