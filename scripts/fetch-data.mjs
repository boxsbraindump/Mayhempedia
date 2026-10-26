// 抓取 & 归一化 装备 + 英雄 数据 → data/*.json
//   装备源：Community Dragon items.json
//   海克斯不在这里抓：海克斯大乱斗的海克斯池由 scripts/fetch-arammayhem-augments.mjs 负责（npm run data:augments）
// 运行：node scripts/fetch-data.mjs [lang]   (lang 省略默认 zh_cn，写 data/；传 default 写 data/en/)
//
// 产出：data/items.json、data/champions.json（含解析好的图标 URL）
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
const ITEMS_URL = `${GD}/${LANG}/v1/items.json`

/** 去掉富文本标签 → 纯文本 */
function stripTags(s) {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

  await writeFile(join(DATA_DIR, 'items.json'), JSON.stringify(items, null, 2))
  await writeFile(join(DATA_DIR, 'champions.json'), JSON.stringify(champions, null, 2))

  // ---------- 汇报 + 抽样验证 ----------
  console.log('\n✅ 完成')
  console.log(`装备: ${items.length} 件（图标 URL 格式候选#${pat} 生效）`)
  const kaisa = champions.find((c) => c.id === 145)
  console.log(`英雄: ${champions.length} 个（样例 卡莎: pinyin=${kaisa?.pinyin} initials=${kaisa?.initials}）`)

  const itemIcon = await fetch(items[0].iconUrl, { method: 'HEAD' })
  console.log(`\n抽样图标可达性:`)
  console.log(`  装备 ${items[0].name}: HTTP ${itemIcon.status}  ${items[0].iconUrl}`)
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
