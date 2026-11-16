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
