import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))

export function readCases(name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/antfu-${name}.json`, import.meta.url), 'utf8'),
  )
}

export function runNativeCases(t, config, cases) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'oxlint-antfu-cases-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const configPath = join(directory, '.oxlintrc.json')
  writeFileSync(configPath, JSON.stringify(config))
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
  assert.ok([0, 1].includes(result.status), result.stderr || result.stdout)
  const report = JSON.parse(result.stdout)
  assert.equal(report.number_of_files, cases.length)
  assert.ok(
    report.diagnostics.every(d => d.code),
    JSON.stringify(report.diagnostics),
  )
  return report
}

export function assertNativeCase(report, entry) {
  const filename = `${entry.id}/${entry.file}`
  const matches = report.diagnostics.filter(d => d.filename === filename && d.code === entry.native)
  assert.equal(
    matches.length > 0,
    entry.report,
    `${entry.id}: ${JSON.stringify(report.diagnostics)}`,
  )
  if (entry.report && entry.severity) {
    const severity = entry.severity === 2 ? 'error' : 'warning'
    assert.ok(
      matches.every(d => d.severity === severity),
      `${entry.id}: ${JSON.stringify(matches)}`,
    )
  }
}
