// 修正 Codex 加的 starterItems：真实起始金币是 1400(不是 Codex 按的 1300)，
// 且有一批坦克只塞了单件多兰之盾(450)、两个坦克塞到 2200(起始买不起)。
//
// 策略(用户选择"只修明显坏的")：只动两类明显不合理的，其余配好的 1300 全部保留不动
//   - 总价 < 1000 的"残缺 stub"(主要是只塞了多兰之盾450的坦克) → 换成对应定位的正规 1400 出门装
//   - 总价 > 1400 的"超预算买不起"(2200 的坦克) → 削回对应定位的 1400 模板
//
// 用法：node scripts/fix-starter-items.mjs        (加 --dry 只看不写)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUILDS_DIR = path.join(ROOT, 'data', 'builds')
const DRY = process.argv.includes('--dry')

const items = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items.json'), 'utf8'))
const byId = new Map(items.map((i) => [i.id, i]))
const priceOf = (id) => byId.get(id)?.priceTotal ?? byId.get(id)?.price ?? 0
const ref = (id) => ({ id, name: byId.get(id).name })

const POT = 2003 // 生命药水 50
const BUDGET = 1400

// 各定位的正规 1400(或接近) 出门装模板——都是海克斯大乱斗标准开局买法
const TEMPLATES = {
  tank: [1011, 1028, POT, POT], //   巨人腰带900 + 红水晶400 + 药×2 = 1400
  ap: [3802, POT, POT, POT], //      遗失的章节1200 + 药×3 = 1350
  ad: [3177, 1001, POT, POT, POT], //守护者之刃950 + 鞋子300 + 药×3 = 1400
  support: [3070, 4642, POT, POT], //女神之泪400 + 班德尔玻璃镜900 + 药×2 = 1400
}

function templateFor(damageType) {
  const d = (damageType || '').toLowerCase()
  if (d.includes('tank')) return TEMPLATES.tank
  if (d.includes('support')) return TEMPLATES.support
  if (d.includes('ap')) return TEMPLATES.ap
  return TEMPLATES.ad
}

function totalOf(starter) {
  return (starter || []).reduce((s, it) => s + priceOf(it.id), 0)
}

const files = fs.readdirSync(BUILDS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
let changed = 0
const samples = []

for (const f of files) {
  const p = path.join(BUILDS_DIR, f)
  const build = JSON.parse(fs.readFileSync(p, 'utf8'))
  let fileChanged = false
  for (const a of build.archetypes) {
    const before = a.starterItems ?? []
    const beforeTotal = totalOf(before)
    // 只修明显坏的：残缺 stub(<1000，主要是单件多兰之盾450) 和 超预算(>1400)。其余保留不动。
    if (beforeTotal >= 1000 && beforeTotal <= BUDGET) continue
    const next = templateFor(a.damageType).map(ref)
    const afterTotal = totalOf(next)
    if (JSON.stringify(next) !== JSON.stringify(before)) {
      a.starterItems = next
      fileChanged = true
      if (samples.length < 20) {
        samples.push(
          `${f} [${a.key}] ${a.damageType}: ` +
            `${before.map((x) => x.name).join('+')}(${beforeTotal}) → ${next.map((x) => x.name).join('+')}(${afterTotal})`,
        )
      }
    }
  }
  if (fileChanged) {
    changed += 1
    if (!DRY) fs.writeFileSync(p, JSON.stringify(build, null, 2) + '\n', 'utf8')
  }
}

console.log(`${DRY ? '[dry-run] ' : ''}改动文件数: ${changed}`)
console.log('样例:')
samples.forEach((s) => console.log('  ' + s))
