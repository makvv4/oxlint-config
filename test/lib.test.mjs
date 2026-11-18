import assert from 'node:assert/strict'
import test from 'node:test'
import createConfig, { accessibility, lib, nextjs, react, typeAware } from '../dist/index.js'
import { assertNativeCase, readCases, runNativeCases } from '../scripts/behavior-cases.mjs'

const cases = readCases('lib')

test('library return type checks match Antfu diagnostics and file exceptions', t => {
  const report = runNativeCases(t, createConfig({ type: 'lib', vue: true }), cases)
  for (const entry of cases) assertNativeCase(report, entry)
})

test('library checks respect app mode, disabled TypeScript, and caller rule overrides', t => {
  const entry = cases.find(item => item.id === 'library-function')
  for (const config of [
    createConfig({ type: 'app' }),
    createConfig({ type: 'lib', typescript: false }),
    createConfig({ type: 'lib' }, { rules: { 'typescript/explicit-function-return-type': 'off' } }),
  ]) {
    assertNativeCase(runNativeCases(t, config, [entry]), { ...entry, report: false })
  }
})

test('named presets are complete configurations and remain independent', () => {
  for (const [preset, options] of [
    [lib, { type: 'lib' }],
    [typeAware, { typeAware: true }],
    [react, { react: true }],
    [nextjs, { nextjs: true }],
    [accessibility, { accessibility: true }],
  ])
    assert.deepEqual(preset, createConfig(options))
  assert.deepEqual(
    createConfig(),
    createConfig({
      type: 'app',
      typeAware: false,
      react: false,
      nextjs: false,
      accessibility: false,
    }),
  )
})
