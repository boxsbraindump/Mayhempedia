// 生成海克斯 × 英雄评级库 → data/augment-tiers.json（海克斯详情页、以后的选海克斯 overlay 都读它）
// 运行：node scripts/build-augment-tiers.mjs          重新生成
//       node scripts/build-augment-tiers.mjs --check  只检查文件是否和流派数据一致（npm run validate 用）
//
// 评级来源按 SOURCES 的顺序合并：同一个「海克斯 × 英雄」有多个来源时，排在前面的来源决定最终评级，
// 其余来源的评级保留在 others 里。现在只有官方流派一个来源；以后接入授权的统计数据时，
// 在 SOURCES 里加一个返回同样结构的函数即可，页面和 overlay 不用改。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const OUT = join(DATA_DIR, 'augment-tiers.json')
const TIERS = ['S', 'A', 'B', 'C', 'D']
const ROUTE_TIER = { core: 'S', good: 'A', trap: 'D' }

async function readJson(file) {
  return JSON.parse(await readFile(join(DATA_DIR, file), 'utf8'))
}

/** 官方流派：核心 = S，备选 = A，陷阱 = D；同一英雄多条流派里取最高的那档，并记下每条流派各自的档位和名字 */
async function routeRatings(liveIds) {
  const buildIndex = await readJson(join('builds', 'index.json'))
  const ratings = new Map()
  for (const file of new Set(Object.values(buildIndex))) {
    const build = await readJson(join('builds', file))
    const enBuild = await readJson(join('en', 'builds', file)).catch(() => null)
    for (const route of build.archetypes ?? []) {
      const enName = enBuild?.archetypes?.find((entry) => entry.key === route.key)?.name ?? route.name
      for (const [slot, tier] of Object.entries(ROUTE_TIER)) {
        for (const ref of route.augments?.[slot] ?? []) {
          if (!liveIds.has(ref.id)) continue
          const key = `${ref.id}:${build.championId}`
          const rating = ratings.get(key) ?? { augmentId: ref.id, championId: build.championId, tier, routes: [] }
          if (TIERS.indexOf(tier) < TIERS.indexOf(rating.tier)) rating.tier = tier
          rating.routes.push({ key: route.key, tier, name: { zh: route.name, en: enName } })
          ratings.set(key, rating)
        }
      }
    }
  }
  return [...ratings.values()]
}

const SOURCES = [
  {
    id: 'routes',
    kind: 'editorial',
    label: { zh: 'Mayhempedia 官方流派', en: 'Mayhempedia routes' },
    rule: { zh: '流派核心 = S，备选 = A，陷阱 = D', en: 'Route core = S, good = A, trap = D' },
    collect: routeRatings,
  },
]

async function build() {
  const augments = await readJson('augments.json')
  const liveIds = new Set(augments.filter((augment) => augment.availability === 'live').map((augment) => augment.id))
  const snapshot = await readJson('arammayhem-augments.snapshot.json').catch(() => ({}))

  const merged = new Map()
  for (const source of SOURCES) {
    for (const rating of await source.collect(liveIds)) {
      if (!TIERS.includes(rating.tier)) throw new Error(`${source.id}: unknown tier ${rating.tier}`)
      const key = `${rating.augmentId}:${rating.championId}`
      const entry = { ...rating, source: source.id }
      const existing = merged.get(key)
      if (!existing) merged.set(key, entry)
      else (existing.others ??= []).push(entry)
    }
  }

  const ratings = [...merged.values()].sort(
    (a, b) => a.augmentId - b.augmentId || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.championId - b.championId,
  )
  return {
    schemaVersion: 1,
    patch: snapshot.patch ?? null,
    tiers: TIERS,
    sources: SOURCES.map(({ collect, ...source }) => source),
    ratings,
  }
}

const payload = await build()
// 每条评级占一行：文件小，diff 一眼能看出哪个「海克斯 × 英雄」变了
const { ratings, ...head } = payload
const text =
  JSON.stringify({ ...head, ratings: [] }, null, 2).replace(
    '"ratings": []',
    `"ratings": [\n${ratings.map((rating) => `    ${JSON.stringify(rating)}`).join(',\n')}\n  ]`,
  ) + '\n'
if (process.argv.includes('--check')) {
  const current = await readFile(OUT, 'utf8').catch(() => '')
  if (current.replace(/\r\n/g, '\n') !== text) {
    console.error('❌ data/augment-tiers.json 和流派数据不一致，运行 npm run data:tiers 重新生成')
    process.exit(1)
  }
  console.log(`✅ 海克斯评级库与流派一致: ${payload.ratings.length} 条评级`)
} else {
  await writeFile(OUT, text)
  const augmentsRated = new Set(payload.ratings.map((rating) => rating.augmentId)).size
  const byTier = Object.fromEntries(payload.tiers.map((tier) => [tier, payload.ratings.filter((rating) => rating.tier === tier).length]))
  console.log(`海克斯评级库: ${payload.ratings.length} 条评级，覆盖 ${augmentsRated} 个海克斯`, byTier)
}
