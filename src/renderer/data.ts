// 数据加载 + 类型。dev 下 data/ 目录当静态根，直接 fetch。

export interface Augment {
  id: number
  apiName: string
  name: string
  rarity: number
  rarityLabel: string
  desc: string
  tooltip: string
  iconLargeLocal: string
  iconSmallLocal: string
}

export interface Item {
  id: number
  name: string
  priceTotal: number
  desc: string
  iconLocal: string
}

export interface Champion {
  id: number
  name: string // 卡莎
  title: string // 虚空之女
  alias: string // Kaisa
  pinyin: string // kasha
  initials: string // ks
  roles: string[] // ["marksman","mage"]
  iconLocal: string
}

/** 流派文件里对增强/装备的引用 */
export interface Ref {
  id: number
  apiName?: string
  name: string
}

export interface Archetype {
  key: string
  name: string
  damageType: string
  note: string
  augments: { core: Ref[]; good: Ref[]; trap: Ref[] }
  items: Ref[]
  runes: unknown
  /** 数据可信度锚点：这套玩法交叉参考过的真实站点，没有就不显示（人工手打的老数据允许缺失） */
  sources?: string[]
}

export interface Build {
  championId: number
  championName: string
  archetypes: Archetype[]
}

/** 某英雄本版本的 ARAM 平衡修正（Riot 官方 wiki Module:ChampionData/data，倍率=1 表示无修正、字段缺失也视为 1） */
export interface AramBalance {
  id: number
  name: string
  apiname: string
  dmgDealt?: number
  dmgTaken?: number
  healing?: number
  shielding?: number
  tenacity?: number
  abilityHaste?: number
  energyRegenMod?: number
  totalAs?: number
}

/** 英雄 Tier（人工评级，见 scripts/build-hero-tier.mjs，覆盖面是"合理起步批次"不是全 173） */
export interface HeroTier {
  id: number
  name: string
  alias: string
  tier: 'S' | 'A' | 'B' | 'C' | 'D'
}

/** 官方 patch notes 摘要（人工从 leagueoflegends.com 官方页面翻译整理，见 data/patch-notes.json 里的 sourceUrl） */
export interface PatchNotes {
  patch: string
  theme: string
  releaseDate: string
  sourceUrl: string
  championChanges: { championId: number; championName: string; changes: string[] }[]
  itemChanges: { itemName: string; changes: string[] }[]
  systemChanges: string[]
  mayhem: {
    summaryZh: string
    summaryEn: string
    augmentChanges: { name: string; change: string }[]
    bugfixes: string[]
  }
}

/** 一次加载：主数据 + 英雄列表 + 流派索引 */
export interface Core {
  augById: Map<number, Augment>
  itemById: Map<number, Item>
  augments: Augment[] // 全列表（海克斯一览用）
  champions: Champion[]
  buildIndex: Record<string, string> // championId -> 流派文件名
  aramBalance: AramBalance[] // 只含有修正的英雄
  heroTier: HeroTier[]
  patchNotes: PatchNotes
}

export async function loadCore(): Promise<Core> {
  const [aug, items, champions, buildIndex, aramBalance, heroTier, patchNotes] = await Promise.all([
    fetch('/augments.json').then((r) => r.json() as Promise<Augment[]>),
    fetch('/items.json').then((r) => r.json() as Promise<Item[]>),
    fetch('/champions.json').then((r) => r.json() as Promise<Champion[]>),
    fetch('/builds/index.json').then((r) => r.json() as Promise<Record<string, string>>),
    fetch('/aram-balance.json').then((r) => r.json() as Promise<AramBalance[]>),
    fetch('/hero-tier.json').then((r) => r.json() as Promise<HeroTier[]>),
    fetch('/patch-notes.json').then((r) => r.json() as Promise<PatchNotes>),
  ])
  return {
    augById: new Map(aug.map((a) => [a.id, a])),
    itemById: new Map(items.map((i) => [i.id, i])),
    augments: aug,
    champions,
    buildIndex,
    aramBalance,
    heroTier,
    patchNotes,
  }
}

export async function loadBuild(file: string): Promise<Build> {
  return fetch('/builds/' + file).then((r) => r.json())
}

/** Mayhem 模式部分海克斯用 base_id+1000 的变体编号（实测发现，非文档记录），查找时先按原 id 找，
 *  找不到且 id≥1000 时退化为 id-1000 再查一次。我们数据里增强最大 id 是 405，不会跟真实低位 id 撞车。 */
export function getAugment(augById: Map<number, Augment>, id: number): Augment | undefined {
  return augById.get(id) ?? (id >= 1000 ? augById.get(id - 1000) : undefined)
}

/** iconLocal("icons/items/2510.png") → 可访问 URL */
export const icon = (p: string): string => '/' + p
