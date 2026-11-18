import assert from 'node:assert/strict'
import test from 'node:test'
import createConfig, { accessibility } from '../dist/index.js'
import { assertNativeCase, readCases, runNativeCases } from '../scripts/behavior-cases.mjs'

const cases = readCases('accessibility')

test('native JSX accessibility matches the Antfu recommended diagnostics and exceptions', async t => {
  const report = runNativeCases(t, accessibility, cases)
  for (const entry of cases) await t.test(entry.id, () => assertNativeCase(report, entry))
})

test('JSX accessibility is opt-in and accepts ordinary rule overrides', t => {
  const missingAlt = cases.find(entry => entry.id === 'missing-alt')
  for (const config of [
    createConfig(),
    createConfig({ react: true }),
    createConfig({ accessibility: true }, { rules: { 'jsx-a11y/alt-text': 'off' } }),
  ]) {
    const report = runNativeCases(t, config, [missingAlt])
    assert.equal(
      report.diagnostics.some(d => d.code === missingAlt.native),
      false,
    )
  }
})
