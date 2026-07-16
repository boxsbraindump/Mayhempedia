import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')

function readJson(path) {
  return readFile(path, 'utf8').then(JSON.parse)
}

function stripMarkup(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/@[A-Za-z0-9_:.+*\-]+@/g, ' ')
    .replace(/%i:[A-Za-z0-9_]+%/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\b(?:AD|AP|MR|HP|MS|AS|CC|Q|W|E|R)\b/g, ' ')
    .replace(/Cherry_[A-Za-z0-9_]+/g, ' ')
    .replace(/Item_Keyword_[A-Za-z0-9_]+/g, ' ')
    .replace(/GeneratedTip_Item_[0-9_]+_ExternalDescription/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasReadableLatin(value) {
  return /[A-Za-z]{3,}/.test(stripMarkup(value))
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(stripMarkup(value))
}

function fail(errors, message) {
  errors.push(message)
}

function checkZhRecord(errors, label, record, fields) {
  for (const field of fields) {
    if (hasReadableLatin(record[field])) {
      fail(errors, `${label} ${field} has non-localized text: ${record[field]}`)
    }
  }
}

function checkEnRecord(errors, label, record, fields) {
  for (const field of fields) {
    if (hasCjk(record[field])) {
      fail(errors, `${label} ${field} has Chinese text in English data: ${record[field]}`)
    }
  }
}

function scanNoCjkStrings(errors, label, value, path = '$') {
  if (typeof value === 'string') {
    if (hasCjk(value)) fail(errors, `${label} ${path} has Chinese text in English data: ${value}`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanNoCjkStrings(errors, label, entry, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      scanNoCjkStrings(errors, label, entry, `${path}.${key}`)
    }
  }
}

function collectRefs(route) {
  const augmentRefs = [
    ...(route.augments?.core ?? []),
    ...(route.augments?.good ?? []),
    ...(route.augments?.trap ?? []),
  ]
  const itemRefs = [
    ...(route.starterItems ?? []),
    ...(route.items ?? []),
    ...(route.boots ?? []),
    ...(route.optionalItems ?? []),
  ]
  return { augmentRefs, itemRefs }
}

async function main() {
  const errors = []
  const [zhAugments, enAugments, zhItems, enItems, buildIndex, patchNotes, enPatchNotes] = await Promise.all([
    readJson(join(DATA_DIR, 'augments.json')),
    readJson(join(DATA_DIR, 'en', 'augments.json')),
    readJson(join(DATA_DIR, 'items.json')),
    readJson(join(DATA_DIR, 'en', 'items.json')),
    readJson(join(DATA_DIR, 'builds', 'index.json')),
    readJson(join(DATA_DIR, 'patch-notes.json')),
    readJson(join(DATA_DIR, 'en', 'patch-notes.json')),
  ])
  const runtimeAliasPayload = await readJson(join(DATA_DIR, 'augment-runtime-aliases.json')).catch(() => ({
    aliases: {},
  }))

  const zhLiveAugments = zhAugments.filter((augment) => augment.availability !== 'legacy')
  const enLiveAugments = enAugments.filter((augment) => augment.availability !== 'legacy')
  if (zhLiveAugments.length !== 199) fail(errors, `zh live augment count expected 199, got ${zhLiveAugments.length}`)
  if (enLiveAugments.length !== 199) fail(errors, `en live augment count expected 199, got ${enLiveAugments.length}`)

  for (const augment of zhLiveAugments) {
    checkZhRecord(errors, `augment ${augment.id} ${augment.apiName}`, augment, ['name', 'desc', 'tooltip'])
  }
  for (const augment of enLiveAugments) {
    checkEnRecord(errors, `en augment ${augment.id} ${augment.apiName}`, augment, ['name', 'rarityLabel', 'desc', 'tooltip'])
  }
  for (const item of enItems) {
    checkEnRecord(errors, `en item ${item.id}`, item, ['name', 'desc'])
  }
  const enChampions = await readJson(join(DATA_DIR, 'en', 'champions.json'))
  const enChampionById = new Map(enChampions.map((champion) => [champion.id, champion]))
  for (const champion of enChampions) {
    checkEnRecord(errors, `en champion ${champion.id}`, champion, ['name', 'title'])
  }

  for (const change of patchNotes.championChanges ?? []) {
    if (!change.championNameEn) fail(errors, `patch champion ${change.championId} is missing championNameEn`)
    if (change.championNameEn) checkEnRecord(errors, `patch champion ${change.championId}`, change, ['championNameEn'])
    const expectedName = enChampionById.get(change.championId)?.name
    if (expectedName && change.championNameEn !== expectedName) {
      fail(errors, `patch champion ${change.championId} championNameEn expected ${expectedName}, got ${change.championNameEn}`)
    }
  }
  for (const change of patchNotes.mayhem?.augmentChanges ?? []) {
    if (!change.nameEn) fail(errors, `patch augment ${change.icon ?? change.name} is missing nameEn`)
    if (change.nameEn) checkEnRecord(errors, `patch augment ${change.icon ?? change.name}`, change, ['nameEn'])
  }
  scanNoCjkStrings(errors, 'data/en/patch-notes.json', enPatchNotes)

  const requiredAugments = {
    MayhemArchmage: { rarity: 2, icon: 'assets/mayhem-augments/archmage-prismatic.webp' },
    ARAMMayhemTerror: { rarity: 2, icon: 'assets/mayhem-augments/terror-prismatic.webp' },
    ARAMMayhemBonk: { rarity: 1, icon: 'assets/mayhem-augments/bonk-gold.webp' },
    ARAMMayhemDoubleTap: { rarity: 1, icon: 'assets/mayhem-augments/double-tap-gold.webp' },
  }
  for (const [apiName, expected] of Object.entries(requiredAugments)) {
    const augment = zhLiveAugments.find((entry) => entry.apiName === apiName)
    if (!augment) {
      fail(errors, `required augment missing: ${apiName}`)
      continue
    }
    if (augment.rarity !== expected.rarity) {
      fail(errors, `${apiName} rarity expected ${expected.rarity}, got ${augment.rarity}`)
    }
    if (augment.iconLargeLocal !== expected.icon) {
      fail(errors, `${apiName} icon expected ${expected.icon}, got ${augment.iconLargeLocal}`)
    }
    await access(join(DATA_DIR, expected.icon)).catch(() => fail(errors, `${apiName} icon file missing: ${expected.icon}`))
  }

  const zhAugmentById = new Map(zhAugments.map((augment) => [augment.id, augment]))
  const enAugmentById = new Map(enAugments.map((augment) => [augment.id, augment]))
  const zhItemById = new Map(zhItems.map((item) => [item.id, item]))
  const enItemById = new Map(enItems.map((item) => [item.id, item]))
  const buildFiles = new Set(Object.values(buildIndex))

  const runtimeAliases = runtimeAliasPayload.aliases ?? {}
  if (Object.keys(runtimeAliases).length < 50) {
    fail(errors, `runtime augment alias table expected at least 50 entries, got ${Object.keys(runtimeAliases).length}`)
  }
  for (const [runtimeId, localId] of Object.entries(runtimeAliases)) {
    if (!Number.isFinite(Number(runtimeId))) fail(errors, `runtime augment alias has invalid runtime id: ${runtimeId}`)
    if (!zhAugmentById.has(localId)) fail(errors, `runtime augment alias ${runtimeId}->${localId} missing from zh augments`)
    if (!enAugmentById.has(localId)) fail(errors, `runtime augment alias ${runtimeId}->${localId} missing from en augments`)
  }

  for (const file of buildFiles) {
    const build = await readJson(join(DATA_DIR, 'builds', file))
    const enBuild = await readJson(join(DATA_DIR, 'en', 'builds', file)).catch(() => null)
    if (!enBuild) fail(errors, `English build file missing: data/en/builds/${file}`)
    if (enBuild) {
      checkEnRecord(errors, `${file}: English build`, enBuild, ['championName'])
      for (const route of enBuild.archetypes ?? []) {
        checkEnRecord(errors, `${file} / ${route.key}: English route`, route, ['name', 'note', 'damageType'])
        const { augmentRefs, itemRefs } = collectRefs(route)
        for (const ref of augmentRefs) checkEnRecord(errors, `${file} / ${route.key}: English augment ${ref.id}`, ref, ['name'])
        for (const ref of itemRefs) checkEnRecord(errors, `${file} / ${route.key}: English item ${ref.id}`, ref, ['name'])
      }
    }
    for (const route of build.archetypes ?? []) {
      const { augmentRefs, itemRefs } = collectRefs(route)
      for (const ref of augmentRefs) {
        if (!zhAugmentById.has(ref.id)) fail(errors, `${file} / ${route.name}: augment ${ref.id} missing from zh augments`)
        if (!enAugmentById.has(ref.id)) fail(errors, `${file} / ${route.name}: augment ${ref.id} missing from en augments`)
      }
      for (const ref of itemRefs) {
        const zhItem = zhItemById.get(ref.id)
        const enItem = enItemById.get(ref.id)
        if (!zhItem) fail(errors, `${file} / ${route.name}: item ${ref.id} missing from zh items`)
        if (!enItem) fail(errors, `${file} / ${route.name}: item ${ref.id} missing from en items`)
        if (zhItem) checkZhRecord(errors, `${file} / ${route.name}: item ${ref.id}`, zhItem, ['name', 'desc'])
      }
    }
  }

  const unusedBuildFiles = (await readdir(join(DATA_DIR, 'builds'))).filter(
    (file) => file.endsWith('.json') && file !== 'index.json' && !buildFiles.has(file),
  )
  if (unusedBuildFiles.length) fail(errors, `build files not listed in index: ${unusedBuildFiles.join(', ')}`)

  if (errors.length) {
    console.error(`\n❌ 本地化数据校验失败 (${errors.length})`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log('✅ 本地化数据校验完成: 语言一致性、增强数量、关键 tier/icon 覆盖均通过')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
