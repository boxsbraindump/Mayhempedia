// 抓取 & 归一化 海克斯增强 + 装备 数据 → data/*.json
//   增强源：Community Dragon 斗魂竞技场(Cherry)增强库（大乱斗复用这套）
//   装备源：Community Dragon items.json
// 运行：node scripts/fetch-data.mjs [lang]   (lang 省略默认 zh_cn，写 data/；传 default 写 data/en/)
//
// 产出：data/augments.json、data/items.json（含解析好的图标 URL）
// 图片下载在 scripts/download-icons.mjs（本脚本只存 URL 并抽样验证）

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pinyin } from 'pinyin-pro'

const __dirname = dirname(fileURLToPath(import.meta.url))

const LANG = process.argv[2] || 'zh_cn' // 语言：'default'(英文) | 'zh_cn' | 'ko_kr' ... 图标与语言无关
// ⚠️ zh_cn 是唯一验证过 name/description 字段错位的 locale；default(英文) 是正常顺序(name=真名)。
// 别的 locale 没实测过，先只信这两个已验证的分支。
const DATA_DIR = LANG === 'zh_cn' ? join(__dirname, '..', 'data') : join(__dirname, '..', 'data', 'en')
const GD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'
const CDRAGON_ICON = `${GD}/default` // 装备图标始终在 default 分支（不分语言）
const GAME = 'https://raw.communitydragon.org/latest/game' // 增强图标在这个分支下
// ⚠️ arena(增强)这个端点的英文 locale 代号是 en_us，不是 default——跟 items/champion-summary 那两个
// GD 端点不一致(它们用 default)。实测 default.json 在这个端点上是 404，混用会直接抓取失败。
const AUG_LANG = LANG === 'default' ? 'en_us' : LANG
const AUG_URL = `https://raw.communitydragon.org/latest/cdragon/arena/${AUG_LANG}.json`
const ITEMS_URL = `${GD}/${LANG}/v1/items.json`

// 斗魂竞技场稀有度（4 档待进一步确认，见下方 note）
const RARITY = { 0: '银 Silver', 1: '金 Gold', 2: '棱彩 Prismatic', 4: '特殊 Special?' }

