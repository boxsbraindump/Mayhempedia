// 读本机 LCU 对局记录，算出「乱斗身份卡」的 ARP 战力分。
//
// 关键发现（2026-06-30 实测挖出来的）：LCU 本地对局记录用 gameMode 字符串标记模式
// （"KIWI" = ARAM: Mayhem、"CLASSIC" = 峡谷、"ARAM" = 经典大乱斗），跟 Riot 公开 API
// 的 queueId 完全是两套不同的标识体系——这也是"Match-V5 查不到 Mayhem 对局"那个谜团
// 的另一半解释：本地数据其实一直都在，只是没走 queueId 这条路。筛选统一用 mapId===12
// （嚎哭深渊），比 gameMode 字符串更稳（不同赛季/语言可能有细节差异，map id 不会变）。
//
// ARP 公式（对应 DASHBOARD.md §2A，本地数据拿不到"对局质量"那 15%，砍掉后按剩余
// 权重比例重新归一化到 0-100，不是简单裸算）：
//   40% 胜率分 + 25% 个人影响(队内百分位) + 20% 状态分(近期走势)  ÷ 0.85

import { createHttp1Request } from 'league-connect'
import type { Credentials } from 'league-connect'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOWLING_ABYSS_MAP_ID = 12
const PRISMATIC_RARITY = 2

interface RawParticipantStats {
  win?: boolean
  kills: number
  deaths: number
  assists: number
  champLevel?: number
  goldEarned?: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal?: number
  totalMinionsKilled?: number
  neutralMinionsKilled?: number
  visionScore?: number
  playerAugment1?: number
  playerAugment2?: number
  playerAugment3?: number
  playerAugment4?: number
  playerAugment5?: number
  playerAugment6?: number
  // item6 是饰品/侦查守卫栏，不算"出装"，只留 item0-5 六个装备格
  item0?: number
  item1?: number
  item2?: number
  item3?: number
  item4?: number
  item5?: number
}

interface RawParticipant {
  participantId: number
  championId: number
  stats: RawParticipantStats
}

interface RawGame {
  gameId: number
  mapId: number
  gameCreationDate: string
  participantIdentities: Array<{ participantId: number; player: { puuid: string } }>
}

/** /lol-match-history/v1/games/{gameId} 的完整响应形状（跟列表端点的 RawGame 不同——
 *  列表端点每场只含"我自己"1个participantIdentity，这个详情端点含全部10人的召唤师名）。 */
interface RawGameDetail {
  gameDuration: number
  participantIdentities: Array<{
    participantId: number
    player: { puuid: string; gameName?: string; tagLine?: string }
  }>
  participants: RawParticipant[]
}

interface TimelineFrame {
  timestamp: number
  participantFrames: Record<string, { participantId: number; totalGold: number }>
}

/** 增强 id → 稀有度，读本地 data/augments.json（一次性缓存，不联网） */
let augmentRarityCache: Map<number, number> | null = null
async function loadAugmentRarity(): Promise<Map<number, number>> {
  if (augmentRarityCache) return augmentRarityCache
  const raw = await readFile(path.join(__dirname, '..', 'data', 'augments.json'), 'utf-8')
  const list = JSON.parse(raw) as Array<{ id: number; rarity: number }>
  augmentRarityCache = new Map(list.map((a) => [a.id, a.rarity]))
  return augmentRarityCache
}

/** Mayhem 模式部分海克斯用 base_id+1000 的变体编号（实测发现，非文档记录），查找时先按原 id 找，
 *  找不到且 id≥1000 时退化为 id-1000 再查一次。跟 src/renderer/data.ts 的 getAugment 是同一套逻辑
 *  （主进程/渲染进程各自独立的模块系统，没法共享一份实现，只能各写各的）。 */
function getAugmentRarity(rarityById: Map<number, number>, id: number): number | undefined {
  return rarityById.get(id) ?? (id >= 1000 ? rarityById.get(id - 1000) : undefined)
}

export interface Achievement {
  key: 'snowballFail' | 'triplePrismatic'
  name: string
  emoji: string
  desc: string
  gameId: number
  gameCreationDate: string
}

/** 「近期对局」列表用的轻量摘要——只含自己这一行，够渲染列表+跳去 fetchMatchFullDetail(按需懒加载
 *  完整10人数据) 用的 gameId。不在这里塞出装/海克斯/双方阵容，那些交给 MatchFullDetail 一次性拿全。 */
