import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import createConfig, { nextjs, react } from '../dist/index.js'
import { assertNativeCase, readCases, runNativeCases } from '../scripts/behavior-cases.mjs'

const cases = readCases('frameworks')

for (const [name, preset] of Object.entries({ react, nextjs })) {
  test(`the ${name} preset matches Antfu diagnostics and severities without enabling the other framework`, t => {
    const report = runNativeCases(t, preset, cases)
    for (const entry of cases)
      assertNativeCase(report, entry.profile === name ? entry : { ...entry, report: false })
  })
}

test('default JSX style does not enable React or Next.js framework rules', t => {
  const report = runNativeCases(t, createConfig(), cases)
  for (const entry of cases) assertNativeCase(report, { ...entry, report: false })
})

test('explicit Next.js integration allows route exports alongside React components', t => {
  const entry = {
    id: 'route-exports',
    file: 'page.tsx',
    source:
      "export const metadata = { title: 'Example' }\nexport default function Page() { return <main /> }\n",
    native: 'react(only-export-components)',
    report: true,
  }
  for (const enableNext of [false, true]) {
    const config = createConfig({ jsx: false, react: { fastRefresh: [] }, nextjs: enableNext })
    assertNativeCase(runNativeCases(t, config, [entry]), { ...entry, report: !enableNext })
  }
})

const refreshExamples = [
  ['vite', 'export const count = 42'],
  ['next', "export const metadata = { title: 'Example' }"],
  ...[
    'meta',
    'links',
    'headers',
    'loader',
    'action',
    'clientLoader',
    'clientAction',
    'handle',
    'shouldRevalidate',
  ].map(name => ['route', `export function ${name}() { return null }`]),
  ['other', 'export function unrelatedHelper() { return 42 }'],
].map(([group, declaration], index) => ({
  group,
  id: `refresh-${group}-${index}`,
  file: 'route.tsx',
  native: 'react(only-export-components)',
  source: `${declaration}\nexport default function Page() { return <main /> }\n`,
}))

function checkRefresh(t, options, allowed) {
  const report = runNativeCases(t, createConfig({ react: options }), refreshExamples)
  for (const example of refreshExamples) {
    assertNativeCase(report, { ...example, report: !allowed.includes(example.group) })
  }
}

function installMarker(root, name) {
  const directory = join(root, 'node_modules', name)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, exports: {} }))
}

test('Fast Refresh detects only installed Antfu markers from the consumer workspace', t => {
  const root = mkdtempSync(join(tmpdir(), 'oxlint-refresh-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [index, [packages, allowed]] of [
    [['react-router'], []],
    [['vite'], ['vite']],
    [['@remix-run/react'], ['route']],
    [
      ['@react-router/dev', 'vite'],
      ['route', 'vite'],
    ],
    [
      ['next', '@remix-run/node'],
      ['next', 'route'],
    ],
  ].entries()) {
    const workspace = join(root, String(index))
    const rootDir = join(workspace, 'apps', 'web')
    mkdirSync(rootDir, { recursive: true })
    for (const name of packages) installMarker(workspace, name)
    checkRefresh(t, { rootDir }, allowed)
  }
})

test('explicit Fast Refresh integrations replace auto-detection, including an empty list', t => {
  const rootDir = mkdtempSync(join(tmpdir(), 'oxlint-refresh-'))
  t.after(() => rmSync(rootDir, { recursive: true, force: true }))
  installMarker(rootDir, 'next')
  checkRefresh(t, { rootDir, fastRefresh: [] }, [])
  checkRefresh(t, { rootDir, fastRefresh: ['vite', 'remix'] }, ['vite', 'route'])
  checkRefresh(t, { rootDir, fastRefresh: ['react-router', 'next'] }, ['next', 'route'])
})
