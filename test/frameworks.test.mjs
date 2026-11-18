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
    const config = createConfig({ jsx: false, react: true, nextjs: enableNext })
    assertNativeCase(runNativeCases(t, config, [entry]), { ...entry, report: !enableNext })
  }
})
