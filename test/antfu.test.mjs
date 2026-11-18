import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import createConfig from '../dist/index.js'
import { assertNativeCase, readCases, runNativeCases } from '../scripts/behavior-cases.mjs'
import { compareAntfu } from '../scripts/compare-antfu.mjs'

test('native diagnostics reproduce behavior checked against Antfu 10.0.0', async t => {
  const cases = readCases('behavior')
  const report = runNativeCases(t, createConfig({ vue: true, isInEditor: false }), cases)
  for (const entry of cases) await t.test(entry.id, () => assertNativeCase(report, entry))
})

test('upstream fixture comparison converges safe fixes and preserves inspectable differences', async t => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-antfu-report-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const detailsDirectory = join(directory, 'details')
  const report = await compareAntfu({ detailsDirectory })
  assert.equal(report.files.length, 18)
  assert.equal(report.lintedFiles, 10)
  assert.equal(report.files.filter(row => row.linted).length, 10)
  assert.equal(report.files.filter(row => row.formatted).length, 14)
  for (const row of report.files.filter(row => row.formatted))
    assert.equal(row.idempotent, true, row.file)
  assert.deepEqual(
    report.files.filter(row => row.exactMatch).map(row => row.file),
    ['angular-inline.component.ts', 'angular.component.ts', 'tsconfig.json'],
  )
  assert.equal(report.fixPasses, 2)
  assert.deepEqual(report.diagnosticsAfterFix, [])
  assert.deepEqual(report.diagnosticsAfter, [])
  const actual = file => readFileSync(join(detailsDirectory, 'actual', file), 'utf8')
  assert.ok(actual('typescript.ts').includes('return `hello${1}`'))
  assert.ok(actual('astro.astro').includes('const content'))
  assert.ok(actual('tsx.tsx').includes('bar="foo"'))
  for (const file of ['svg.svg', 'xml.xml']) {
    const row = report.files.find(row => row.file === file)
    assert.equal(row.formatterStatus, 'not-selected')
    assert.equal(row.byteEqual, true)
    assert.equal(row.exactMatch, false)
  }
  assert.deepEqual(JSON.parse(readFileSync(join(detailsDirectory, 'report.json'), 'utf8')), report)

  // The remaining mixed-text JSX line wrapping must not change rendered children.
  const tree = source => {
    const result = transpileModule(source, {
      compilerOptions: {
        jsx: JsxEmit.React,
        jsxFactory: 'h',
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2022,
      },
      fileName: 'fixture.tsx',
    })
    const exports = {}
    const h = (type, props, ...children) => ({
      type: typeof type === 'function' ? type.name : type,
      props,
      children,
    })
    runInNewContext(result.outputText, { exports, h }, { timeout: 1000 })
    return JSON.parse(JSON.stringify(exports.Component2()))
  }
  assert.deepEqual(
    tree(actual('tsx.tsx')),
    tree(readFileSync(join(detailsDirectory, 'expected', 'tsx.tsx'), 'utf8')),
  )
})
