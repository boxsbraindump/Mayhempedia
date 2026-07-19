import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const expectedTag = `v${pkg.version}`
const releaseTag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME
const certificateSource = process.env.WIN_CSC_LINK ?? process.env.CSC_LINK ?? process.env.CSC_NAME ?? process.env.WIN_CSC_NAME

function fail(message) {
  console.error(`Release preflight failed: ${message}`)
  process.exit(1)
}

if (releaseTag && releaseTag !== expectedTag) {
  fail(`package.json is ${expectedTag}, but the release tag is ${releaseTag}.`)
}

if (!certificateSource) {
  fail('No Windows signing identity is configured. Set WIN_CSC_LINK (or CSC_LINK) and its password before making a public installer.')
}

try {
  const tagCommit = execFileSync('git', ['rev-list', '-n', '1', expectedTag], { encoding: 'utf8' }).trim()
  const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  if (tagCommit && tagCommit !== headCommit) {
    fail(`${expectedTag} does not point at the commit being packaged. Create the tag only after this commit is final.`)
  }
} catch {
  // Release CI can run before tags are fetched; the explicit version and certificate checks still apply.
}

console.log(`Release preflight passed for ${expectedTag}. A signing identity is configured.`)
