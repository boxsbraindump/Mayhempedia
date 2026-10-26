// 首页「本版本精选玩法」的个性化：先弄清玩家常玩谁，再决定优先推荐哪些英雄的路线。
// 两个来源：本地对局记录（玩过 HISTORY_MIN_GAMES 次以上的英雄）+ 玩家手动勾选的英雄/打法（settings.playPreferences）。
// 全部在渲染层本地计算——对局记录只来自本机 LCU / 本地 electron-store，不发给任何服务器。

import type { Archetype, Champion, HeroTier } from './data'
import type { MatchSummary, PlayPreferences } from './lcu'

/** 本地对局里至少玩过这么多次才算「常玩」。本地最多只保存 20 局（见 match-history-store），全部参与统计。 */
export const HISTORY_MIN_GAMES = 3
/** 手动勾选的英雄上限：首页只有几个位置，选太多就失去「优先」的意义。 */
export const MAX_MANUAL_CHAMPIONS = 8

export const EMPTY_PLAY_PREFERENCES: PlayPreferences = { championIds: [], playstyles: [], prompted: false }

export type PlaystyleKey = 'poke' | 'engage' | 'enchanter' | 'marksman' | 'assassin' | 'bruiser'

interface Playstyle {
  key: PlaystyleKey
  /** 手工挑的代表英雄（champions.json 的 alias），排在前面的会当示例显示。 */
  aliases?: string[]
  /** 没有手工名单的打法，按英雄主定位（roles[0]）归类，再按 Tier 排序。 */
  primaryRole?: string
}

export const PLAYSTYLES: Playstyle[] = [
  { key: 'poke', aliases: ['Lux', 'Xerath', 'Ziggs', 'Velkoz', 'Hwei', 'Zoe', 'Mel', 'Nidalee', 'Jayce', 'Varus', 'Ezreal', 'Karma'] },
  { key: 'engage', aliases: ['Malphite', 'Amumu', 'Leona', 'Rell', 'Ornn', 'Alistar', 'Nautilus', 'Zac', 'Sejuani', 'Galio', 'Maokai', 'Rakan'] },
  { key: 'enchanter', aliases: ['Soraka', 'Sona', 'Yuumi', 'Nami', 'Janna', 'Lulu', 'Seraphine', 'Milio', 'Renata', 'Taric', 'Bard', 'Senna'] },
  { key: 'marksman', primaryRole: 'marksman' },
  { key: 'assassin', primaryRole: 'assassin' },
  { key: 'bruiser', primaryRole: 'fighter' },
]

const TIER_RANK: Record<HeroTier['tier'], number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }

export function playstyleChampions(key: string, champions: Champion[], heroTier: HeroTier[]): Champion[] {
  const style = PLAYSTYLES.find((entry) => entry.key === key)
  if (!style) return []
  if (style.aliases) {
    const byAlias = new Map(champions.map((champion) => [champion.alias, champion]))
    return style.aliases.map((alias) => byAlias.get(alias)).filter((champion): champion is Champion => !!champion)
  }
  const tierById = new Map(heroTier.map((entry) => [entry.id, TIER_RANK[entry.tier]]))
  return champions
    .filter((champion) => champion.roles[0] === style.primaryRole)
    .sort((a, b) => (tierById.get(a.id) ?? 5) - (tierById.get(b.id) ?? 5))
}

/** 本地对局里玩过 HISTORY_MIN_GAMES 次以上的英雄：次数多的在前，同次数按最近一局在前。 */
export function frequentChampions(matches: MatchSummary[]): { championId: number; games: number }[] {
  const stats = new Map<number, { games: number; latest: string }>()
  for (const match of matches) {
    const current = stats.get(match.championId)
    stats.set(match.championId, {
      games: (current?.games ?? 0) + 1,
      latest: current && current.latest > match.gameCreationDate ? current.latest : match.gameCreationDate,
    })
  }
  return [...stats.entries()]
    .filter(([, stat]) => stat.games >= HISTORY_MIN_GAMES)
    .sort((a, b) => b[1].games - a[1].games || b[1].latest.localeCompare(a[1].latest))
    .map(([championId, stat]) => ({ championId, games: stat.games }))
}

export type PreferenceReason =
  | { kind: 'manual' }
  | { kind: 'history'; games: number }
  | { kind: 'playstyle'; playstyle: PlaystyleKey }

export interface PreferredChampion {
  champion: Champion
  reason: PreferenceReason
}

/**
 * 按「手动勾选的英雄 → 本地常玩英雄 → 偏好打法的代表英雄」排出优先推荐的英雄。
 * 同一英雄只出现一次，理由取排在最前的那个来源；多个打法轮流取，避免第一个打法占满名额。
 */
export function rankPreferredChampions({
  champions,
  heroTier,
  matches,
  preferences,
  limit = 12,
}: {
  champions: Champion[]
  heroTier: HeroTier[]
  matches: MatchSummary[]
  preferences: PlayPreferences
  limit?: number
}): PreferredChampion[] {
  const byId = new Map(champions.map((champion) => [champion.id, champion]))
  const ranked: PreferredChampion[] = []
  const push = (championId: number, reason: PreferenceReason) => {
    const champion = byId.get(championId)
    if (!champion || ranked.length >= limit || ranked.some((entry) => entry.champion.id === championId)) return
    ranked.push({ champion, reason })
  }
  preferences.championIds.forEach((championId) => push(championId, { kind: 'manual' }))
  frequentChampions(matches).forEach(({ championId, games }) => push(championId, { kind: 'history', games }))
  const styles = PLAYSTYLES.filter((style) => preferences.playstyles.includes(style.key)).map((style) => ({
    key: style.key,
    champions: playstyleChampions(style.key, champions, heroTier),
  }))
  const longest = Math.max(0, ...styles.map((style) => style.champions.length))
  for (let index = 0; index < longest && ranked.length < limit; index++) {
    for (const style of styles) {
      const champion = style.champions[index]
      if (champion) push(champion.id, { kind: 'playstyle', playstyle: style.key })
    }
  }
  return ranked
}

/** 首页卡片该展示这个英雄的哪条路线：本版本新路线优先，没有就用官方推荐（未标注时取第一条）。 */
export function homepageRoute(archetypes: Archetype[]): { archetype: Archetype; isNew: boolean } | null {
  const fresh = archetypes.find((route) => route.isNew || !!route.releaseDate)
  if (fresh) return { archetype: fresh, isNew: true }
  const recommended = archetypes.find((route) => route.recommended) ?? archetypes[0]
  return recommended ? { archetype: recommended, isNew: false } : null
}