/** 去掉富文本标签 → 纯文本 */
function stripTags(s) {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 用 dataValues 对 @Key@ / @Key*100@ / @Key*N@ 做轻量替换（取第 1 档，近似展示；精确值见 dataValues） */
function substitute(text, dataValues = {}) {
  if (!text) return text
  return text.replace(/@(\w+)(?:\*([\d.]+))?@/g, (m, key, mult) => {
    const arr = dataValues[key]
    if (!arr) return m // 替换不了就保留原占位符
    let v = Array.isArray(arr) ? arr[0] : arr
    if (mult) v *= parseFloat(mult)
    // 收拾浮点误差
    v = Math.round(v * 1000) / 1000
    return String(v)
  })
}

/** 装备 iconPath("/lol-game-data/assets/ASSETS/...") → CDN URL，多候选自动试 */
function itemIconCandidates(iconPath) {
  const p = iconPath.toLowerCase()
  return [
    CDRAGON_ICON + p.replace('/lol-game-data/assets/', '/assets/'),
    CDRAGON_ICON + p.replace('/lol-game-data/assets/assets/', '/assets/'),
    CDRAGON_ICON + p.replace('/lol-game-data/', '/'),
  ]
}

async function firstWorking(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: 'HEAD' })
      if (r.ok) return u
    } catch {}
  }
  return null
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })

  // ---------- 增强 ----------
  console.log('拉取增强…')
  const augRaw = (await (await fetch(AUG_URL)).json()).augments
  const augments = augRaw
    .filter((a) => a.apiName !== 'Augment404' && a.id !== 404) // 开发者占位彩蛋，剔除
    .map((a) => ({
      id: a.id,
      apiName: a.apiName,
      name: a.name,
      rarity: a.rarity,
      rarityLabel: RARITY[a.rarity] ?? String(a.rarity),
      desc: stripTags(substitute(a.desc, a.dataValues)),
      tooltip: stripTags(substitute(a.tooltip, a.dataValues)),
      descRaw: a.desc,
      dataValues: a.dataValues,
      iconLargeUrl: `${GAME}/${a.iconLarge}`,
      iconSmallUrl: `${GAME}/${a.iconSmall}`,
      iconLargeLocal: `icons/augments/${a.apiName}_large.png`,
      iconSmallLocal: `icons/augments/${a.apiName}_small.png`,
    }))
    .sort((x, y) => x.rarity - y.rarity || x.name.localeCompare(y.name))

  // ---------- 装备 ----------
  console.log('拉取装备…')
  const itemsRaw = await (await fetch(ITEMS_URL)).json()
  // 先用第一件带图标的装备，试出正确的 URL 格式
  const sampleItem = itemsRaw.find((i) => i.iconPath)
  const chosen = await firstWorking(itemIconCandidates(sampleItem.iconPath))
  if (!chosen) throw new Error('装备图标 URL 格式没试出来，需手动检查')
  // 记住是哪套 replace 生效了
  const pat = itemIconCandidates(sampleItem.iconPath).indexOf(chosen)
  const toIconUrl = (iconPath) => itemIconCandidates(iconPath)[pat]

  const items = itemsRaw
    .filter((i) => i.iconPath)
    .map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      priceTotal: i.priceTotal,
      categories: i.categories,
      from: i.from,
      to: i.to,
      inStore: i.inStore,
      isEnchantment: i.isEnchantment,
      requiredChampion: i.requiredChampion || undefined,
      desc: stripTags(i.description),
      descRaw: i.description,
      iconUrl: toIconUrl(i.iconPath),
      iconLocal: `icons/items/${i.id}.png`,
    }))
    .sort((x, y) => x.id - y.id)

  // ---------- 英雄 ----------
  console.log('拉取英雄…')
  const champRaw = await (await fetch(`${GD}/${LANG}/v1/champion-summary.json`)).json()
  const py = (name, first) =>
    pinyin(name, { pattern: first ? 'first' : undefined, toneType: 'none', type: 'array', nonZh: 'consecutive' })
      .join('')
      .toLowerCase()
  // ⚠️ 只有 zh_cn 字段错位：name=称号(虚空之女)、description=真名(卡莎)。
  // 实测过 default(英文)是正常顺序：name=真名(Kai'Sa)、description=称号(Daughter of the Void)，
  // 不能对 default 用同一套 swap，会把称号当真名，两个字段整个错位。
  const champions = champRaw
    .filter((c) => c.id > 0) // id=-1 是 None 占位
    .map((c) => {
      const name = LANG === 'zh_cn' ? c.description || c.name : c.name
      const title = LANG === 'zh_cn' ? c.name : c.description || c.name
      return {
        id: c.id,
        name, // 卡莎 / Kai'Sa
        title, // 虚空之女 / Daughter of the Void
        alias: c.alias, // Kaisa
        pinyin: py(name, false), // 卡莎 → kasha
        initials: py(name, true), // 卡莎 → ks
        roles: c.roles ?? [], // ["marksman","mage"]，用于角色筛选
        iconUrl: `${GD}/default/v1/champion-icons/${c.id}.png`, // 头像与语言无关
        iconLocal: `icons/champions/${c.id}.png`,
      }
    })
    .sort((a, b) => a.pinyin.localeCompare(b.pinyin))

  await writeFile(join(DATA_DIR, 'augments.json'), JSON.stringify(augments, null, 2))
  await writeFile(join(DATA_DIR, 'items.json'), JSON.stringify(items, null, 2))
  await writeFile(join(DATA_DIR, 'champions.json'), JSON.stringify(champions, null, 2))

  // ---------- 汇报 + 抽样验证 ----------
  const rar = {}
  for (const a of augments) rar[a.rarityLabel] = (rar[a.rarityLabel] || 0) + 1
  console.log('\n✅ 完成')
  console.log(`增强: ${augments.length} 个`, rar)
  console.log(`装备: ${items.length} 件（图标 URL 格式候选#${pat} 生效）`)
  const kaisa = champions.find((c) => c.id === 145)
  console.log(`英雄: ${champions.length} 个（样例 卡莎: pinyin=${kaisa?.pinyin} initials=${kaisa?.initials}）`)

  const sampleAug = augments.find((a) => a.name === 'Goliath') ?? augments[0]
  const augIcon = await fetch(sampleAug.iconLargeUrl, { method: 'HEAD' })
  const itemIcon = await fetch(items[0].iconUrl, { method: 'HEAD' })
  console.log(`\n抽样图标可达性:`)
  console.log(`  增强 ${sampleAug.name}: HTTP ${augIcon.status}  ${sampleAug.iconLargeUrl}`)
  console.log(`  装备 ${items[0].name}: HTTP ${itemIcon.status}  ${items[0].iconUrl}`)

  console.log(`\n增强样例:`)
  console.log(`  [${sampleAug.rarityLabel}] ${sampleAug.name} — ${sampleAug.desc.replace(/\n/g, ' ')}`)
  console.log(`\nnote: rarity=4（${rar['特殊 Special?'] || 0} 个）稀有度含义待确认；大乱斗实际启用的增强池可能是这 226 的子集，后续 curate 时再过滤。`)
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
