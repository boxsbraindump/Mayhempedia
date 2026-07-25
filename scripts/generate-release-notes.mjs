import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const sourcePath = new URL('./data/release-notes.json', root)
const changelogPath = new URL('./CHANGELOG.md', root)
const sitePath = new URL('./site/updates.json', root)

const payload = JSON.parse(await readFile(sourcePath, 'utf8'))

function list(items) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None'
}

const changelog = [
  '# Mayhempedia changelog',
  '',
  'Release history for the Mayhempedia desktop companion. League/ARAM game patch notes live separately in `data/patch-notes.json`.',
  '',
  ...payload.releases.flatMap((release) => [
    `## [${release.version}] - ${release.status === 'unreleased' ? 'Unreleased' : release.date}`,
    '',
    release.summaryEn,
    '',
    '### Added',
    list(release.addedEn),
    '',
    '### Changed',
    list(release.changedEn),
    '',
    '### Fixed',
    list(release.fixedEn),
    '',
  ]),
].join('\n')

const publicReleases = payload.releases.map((release) => {
  const notes = release.public ?? {}
  return {
    version: release.version,
    status: release.status,
    date: release.date,
    titleEn: notes.titleEn ?? '',
    titleZh: notes.titleZh ?? '',
    summaryEn: notes.summaryEn ?? '',
    summaryZh: notes.summaryZh ?? '',
    addedEn: notes.addedEn ?? [],
    addedZh: notes.addedZh ?? [],
    changedEn: notes.changedEn ?? [],
    changedZh: notes.changedZh ?? [],
    fixedEn: notes.fixedEn ?? [],
    fixedZh: notes.fixedZh ?? [],
    releaseUrl: release.releaseUrl,
  }
})

await writeFile(changelogPath, `${changelog.trim()}\n`, 'utf8')
await writeFile(sitePath, `${JSON.stringify({ currentVersion: payload.currentVersion, releases: publicReleases }, null, 2)}\n`, 'utf8')
console.log(`Generated CHANGELOG.md and site/updates.json for ${payload.releases.length} releases.`)
