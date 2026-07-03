// 英雄 Tier —— 2026-07-01 重做：不再是纯拍脑袋，而是从两个独立的 Mayhem 专门站点
// 各查一次"当前 tier list 总览"（只看一次宏观页面，不是逐英雄爬详情页——性质跟批量
// 爬取详情数据库不同），把两份原始信号硬编码在这里、做加权评分，透明可复现。
//
// ⚠️ 教训记牢：第一版(2026-06-30)是纯靠训练知识+一次模糊WebSearch摘要拼的，结果跟这次
// 查到的真实数据源（aramgg.com号称3080万场样本、arammayhem.com）**差异巨大**——
// 好几个原来评S的（泽拉斯/阿狸/时光/大嘴/莫甘娜/德莱文/内瑟斯/费德提克）在真实数据里只是
// 中等。常规ARAM强度和Mayhem强度不是一回事，海克斯系统会重新洗牌格局。别再凭印象评级。
//
// 方法：
//   1. aramgg.com 的 T1-T5（更均匀的五档，30.8M样本，权重更高=0.6）
//   2. arammayhem.com 的 S+/S/A/B/C（二极化，C桶塞了103/172个英雄区分度差，权重较低=0.4）
//   3. 两份都转成 0-4 分制加权平均，只在一份源里出现的按该份打 8 折(降置信度)
//   4. 最终分数映射回我们的 S/A/B/C/D
//
// 运行：node scripts/build-hero-tier.mjs

import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// ---------- 源 1: aramgg.com（2026-07-01 查，patch 26.13，T1最强~T5最弱）----------
const ARAMGG = {
  T1: [
    'Sion', 'Sett', 'Jinx', 'Kayle', 'Lillia', 'Vayne', 'Rell', 'Graves', 'DrMundo',
    'Akshan', 'Seraphine', 'Shen', 'Gwen',
  ],
  T2: [
    'Yunara', 'Brand', 'Caitlyn', 'Leona', 'Aurora', 'Sona', 'Viktor', 'Malzahar', 'Kassadin',
    'Ryze', 'Jax', 'Zaahen', 'Hwei', 'AurelionSol', 'Zyra', 'Illaoi', 'Ornn', 'MasterYi', 'Milio',
    'Galio', 'Xayah', 'Fiora', 'Samira', 'Ekko', 'TwistedFate', 'TahmKench', 'Maokai',
    'Heimerdinger', 'Syndra', 'Janna', 'Yasuo',
  ],
  T3: [
    'Yuumi', 'Soraka', 'Shyvana', 'Ahri', 'Sejuani', 'KogMaw', 'Zilean', 'Renata', 'Nautilus',
    'Sivir', 'Ashe', 'Nasus', 'Karthus', 'Taric', 'XinZhao', 'Rumble', 'Tristana', 'Poppy',
    'Velkoz', 'Kindred', 'Yone', 'Vladimir', 'Morgana', 'Amumu', 'Alistar', 'Trundle', 'Rammus',
    'Veigar', 'Briar', 'Vex', 'Singed', 'Lucian', 'Kayn', 'Skarner', 'Fizz', 'Kalista',
    'Nami', 'Lux', 'Fiddlesticks', 'Azir', 'Volibear', 'MonkeyKing', 'Annie', 'Teemo', 'Ivern',
    'MissFortune', 'Orianna', 'Draven', 'Xerath', 'Corki', 'Gangplank', 'Kled', 'Senna',
    'Twitch', 'Ziggs', 'Varus', 'Jhin', 'Olaf', 'Hecarim', 'Nilah', 'Gnar', 'Sylas', 'Ambessa',
    'Smolder', 'Kaisa', 'Lulu', 'Mordekaiser', 'Tryndamere', 'Malphite', 'Mel', 'Vi', 'Swain',
    'Riven', 'Zeri', 'Warwick', 'RekSai', 'Karma', 'Chogath',
  ],
  T4: [
    'Cassiopeia', 'Viego', 'Taliyah', 'Quinn', 'Rakan', 'Diana', 'Ezreal', 'Rengar', 'Braum',
    'Elise', 'JarvanIV', 'Zac', 'Nocturne', 'Gragas', 'Talon', 'Urgot', 'Zed', 'Lissandra',
    'Udyr', 'Evelynn', 'Katarina', 'Anivia', 'Renekton', 'Garen', 'Neeko', 'Pantheon', 'Zoe',
    'Belveth', 'Yorick', 'Darius', 'Pyke', 'Nunu', 'Shaco', 'Blitzcrank', 'Nidalee',
  ],
  T5: [
    'Jayce', 'Kennen', 'Irelia', 'Camille', 'Aatrox', 'Naafiri', 'Qiyana', 'Khazix', 'Thresh',
    'Akali', 'Leblanc', 'KSante', 'Bard', 'LeeSin', 'Locke',
  ],
}

