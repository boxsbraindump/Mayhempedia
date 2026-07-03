// 设置数据层：本地持久化(electron-store，写 JSON 到用户数据目录，不联网)。
// 主进程持有唯一的 Store 实例；渲染层通过 IPC(settings:get/settings:set) 读写，不直接碰文件。

import Store from 'electron-store'

export interface OverlaySettings {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number // 0.3–1
  hotkey: { ctrl: boolean; shift: boolean; alt: boolean; key: string } // key 是 UiohookKey 的键名，如 "X"
  /** 拖动解锁/锁定的快捷键——解锁后才能像 TFT 插件那样手动拖窗口。 */
  moveHotkey: { ctrl: boolean; shift: boolean; alt: boolean; key: string }
  /** 手动拖动后落盘的实际坐标；null = 还没拖过，用 position 锚点算默认位置。 */
  customPos: { x: number; y: number } | null
}

export interface DashboardSections {
  identityCard: boolean
  versionChanges: boolean
  recentMatches: boolean
  achievements: boolean
}

export interface Settings {
  // 语言
  language: 'zh' | 'en'

  // 启动/窗口类
  autoLaunch: boolean
  zoomFactor: number // 0.8–1.4

  // Overlay 行为类
  overlay: OverlaySettings

  // 主页内容显示（内容开关类）
  dashboardSections: DashboardSections
  selectedArchetypeByChampionId: Record<string, string>

  // 通知类
  notificationMode: 'inpage' | 'system'

  // 数据/隐私类
  persistMatchHistory: boolean // 本地积累对局记录，供未来长期战力分析；只落本地盘，不上传
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'zh',
  autoLaunch: false,
  zoomFactor: 1,
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
  notificationMode: 'inpage',
  persistMatchHistory: true, // 默认开：这是产品核心卖点(长期攒Tier数据素材)，纯本地零风险；设置页要把这点说清楚，不能默默开
}

let store: Store<Settings> | null = null

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
    overlay: { ...DEFAULT_SETTINGS.overlay, ...stored.overlay },
    dashboardSections: { ...DEFAULT_SETTINGS.dashboardSections, ...stored.dashboardSections },
    selectedArchetypeByChampionId: {
      ...DEFAULT_SETTINGS.selectedArchetypeByChampionId,
      ...stored.selectedArchetypeByChampionId,
    },
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Settings {
  getStore().set(key, value)
  return getSettings()
}
