// 校验 data/builds/*.json：引用的增强/装备 id 是否存在、名字是否与主数据一致。
// 运行：node scripts/validate-builds.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
const BUILDS = join(DATA, 'builds')

const augById = new Map()
const itemById = new Map()
for (const a of JSON.parse(await readFile(join(DATA, 'augments.json')))) augById.set(a.id, a)
for (const i of JSON.parse(await readFile(join(DATA, 'items.json')))) itemById.set(i.id, i)

const files = (await readdir(BUILDS)).filter((f) => f.endsWith('.json') && f !== 'index.json')
const index = {} // championId -> 文件名，供首页判断哪些英雄有数据
let errors = 0
let warnings = 0

function checkAug(ref, where) {
  const a = augById.get(ref.id)
  if (!a) { console.log(`  ❌ [${where}] 增强 id=${ref.id} "${ref.name}" 不存在`); errors++; return }
  if (ref.apiName && ref.apiName !== a.apiName) { console.log(`  ❌ [${where}] 增强 id=${ref.id} apiName 不符: 写的"${ref.apiName}" 实际"${a.apiName}"`); errors++ }
  if (ref.name && ref.name.replace(/[：:\s]/g, '') !== a.name.replace(/[：:\s]/g, '')) { console.log(`  ⚠️ [${where}] 增强 id=${ref.id} 名字漂移: 写的"${ref.name}" 主数据"${a.name}"`); warnings++ }
}
function checkItem(ref, where) {
  const it = itemById.get(ref.id)
  if (!it) { console.log(`  ❌ [${where}] 装备 id=${ref.id} "${ref.name}" 不存在`); errors++; return }
  if (ref.name && ref.name !== it.name) { console.log(`  ⚠️ [${where}] 装备 id=${ref.id} 名字漂移: 写的"${ref.name}" 主数据"${it.name}"`); warnings++ }
}

for (const f of files) {
  const b = JSON.parse(await readFile(join(BUILDS, f)))
  index[b.championId] = f
  console.log(`\n📄 ${f} — ${b.championName} (id=${b.championId})`)
  for (const arch of b.archetypes ?? []) {
    const w = `${b.championName}/${arch.name}`
    const augs = [...(arch.augments?.core ?? []), ...(arch.augments?.good ?? []), ...(arch.augments?.trap ?? [])]
    for (const a of augs) checkAug(a, w)
    for (const it of arch.starterItems ?? []) checkItem(it, `${w}/starterItems`)
    for (const it of arch.items ?? []) checkItem(it, `${w}/items`)
    for (const it of arch.boots ?? []) checkItem(it, `${w}/boots`)
    for (const it of arch.optionalItems ?? []) checkItem(it, `${w}/optionalItems`)
    console.log(`  ✓ ${arch.name}: ${augs.length} 增强 (核心${arch.augments?.core?.length ?? 0}/备选${arch.augments?.good?.length ?? 0}/陷阱${arch.augments?.trap?.length ?? 0}) + ${arch.starterItems?.length ?? 0} 出门装 + ${arch.items?.length ?? 0} 六神装 + ${arch.boots?.length ?? 0} 鞋子 + ${arch.optionalItems?.length ?? 0} 备选装备`)
  }
}

await writeFile(join(BUILDS, 'index.json'), JSON.stringify(index, null, 2))
console.log(`\n${errors === 0 ? '✅' : '❌'} 校验完成: ${errors} 错误, ${warnings} 警告`)
console.log(`📇 已写 builds/index.json（${Object.keys(index).length} 个英雄有数据）`)
process.exit(errors ? 1 : 0)
