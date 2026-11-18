import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig from '../dist/index.js'
import { assertNativeCase, readCases, runNativeCases } from '../scripts/behavior-cases.mjs'

const importCases = readCases('import-paths')
const nextCases = readCases('next-location')
const inputs = [...importCases, ...nextCases]

test('the bundled plugin reproduces Antfu import and Next navigation diagnostics', t => {
  const report = runNativeCases(t, createConfig({ nextjs: true }), inputs)
  for (const entry of inputs) assertNativeCase(report, entry)
})

test('imports and Next navigation checks can be enabled independently', t => {
  for (const [options, active] of [
    [{}, importCases],
    [{ imports: false, nextjs: true }, nextCases],
  ]) {
    const report = runNativeCases(t, createConfig(options), inputs)
    for (const entry of inputs)
      assertNativeCase(report, active.includes(entry) ? entry : { ...entry, report: false })
  }
})

const distRule = 'makvv4/no-import-dist'
const nextRule = 'makvv4/no-location-assign-relative-destination'
const moduleImport = "import '../lib/dist/module.js'\n\n"
const navigation = "window.location.assign('/about')\n"
const distCode = 'makvv4(no-import-dist)'
const nextCode = 'makvv4(no-location-assign-relative-destination)'

test('caller rule severities and file overrides take priority over plugin presets', t => {
  const config = createConfig(
    { nextjs: true },
    {
      rules: { [distRule]: 'warn', [nextRule]: 'off' },
      overrides: [{ files: ['**/strict.js'], rules: { [distRule]: 'off', [nextRule]: 'error' } }],
    },
  )
  const entries = ['normal.js', 'strict.js'].map(file => ({
    id: 'consumer',
    file,
    source: moduleImport + navigation,
  }))
  const report = runNativeCases(t, config, entries)
  for (const entry of entries) {
    const strict = entry.file === 'strict.js'
    assertNativeCase(report, { ...entry, native: distCode, report: !strict, severity: 1 })
    assertNativeCase(report, { ...entry, native: nextCode, report: strict, severity: 2 })
  }
})

test('Next navigation inspection terminates on circular destination bindings', t => {
  const entry = {
    id: 'cycle',
    file: 'page.js',
    source: 'let a = a\nlocation.assign(a)\n',
    native: nextCode,
    report: false,
  }
  assertNativeCase(runNativeCases(t, createConfig({ nextjs: true }), [entry]), entry)
})

test('a consumer loads the distributed plugin from TS and ESM configs, including explicit jsPlugins', t => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-plugin-consumer-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const installed = join(directory, 'node_modules/@makvv4/oxlint-config')
  mkdirSync(installed, { recursive: true })
  cpSync(join(root, 'dist'), join(installed, 'dist'), { recursive: true })
  cpSync(join(root, 'package.json'), join(installed, 'package.json'))
  symlinkSync(join(root, 'node_modules/oxlint'), join(directory, 'node_modules/oxlint'), 'junction')
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n')
  writeFileSync(join(directory, 'main.js'), moduleImport + navigation)
  writeFileSync(
    join(directory, 'consumer-plugin.mjs'),
    `export default {
    meta: { name: 'consumer' },
    rules: { 'example': { create: ctx => ({ Program(node) { ctx.report({ node, message: 'checked' }) } }) } },
  }\n`,
  )
  for (const [filename, overrides, expected] of [
    ['oxlint.config.ts', {}, [distCode, nextCode]],
    ['oxlint.config.mjs', { jsPlugins: ['@makvv4/oxlint-config/plugin'] }, [distCode, nextCode]],
    ['oxlint.config.mjs', { jsPlugins: [] }, []],
    [
      'oxlint.config.mjs',
      { jsPlugins: ['./consumer-plugin.mjs'], rules: { 'consumer/example': 'error' } },
      ['consumer(example)'],
    ],
  ]) {
    writeFileSync(
      join(directory, filename),
      `import createConfig from '@makvv4/oxlint-config'\nexport default createConfig({ nextjs: true }, ${JSON.stringify(overrides)})\n`,
    )
    const result = spawnSync(
      process.execPath,
      [join(root, 'node_modules/oxlint/bin/oxlint'), '-c', filename, '--format', 'json', 'main.js'],
      { cwd: directory, encoding: 'utf8', timeout: 20_000 },
    )
    assert.ifError(result.error)
    assert.equal(result.status, expected.length ? 1 : 0, result.stderr || result.stdout)
    const report = JSON.parse(result.stdout)
    assert.equal(report.number_of_files, 1)
    assert.deepEqual(report.diagnostics.map(d => d.code).sort(), expected)
  }
})
