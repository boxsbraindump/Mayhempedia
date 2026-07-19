// Preload：在隔离的渲染进程上下文里，把主进程的 LCU 事件安全地暴露给 React。
// contextIsolation + 无 nodeIntegration，渲染层拿不到 Node/Electron 原生能力，只能用这几个受限接口。
//
// ⚠️ 用 .cts（而非 .ts）：项目整体是 ESM("type":"module")，但 Electron 加载 preload
// 脚本时不认这个、按 CommonJS 解析 → import 语法直接报错、preload 静默失败。
// .cts 是 TypeScript 官方给"这一个文件强制编译成 CommonJS"设计的机制，输出 preload.cjs，
// 用 .cjs 后缀就不会再受 package.json 的 type:module 影响。

import { contextBridge, ipcRenderer } from 'electron'

export interface LcuStatus {
  state: 'connecting' | 'connected' | 'error'
  message?: string
}

export interface ChampSelectData {
  myChampionId: number | null
  benchChampionIds: number[]
  benchEnabled: boolean
}

// 跟 src/match-history.ts 的 MatchHistoryResult 结构一致；preload 走 CommonJS 不能 import
// 主进程那份 .ts 类型，这里独立声明一份形状相同的（纯类型，不影响运行时）。
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

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
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

// 跟 src/settings.ts 结构一致（同样的"preload走CJS不能import主进程ESM类型"原因，独立声明一份）。
export interface OverlaySettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number
  hotkey: Hotkey
  moveHotkey: Hotkey
  customPos: { x: number; y: number } | null
}

export interface Hotkey {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
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
export interface FeedbackSettings {
  state: 'unasked' | 'later' | 'completed' | 'disabled'
  lastPromptedAt: string | null
  rating: number | null
}
export interface CustomRoute {
  id: string
  championId: number
  title: string
  description: string
  damageType: string
  starterItemIds: number[]
  itemIds: number[]
  coreAugmentIds: number[]
  goodAugmentIds: number[]
  trapAugmentIds: number[]
  updatedAt: string
}
export interface Settings {
  language: 'zh' | 'en'
  autoLaunch: boolean
  zoomFactor: number
  mainWindowHotkey: Hotkey
  overlay: OverlaySettings
  dashboardSections: DashboardSections
  selectedArchetypeByChampionId: Record<string, string>
  customRoutes: CustomRoute[]
  notificationMode: 'inpage' | 'system'
  persistMatchHistory: boolean
  feedback: FeedbackSettings
}

contextBridge.exposeInMainWorld('mayhem', {
  onLcuStatus: (cb: (s: LcuStatus) => void) => {
    ipcRenderer.on('lcu:status', (_event, data: LcuStatus) => cb(data))
  },
  onChampSelect: (cb: (s: ChampSelectData) => void) => {
    ipcRenderer.on('lcu:champSelect', (_event, data: ChampSelectData) => cb(data))
  },
  onMatchHistory: (cb: (s: MatchHistoryResult) => void) => {
    ipcRenderer.on('lcu:matchHistory', (_event, data: MatchHistoryResult) => cb(data))
  },
  onSummoner: (cb: (s: SummonerInfo) => void) => {
    ipcRenderer.on('lcu:summoner', (_event, data: SummonerInfo) => cb(data))
  },
  onNotification: (cb: (s: AppNotice) => void) => {
    ipcRenderer.on('app:notification', (_event, data: AppNotice) => cb(data))
  },
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', key, value),
  onSettingsChanged: (cb: (s: Settings) => void) => {
    ipcRenderer.on('settings:changed', (_event, data: Settings) => cb(data))
  },
  onOverlayLock: (cb: (s: OverlayLockState) => void) => {
    ipcRenderer.on('overlay:lockChanged', (_event, data: OverlayLockState) => cb(data))
  },
  onOverlayCollapsed: (cb: (s: OverlayCollapsedState) => void) => {
    ipcRenderer.on('overlay:collapsedChanged', (_event, data: OverlayCollapsedState) => cb(data))
  },
  getMatchDetail: (gameId: number): Promise<MatchFullDetail | null> =>
    ipcRenderer.invoke('lcu:getMatchDetail', gameId),
  getStoredAccounts: (): Promise<PersistedAccountSummary[]> => ipcRenderer.invoke('matchHistory:getAccounts'),
  forgetStoredAccount: (puuid: string): Promise<PersistedAccountSummary[]> =>
    ipcRenderer.invoke('matchHistory:forgetAccount', puuid),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('appWindow:minimize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('appWindow:close'),
  showOverlay: (): Promise<boolean> => ipcRenderer.invoke('overlay:show'),
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:getStatus'),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke('updates:check'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('updates:install'),
  openFeedback: (payload: { kind: 'feedback' | 'problem'; rating: number; comment: string }): Promise<boolean> =>
    ipcRenderer.invoke('feedback:open', payload),
  onUpdateStatus: (cb: (s: UpdateStatus) => void) => {
    ipcRenderer.on('updates:status', (_event, data: UpdateStatus) => cb(data))
  },
})
