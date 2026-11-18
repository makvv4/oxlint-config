import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import formatter, { createFormatterConfig } from '../dist/formatter.js'
import { readCases } from '../scripts/behavior-cases.mjs'

const oxfmtBin = fileURLToPath(new URL('../node_modules/oxfmt/bin/oxfmt', import.meta.url))
const ts = ['export  const value="test";\n', "export const value = 'test'\n"]
const dts = ['export  declare const value:string;\n', 'export declare const value: string\n']
const md = ['#   Heading\n', '# Heading\n']
const json = ['{"a":1}\n', '{ "a": 1 }\n']

function contents(file) {
  if (file.endsWith('.d.ts')) return dts
  if (file.endsWith('.md')) return md
  if (file.endsWith('.json')) return json
  return ts
}

function checkSelection(t, config, included, excluded) {
  const dir = mkdtempSync(join(tmpdir(), 'oxfmt-selection-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, '.oxfmtrc.json'), JSON.stringify(config))
  for (const file of [...included, ...excluded]) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), contents(file)[0])
  }
  const result = spawnSync(process.execPath, [oxfmtBin, '--write', '--with-node-modules', '.'], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 20_000,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  for (const file of included) {
    assert.equal(readFileSync(join(dir, file), 'utf8'), contents(file)[1], file)
  }
  for (const file of excluded) {
    assert.equal(readFileSync(join(dir, file), 'utf8'), contents(file)[0], file)
  }
}

test('the Oxfmt CLI selects sources and leaves Antfu exclusions untouched without a gitignore', t => {
  const { included, excluded } = readCases('file-selection')
  checkSelection(t, formatter, included, excluded)
})

test('explicit ignore patterns replace formatter defaults, including an empty list', t => {
  checkSelection(
    t,
    createFormatterConfig({ ignorePatterns: ['**/private/**'] }),
    ['.nuxt/output.ts', 'CHANGELOG.md'],
    ['src/private/example.ts'],
  )
  checkSelection(
    t,
    createFormatterConfig({ ignorePatterns: [] }),
    ['.nuxt/output.ts', 'src/client.min.ts', 'docs/LICENSE.md'],
    [],
  )
})
