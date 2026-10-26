// 下载所有增强 + 装备 + 英雄图标到 data/icons/，并把装备/英雄的本地相对路径写回 JSON。
// 运行：node scripts/download-icons.mjs
//   增强: 按 augments.json 里已有的 iconLargeLocal/iconSmallLocal 补下载（不改写路径）
//   装备: data/icons/items/{id}.png

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const ICONS = join(DATA_DIR, 'icons')

const CONCURRENCY = 12

/** 简单并发池 */
async function pool(tasks, n, onProgress) {
  const results = []
  let i = 0
  let done = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
      onProgress?.(++done, tasks.length)
    }
  }
  await Promise.all(Array.from({ length: n }, worker))
  return results
}

async function download(url, dest) {
  try {
    const r = await fetch(url)
    if (!r.ok) return { ok: false, status: r.status, url }
    const buf = Buffer.from(await r.arrayBuffer())
    await writeFile(dest, buf)
    return { ok: true }
  } catch (e) {
    return { ok: false, status: e.message, url }
  }
}

function progress(done, total) {
  if (done % 50 === 0 || done === total) process.stdout.write(`\r  ${done}/${total}`)
}

async function main() {
  await mkdir(join(ICONS, 'augments'), { recursive: true })
  await mkdir(join(ICONS, 'items'), { recursive: true })
  await mkdir(join(ICONS, 'champions'), { recursive: true })

  const augments = JSON.parse(await readFile(join(DATA_DIR, 'augments.json')))
  const items = JSON.parse(await readFile(join(DATA_DIR, 'items.json')))
  const champions = JSON.parse(await readFile(join(DATA_DIR, 'champions.json')))

  // ---- 增强图标 ----
  // 本地路径由 fetch-arammayhem-augments.mjs 决定（arammayhem / CommunityDragon / 入库的 data/assets/），这里只按原路径补下载
  const augTasks = []
  for (const a of augments) {
    const targets = [[a.iconLargeLocal, a.iconLargeUrl]]
    if (a.iconSmallLocal !== a.iconLargeLocal) targets.push([a.iconSmallLocal, a.iconSmallUrl])
    for (const [local, url] of targets) {
      if (!local?.startsWith('icons/') || !url) continue
      augTasks.push(() => download(url, join(DATA_DIR, local)).then((r) => ({ ...r, who: `${a.name} (${local})` })))
    }
  }
  console.log(`下载增强图标 (${augTasks.length})…`)
  const augRes = await pool(augTasks, CONCURRENCY, progress)

  // ---- 装备图标 ----
  console.log(`\n下载装备图标 (${items.length})…`)
  const itemTasks = []
  for (const it of items) {
    const f = `items/${it.id}.png`
    it.iconLocal = `icons/${f}`
    itemTasks.push(() => download(it.iconUrl, join(ICONS, f)).then((r) => ({ ...r, who: `${it.id} ${it.name}` })))
  }
  const itemRes = await pool(itemTasks, CONCURRENCY, progress)

  // ---- 英雄头像 ----
  console.log(`\n下载英雄头像 (${champions.length})…`)
  const champTasks = []
  for (const c of champions) {
    const f = `champions/${c.id}.png`
    c.iconLocal = `icons/${f}`
    champTasks.push(() => download(c.iconUrl, join(ICONS, f)).then((r) => ({ ...r, who: `${c.id} ${c.name}` })))
  }
  const champRes = await pool(champTasks, CONCURRENCY, progress)

  // ---- 回写本地路径（增强的路径不改，见上） ----
  await writeFile(join(DATA_DIR, 'items.json'), JSON.stringify(items, null, 2))
  await writeFile(join(DATA_DIR, 'champions.json'), JSON.stringify(champions, null, 2))

  // ---- 汇报失败 ----
  const all = [...augRes, ...itemRes, ...champRes]
  const fails = all.filter((r) => !r.ok)
  console.log(`\n\n✅ 完成. 成功 ${all.length - fails.length} / ${all.length}`)
  if (fails.length) {
    console.log(`⚠️ 失败 ${fails.length} 个:`)
    for (const f of fails.slice(0, 20)) console.log(`  [${f.status}] ${f.who}  ${f.url}`)
    if (fails.length > 20) console.log(`  …还有 ${fails.length - 20} 个`)
  }
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
