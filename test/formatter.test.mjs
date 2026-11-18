import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { format } from 'oxfmt'
import formatter, { createFormatterConfig } from '../dist/formatter.js'

const oxfmtBin = fileURLToPath(new URL('../node_modules/oxfmt/bin/oxfmt', import.meta.url))

// The low-level format() API ignores configuration overrides; exercise them through the CLI.
function formatWithCli(t, filename, source, options = formatter) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-oxfmt-consumer-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const configPath = join(directory, '.oxfmtrc.json')
  writeFileSync(configPath, JSON.stringify(options))
  const result = spawnSync(
    process.execPath,
    [oxfmtBin, '--config', configPath, '--stdin-filepath', filename],
    { cwd: directory, input: source, encoding: 'utf8', timeout: 20_000 },
  )
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

test('formats TypeScript with the published style and is idempotent', async () => {
  const source = 'export const greet = (name: string) => "Hello " + name;\n'
  const result = await format('example.ts', source, formatter)
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /'Hello '/)
  assert.doesNotMatch(result.code, /;/)
  const second = await format('example.ts', result.code, formatter)
  assert.equal(second.code, result.code)
})

test('formats a complete Vue SFC without changing interpolation', async () => {
  const source =
    '<script setup lang="ts">const title = "Hello";</script>\n<template><h1>{{ title }}</h1></template>\n'
  const result = await format('Example.vue', source, formatter)
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /const title = 'Hello'/)
  assert.match(result.code, /\{\{ title \}\}/)
  assert.equal((await format('Example.vue', result.code, formatter)).code, result.code)
})

test('consumer overrides change formatter behavior without mutating the preset', async () => {
  const config = createFormatterConfig({ semi: true, singleQuote: false })
  const result = await format('example.ts', "export const title = 'Hello'\n", config)
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /"Hello";/)
  assert.equal(formatter.semi, false)
  assert.equal(formatter.singleQuote, true)
})

test('sorts imports into Antfu-like groups while preserving side-effect order', async () => {
  const source =
    "import local from './local'\nimport zebra from 'zebra'\nimport fs from 'node:fs'\nimport type { Local } from './local'\nimport type { External } from 'external'\nimport './z.css'\nimport './a.css'\n"
  const result = await format('example.ts', source, formatter)
  assert.deepEqual(result.errors, [])
  assert.equal(
    result.code,
    "import type { External } from 'external'\nimport type { Local } from './local'\nimport fs from 'node:fs'\nimport zebra from 'zebra'\nimport local from './local'\nimport './z.css'\nimport './a.css'\n",
  )
  assert.equal((await format('example.ts', result.code, formatter)).code, result.code)
})

test('sorts package fields and dependencies without sorting scripts', async () => {
  const source = JSON.stringify({
    dependencies: { zebra: '1', alpha: '1' },
    scripts: { zebra: 'z', alpha: 'a' },
    version: '1.0.0',
    name: 'fixture',
  })
  const result = await format('package.json', source, formatter)
  assert.deepEqual(result.errors, [])
  const data = JSON.parse(result.code)
  assert.ok(Object.keys(data).indexOf('name') < Object.keys(data).indexOf('version'))
  assert.deepEqual(Object.keys(data.dependencies), ['alpha', 'zebra'])
  assert.deepEqual(Object.keys(data.scripts), ['zebra', 'alpha'])
})

test('false disables formatter sorting and defaults are independent across calls', async () => {
  const config = createFormatterConfig({ sortImports: false, sortPackageJson: false })
  const source = "import z from 'z'\nimport a from 'a'\n"
  assert.equal((await format('example.ts', source, config)).code, source)
  const result = await format('package.json', '{"version":"1","name":"fixture"}', config)
  assert.deepEqual(Object.keys(JSON.parse(result.code)), ['version', 'name'])
  const first = createFormatterConfig()
  first.sortImports.groups.push('style')
  assert.ok(!createFormatterConfig().sortImports.groups.includes('style'))
})

test('quotes all object keys when one key requires quotes, as Antfu does', async () => {
  const result = await format(
    'example.ts',
    "export const labels = { valid: 1, 'needs-quotes': 2 }\n",
    formatter,
  )
  assert.deepEqual(result.errors, [])
  assert.equal(result.code, "export const labels = { 'valid': 1, 'needs-quotes': 2 }\n")
})

test('puts wrapped binary operators before their operands, as Antfu does', async () => {
  const source =
    'export const total = firstValueWithALongDescriptiveName + secondValueWithALongDescriptiveName + thirdValueWithALongDescriptiveName\n'
  const result = await format('example.ts', source, formatter)
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /\n\s+\+ secondValueWithALongDescriptiveName/)
  assert.match(result.code, /\n\s+\+ thirdValueWithALongDescriptiveName/)
  assert.doesNotMatch(result.code, /\+\n/)
})

test('the CLI preserves embedded markup in root and nested source files', t => {
  const source = 'const template = html`<section  class="app"><img src="logo.svg"></section>`\n'
  for (const extension of ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']) {
    for (const filename of [`example.${extension}`, `src/example.${extension}`]) {
      assert.equal(formatWithCli(t, filename, source), source, filename)
    }
  }
})

test('the CLI still formats Vue script and style blocks', t => {
  const source =
    '<script setup lang="ts">const title = "Hello";</script>\n<template><h1>{{ title }}</h1></template>\n<style>.title {color:red}</style>\n'
  const result = formatWithCli(t, 'src/Example.vue', source)
  assert.match(result, /const title = 'Hello'/)
  assert.match(result, /\.title \{\n  color: red;\n\}/)
  assert.equal(formatWithCli(t, 'src/Example.vue', result), result)
})

test('explicit formatter overrides replace the default source scope, including an empty array', t => {
  const source =
    'export const template = html`<section  class="app"><img src="logo.svg"></section>`\n'
  const automatic = createFormatterConfig({ overrides: [] })
  const formatted = formatWithCli(t, 'example.ts', source, automatic)
  assert.notEqual(formatted, source)
  assert.match(formatted, /<img src="logo.svg" \/>/)
  const scoped = createFormatterConfig({
    overrides: [{ files: ['**/*.ts'], options: { embeddedLanguageFormatting: 'auto' } }],
  })
  assert.equal(formatWithCli(t, 'example.ts', source, scoped), formatted)
  const first = createFormatterConfig()
  first.overrides[0].options.embeddedLanguageFormatting = 'auto'
  assert.equal(createFormatterConfig().overrides[0].options.embeddedLanguageFormatting, 'off')
})

test('an explicit global embedded formatting option takes precedence over the preset scope', t => {
  const source = 'const template = html`<section  class="app"><img src="logo.svg"></section>`\n'
  const automatic = createFormatterConfig({ embeddedLanguageFormatting: 'auto' })
  const formatted = formatWithCli(t, 'example.ts', source, automatic)
  assert.notEqual(formatted, source)
  assert.match(formatted, /<img src="logo.svg" \/>/)
  const disabled = createFormatterConfig({ embeddedLanguageFormatting: 'off' })
  assert.equal(formatWithCli(t, 'example.ts', source, disabled), source)
  const vueSource =
    '<script setup lang="ts">const title = "Hello";</script>\n<template><h1>{{ title }}</h1></template>\n<style>.title {color:red}</style>\n'
  const vueResult = formatWithCli(t, 'src/Example.vue', vueSource, disabled)
  assert.match(vueResult, /const title = "Hello";/)
  assert.match(vueResult, /\.title \{color:red\}/)
})
