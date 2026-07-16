import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')
const BUILD_DIR = join(DATA_DIR, 'builds')
const EN_BUILD_DIR = join(DATA_DIR, 'en', 'builds')

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse)
}

function refName(ref, byId) {
  return byId.get(ref.id)?.name ?? ref.name ?? `#${ref.id}`
}

function mapRefs(refs = [], byId) {
  return refs.map((ref) => ({
    ...ref,
    name: refName(ref, byId),
  }))
}

function routeFlavor(route) {
  const key = String(route.key || '').toLowerCase()
  return (
    key.includes('poke') ? 'Poke' :
    key.includes('crit') ? 'Crit' :
    key.includes('onhit') || key.includes('on-hit') ? 'On-Hit' :
    key.includes('support') || key.includes('heal') ? 'Support' :
    key.includes('tank') ? 'Tank' :
    key.includes('burn') ? 'Burn' :
    key.includes('burst') ? 'Burst' :
    ''
  )
}

function routeTitle(championName, route, enAugmentById, useMechanicName) {
  const damage = String(route.damageType || '').toUpperCase()
  const type =
    damage === 'AP'
      ? 'AP'
      : damage === 'AD'
        ? 'AD'
        : damage === 'TANK'
          ? 'Tank'
        : route.damageType || 'Mayhem'
  const coreAugment = route.augments?.core?.[0] ? refName(route.augments.core[0], enAugmentById) : ''
  const flavor = routeFlavor(route)
  const mechanic = useMechanicName ? (coreAugment || flavor) : flavor
  return [type, mechanic, championName].filter(Boolean).join(' ')
}

function routeNote(championName, route, enItemById, enAugmentById) {
  const coreAugments = mapRefs(route.augments?.core, enAugmentById).map((ref) => ref.name)
  const goodAugments = mapRefs(route.augments?.good, enAugmentById).map((ref) => ref.name)
  const items = mapRefs(route.items, enItemById).map((ref) => ref.name)
  const starters = mapRefs(route.starterItems, enItemById).map((ref) => ref.name)
  const sourceText = route.sources?.length ? ` Cross-checked against ${route.sources.join(' and ')}.` : ''
  const opener = `${championName} ${String(route.damageType || '').toUpperCase()} route for ARAM: Mayhem.`
  const augmentText = coreAugments.length
    ? ` Prioritize ${coreAugments.slice(0, 3).join(' / ')} as the main augment plan.`
    : ''
  const goodText = goodAugments.length
    ? ` Strong secondary hits include ${goodAugments.slice(0, 3).join(' / ')}.`
    : ''
  const itemText = items.length
    ? ` Build toward ${items.slice(0, 6).join(' > ')}.`
    : ''
  const starterText = starters.length
    ? ` Start with ${starters.slice(0, 3).join(' + ')}.`
    : ''
  return `${opener}${augmentText}${goodText}${itemText}${starterText}${sourceText}`.replace(/\s+/g, ' ').trim()
}

async function main() {
  const [buildIndex, enChampions, enItems, enAugments] = await Promise.all([
    readJson(join(BUILD_DIR, 'index.json')),
    readJson(join(DATA_DIR, 'en', 'champions.json')),
    readJson(join(DATA_DIR, 'en', 'items.json')),
    readJson(join(DATA_DIR, 'en', 'augments.json')),
  ])
  const enChampionById = new Map(enChampions.map((champion) => [champion.id, champion]))
  const enItemById = new Map(enItems.map((item) => [item.id, item]))
  const enAugmentById = new Map(enAugments.map((augment) => [augment.id, augment]))

  await mkdir(EN_BUILD_DIR, { recursive: true })
  await writeFile(join(EN_BUILD_DIR, 'index.json'), JSON.stringify(buildIndex, null, 2) + '\n')

  const files = new Set(Object.values(buildIndex))
  for (const file of files) {
    const build = await readJson(join(BUILD_DIR, file))
    const champion = enChampionById.get(build.championId)
    const championName = champion?.name ?? build.championName
    const localized = {
      ...build,
      championName,
      archetypes: (build.archetypes ?? []).map((route) => ({
        ...route,
        name: routeTitle(championName, route, enAugmentById, (build.archetypes ?? []).length > 1),
        note: routeNote(championName, route, enItemById, enAugmentById),
        augments: {
          core: mapRefs(route.augments?.core, enAugmentById),
          good: mapRefs(route.augments?.good, enAugmentById),
          trap: mapRefs(route.augments?.trap, enAugmentById),
        },
        starterItems: mapRefs(route.starterItems, enItemById),
        items: mapRefs(route.items, enItemById),
        boots: mapRefs(route.boots, enItemById),
        optionalItems: mapRefs(route.optionalItems, enItemById),
      })),
    }
    await writeFile(join(EN_BUILD_DIR, file), JSON.stringify(localized, null, 2) + '\n')
  }

  const extraFiles = (await readdir(EN_BUILD_DIR)).filter((file) => file.endsWith('.json') && file !== 'index.json' && !files.has(file))
  if (extraFiles.length) {
    console.warn(`Unused English build files left in place: ${extraFiles.join(', ')}`)
  }
  console.log(`Generated ${files.size} English build files in data/en/builds`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
