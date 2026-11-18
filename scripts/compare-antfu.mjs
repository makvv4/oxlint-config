import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import formatter, { createFormatterConfig } from '../dist/formatter.js'
import createConfig from '../dist/index.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = join(root, 'fixtures/antfu')
const oxlintBin = join(root, 'node_modules/oxlint/bin/oxlint')
const defaultOxfmtBin = join(root, 'node_modules/oxfmt/bin/oxfmt')
// Oxlint also extracts Astro frontmatter/script and Svelte script blocks natively.
const lintExtensions = /\.(?:[cm]?[jt]sx?|vue|astro|svelte)$/

function execute(bin, args, directory) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.signal) {
    throw new Error(result.error?.message ?? `Process terminated by ${result.signal}`)
  }
  return result
}

function firstDifferentLine(expected, actual) {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const index = expectedLines.findIndex((line, i) => line !== actualLines[i])
  return index === -1 ? (expected === actual ? null : expectedLines.length + 1) : index + 1
}

/** Run safe native fixes to convergence and the real Oxfmt CLI/config resolver. */
export async function compareAntfu({
  config = createConfig({ vue: true }),
  formatting = formatter,
  oxfmtBin = defaultOxfmtBin,
  detailsDirectory,
} = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-antfu-')))
  try {
    cpSync(join(fixtures, 'input'), directory, { recursive: true })
    const configPath = join(directory, '.oxlintrc.json')
    const formatterPath = join(directory, '.oxfmtrc.json')
    writeFileSync(configPath, JSON.stringify(config))
    writeFileSync(formatterPath, JSON.stringify(formatting))
    const files = readdirSync(join(fixtures, 'input')).sort()
    const targets = files.filter(file => lintExtensions.test(file))
    const read = file => readFileSync(join(directory, file), 'utf8')
    const runLint = args => {
      const result = execute(
        oxlintBin,
        ['-c', configPath, '--format', 'json', ...args, ...targets],
        directory,
      )
      if (![0, 1].includes(result.status)) throw new Error(result.stderr || result.stdout)
      return JSON.parse(result.stdout)
    }
    const before = runLint([])
    let fixPasses = 0
    let stable = false
    // Overlapping fixes (e.g. no-var + prefer-template) need separate CLI invocations.
    for (let attempt = 0; attempt < 10; attempt++) {
      const previous = targets.map(read)
      runLint(['--fix'])
      if (targets.every((file, index) => read(file) === previous[index])) {
        stable = true
        break
      }
      fixPasses++
    }
    if (!stable) throw new Error('Oxlint safe fixes did not converge within 10 passes')
    const afterFix = runLint([])
    const rows = []
    const outputs = new Map()
    const expectedOutputs = new Map()
    for (const file of files) {
      const input = readFileSync(join(fixtures, 'input', file), 'utf8')
      const result = execute(oxfmtBin, ['-c', formatterPath, '--write', file], directory)
      const expectedPath = join(fixtures, 'expected', file)
      // Upstream only stores a snapshot when ESLint changes the input.
      const expected = readFileSync(
        existsSync(expectedPath) ? expectedPath : join(fixtures, 'input', file),
        'utf8',
      )
      const actual = read(file)
      const formatted = result.status === 0
      // The CLI excludes disabled languages and unknown extensions from its target list.
      const notSelected =
        result.status === 2 && result.stderr.includes('Expected at least one target file')
      const check = formatted
        ? execute(oxfmtBin, ['-c', formatterPath, '--check', file], directory)
        : null
      rows.push({
        file,
        linted: lintExtensions.test(file),
        formatterStatus: formatted ? 'formatted' : notSelected ? 'not-selected' : 'error',
        formatted,
        referenceChanged: expected !== input,
        byteEqual: actual === expected,
        // An unchanged, skipped file is not evidence of formatter compatibility.
        exactMatch: formatted && actual === expected,
        firstDifferentLine: firstDifferentLine(expected, actual),
        idempotent: formatted ? check.status === 0 : null,
        formattingErrors: formatted || notSelected ? [] : [result.stderr || result.stdout],
      })
      outputs.set(file, actual)
      expectedOutputs.set(file, expected)
    }
    const after = runLint([])
    const diagnostics = report =>
      report.diagnostics.map(({ filename, code, severity }) => ({ filename, code, severity }))
    const report = {
      reference: {
        package: '@antfu/eslint-config',
        version: '10.0.0',
        commit: 'bb2013690a517ea9b369d36d79a5708356326a64',
        suite: 'all',
      },
      pipeline: 'oxlint --fix until stable, then Oxfmt CLI; no suggestion or dangerous fixes',
      tools: {
        oxlint: execute(oxlintBin, ['--version'], directory).stdout.trim(),
        oxfmt: execute(oxfmtBin, ['--version'], directory).stdout.trim(),
      },
      fixPasses,
      lintedFiles: before.number_of_files,
      files: rows,
      diagnosticsBefore: diagnostics(before),
      diagnosticsAfterFix: diagnostics(afterFix),
      diagnosticsAfter: diagnostics(after),
    }
    if (detailsDirectory) {
      const destination = resolve(detailsDirectory)
      // Never overwrite an earlier report or a caller's existing directory.
      mkdirSync(destination)
      for (const [name, content] of [
        ['actual', outputs],
        ['expected', expectedOutputs],
      ]) {
        mkdirSync(join(destination, name))
        for (const [file, source] of content) writeFileSync(join(destination, name, file), source)
      }
      writeFileSync(join(destination, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    }
    return report
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'details-dir': { type: 'string' },
      'framework-formatters': { type: 'boolean', default: false },
      'oxfmt-bin': { type: 'string' },
    },
  })
  if (positionals.length > 1) throw new Error('Expected at most one JSON report path')
  const report = await compareAntfu({
    detailsDirectory: values['details-dir'],
    oxfmtBin: values['oxfmt-bin'] ? resolve(values['oxfmt-bin']) : defaultOxfmtBin,
    formatting: values['framework-formatters']
      ? createFormatterConfig({ astro: true, svelte: true })
      : formatter,
  })
  if (positionals[0]) writeFileSync(resolve(positionals[0]), `${JSON.stringify(report, null, 2)}\n`)
  console.table(
    report.files.map(({ file, linted, formatterStatus, referenceChanged, exactMatch }) => ({
      file,
      linted,
      formatterStatus,
      referenceChanged,
      exactMatch,
    })),
  )
  console.log(
    `Exact processed snapshots: ${report.files.filter(row => row.exactMatch).length}/${report.files.filter(row => row.formatted).length} formatted files (${report.files.length} total inputs)`,
  )
  console.log(`Safe fix passes that changed files: ${report.fixPasses}`)
  console.log(
    `Diagnostics: ${report.diagnosticsBefore.length} before, ${report.diagnosticsAfter.length} after safe fixes and formatting`,
  )
  if (report.files.some(row => row.idempotent === false || row.formatterStatus === 'error'))
    process.exitCode = 1
}
