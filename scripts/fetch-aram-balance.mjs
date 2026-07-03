// 抓取「ARAM 平衡数值」（每英雄的 +造成伤害% / -承受伤害% 等）。
// 数据源 = Riot 官方 wiki（wiki.leagueoflegends.com）的 Module:ChampionData/data —— 这是全网
// aramnerfs.com / 各站"版本变动"数字的共同源头，我们直接查到了这个模块本身（MediaWiki API 拿原始
// wikitext，不用猜/不用信任第三方站点的二次整理）。
//
// 结构（Lua table）：
//   ["Aatrox"] = { ["apiname"]="Aatrox", ["stats"]={ ["aram"]={["dmg_dealt"]=1.05, ["dmg_taken"]=1}, ... } }
// apiname 与我们 champions.json 的 alias 字段是同一套命名（如 Kai'Sa -> apiname "Kaisa"，验证过）。
//
// 运行：node scripts/fetch-aram-balance.mjs
// 产出：data/aram-balance.json —— 只含"有平衡修正"的英雄（全 1 倍率的不列出）

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

const API =
  'https://wiki.leagueoflegends.com/en-us/api.php?action=parse&page=Module:ChampionData/data&format=json&prop=wikitext'

/** 数值字段名 → 我们用的字段名 */
const FIELD_MAP = {
  dmg_dealt: 'dmgDealt',
  dmg_taken: 'dmgTaken',
  healing: 'healing',
  shielding: 'shielding',
  tenacity: 'tenacity',
  ability_haste: 'abilityHaste',
  energyregen_mod: 'energyRegenMod',
  total_as: 'totalAs',
}

function parseAramBlock(championChunk) {
  const aramIdx = championChunk.indexOf('["aram"]')
  if (aramIdx < 0) return null
  const braceStart = championChunk.indexOf('{', aramIdx)
  // 找到与之匹配的右括号（简单深度计数，块内容不会再嵌套 {}）
  let depth = 0
  let end = braceStart
  for (; end < championChunk.length; end++) {
    if (championChunk[end] === '{') depth++
    else if (championChunk[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = championChunk.slice(braceStart + 1, end)
  const out = {}
  for (const m of body.matchAll(/\["(\w+)"\]\s*=\s*([\d.]+)/g)) {
    const key = FIELD_MAP[m[1]]
    if (key) out[key] = parseFloat(m[2])
  }
  return Object.keys(out).length ? out : null
}

async function main() {
  console.log('拉取 Module:ChampionData/data（Riot 官方 wiki）…')
  const res = await fetch(API)
  const json = await res.json()
  if (json.error) throw new Error('wiki API 报错: ' + JSON.stringify(json.error))
  const wikitext = json.parse.wikitext['*']

  // 按顶层条目切分：形如 `  ["Aatrox"] = {`（恰好 2 空格缩进）
  const splitRe = /\n {2}\["([^"]+)"\]\s*=\s*\{/g
  const marks = [...wikitext.matchAll(splitRe)]
  console.log(`发现 ${marks.length} 个顶层英雄条目`)

  const champions = JSON.parse(await readFile(join(DATA_DIR, 'champions.json')))
  const byAlias = new Map(champions.map((c) => [c.alias.toLowerCase(), c]))

  const results = []
  const unmatched = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index
    const end = i + 1 < marks.length ? marks[i + 1].index : wikitext.length
    const chunk = wikitext.slice(start, end)

    const apiNameMatch = chunk.match(/\["apiname"\]\s*=\s*"([^"]+)"/)
    const apiname = apiNameMatch ? apiNameMatch[1] : marks[i][1]

    const aram = parseAramBlock(chunk)
    if (!aram) continue // 该英雄本版本 ARAM 无修正

    const champ = byAlias.get(apiname.toLowerCase())
    if (!champ) {
      unmatched.push(apiname)
      continue
    }
    results.push({ id: champ.id, name: champ.name, apiname, ...aram })
  }

  results.sort((a, b) => a.id - b.id)
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, 'aram-balance.json'), JSON.stringify(results, null, 2))

  console.log(`\n✅ 完成：${results.length} 个英雄有 ARAM 平衡修正`)
  if (unmatched.length) {
    console.log(`⚠️ ${unmatched.length} 个 apiname 没在 champions.json 里对上（可能是新英雄/命名差异):`, unmatched.join(', '))
  }
  console.log('\n样例:')
  for (const r of results.slice(0, 5)) console.log(' ', JSON.stringify(r))
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
