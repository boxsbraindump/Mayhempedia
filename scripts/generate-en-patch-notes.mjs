import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse)
}

function englishAugmentName(name = '') {
  const match = String(name).match(/\(([^)]+)\)\s*$/)
  return match ? match[1].trim() : String(name).trim()
}

async function main() {
  const [patchNotes, enChampions, enItems] = await Promise.all([
    readJson(join(DATA_DIR, 'patch-notes.json')),
    readJson(join(DATA_DIR, 'en', 'champions.json')),
    readJson(join(DATA_DIR, 'en', 'items.json')),
  ])

  const championById = new Map(enChampions.map((champion) => [champion.id, champion]))
  const itemById = new Map(enItems.map((item) => [item.id, item]))

  const enPatchNotes = {
    patch: patchNotes.patch,
    theme: patchNotes.theme,
    releaseDate: patchNotes.releaseDate,
    sourceUrl: patchNotes.sourceUrl,
    championChanges: patchNotes.championChanges.map((change) => ({
      championId: change.championId,
      championName: change.championNameEn ?? championById.get(change.championId)?.name ?? change.championName,
      changes: change.changesEn ?? change.changes,
    })),
    itemChanges: patchNotes.itemChanges.map((change) => ({
      ...(change.itemId != null ? { itemId: change.itemId } : {}),
      itemName: change.itemNameEn ?? itemById.get(change.itemId)?.name ?? change.itemName,
      changes: change.changesEn ?? change.changes,
    })),
    systemChanges: patchNotes.systemChangesEn ?? patchNotes.systemChanges,
    mayhem: {
      summaryEn: patchNotes.mayhem.summaryEn ?? patchNotes.mayhem.summaryZh,
      augmentChanges: patchNotes.mayhem.augmentChanges.map((change) => ({
        ...(change.icon ? { icon: change.icon } : {}),
        name: change.nameEn ?? englishAugmentName(change.name),
        change: change.changeEn ?? change.change,
      })),
      bugfixes: patchNotes.mayhem.bugfixesEn ?? patchNotes.mayhem.bugfixes,
    },
  }

  const outPath = join(DATA_DIR, 'en', 'patch-notes.json')
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(enPatchNotes, null, 2)}\n`)
  console.log(`Generated ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