export interface MatchSummary {
  gameId: number
  championId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  /** 这局在 10 人里的综合表现百分位（0-100，越高越好） */
  impactPercentile: number
  gameCreationDate: string
}

export interface ArpResult {
  score: number // 0-100
  winRateScore: number
  impactScore: number
  stateScore: number
  wins: number
  losses: number
  winRatePct: number
  rankName: string
}

export interface MatchHistoryResult {
  matches: MatchSummary[] // 最近的在前
  arp: ArpResult
  /** 只做了"雪球脱手"+"棱彩三连"（赛后数据能算的）。开局对狙王/一发入魂/冰河世纪の舞
   *  需要对局内实时追踪(Live Client Data)，赛后 timeline 只有击杀/建筑事件，拿不到伤害
   *  时序/技能命中/装备购买时间——今天明确排除，不是漏做。 */
  achievements: Achievement[]
}

const RANK_THRESHOLDS: [number, string][] = [
  [85, '大乱斗之神'],
  [70, '冰海领主'],
  [55, '无双乱斗手'],
  [40, '桥头霸主'],
  [20, '冰封新秀'],
  [0, '深渊路人'],
]

function pickRankName(score: number): string {
  for (const [min, name] of RANK_THRESHOLDS) if (score >= min) return name
  return '深渊路人'
}

export function buildMatchHistoryResult(
  sourceMatches: MatchSummary[],
  sourceAchievements: Achievement[],
): MatchHistoryResult | null {
  const matches = [...sourceMatches].sort((a, b) => b.gameCreationDate.localeCompare(a.gameCreationDate))
  if (matches.length === 0) return null

  const wins = matches.filter((m) => m.win).length
  const total = matches.length
  const winRate = wins / total
  const winRateScore = winRate * 100
  const impactScore = matches.reduce((sum, m) => sum + m.impactPercentile, 0) / total

  const recent5 = matches.slice(0, 5)
  const recent5WinRate = recent5.filter((m) => m.win).length / recent5.length
  const stateScore = Math.max(0, Math.min(100, 50 + (recent5WinRate - winRate) * 100))

  const rawScore = winRateScore * 0.4 + impactScore * 0.25 + stateScore * 0.2
  const score = Math.round(Math.min(100, rawScore / 0.85))

  const latestByKey = new Map<string, Achievement>()
  for (const a of sourceAchievements) {
    const prev = latestByKey.get(a.key)
    if (!prev || a.gameCreationDate > prev.gameCreationDate) latestByKey.set(a.key, a)
  }

  return {
    matches,
    arp: {
      score,
      winRateScore: Math.round(winRateScore),
      impactScore: Math.round(impactScore),
      stateScore: Math.round(stateScore),
      wins,
      losses: total - wins,
      winRatePct: Math.round(winRate * 100),
      rankName: pickRankName(score),
    },
    achievements: [...latestByKey.values()],
  }
}

/** 单人综合表现分：KDA 权重最高，伤害/承伤占比做微调——只用来算"队内排第几"，不对外展示裸分 */
function performanceScore(s: RawParticipantStats): number {
  const kda = (s.kills + s.assists) / Math.max(1, s.deaths)
  return kda * 0.5 + s.totalDamageDealtToChampions * 0.0003 + s.totalDamageTaken * 0.0002
}

async function getJson<T>(credentials: Credentials, url: string): Promise<T | null> {
  const res = await createHttp1Request({ method: 'GET', url }, credentials)
  if (!res.ok) return null
  return (await res.json()) as T
}

/**
 * 拉最近对局 → 筛出嚎哭深渊(含经典大乱斗+Mayhem) → 逐场拉完整对局详情算队内百分位 → 汇总 ARP。
 * 全部走本机 LCU 只读接口，不碰 Riot 云端 API。
 */
