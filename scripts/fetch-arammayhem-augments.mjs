// 抓取海克斯大乱斗当前版本的海克斯池 → data/augments.json（中文）+ data/en/augments.json（英文）
//   海克斯池：arammayhem.com/augments/ 的「当前版本目录」(data-current-augment-directory)
//   名字/稀有度/描述/图标：arammayhem.com 每个海克斯的英文详情页 + /zh-cn/ 中文详情页
//   上线版本/选取率：arammayhem.com 开放数据 data/v1/latest/augments.json（CC BY 4.0，署名 "Data: arammayhem.com"）
//   新海克斯的 id：优先沿用本地旧 id，其次用 CommunityDragon 的 Riot 运行时 id（对局记录里就是这个 id）
// 运行：node scripts/fetch-arammayhem-augments.mjs
//
// 不在当前池里的旧海克斯保留为 availability: "legacy"，只用于解析旧路线/旧对局里引用的 id，不展示给玩家选择。

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const ICON_DIR = join(DATA_DIR, 'icons', 'augments')
const ROOT = 'https://arammayhem.com'
const CATALOG_URL = `${ROOT}/augments/`
const OPEN_DATA_URL = `${ROOT}/data/v1/latest/augments.json`
const CDRAGON_AUGMENTS_URL = (locale) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/${locale}/v1/cherry-augments.json`
const CONCURRENCY = 4
const GENERATED_ID_BASE = 910000

// arammayhem.com 的 26.21 目录把这几个标成了 retired，但 hexdata.com.cn 的 26.21 对局样本里仍然有它们
// （运行时 id 1310 / 2116 / 2137），说明游戏里还能选到。详情页仍在 arammayhem.com 上，照常抓取。
const EXTRA_LIVE_SLUGS = ['clown-college', 'pursuit-of-power', 'pat-on-the-back']

// arammayhem.com 完全没有收录（详情页 404）、但 26.21 对局里确实出现的海克斯：hexdata.com.cn 16.21 样本
// 13.9 万～546 万场（2026-10-26 查）。key 是 Riot 运行时 id；名字/稀有度/图标取 CommunityDragon 客户端数据，
// 描述是 hexdata 英文页上的游戏原文 + 对应中文翻译；查不到原文的留空，不编。
const CDRAGON_ONLY_LIVE = {
  1034: {
    en: 'Gain a Spell Shield every 30 seconds that blocks the next enemy Ability.',
    zh: '每30秒获得一层法术护盾，抵挡下一个敌方技能。',
  },
  1116: { en: 'Your Flash has 3 charges. After 120 seconds, regain all charges.', zh: '你的闪现拥有3层充能。120秒后恢复全部充能。' },
  1237: { en: 'Gain a random Gold Augment.', zh: '获得一个随机黄金阶强化符文。' },
  1027: {
    en: 'Your dash, blink, or teleport Abilities leave behind a trail that detonates after 0.75 second.',
    zh: '你的冲刺、闪烁或传送类技能会留下一条在0.75秒后爆炸的轨迹。',
  },
  1379: {
    en: "Gain 100% Attack Speed. Increase Sword of Blossoming Dawn's healing to 250% when you attack enemy champions.",
    zh: '获得100%攻击速度。攻击敌方英雄时，花晓之剑的治疗效果提升至250%。',
  },
  2140: { en: '', zh: '' }, // Upgrade Ravenous Hydra
  2143: { en: '', zh: '' }, // Upgrade Sundered Sky
  2144: { en: '', zh: '' }, // Bolstered
}
const CDRAGON_ICON_ROOT = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default'
const RARITY_BY_CDRAGON = { kSilver: 0, kGold: 1, kPrismatic: 2 }

const RARITY_BY_BADGE = { silver: 0, gold: 1, prismatic: 2 }
const RARITY_LABEL_ZH = { 0: '银 Silver', 1: '金 Gold', 2: '棱彩 Prismatic' }
const RARITY_LABEL_EN = { 0: 'Silver', 1: 'Gold', 2: 'Prismatic' }

function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 富文本 → 纯文本，保留 <br> 换行 */
function htmlToText(value = '') {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/%i:[A-Za-z0-9_]+%/g, ''),
  )
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 只留字母数字比较：MountainSoul / Mountain Soul、PandorasBox / Pandora's Box 视为同名 */
function normalizeName(value) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function apiNameFromSlug(slug) {
  return (
    'ARAMMayhem' +
    slug
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join('')
      .replace(/[^A-Za-z0-9]/g, '')
  )
}

function hasUnresolvedValue(value) {
  return /@[^@\s]+@|\{\{[^}]*\}\}/.test(value)
}

function hasReadableLatin(value) {
  return /[A-Za-z]{3,}/.test(String(value).replace(/\b(?:AD|AP|MR|HP|MS|AS|CC|Q|W|E|R)\b/g, ''))
}

async function fetchText(url, attempt = 1) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' })
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    return await response.text()
  } catch (error) {
    if (attempt >= 3) throw error
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    return fetchText(url, attempt + 1)
  }
}

async function download(url, file) {
  if (existsSync(file) && (await stat(file)).size > 0) return
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  await writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function pool(items, worker) {
  const results = []
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run))
  return results
}

async function loadJson(file) {
  return JSON.parse(await readFile(join(DATA_DIR, file), 'utf8'))
}

/** 当前版本目录：<section data-current-augment-directory="26.21"> 里的 <summary>223 Augments</summary> + 链接列表 */
function parseCatalog(html) {
  const section = html.match(/<section[^>]*data-current-augment-directory="([^"]+)"[^>]*>([\s\S]*?)<\/section>/)
  if (!section) throw new Error('arammayhem.com 页面里找不到当前版本目录 (data-current-augment-directory)')
  const [, patch, body] = section
  const expected = Number(body.match(/<summary[^>]*>\s*(\d+)/)?.[1])
  const rows = []
  for (const [, attrs, label] of body.matchAll(/<a\b([^>]*)>([^<]+)<\/a>/g)) {
    if (!attrs.includes('data-current-augment=')) continue
    const slug = attrs.match(/href="\/augments\/([^"/]+)\/?"/)?.[1]
    if (slug) rows.push({ slug, name: decodeHtml(label).trim() })
  }
  if (!expected || rows.length !== expected) {
    throw new Error(`当前版本目录条数对不上：summary 写 ${expected}，解析到 ${rows.length}`)
  }
  return { patch, rows }
}

/** 详情页头部：图标 + <h1>名字</h1> + 稀有度徽章 + 描述；可选的「上线版本」提示和「实战指南」 */
function parseDetail(html, url) {
  const header = html.match(
    /<!-- Augment Header[\s\S]*?<img src="([^"]+)"[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>\s*<span data-slot="badge"[^>]*>([\s\S]*?)<\/span>\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/,
  )
  if (!header) throw new Error(`详情页结构变了，解析不到头部: ${url}`)
  const [, imagePath, rawName, rawBadge, rawDesc] = header
  const tip = htmlToText(html.match(/<div data-augment-mechanic-tip[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '')
  const guidanceBody = html.match(/<section data-launch-guidance="[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? ''
  const guidance = [...guidanceBody.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(
    ([, term, text]) => ({ term: htmlToText(term), text: htmlToText(text) }),
  )
  return {
    imagePath,
    name: htmlToText(rawName),
    badge: htmlToText(rawBadge),
    desc: htmlToText(rawDesc),
    releasedPatch: tip.match(/(\d+\.\d+)/)?.[1] ?? null,
    guidance,
  }
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true })

  const [previousZh, previousEn, previousSnapshot] = await Promise.all([
    loadJson('augments.json'),
    loadJson(join('en', 'augments.json')),
    loadJson('arammayhem-augments.snapshot.json').catch(() => ({ augments: [] })),
  ])
  const previousZhById = new Map(previousZh.map((augment) => [augment.id, augment]))
  const previousEnById = new Map(previousEn.map((augment) => [augment.id, augment]))
  const previousIdBySlug = new Map(previousSnapshot.augments.map((augment) => [augment.slug, augment.id]))
  // 同名时优先沿用 live 记录的 id
  const previousEnByName = new Map()
  for (const augment of [...previousEn].sort((a, b) => (a.availability === 'legacy') - (b.availability === 'legacy'))) {
    const key = normalizeName(augment.name)
    if (!previousEnByName.has(key)) previousEnByName.set(key, augment)
  }

  const catalog = parseCatalog(await fetchText(CATALOG_URL))
  const openData = JSON.parse(await fetchText(OPEN_DATA_URL))
  const openDataBySlug = new Map(openData.rows.map((row) => [row.slug, row]))
  const [cdragonEn, cdragonZh] = await Promise.all([
    fetchText(CDRAGON_AUGMENTS_URL('default')).then(JSON.parse),
    fetchText(CDRAGON_AUGMENTS_URL('zh_cn')).then(JSON.parse),
  ])
  const cdragonZhById = new Map(cdragonZh.map((augment) => [augment.id, augment.nameTRA]))
  // 英文名 → Riot 运行时 id（新海克斯的 id 来源）+ 客户端官方中文名（arammayhem 中文名的校对基准）
  const runtimeIdsByName = new Map()
  for (const augment of [...cdragonEn].sort((a, b) => b.id - a.id)) {
    const key = normalizeName(augment.nameTRA)
    if (!runtimeIdsByName.has(key)) runtimeIdsByName.set(key, [])
    runtimeIdsByName.get(key).push(augment.id)
  }
  const officialZhNames = (enName) =>
    (runtimeIdsByName.get(normalizeName(enName)) ?? []).map((id) => cdragonZhById.get(id)).filter(Boolean)
  const sameZhName = (a, b) => a.replace(/[\s：:！!]/g, '') === b.replace(/[\s：:！!]/g, '')

  const catalogSlugs = new Set(catalog.rows.map((row) => row.slug))
  const slugs = [...catalog.rows.map((row) => row.slug), ...EXTRA_LIVE_SLUGS.filter((slug) => !catalogSlugs.has(slug))]
  console.log(`arammayhem.com ${catalog.patch} 目录 ${catalog.rows.length} 个 + 额外保留 ${slugs.length - catalog.rows.length} 个，抓取详情页…`)

  const details = await pool(slugs, async (slug) => {
    const enUrl = `${ROOT}/augments/${slug}/`
    const zhUrl = `${ROOT}/zh-cn/augments/${slug}/`
    const [enHtml, zhHtml] = await Promise.all([fetchText(enUrl), fetchText(zhUrl)])
    return { slug, enUrl, en: parseDetail(enHtml, enUrl), zh: parseDetail(zhHtml, zhUrl) }
  })

  const usedIds = new Set()
  let nextGeneratedId = Math.max(GENERATED_ID_BASE - 1, ...previousEn.map((augment) => augment.id).filter((id) => id >= GENERATED_ID_BASE)) + 1
  const report = {
    added: [],
    rarityChanged: [],
    zhRenamed: [],
    zhOfficial: [],
    legacyZhOfficial: [],
    zhFallback: [],
    descFallback: [],
    unresolved: [],
  }
  const zh = []
  const en = []
  const snapshot = []

  for (const { slug, enUrl, en: enPage, zh: zhPage } of details) {
    const rarity = RARITY_BY_BADGE[enPage.badge.toLowerCase()]
    if (rarity === undefined) throw new Error(`${slug}: 认不出稀有度徽章 "${enPage.badge}"`)

    let idSource = 'snapshot'
    let previous = previousEnById.get(previousIdBySlug.get(slug))
    if (!previous) {
      idSource = 'local-name'
      previous = previousEnByName.get(normalizeName(enPage.name))
    }
    let id = previous?.id
    if (id === undefined) {
      idSource = 'riot-runtime'
      id = (runtimeIdsByName.get(normalizeName(enPage.name)) ?? [])
        .filter((runtimeId) => !usedIds.has(runtimeId) && !previousEnById.has(runtimeId))
        .sort((a, b) => b - a)[0]
    }
    if (id === undefined) {
      idSource = 'generated'
      id = nextGeneratedId++
    }
    if (usedIds.has(id)) throw new Error(`${slug}: id ${id} 重复`)
    usedIds.add(id)

    const previousZhRecord = previous ? previousZhById.get(previous.id) : undefined
    const wasLive = previous?.availability === 'live'
    const apiName = previous?.apiName ?? apiNameFromSlug(slug)
    const iconUrl = `${ROOT}${enPage.imagePath}`

    // 旧的 live 记录且稀有度没变 → 沿用原图标（含 data/assets/ 里手工校对过的稀有度专用图标）；否则用 arammayhem 的图
    let iconLargeLocal = previous?.iconLargeLocal
    let iconSmallLocal = previous?.iconSmallLocal
    if (!wasLive || previous.rarity !== rarity) {
      const ext = enPage.imagePath.match(/\.(\w+)$/)?.[1] ?? 'webp'
      iconLargeLocal = iconSmallLocal = `icons/augments/${apiName}_arammayhem.${ext}`
    }
    if (iconLargeLocal.startsWith('icons/augments/') && iconLargeLocal.includes('_arammayhem.')) {
      await download(iconUrl, join(DATA_DIR, iconLargeLocal))
    }

    if (!wasLive) report.added.push(`${enPage.name} (${id}, ${idSource})`)
    if (wasLive && previous.rarity !== rarity) report.rarityChanged.push(`${enPage.name}: ${previous.rarity} → ${rarity}`)

    let zhName = zhPage.name
    let zhDesc = zhPage.desc
    const official = officialZhNames(enPage.name)
    if (official.length && !official.some((name) => sameZhName(name, zhName))) {
      report.zhOfficial.push(`${zhName} → ${official[0]}`)
      zhName = official[0]
    }
    if (hasReadableLatin(zhName) && previousZhRecord && !hasReadableLatin(previousZhRecord.name)) {
      report.zhFallback.push(`${slug} name "${zhName}" → 沿用 "${previousZhRecord.name}"`)
      zhName = previousZhRecord.name
    }
    // 详情页偶尔带没替换的数值占位符（@ADAmp*100@ / {{SpellName}}）：旧描述是完整文本时沿用旧描述
    const zhUnusable = (text) => hasUnresolvedValue(text) || hasReadableLatin(text)
    const previousZhDesc = previousZhRecord ? htmlToText(previousZhRecord.desc) : ''
    if (zhUnusable(zhDesc) && previousZhDesc && !zhUnusable(previousZhDesc)) {
      report.descFallback.push(`zh:${slug}`)
      zhDesc = previousZhDesc
    }
    let enDesc = enPage.desc
    const previousEnDesc = previous ? htmlToText(previous.desc) : ''
    if (hasUnresolvedValue(enDesc) && previousEnDesc && !hasUnresolvedValue(previousEnDesc)) {
      report.descFallback.push(`en:${slug}`)
      enDesc = previousEnDesc
    }
    if (hasUnresolvedValue(zhDesc) || hasUnresolvedValue(enDesc)) report.unresolved.push(slug)
    if (wasLive && previousZhRecord && previousZhRecord.name !== zhName) {
      report.zhRenamed.push(`${previousZhRecord.name} → ${zhName}`)
    }

    const open = openDataBySlug.get(slug)
    const introducedPatch = open?.introducedPatch ?? enPage.releasedPatch ?? null
    const record = (name, desc, rarityLabel) => ({
      id,
      apiName,
      name,
      rarity,
      desc,
      tooltip: desc,
      descRaw: desc,
      availability: 'live',
      introducedPatch,
      source: 'arammayhem.com',
      sourceUrl: enUrl,
      iconLargeUrl: iconUrl,
      iconSmallUrl: iconUrl,
      iconLargeLocal,
      iconSmallLocal,
      rarityLabel,
    })
    en.push(record(enPage.name, enDesc, RARITY_LABEL_EN[rarity]))
    zh.push(record(zhName, zhDesc, RARITY_LABEL_ZH[rarity]))
    snapshot.push({
      id,
      apiName,
      slug,
      name: enPage.name,
      nameZh: zhName,
      rarity: enPage.badge.toLowerCase(),
      introducedPatch,
      pickRate: open?.pickRate ?? null,
      pickRateRank: open?.pickRateRank ?? null,
      inCatalog: catalogSlugs.has(slug),
      idSource,
      guidance: enPage.guidance.length ? { en: enPage.guidance, zh: zhPage.guidance } : undefined,
    })
  }

  const cdragonEnById = new Map(cdragonEn.map((augment) => [augment.id, augment]))
  for (const [runtimeIdKey, text] of Object.entries(CDRAGON_ONLY_LIVE)) {
    const runtime = cdragonEnById.get(Number(runtimeIdKey))
    if (!runtime) throw new Error(`CommunityDragon 里找不到运行时 id ${runtimeIdKey}`)
    if (en.some((augment) => normalizeName(augment.name) === normalizeName(runtime.nameTRA))) {
      console.log(`提示: ${runtime.nameTRA} 已经出现在 arammayhem.com，可以从 CDRAGON_ONLY_LIVE 删掉`)
      continue
    }
    const rarity = RARITY_BY_CDRAGON[runtime.rarity]
    if (rarity === undefined) throw new Error(`${runtime.nameTRA}: 认不出稀有度 ${runtime.rarity}`)
    const previous = previousEnByName.get(normalizeName(runtime.nameTRA))
    const id = previous?.id ?? runtime.id
    if (usedIds.has(id)) throw new Error(`${runtime.nameTRA}: id ${id} 重复`)
    usedIds.add(id)
    const slug = runtime.nameTRA.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const apiName = previous?.apiName ?? apiNameFromSlug(slug)
    const iconUrl = `${CDRAGON_ICON_ROOT}${runtime.augmentSmallIconPath.toLowerCase().replace('/lol-game-data/assets/assets/', '/assets/')}`
    const iconLocal = previous?.iconLargeLocal ?? `icons/augments/${apiName}_cdragon.png`
    if (!previous) await download(iconUrl, join(DATA_DIR, iconLocal))
    const zhName = cdragonZhById.get(runtime.id) ?? runtime.nameTRA
    const record = (name, desc, rarityLabel) => ({
      id,
      apiName,
      name,
      rarity,
      desc,
      tooltip: desc,
      descRaw: desc,
      availability: 'live',
      introducedPatch: null,
      source: 'communitydragon',
      iconLargeUrl: iconUrl,
      iconSmallUrl: iconUrl,
      iconLargeLocal: iconLocal,
      iconSmallLocal: previous?.iconSmallLocal ?? iconLocal,
      rarityLabel,
    })
    en.push(record(runtime.nameTRA, text.en, RARITY_LABEL_EN[rarity]))
    zh.push(record(zhName, text.zh, RARITY_LABEL_ZH[rarity]))
    report.added.push(`${runtime.nameTRA} (${id}, communitydragon)`)
    snapshot.push({
      id,
      apiName,
      slug,
      name: runtime.nameTRA,
      nameZh: zhName,
      rarity: ['silver', 'gold', 'prismatic'][rarity],
      introducedPatch: null,
      pickRate: null,
      pickRateRank: null,
      inCatalog: false,
      idSource: previous ? 'local-name' : 'riot-runtime',
      source: 'communitydragon',
    })
  }

  const liveIds = new Set(en.map((augment) => augment.id))
  const toLegacy = (augment) => ({ ...augment, availability: 'legacy', source: augment.source ?? 'legacy-cdragon' })
  // 隐藏的旧条目也换成客户端官方中文名（旧路线、旧对局里显示的名字要和游戏里一致）
  const legacyZh = previousZh
    .filter((augment) => augment.rarity !== 4 && !liveIds.has(augment.id))
    .map((augment) => {
      const official = officialZhNames(previousEnById.get(augment.id)?.name ?? '')
      if (!official.length || official.some((name) => sameZhName(name, augment.name))) return toLegacy(augment)
      report.legacyZhOfficial.push(`${augment.name} → ${official[0]}`)
      return toLegacy({ ...augment, name: official[0] })
    })
  const legacyEn = previousEn.filter((augment) => augment.rarity !== 4 && !liveIds.has(augment.id)).map(toLegacy)
  const removed = previousEn.filter((augment) => augment.availability === 'live' && !liveIds.has(augment.id))

  // 所有流派引用的海克斯 id 都必须还能解析（live 或 legacy）
  const allIds = new Set([...liveIds, ...legacyEn.map((augment) => augment.id)])
  const buildIndex = await loadJson(join('builds', 'index.json'))
  for (const file of new Set(Object.values(buildIndex))) {
    const build = await loadJson(join('builds', file))
    for (const route of build.archetypes ?? []) {
      for (const ref of [...(route.augments?.core ?? []), ...(route.augments?.good ?? []), ...(route.augments?.trap ?? [])]) {
        if (!allIds.has(ref.id)) throw new Error(`${file} / ${route.key} 引用的海克斯 ${ref.id} ${ref.name} 丢失`)
      }
    }
  }

  const order = (a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name)
  await writeFile(join(DATA_DIR, 'augments.json'), JSON.stringify([...zh.sort(order), ...legacyZh], null, 2) + '\n')
  await writeFile(join(DATA_DIR, 'en', 'augments.json'), JSON.stringify([...en.sort(order), ...legacyEn], null, 2) + '\n')
  await writeFile(
    join(DATA_DIR, 'arammayhem-augments.snapshot.json'),
    JSON.stringify(
      {
        source: CATALOG_URL,
        openData: OPEN_DATA_URL,
        attribution: 'Data: arammayhem.com (CC BY 4.0)',
        patch: catalog.patch,
        fetchedAt: new Date().toISOString(),
        openDataReleaseId: openData.meta?.releaseId ?? null,
        total: snapshot.length,
        catalogTotal: catalog.rows.length,
        extraLiveSlugs: EXTRA_LIVE_SLUGS,
        augments: snapshot.sort((a, b) => a.slug.localeCompare(b.slug)),
      },
      null,
      2,
    ) + '\n',
  )

  console.log(`\n${catalog.patch}: ${snapshot.length} 个现役海克斯，${legacyEn.length} 个隐藏 legacy`)
  console.log(`新增 ${report.added.length}: ${report.added.join(' | ')}`)
  console.log(`移出现役 ${removed.length}: ${removed.map((augment) => `${augment.name} (${augment.id})`).join(' | ')}`)
  if (report.rarityChanged.length) console.log(`稀有度变化: ${report.rarityChanged.join(' | ')}`)
  if (report.zhRenamed.length) console.log(`中文名变化 ${report.zhRenamed.length}: ${report.zhRenamed.join(' | ')}`)
  if (report.zhOfficial.length) console.log(`改用客户端官方中文名: ${report.zhOfficial.join(' | ')}`)
  if (report.legacyZhOfficial.length) {
    console.log(`legacy 改用官方中文名 ${report.legacyZhOfficial.length}: ${report.legacyZhOfficial.join(' | ')}`)
  }
  if (report.zhFallback.length) console.log(`中文名回退 ${report.zhFallback.length}: ${report.zhFallback.join(' | ')}`)
  if (report.descFallback.length) console.log(`描述沿用旧文本 ${report.descFallback.length}: ${report.descFallback.join(' | ')}`)
  if (report.unresolved.length) console.log(`仍带数值占位符 ${report.unresolved.length}: ${report.unresolved.join(' | ')}`)
}

main().catch((error) => {
  console.error('failed:', error)
  process.exit(1)
})
