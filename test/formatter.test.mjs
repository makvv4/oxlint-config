import assert from 'node:assert/strict'
import { test } from 'node:test'
import { format } from 'oxfmt'
import formatter, { createFormatterConfig } from '../dist/formatter.js'

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
