// 设置数据层：本地持久化(electron-store，写 JSON 到用户数据目录，不联网)。
// 主进程持有唯一的 Store 实例；渲染层通过 IPC(settings:get/settings:set) 读写，不直接碰文件。

import Store from 'electron-store'
import type { CustomRoute } from './custom-routes.js'

export interface Hotkey {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

export interface OverlaySettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number // 0.3–1
  hotkey: Hotkey // key 是 UiohookKey 的键名，如 "X"
  /** 拖动解锁/锁定的快捷键——解锁后才能像 TFT 插件那样手动拖窗口。 */
  moveHotkey: Hotkey
  /** 手动拖动后落盘的实际坐标；null = 还没拖过，用 position 锚点算默认位置。 */
  customPos: { x: number; y: number } | null
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

/** 玩家手动勾选的常玩英雄和偏好打法；跟本地对局记录一起决定首页优先推荐谁的路线。 */
export interface PlayPreferences {
  championIds: number[]
  /** 打法类型 key，见 src/renderer/play-preferences.ts 的 PLAYSTYLES */
  playstyles: string[]
  /** 首页的首次提示已处理过（保存过或点了「先不用」），之后不再提示。 */
  prompted: boolean
}

export interface Settings {
  // 语言
  language: 'zh' | 'en'

  // 启动/窗口类
  autoLaunch: boolean
  zoomFactor: number // 0.5 / 0.75 / 1 / 1.25 / 1.5
  /** 游戏中快速调出当前英雄的完整 Combat File。 */
  mainWindowHotkey: Hotkey

  // Overlay 行为类
  overlay: OverlaySettings

  // 主页内容显示（内容开关类）
  dashboardSections: DashboardSections
  selectedArchetypeByChampionId: Record<string, string>
  /** 玩家主动收藏的路线，用于在同一英雄的路线切换器内置顶。仅保存在本机。 */
  favoriteRouteKeys: string[]
  customRoutes: CustomRoute[]
  /** 首页「本版本精选玩法」的个性化偏好。仅保存在本机。 */
  playPreferences: PlayPreferences

  // 通知类
  notificationMode: 'inpage' | 'system'

  // 数据/隐私类
  persistMatchHistory: boolean // 本地积累对局记录，供未来长期战力分析；只落本地盘，不上传

  // Beta 反馈。评论不存入设置；这里只记录是否需要再次提示与可选评分。
  feedback: FeedbackSettings
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  autoLaunch: false,
  zoomFactor: 1,
  mainWindowHotkey: { ctrl: true, shift: true, alt: false, key: 'M' },
  overlay: {
    position: 'top-left',
    opacity: 0.85,
    hotkey: { ctrl: true, shift: true, alt: false, key: 'X' },
    moveHotkey: { ctrl: true, shift: true, alt: false, key: 'L' },
    customPos: null,
  },
  dashboardSections: {
    identityCard: true,
    versionChanges: true,
    recentMatches: true,
    achievements: true,
  },
  selectedArchetypeByChampionId: {},
  favoriteRouteKeys: [],
  customRoutes: [],
  playPreferences: {
    championIds: [],
    playstyles: [],
    prompted: false,
  },
  notificationMode: 'inpage',
  persistMatchHistory: true, // 默认开：这是产品核心卖点(长期攒Tier数据素材)，纯本地零风险；设置页要把这点说清楚，不能默默开
  feedback: {
    state: 'unasked',
    lastPromptedAt: null,
    rating: null,
  },
}

let store: Store<Settings> | null = null

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const

function normalizeZoom(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.zoomFactor
  return ZOOM_PRESETS.includes(value as (typeof ZOOM_PRESETS)[number]) ? value : DEFAULT_SETTINGS.zoomFactor
}

function normalizePlayPreferences(value: unknown): PlayPreferences {
  const stored = value && typeof value === 'object' ? (value as Partial<PlayPreferences>) : {}
  return {
    championIds: Array.isArray(stored.championIds) ? stored.championIds.filter((id) => typeof id === 'number') : [],
    playstyles: Array.isArray(stored.playstyles) ? stored.playstyles.filter((key) => typeof key === 'string') : [],
    prompted: stored.prompted === true,
  }
}

function getStore(): Store<Settings> {
  if (!store) {
    store = new Store<Settings>({ name: 'settings', defaults: DEFAULT_SETTINGS })
  }
  return store
}

export function getSettings(): Settings {
  const s = getStore()
  const stored = s.store
  // 顶层 spread 是浅合并——旧配置文件里如果已经存的 overlay/dashboardSections 对象，
  // 会整个覆盖掉 DEFAULT_SETTINGS 里的同名对象，新增的嵌套字段(比如 moveHotkey/customPos)
  // 在旧文件里根本不存在，读出来就是 undefined，渲染层一读 .ctrl 直接崩。
  // 所以嵌套对象要单独再合一层，而不是指望顶层 spread 帮你处理。
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    zoomFactor: normalizeZoom(stored.zoomFactor),
    overlay: { ...DEFAULT_SETTINGS.overlay, ...stored.overlay },
    dashboardSections: { ...DEFAULT_SETTINGS.dashboardSections, ...stored.dashboardSections },
    feedback: {
      ...DEFAULT_SETTINGS.feedback,
      ...(stored.feedback && typeof stored.feedback === 'object' ? stored.feedback : {}),
    },
    selectedArchetypeByChampionId: {
      ...DEFAULT_SETTINGS.selectedArchetypeByChampionId,
      ...stored.selectedArchetypeByChampionId,
    },
    favoriteRouteKeys: Array.isArray(stored.favoriteRouteKeys) ? stored.favoriteRouteKeys : [],
    customRoutes: Array.isArray(stored.customRoutes) ? stored.customRoutes : [],
    playPreferences: normalizePlayPreferences(stored.playPreferences),
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Settings {
  getStore().set(key, key === 'zoomFactor' ? normalizeZoom(value) : value)
  return getSettings()
}
