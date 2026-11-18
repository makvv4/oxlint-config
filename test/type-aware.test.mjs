import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig, { typeAware } from '../dist/index.js'

const cases = JSON.parse(
  readFileSync(new URL('../fixtures/antfu-type-aware.json', import.meta.url), 'utf8'),
)
const nodeModules = fileURLToPath(new URL('../node_modules', import.meta.url))
const oxlintBin = join(nodeModules, 'oxlint/bin/oxlint')
const floatingPromise = 'Promise.resolve(1)\nexport {}\n'

function fixture(t, config, files) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-type-aware-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  // Oxlint resolves the optional native engine from the consumer project.
  symlinkSync(nodeModules, join(directory, 'node_modules'), 'junction')
  const configPath = join(directory, '.oxlintrc.json')
  writeFileSync(configPath, JSON.stringify(config))
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        jsx: 'preserve',
        allowJs: true,
      },
      include: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx', '**/*.js'],
    }),
  )
  for (const [name, source] of Object.entries(files)) {
    const filename = join(directory, name)
    mkdirSync(dirname(filename), { recursive: true })
    writeFileSync(filename, source)
  }
  return { directory, configPath, targets: Object.keys(files) }
}

function lint(consumer) {
  const result = spawnSync(
    process.execPath,
    [oxlintBin, '--config', consumer.configPath, '--format', 'json', ...consumer.targets],
    {
      cwd: consumer.directory,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  )
  assert.ifError(result.error)
  assert.equal(result.signal, null, result.stderr)
  assert.ok([0, 1].includes(result.status), result.stderr || result.stdout)
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    assert.fail(`Oxlint returned non-JSON output:\n${result.stdout}\n${result.stderr}`)
  }
  return { status: result.status, report }
}

test('native type-aware diagnostics reproduce Antfu rule choices and options', async t => {
  const consumer = fixture(
    t,
    typeAware,
    Object.fromEntries(cases.map(entry => [`${entry.id}/${entry.file}`, entry.source])),
  )
  const { status, report } = lint(consumer)
  assert.equal(status, 1)
  assert.equal(report.number_of_files, cases.length)
  for (const entry of cases) {
    await t.test(entry.id, () => {
      const diagnostics = report.diagnostics.filter(d => d.filename === `${entry.id}/${entry.file}`)
      const matched = diagnostics.filter(d => d.code === entry.native)
      assert.equal(matched.length > 0, entry.report, JSON.stringify(diagnostics))
      for (const diagnostic of matched) assert.equal(diagnostic.severity, 'error')
      if (entry.upstream === 'ts/no-implied-eval') {
        assert.ok(!diagnostics.some(d => d.code === 'eslint(no-implied-eval)'))
      }
    })
  }
})

test('type-aware rules are opt-in and TypeScript false disables them', t => {
  for (const config of [
    createConfig(),
    createConfig({ typeAware: false }),
    createConfig({ typeAware: true, typescript: false }),
    createConfig({ typeAware: true }, { options: { typeAware: false } }),
  ]) {
    const { status, report } = lint(fixture(t, config, { 'source.ts': floatingPromise }))
    assert.equal(status, 0, JSON.stringify(report.diagnostics))
    assert.deepEqual(report.diagnostics, [])
  }
})

test('type-aware rules cover TypeScript extensions and leave JavaScript and Vue scripts alone', t => {
  const files = Object.fromEntries(
    ['source.ts', 'source.mts', 'source.cts', 'component.tsx', 'source.js'].map(name => [
      name,
      floatingPromise,
    ]),
  )
  files['component.vue'] = '<script setup lang="ts">\nPromise.resolve(1)\n</script>\n'
  const { report } = lint(fixture(t, createConfig({ typeAware: true, vue: true }), files))
  assert.deepEqual(
    report.diagnostics
      .filter(d => d.code === 'typescript(no-floating-promises)')
      .map(d => d.filename)
      .sort(),
    ['component.tsx', 'source.cts', 'source.mts', 'source.ts'],
  )
})

test('global and file overrides retain priority over type-aware preset rules', t => {
  const files = { 'source.ts': floatingPromise, 'source.test.ts': floatingPromise }
  const globallyDisabled = lint(
    fixture(
      t,
      createConfig({ typeAware: true }, { rules: { 'typescript/no-floating-promises': 'off' } }),
      files,
    ),
  )
  assert.equal(globallyDisabled.status, 0, JSON.stringify(globallyDisabled.report.diagnostics))
  assert.deepEqual(globallyDisabled.report.diagnostics, [])

  const locallyDisabled = lint(
    fixture(
      t,
      createConfig(
        { typeAware: true },
        {
          rules: { 'typescript/no-floating-promises': 'warn' },
          overrides: [
            {
              files: ['**/*.test.ts'],
              rules: { 'typescript/no-floating-promises': 'off' },
            },
          ],
        },
      ),
      files,
    ),
  )
  assert.equal(locallyDisabled.status, 0, JSON.stringify(locallyDisabled.report.diagnostics))
  assert.deepEqual(
    locallyDisabled.report.diagnostics.map(d => ({
      filename: d.filename,
      code: d.code,
      severity: d.severity,
    })),
    [{ filename: 'source.ts', code: 'typescript(no-floating-promises)', severity: 'warning' }],
  )
})

test('opting into type-aware lint does not also enable TypeScript compiler diagnostics', t => {
  const { status, report } = lint(
    fixture(t, createConfig({ typeAware: true }), {
      'source.ts': "export const value: number = 'incorrect type'\n",
    }),
  )
  assert.equal(status, 0, JSON.stringify(report.diagnostics))
  assert.deepEqual(report.diagnostics, [])
})
