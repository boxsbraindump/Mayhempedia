import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')
const SOURCE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json'

function normalizeName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mayhempedia data sync' } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.json()
}

function fallbackResolves(runtimeId, localId) {
  return runtimeId === localId || runtimeId - 1000 === localId || runtimeId - 2000 === localId || runtimeId % 1000 === localId
}

async function main() {
  const localAugments = await readJson(join(DATA_DIR, 'en', 'augments.json'))
  const liveByName = new Map(
    localAugments
      .filter((augment) => augment.availability !== 'legacy')
      .map((augment) => [normalizeName(augment.name), augment]),
  )
  const communityDragonAugments = await fetchJson(SOURCE)

  const aliases = {}
  const matches = []
  const unmatchedKiwi = []

  for (const augment of communityDragonAugments) {
    const local = liveByName.get(normalizeName(augment.nameTRA))
    const iconPath = String(augment.augmentSmallIconPath ?? '')
    if (!local) {
      if (iconPath.toLowerCase().includes('/kiwi/')) {
        unmatchedKiwi.push({
          runtimeId: augment.id,
          name: augment.nameTRA,
          apiName: augment.augmentNameId,
          rarity: augment.rarity,
          iconPath,
        })
      }
      continue
    }

    matches.push({
      runtimeId: augment.id,
      runtimeName: augment.nameTRA,
      runtimeApiName: augment.augmentNameId,
      runtimeRarity: augment.rarity,
      runtimeIconPath: iconPath,
      localId: local.id,
      localName: local.name,
      localApiName: local.apiName,
      localRarity: local.rarity,
      fallbackAlreadyWorks: fallbackResolves(augment.id, local.id),
    })

    if (!fallbackResolves(augment.id, local.id)) aliases[String(augment.id)] = local.id
  }

  const payload = {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    notes: [
      'Maps Riot/CommunityDragon runtime augment ids to Mayhempedia local ids.',
      'Only live Mayhempedia augments are used as visible targets; unmatched Kiwi rows are kept for review only.',
    ],
    aliases,
    matchedRuntimeRows: matches.length,
    explicitAliasCount: Object.keys(aliases).length,
    unmatchedKiwiCount: unmatchedKiwi.length,
    matches: matches.sort((a, b) => a.runtimeId - b.runtimeId || a.localId - b.localId),
    unmatchedKiwi: unmatchedKiwi.sort((a, b) => a.runtimeId - b.runtimeId),
  }

  await writeFile(join(DATA_DIR, 'augment-runtime-aliases.json'), JSON.stringify(payload, null, 2) + '\n')
  console.log(
    `communitydragon augment aliases: ${payload.explicitAliasCount} explicit aliases, ${payload.matchedRuntimeRows} matched runtime rows, ${payload.unmatchedKiwiCount} unmatched Kiwi rows`,
  )
}

main().catch((error) => {
  console.error('failed:', error)
  process.exit(1)
})
