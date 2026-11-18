import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import createConfig, { base, node, nuxt, typescript, vue } from '../dist/index.js'

const packageUrl = new URL('../dist/index.js', import.meta.url).href
const oxlintBin = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url))

function fixture(t, expression, files) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-oxlint-consumer-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const configPath = join(directory, 'oxlint.config.mjs')
  writeFileSync(
    configPath,
    `import createConfig, { base, node, nuxt, typescript, vue } from ${JSON.stringify(packageUrl)}\n\nexport default ${expression}\n`,
  )
  for (const [name, source] of Object.entries(files)) {
    const filename = join(directory, name)
    mkdirSync(dirname(filename), { recursive: true })
    writeFileSync(filename, source)
  }
  return { directory, configPath, targets: Object.keys(files) }
}

function execute(consumer, args) {
  const result = spawnSync(
    process.execPath,
    [oxlintBin, '--config', consumer.configPath, ...args],
    {
      cwd: consumer.directory,
      encoding: 'utf8',
      timeout: 20_000,
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

function lint(consumer) {
  return execute(consumer, ['--format', 'json', ...consumer.targets])
}

function hasRule(report, name) {
  return report.diagnostics.some(diagnostic => diagnostic.code === name)
}

test('the default preset accepts a clean TypeScript consumer', t => {
  const consumer = fixture(t, 'createConfig()', {
    'source.ts':
      'export const values: number[] = [1, 2]\nexport const sum = values.reduce((total, value) => total + value, 0)\n',
  })
  const { status, report } = lint(consumer)
  assert.equal(status, 0, JSON.stringify(report.diagnostics))
  assert.deepEqual(report.diagnostics, [])
  assert.equal(report.number_of_files, 1)
})

test('the base preset rejects debugger statements', t => {
  const { status, report } = lint(fixture(t, 'base', { 'source.js': 'debugger\n' }))
  assert.equal(status, 1)
  assert.ok(hasRule(report, 'eslint(no-debugger)'), JSON.stringify(report.diagnostics))
})

test('TypeScript interface style follows Antfu and can be disabled as a preset', t => {
  const files = { 'source.ts': 'export type Person = { name: string }\n' }
  const enabled = lint(fixture(t, 'typescript', files))
  assert.equal(enabled.status, 1)
  assert.ok(
    hasRule(enabled.report, 'typescript(consistent-type-definitions)'),
    JSON.stringify(enabled.report.diagnostics),
  )
  const disabled = lint(fixture(t, 'createConfig({ typescript: false })', files))
  assert.equal(disabled.status, 0, JSON.stringify(disabled.report.diagnostics))
  assert.deepEqual(disabled.report.diagnostics, [])
})

test('the Vue preset rejects async computed callbacks in script blocks', t => {
  const { status, report } = lint(
    fixture(t, 'vue', {
      'component.vue':
        '<script setup lang="ts">\nimport { computed } from \'vue\'\nconst value = computed(async () => 1)\n</script>\n<template><div>{{ value }}</div></template>\n',
    }),
  )
  assert.equal(status, 1)
  assert.ok(
    hasRule(report, 'vue(no-async-in-computed-properties)'),
    JSON.stringify(report.diagnostics),
  )
})

test('an explicit rule off overrides the base severity', t => {
  const { status, report } = lint(
    fixture(t, "createConfig({}, { rules: { 'no-debugger': 'off' } })", {
      'source.js': 'debugger\n',
    }),
  )
  assert.equal(status, 0, JSON.stringify(report.diagnostics))
  assert.deepEqual(report.diagnostics, [])
})

test('file overrides disable a rule only for the matching files', t => {
  const { status, report } = lint(
    fixture(
      t,
      "createConfig({}, { overrides: [{ files: ['**/*.test.ts'], rules: { 'no-debugger': 'off' } }] })",
      {
        'source.ts': 'debugger\n',
        'source.test.ts': 'debugger\n',
      },
    ),
  )
  assert.equal(status, 1)
  const diagnostics = report.diagnostics.filter(
    diagnostic => diagnostic.code === 'eslint(no-debugger)',
  )
  assert.equal(diagnostics.length, 1)
  assert.match(diagnostics[0].filename, /source\.ts$/)
})

test('Node environment and custom globals survive loading, and node false stays effective', t => {
  const files = { 'source.js': 'process.stdout.write(projectName)\n' }
  const allowed = lint(
    fixture(
      t,
      "createConfig({ node: true }, { rules: { 'no-undef': 'error' }, globals: { projectName: false } })",
      files,
    ),
  )
  assert.equal(allowed.status, 0, JSON.stringify(allowed.report.diagnostics))
  const denied = lint(
    fixture(
      t,
      "createConfig({ node: true }, { env: { node: false }, rules: { 'no-undef': 'error' }, globals: { projectName: false } })",
      files,
    ),
  )
  assert.equal(denied.status, 1)
  assert.ok(
    denied.report.diagnostics.some(
      diagnostic =>
        diagnostic.code === 'eslint(no-undef)' && diagnostic.message.includes('process'),
    ),
  )
  assert.ok(
    !denied.report.diagnostics.some(diagnostic => diagnostic.message.includes('projectName')),
  )
})

test('Nuxt generated files are ignored unless ignorePatterns is explicitly replaced', t => {
  const files = {
    'source.ts': 'export const ready = true\n',
    '.nuxt/generated.ts': 'debugger\n',
    '.output/generated.js': 'debugger\n',
  }
  const ignored = execute(fixture(t, 'nuxt', files), [
    '--format',
    'json',
    'source.ts',
    '.nuxt',
    '.output',
  ])
  assert.equal(ignored.status, 0, JSON.stringify(ignored.report.diagnostics))
  assert.equal(ignored.report.number_of_files, 1)
  const included = execute(
    fixture(t, 'createConfig({ nuxt: true }, { ignorePatterns: [] })', files),
    ['--format', 'json', 'source.ts', '.nuxt', '.output'],
  )
  assert.equal(included.status, 1)
  assert.equal(
    included.report.diagnostics.filter(diagnostic => diagnostic.code === 'eslint(no-debugger)')
      .length,
    2,
  )
})

test('directory linting excludes root and nested dependencies without a gitignore', t => {
  const files = {
    'source.ts': 'export const ready = true\n',
    'node_modules/dependency/index.js': 'debugger\n',
    'packages/feature/node_modules/dependency/index.js': 'debugger\n',
  }
  const expression =
    "createConfig({}, { overrides: [{ files: ['oxlint.config.mjs'], rules: { 'no-unused-vars': 'off' } }] })"
  const excluded = execute(fixture(t, expression, files), ['--format', 'json', '.'])
  assert.equal(excluded.status, 0, JSON.stringify(excluded.report.diagnostics))
  assert.deepEqual(excluded.report.diagnostics, [])
  assert.equal(excluded.report.number_of_files, 2)

  const includedExpression =
    "createConfig({}, { ignorePatterns: [], overrides: [{ files: ['oxlint.config.mjs'], rules: { 'no-unused-vars': 'off' } }] })"
  const included = execute(fixture(t, includedExpression, files), ['--format', 'json', '.'])
  assert.equal(included.status, 1)
  assert.equal(
    included.report.diagnostics.filter(diagnostic => diagnostic.code === 'eslint(no-debugger)')
      .length,
    2,
  )
})

test('explicit plugins and settings reach the real Oxlint configuration', t => {
  const consumer = fixture(
    t,
    'createConfig({ typescript: false }, { plugins: [], settings: { jsdoc: { ignorePrivate: true } } })',
    {},
  )
  const { status, report } = execute(consumer, ['--print-config'])
  assert.equal(status, 0)
  assert.deepEqual(report.plugins, [])
  assert.equal(report.settings.jsdoc.ignorePrivate, true)
})

test('configuration creation does not mutate inputs or shared presets', () => {
  const presets = [base, typescript, vue, nuxt, node]
  const original = structuredClone(presets)
  const options = Object.freeze({ vue: true })
  const overrides = Object.freeze({
    rules: Object.freeze({ 'no-debugger': 'off' }),
    env: Object.freeze({ browser: false }),
    globals: Object.freeze({ projectName: false }),
    overrides: Object.freeze([]),
  })
  const first = createConfig(options, overrides)
  first.rules['no-debugger'] = 'error'
  first.env.browser = true
  first.globals.projectName = 'writable'
  first.overrides.push({ files: ['**/*.js'], rules: { 'no-debugger': 'off' } })
  const second = createConfig(options, overrides)
  assert.equal(second.rules['no-debugger'], 'off')
  assert.equal(second.env.browser, false)
  assert.equal(second.globals.projectName, false)
  assert.deepEqual(second.overrides, createConfig(options).overrides)
  assert.deepEqual(presets, original)
})

test('Vue template key validation is explicitly outside the native preset coverage', t => {
  const { status, report } = lint(
    fixture(t, 'vue', {
      'component.vue':
        '<script setup lang="ts">\nconst items = [1, 2]\n</script>\n<template><ul><li v-for="item in items">{{ item }}</li></ul></template>\n',
    }),
  )
  assert.equal(status, 0, JSON.stringify(report.diagnostics))
  assert.deepEqual(report.diagnostics, [])
  assert.equal(report.number_of_files, 1)
})

test('caller rules override preset file scopes and caller file overrides still run last', t => {
  const files = {
    'source.ts': 'export type Person = { name: string }\n',
    'strict.ts': 'export type Person = { name: string }\n',
  }
  const { report } = lint(
    fixture(
      t,
      "createConfig({}, { rules: { 'typescript/consistent-type-definitions': 'off' }, overrides: [{ files: ['strict.ts'], rules: { 'typescript/consistent-type-definitions': ['error', 'interface'] } }] })",
      files,
    ),
  )
  const hits = report.diagnostics.filter(d => d.code === 'typescript(consistent-type-definitions)')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].filename, 'strict.ts')
})

test('disabling optional native presets removes their diagnostics', t => {
  const files = {
    'source.test.ts': "import { test } from 'vitest'\n\ntest.only('Works', () => {})\n",
  }
  const enabled = lint(fixture(t, 'createConfig()', files))
  assert.ok(hasRule(enabled.report, 'vitest(no-focused-tests)'))
  const disabled = lint(fixture(t, 'createConfig({ test: false })', files))
  assert.equal(disabled.status, 0, JSON.stringify(disabled.report.diagnostics))
})

test('nested preset rule options are independent across factory calls', () => {
  const first = createConfig()
  first.rules['no-console'][1].allow.push('log')
  first.overrides[0].rules['typescript/ban-ts-comment'][1]['ts-expect-error'] = false
  const second = createConfig()
  assert.deepEqual(second.rules['no-console'][1].allow, ['warn', 'error'])
  assert.equal(
    second.overrides[0].rules['typescript/ban-ts-comment'][1]['ts-expect-error'],
    'allow-with-description',
  )
})

test('native JSX style checks fix literal props and wrap JSX element props', t => {
  const source = 'export const element = <div label={`hello`} icon=<span /> />\n'
  const consumer = fixture(t, 'createConfig()', { 'source.tsx': source })
  const before = lint(consumer)
  assert.ok(hasRule(before.report, 'react(jsx-curly-brace-presence)'))
  execute(consumer, ['--format', 'json', '--fix', ...consumer.targets])
  assert.equal(
    readFileSync(join(consumer.directory, 'source.tsx'), 'utf8'),
    'export const element = <div label="hello" icon={<span />} />\n',
  )
  const after = lint(consumer)
  assert.equal(after.status, 0, JSON.stringify(after.report.diagnostics))
})

test('the JSX style subset can be disabled without enabling React framework rules', t => {
  const source = 'export const element = <div label={`hello`} />\n'
  const files = { 'source.jsx': source, 'source.js': 'export const value = 1\n' }
  const consumer = fixture(t, 'createConfig({ jsx: false })', files)
  const result = execute(consumer, ['--format', 'json', '--fix', ...consumer.targets])
  assert.equal(result.status, 0, JSON.stringify(result.report.diagnostics))
  assert.equal(readFileSync(join(consumer.directory, 'source.jsx'), 'utf8'), source)
  assert.equal(readFileSync(join(consumer.directory, 'source.js'), 'utf8'), files['source.js'])

  const enabled = lint(fixture(t, 'createConfig()', files))
  assert.deepEqual(
    enabled.report.diagnostics.map(d => [d.filename, d.code]),
    [['source.jsx', 'react(jsx-curly-brace-presence)']],
  )
})

test('safe fixes preserve ordinary string escapes that Antfu does not lint', t => {
  const source = "export const color = '\\grey'\n"
  const consumer = fixture(t, 'createConfig()', { 'source.js': source })
  const result = execute(consumer, ['--format', 'json', '--fix', ...consumer.targets])
  assert.equal(result.status, 0, JSON.stringify(result.report.diagnostics))
  assert.equal(readFileSync(join(consumer.directory, 'source.js'), 'utf8'), source)
  const invalidRegexp = lint(
    fixture(t, 'createConfig()', { 'pattern.js': "export const pattern = new RegExp('[')\n" }),
  )
  assert.ok(hasRule(invalidRegexp.report, 'eslint(no-invalid-regexp)'))
})
