// 英雄静态数据：把 championId 映射成英雄名。
// 数据源 = Community Dragon 的 champion-summary（比官方 Data Dragon 更全，且免维护）。

const SUMMARY_URL =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json'

let idToName = new Map<number, string>()

/** 启动时拉一次，缓存在内存里。 */
export async function loadChampions(): Promise<void> {
  const res = await fetch(SUMMARY_URL)
  if (!res.ok) throw new Error(`champion-summary 拉取失败: HTTP ${res.status}`)
  const list = (await res.json()) as Array<{ id: number; name: string }>
  // id = -1 是 "None" 占位，过滤掉
  idToName = new Map(list.filter((c) => c.id > 0).map((c) => [c.id, c.name]))
}

/** championId → 英雄名；未知 id 退化成 #id，方便排查。 */
export function championName(id: number | undefined | null): string {
  if (!id || id <= 0) return '(未选)'
  return idToName.get(id) ?? `#${id}`
}
