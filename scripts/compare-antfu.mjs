import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
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
import { format } from 'oxfmt'
import formatter from '../dist/formatter.js'
import createConfig from '../dist/index.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = join(root, 'fixtures/antfu')
const oxlintBin = join(root, 'node_modules/oxlint/bin/oxlint')
const lintExtensions = /\.(?:[cm]?[jt]sx?|vue)$/

/** Run the real native tools over the unmodified upstream fixture corpus. */
export async function compareAntfu({
  config = createConfig({ vue: true }),
  formatting = formatter,
} = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'makvv4-antfu-')))
  try {
    cpSync(join(fixtures, 'input'), directory, { recursive: true })
    const configPath = join(directory, '.oxlintrc.json')
    writeFileSync(configPath, JSON.stringify(config))
    const files = readdirSync(join(fixtures, 'input')).sort()
    const targets = files.filter(file => lintExtensions.test(file))
    const run = args => {
      const result = spawnSync(
        process.execPath,
        [oxlintBin, '-c', configPath, '--format', 'json', ...args, ...targets],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 8 * 1024 * 1024,
        },
      )
      if (result.error || result.signal || ![0, 1].includes(result.status)) {
        throw new Error(result.error?.message ?? result.stderr ?? result.stdout)
      }
      return JSON.parse(result.stdout)
    }
    const before = run([])
    run(['--fix'])
    const rows = []
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8')
      const result = await format(file, source, formatting)
      const expectedPath = join(fixtures, 'expected', file)
      // Upstream only stores a snapshot when ESLint changes the input.
      const expected = readFileSync(
        existsSync(expectedPath) ? expectedPath : join(fixtures, 'input', file),
        'utf8',
      )
      const supported = result.errors.length === 0
      if (supported) writeFileSync(join(directory, file), result.code)
      const second = supported ? await format(file, result.code, formatting) : null
      rows.push({
        file,
        linted: lintExtensions.test(file),
        formatted: supported,
        exactMatch: supported && result.code === expected,
        idempotent: supported ? second.errors.length === 0 && second.code === result.code : null,
        formattingErrors: result.errors,
      })
    }
    const after = run([])
    return {
      reference: {
        package: '@antfu/eslint-config',
        version: '10.0.0',
        commit: 'bb2013690a517ea9b369d36d79a5708356326a64',
        suite: 'all',
      },
      pipeline: 'oxlint --fix, then Oxfmt; no suggestion or dangerous fixes',
      files: rows,
      diagnosticsBefore: before.diagnostics.map(({ filename, code, severity }) => ({
        filename,
        code,
        severity,
      })),
      diagnosticsAfter: after.diagnostics.map(({ filename, code, severity }) => ({
        filename,
        code,
        severity,
      })),
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await compareAntfu()
  if (process.argv[2])
    writeFileSync(resolve(process.argv[2]), `${JSON.stringify(report, null, 2)}\n`)
  console.table(
    report.files.map(({ file, linted, formatted, exactMatch }) => ({
      file,
      linted,
      formatted,
      exactMatch,
    })),
  )
  console.log(
    `Exact upstream snapshots: ${report.files.filter(row => row.exactMatch).length}/${report.files.length}`,
  )
  console.log(
    `Diagnostics: ${report.diagnosticsBefore.length} before, ${report.diagnosticsAfter.length} after safe fixes and formatting`,
  )
  if (report.files.some(row => row.idempotent === false)) process.exitCode = 1
}
