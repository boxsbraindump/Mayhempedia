import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

const checks = [
  ['LICENSE', /MIT License/],
  ['README.md', /Code signing policy/],
  ['CODE_SIGNING_POLICY.md', /Free code signing provided by SignPath\.io, certificate by SignPath Foundation/],
  ['site/index.html', /code-signing\.html/],
  ['site/code-signing.html', /Code signing policy/],
  ['.github/workflows/release-candidate.yml', /Build Windows release candidate/],
]

const failures = []
for (const [path, pattern] of checks) {
  try {
    const content = await readFile(new URL(`./${path}`, root), 'utf8')
    if (!pattern.test(content)) failures.push(`${path} is missing ${pattern}`)
  } catch {
    failures.push(`${path} is missing`)
  }
}

if (failures.length) {
  console.error(`Code signing policy check failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Code signing policy check passed.')