export async function fetchMatchHistory(credentials: Credentials): Promise<MatchHistoryResult | null> {
  const list = await getJson<{ games: { games: RawGame[] } }>(
    credentials,
    '/lol-match-history/v1/products/lol/current-summoner/matches',
  )
  const games = list?.games?.games ?? []
  if (games.length === 0) return null

  const myPuuid = games[0].participantIdentities[0]?.player.puuid
  const aramGames = games.filter((g) => g.mapId === HOWLING_ABYSS_MAP_ID)
  const augmentRarity = await loadAugmentRarity()

  const matches: MatchSummary[] = []
  const achievements: Achievement[] = []
  for (const g of aramGames) {
    const myParticipantId = g.participantIdentities.find((pi) => pi.player.puuid === myPuuid)?.participantId
    if (myParticipantId == null) continue

    const detail = await getJson<{ participants: RawParticipant[] }>(
      credentials,
      `/lol-match-history/v1/games/${g.gameId}`,
    )
    const participants = detail?.participants
    if (!participants || participants.length === 0) continue

    const me = participants.find((p) => p.participantId === myParticipantId)
    if (!me) continue

    const scores = participants.map((p) => performanceScore(p.stats))
    const myScore = performanceScore(me.stats)
    const rankAmongTen = scores.filter((s) => s <= myScore).length
    const impactPercentile = Math.round((rankAmongTen / scores.length) * 100)

    // 棱彩三连：本局选的海克斯里有 ≥3 个棱彩稀有度（读本地 augments.json，不联网、不算胜率聚合，
    // 只是"这局你选了什么"的事实陈述，合规——Riot 只禁止显示增强的"胜率"统计）
    const myAugmentIds = [
      me.stats.playerAugment1,
      me.stats.playerAugment2,
      me.stats.playerAugment3,
      me.stats.playerAugment4,
      me.stats.playerAugment5,
      me.stats.playerAugment6,
    ].filter((id): id is number => !!id && id > 0)

    matches.push({
      gameId: g.gameId,
      championId: me.championId,
      win: !!me.stats.win,
      kills: me.stats.kills,
      deaths: me.stats.deaths,
      assists: me.stats.assists,
      impactPercentile,
      gameCreationDate: g.gameCreationDate,
    })

    const prismaticCount = myAugmentIds.filter((id) => getAugmentRarity(augmentRarity, id) === PRISMATIC_RARITY).length
    if (prismaticCount >= 3) {
      achievements.push({
        key: 'triplePrismatic',
        name: '棱彩三连',
        emoji: '💎',
        desc: '一局里选到 3 个棱彩稀有度的海克斯增强',
        gameId: g.gameId,
        gameCreationDate: g.gameCreationDate,
      })
    }

    // 雪球脱手：本队经济一度领先 ≥3000，但最终输了。participantId 1-5=蓝队/6-10=红队(固定惯例)。
    if (!me.stats.win) {
      const timeline = await getJson<{ frames: TimelineFrame[] }>(
        credentials,
        `/lol-match-history/v1/game-timelines/${g.gameId}`,
      )
      const myTeamIsBlue = myParticipantId <= 5
      let maxLead = 0
      for (const frame of timeline?.frames ?? []) {
        let blueGold = 0
        let redGold = 0
        for (const pf of Object.values(frame.participantFrames)) {
          if (pf.participantId <= 5) blueGold += pf.totalGold
          else redGold += pf.totalGold
        }
        const lead = myTeamIsBlue ? blueGold - redGold : redGold - blueGold
        if (lead > maxLead) maxLead = lead
      }
      if (maxLead >= 3000) {
        achievements.push({
          key: 'snowballFail',
          name: '雪球脱手',
          emoji: '🌨️',
          desc: `经济一度领先 ${maxLead} 金，最后还是输了`,
          gameId: g.gameId,
          gameCreationDate: g.gameCreationDate,
        })
      }
    }
  }

  return buildMatchHistoryResult(matches, achievements)
}

/** 「对局详情」页(比分/伤害/经济/每人出装海克斯/Overview/Stats/Graph)用的单个玩家完整数据。 */
export interface PlayerMatchStats {
  participantId: number
  championId: number
  summonerName: string
  isMe: boolean
  team: 'ally' | 'enemy'
  win: boolean
  kills: number
  deaths: number
  assists: number
  champLevel: number
  goldEarned: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  totalMinionsKilled: number
  visionScore: number
  items: number[]
  augments: number[]
}

/** 经济曲线图的单个采样点（timeline 一帧=一个点，本地数据大概每分钟一帧）。 */
export interface GoldFramePoint {
  timestampMs: number
  allyGold: number
  enemyGold: number
}

