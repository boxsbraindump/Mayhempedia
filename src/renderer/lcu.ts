// LCU 桥接类型 + 小工具。这些事件只有跑在真正的 Electron 窗口里才会触发；
// 在浏览器预览里 window.mayhem 不存在，所有订阅都安全地什么都不做（双模式：预览开发 / 真机运行都不报错）。

export interface LcuStatus {
  state: 'connecting' | 'connected' | 'error'
  message?: string
}

export interface ChampSelectData {
  myChampionId: number | null
  benchChampionIds: number[]
  benchEnabled: boolean
}

export interface MatchSummary {
  gameId: number
  championId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  impactPercentile: number
  gameCreationDate: string
}

export interface ArpResult {
  score: number
  winRateScore: number
  impactScore: number
  stateScore: number
  wins: number
  losses: number
  winRatePct: number
  rankName: string
}

export interface Achievement {
  key: 'snowballFail' | 'triplePrismatic'
  name: string
  emoji: string
  desc: string
  gameId: number
  gameCreationDate: string
}

export interface MatchHistoryResult {
  matches: MatchSummary[]
  arp: ArpResult
  achievements: Achievement[]
}

export interface SummonerInfo {
  gameName: string
  tagLine: string
}

export interface AppNotice {
  id: string
  title: string
  body: string
  tone: 'success' | 'warning' | 'info'
}

export interface PersistedAccountSummary {
  puuid: string
  gameName?: string
  tagLine?: string
  updatedAt: string
  matchCount: number
  detailCount: number
  latestGameCreationDate?: string
  isCurrent: boolean
}

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
export interface GoldFramePoint {
  timestampMs: number
  allyGold: number
  enemyGold: number
}
export interface MatchFullDetail {
  gameId: number
  gameDurationSec: number
  win: boolean
  players: PlayerMatchStats[]
  goldGraph: GoldFramePoint[]
}

export interface OverlaySettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number
  hotkey: { ctrl: boolean; shift: boolean; alt: boolean; key: string }
  moveHotkey: { ctrl: boolean; shift: boolean; alt: boolean; key: string }
  customPos: { x: number; y: number } | null
}
export interface OverlayLockState {
  locked: boolean
}
export interface OverlayCollapsedState {
  collapsed: boolean
}
export interface DashboardSections {
  identityCard: boolean
  versionChanges: boolean
  recentMatches: boolean
  achievements: boolean
}
export interface Settings {
  autoLaunch: boolean
  zoomFactor: number
  overlay: OverlaySettings
  dashboardSections: DashboardSections
  selectedArchetypeByChampionId: Record<string, string>
  notificationMode: 'inpage' | 'system'
  persistMatchHistory: boolean
}

declare global {
  interface Window {
    mayhem?: {
      onLcuStatus: (cb: (s: LcuStatus) => void) => void
      onChampSelect: (cb: (s: ChampSelectData) => void) => void
      onMatchHistory: (cb: (s: MatchHistoryResult) => void) => void
      onSummoner: (cb: (s: SummonerInfo) => void) => void
      onNotification: (cb: (s: AppNotice) => void) => void
      getSettings: () => Promise<Settings>
      setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<Settings>
      onSettingsChanged: (cb: (s: Settings) => void) => void
      onOverlayLock: (cb: (s: OverlayLockState) => void) => void
      onOverlayCollapsed: (cb: (s: OverlayCollapsedState) => void) => void
      getMatchDetail: (gameId: number) => Promise<MatchFullDetail | null>
      getStoredAccounts: () => Promise<PersistedAccountSummary[]>
      forgetStoredAccount: (puuid: string) => Promise<PersistedAccountSummary[]>
    }
  }
}

export const isElectron = (): boolean => typeof window !== 'undefined' && !!window.mayhem
