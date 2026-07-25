import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const packageJson = await readJson('./package.json')
const releaseNotes = await readJson('./data/release-notes.json')
const publicUpdates = await readJson('./site/updates.json')
const siteIndex = await readFile(new URL('./site/index.html', root), 'utf8')
const siteApp = await readFile(new URL('./site/app.js', root), 'utf8')
const version = packageJson.version

function fail(message) {
  console.error(`Public release check failed: ${message}`)
  process.exit(1)
}

const matchingRelease = releaseNotes.releases.find((release) => release.version === version)
if (!matchingRelease || matchingRelease.status !== 'released') {
  fail(`data/release-notes.json must mark v${version} as released before publishing.`)
}

if (releaseNotes.currentVersion !== version) {
  fail(`data/release-notes.json currentVersion is ${releaseNotes.currentVersion}, expected ${version}.`)
}

if (publicUpdates.currentVersion !== version) {
  fail(`site/updates.json is ${publicUpdates.currentVersion}, expected ${version}. Run npm run release:notes after marking the release published.`)
}

if (!publicUpdates.releases.some((release) => release.version === version && release.status === 'released')) {
  fail(`site/updates.json does not contain v${version} as a released entry.`)
}

if (!siteApp.includes(`const PUBLIC_RELEASE_VERSION = '${version}'`)) {
  fail(`site/app.js analytics version does not match v${version}.`)
}

const installerUrl = `releases/download/v${version}/Mayhempedia-${version}-setup-x64.exe`
if (!siteIndex.includes(`Early beta ${version}`) || !siteIndex.includes(`Download ${version}`) || !siteIndex.includes(installerUrl)) {
  fail(`site/index.html does not consistently advertise the v${version} installer.`)
}

console.log(`Public release check passed: desktop app, homepage, and Updates are all v${version}.`)