export interface MatchFullDetail {
  gameId: number
  gameDurationSec: number
  win: boolean
  /** 10人，己方在前(自己排最前)、对面在后，Overview/Stats 表格直接按顺序渲染即可 */
  players: PlayerMatchStats[]
  goldGraph: GoldFramePoint[]
}

/**
 * 单局完整详情——按需懒加载(用户点进某一局才拉，不在 fetchMatchHistory 里对所有20场都拉一遍，
 * 省掉不必要的本地请求量)。两次本机 LCU 调用：game detail(10人完整stats+召唤师名) + timeline(经济曲线)。
 */
export async function fetchMatchFullDetail(credentials: Credentials, gameId: number): Promise<MatchFullDetail | null> {
  const me = await getJson<{ puuid: string }>(credentials, '/lol-summoner/v1/current-summoner')
  const myPuuid = me?.puuid
  if (!myPuuid) return null

  const detail = await getJson<RawGameDetail>(credentials, `/lol-match-history/v1/games/${gameId}`)
  if (!detail) return null

  const myParticipantId = detail.participantIdentities.find((pi) => pi.player.puuid === myPuuid)?.participantId
  if (myParticipantId == null) return null
  const myTeamIsBlue = myParticipantId <= 5

  const nameByParticipantId = new Map(
    detail.participantIdentities.map((pi) => [
      pi.participantId,
      pi.player.gameName ? `${pi.player.gameName}#${pi.player.tagLine ?? ''}` : '未知召唤师',
    ]),
  )

  const players: PlayerMatchStats[] = detail.participants
    .map((p) => {
      const items = [p.stats.item0, p.stats.item1, p.stats.item2, p.stats.item3, p.stats.item4, p.stats.item5].filter(
        (id): id is number => !!id && id > 0,
      )
      const augments = [
        p.stats.playerAugment1,
        p.stats.playerAugment2,
        p.stats.playerAugment3,
        p.stats.playerAugment4,
        p.stats.playerAugment5,
        p.stats.playerAugment6,
      ].filter((id): id is number => !!id && id > 0)
      return {
        participantId: p.participantId,
        championId: p.championId,
        summonerName: nameByParticipantId.get(p.participantId) ?? '未知召唤师',
        isMe: p.participantId === myParticipantId,
        team: (p.participantId <= 5) === myTeamIsBlue ? ('ally' as const) : ('enemy' as const),
        win: !!p.stats.win,
        kills: p.stats.kills,
        deaths: p.stats.deaths,
        assists: p.stats.assists,
        champLevel: p.stats.champLevel ?? 0,
        goldEarned: p.stats.goldEarned ?? 0,
        totalDamageDealtToChampions: p.stats.totalDamageDealtToChampions,
        totalDamageTaken: p.stats.totalDamageTaken,
        totalHeal: p.stats.totalHeal ?? 0,
        totalMinionsKilled: (p.stats.totalMinionsKilled ?? 0) + (p.stats.neutralMinionsKilled ?? 0),
        visionScore: p.stats.visionScore ?? 0,
        items,
        augments,
      }
    })
    // 自己排最前，然后同队剩下的，最后对面——Overview/Stats 表格读到就是最终展示顺序
    .sort((a, b) => {
      if (a.isMe) return -1
      if (b.isMe) return 1
      if (a.team !== b.team) return a.team === 'ally' ? -1 : 1
      return a.participantId - b.participantId
    })

  const timeline = await getJson<{ frames: TimelineFrame[] }>(credentials, `/lol-match-history/v1/game-timelines/${gameId}`)
  const allyIds = new Set(players.filter((p) => p.team === 'ally').map((p) => p.participantId))
  const goldGraph: GoldFramePoint[] = (timeline?.frames ?? []).map((frame) => {
    let allyGold = 0
    let enemyGold = 0
    for (const pf of Object.values(frame.participantFrames)) {
      if (allyIds.has(pf.participantId)) allyGold += pf.totalGold
      else enemyGold += pf.totalGold
    }
    return { timestampMs: frame.timestamp, allyGold, enemyGold }
  })

  const myPlayer = players.find((p) => p.isMe)
  return {
    gameId,
    gameDurationSec: detail.gameDuration,
    win: !!myPlayer?.win,
    players,
    goldGraph,
  }
}