// ---------- 源 2: arammayhem.com（2026-07-01 查，patch 26.13，二极化五档）----------
const ARAMMAYHEM = {
  Splus: ['Brand', 'Vayne', 'Sett', 'Graves', 'Sion', 'Lucian', 'DrMundo'],
  S: [
    'Caitlyn', 'Yasuo', 'Jinx', 'Lillia', 'Ryze', 'TahmKench', 'AurelionSol', 'Morgana',
    'MissFortune', 'Rell', 'Teemo', 'Kayn', 'Trundle', 'TwistedFate', 'Seraphine', 'Kaisa',
    'Smolder', 'Kayle', 'Malzahar',
  ],
  A: [
    'Shen', 'Galio', 'Ashe', 'Yone', 'Yunara', 'MasterYi', 'Maokai', 'Tristana', 'Aurora',
    'Ornn', 'Illaoi', 'Karthus', 'Nautilus', 'Leona', 'Hwei', 'Sejuani', 'Jhin', 'Veigar',
    'Zilean', 'Alistar', 'Corki', 'Varus', 'Zyra', 'Ekko', 'Velkoz', 'Syndra',
  ],
  B: [
    'Senna', 'Xayah', 'Hecarim', 'XinZhao', 'Malphite', 'Lux', 'Aphelios', 'Ezreal', 'Viktor',
    'Ahri', 'JarvanIV', 'Nasus', 'Soraka', 'Fizz', 'Amumu', 'Chogath', 'Sivir',
  ],
  // C 桶塞了103/172个英雄，区分度太差——不逐个抄录，交给"两份都没在前四档出现"的默认逻辑处理。
}

const SCORE = { T1: 4, T2: 3, T3: 2, T4: 1, T5: 0, Splus: 4, S: 3.2, A: 2.4, B: 1.4 }
const AGG_WEIGHT = 0.6 // aramgg.com：更均匀的五档 + 更大样本量，权重更高
const MAYHEM_WEIGHT = 0.4 // arammayhem.com：C桶粗糙，权重较低

function buildScoreMap(source, weight) {
  const map = new Map()
  for (const [tier, aliases] of Object.entries(source)) {
    for (const alias of aliases) map.set(alias.toLowerCase(), SCORE[tier] * weight)
  }
  return map
}

async function main() {
  const champions = JSON.parse(await readFile(join(DATA_DIR, 'champions.json')))
  const byAlias = new Map(champions.map((c) => [c.alias.toLowerCase(), c]))

  const aggScores = buildScoreMap(ARAMGG, AGG_WEIGHT)
  const mayhemScores = buildScoreMap(ARAMMAYHEM, MAYHEM_WEIGHT)

  // 出现在任一来源里的英雄全集
  const allAliases = new Set([...aggScores.keys(), ...mayhemScores.keys()])

  const results = []
  const unmatched = []
  const conflicts = [] // 两源打分差距大的，记下来供人工复核

  for (const alias of allAliases) {
    const champ = byAlias.get(alias)
    if (!champ) {
      unmatched.push(alias)
      continue
    }
    const a = aggScores.get(alias)
    const m = mayhemScores.get(alias)

    let finalScore
    if (a != null && m != null) {
      finalScore = a + m // 两个权重已经分别是0.6/0.4，直接相加=加权平均
      // 换算成 0-4 尺度比较原始档位差距（未加权），差距过大时记录冲突供参考
      const rawDiff = Math.abs(a / AGG_WEIGHT - m / MAYHEM_WEIGHT)
      if (rawDiff >= 2.5) conflicts.push(`${champ.name}(${alias}): aramgg=${(a / AGG_WEIGHT).toFixed(1)} vs arammayhem=${(m / MAYHEM_WEIGHT).toFixed(1)}`)
    } else if (a != null) {
      finalScore = a // 只有一份来源，不额外补偿权重，天然降低置信度
    } else {
      finalScore = m
    }

    // 未在任何"前四档"出现，说明落在 arammayhem 的巨型 C 桶或更低——按 D 处理，
    // 除非 aramgg 明确给了 T3/T4（那样不算最弱，用 aramgg 的分数）
    let tier
    if (finalScore >= 3.0) tier = 'S'
    else if (finalScore >= 2.2) tier = 'A'
    else if (finalScore >= 1.4) tier = 'B'
    else if (finalScore >= 0.6) tier = 'C'
    else tier = 'D'

    results.push({ id: champ.id, name: champ.name, alias: champ.alias, tier, score: Math.round(finalScore * 100) / 100 })
  }

  results.sort((a, b) => a.id - b.id)
  await writeFile(
    join(DATA_DIR, 'hero-tier.json'),
    JSON.stringify(
      results.map(({ id, name, alias, tier }) => ({ id, name, alias, tier })),
      null,
      2,
    ),
  )

  const byTier = {}
  for (const r of results) byTier[r.tier] = (byTier[r.tier] || 0) + 1

  console.log(`✅ 完成：${results.length} / ${champions.length} 个英雄已评级`, byTier)
  if (unmatched.length) {
    console.log(`⚠️ ${unmatched.length} 个 alias 没在 champions.json 对上(可能是新英雄/拼写差异):`, unmatched.join(', '))
  }
  if (conflicts.length) {
    console.log(`\n⚠️ ${conflicts.length} 个英雄两源评价差距较大(≥2.5档)，人工复核参考:`)
    conflicts.forEach((c) => console.log('  ', c))
  }
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
