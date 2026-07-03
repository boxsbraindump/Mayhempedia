// 极简 i18n：不用外部库，一个 key→文案的字典 + React context。
// 设计边界：这一步只搭基础设施 + 打通导航栏/设置页两处做验证，
// App.tsx/Overlay.tsx 里剩下上百处硬编码中文文案的全量替换是单独的后续任务，
// 没有覆盖到的 key 会 fallback 回中文文案本身，不会崩、不会显示 undefined。

import { createContext, useContext } from 'react'

export type Lang = 'zh' | 'en'

type Dict = Record<string, string>

const zh: Dict = {
  'nav.dash': '副官状态',
  'nav.champ': '流派档案',
  'nav.tier': '强度路线',
  'nav.aug': '增强图鉴',
  'nav.patch': '战术更新',
  'nav.settings': '设置',

  'settings.title': '设置',
  'settings.electronOnly': '需要在真正的 Mayhempedia 客户端窗口里运行才能读写设置(浏览器预览下 window.mayhem 不存在)。',
  'settings.loading': '加载中…',

  'settings.startup.title': '启动与窗口',
  'settings.startup.autoLaunch': '开机自启',
  'settings.startup.autoLaunchDesc': '开机后自动启动 Mayhempedia',
  'settings.startup.zoom': '界面缩放',

  'settings.overlay.title': 'Overlay 行为',
  'settings.overlay.position': '位置',
  'settings.overlay.opacity': '透明度',
  'settings.overlay.hotkey': '呼出快捷键',
  'settings.overlay.hotkeyNote': '（自定义按键捕获开发中）',
  'settings.overlay.moveHotkey': '拖动定位快捷键',
  'settings.overlay.moveHotkeyNote': '游戏里按一下解锁，像 TFT 插件一样拖面板，再按一下锁定保存位置',
  'settings.overlay.customPos': '已手动拖动定位到',
  'settings.overlay.resetPos': '重置为锚点默认位置',
  'settings.overlay.pos.topLeft': '左上',
  'settings.overlay.pos.topRight': '右上',
  'settings.overlay.pos.bottomLeft': '左下',
  'settings.overlay.pos.bottomRight': '右下',

  'settings.dashboard.title': '主页内容显示',
  'settings.dashboard.identityCard': '身份卡',
  'settings.dashboard.versionChanges': '本版本变动',
  'settings.dashboard.recentMatches': '近期对局',
  'settings.dashboard.achievements': '新解锁',

  'settings.account.title': '账号',
  'settings.account.none': '未检测到登录账号',
  'settings.account.desc': '本地历史按账号分开记录，不联网、不绑定 Riot 云账号。',
  'settings.account.refresh': '刷新',
  'settings.account.loading': '读取本地账号记录中…',
  'settings.account.empty': '还没有累计过任何账号的本地对局记录。',
  'settings.account.current': '当前',
  'settings.account.forget': '清除本地记录',
  'settings.account.matches': '{n} 场',
  'settings.account.detailsCached': '{n} 场详情缓存',
  'settings.account.lastMatch': '最近对局',

  'settings.notification.title': '通知',
  'settings.notification.inpage': '页面内提示',
  'settings.notification.system': '系统通知',

  'settings.language.title': '语言',
  'settings.language.zh': '中文',
  'settings.language.en': 'English',
  'settings.language.note': '切换后英雄/装备/海克斯名字会显示对应语言；人工撰写的流派说明视翻译完成情况逐步补齐。',

  'settings.privacy.title': '数据与隐私',
  'settings.privacy.persist': '本地积累对局记录',
  'settings.privacy.persistDesc': '为长期战力分析/英雄强度统计攒素材。只写在你自己电脑本地，从不上传。',
}

const en: Dict = {
  'nav.dash': 'Dashboard',
  'nav.champ': 'Champions',
  'nav.tier': 'Tier List',
  'nav.aug': 'Augments',
  'nav.patch': 'Patch Notes',
  'nav.settings': 'Settings',

  'settings.title': 'Settings',
  'settings.electronOnly': 'Settings only work inside the real Mayhempedia app window (window.mayhem is unavailable in a browser preview).',
  'settings.loading': 'Loading…',

  'settings.startup.title': 'Startup & Window',
  'settings.startup.autoLaunch': 'Launch at startup',
  'settings.startup.autoLaunchDesc': 'Automatically start Mayhempedia when you log in',
  'settings.startup.zoom': 'UI Zoom',

  'settings.overlay.title': 'Overlay Behavior',
  'settings.overlay.position': 'Position',
  'settings.overlay.opacity': 'Opacity',
  'settings.overlay.hotkey': 'Toggle Hotkey',
  'settings.overlay.hotkeyNote': '(custom key capture coming soon)',
  'settings.overlay.moveHotkey': 'Reposition Hotkey',
  'settings.overlay.moveHotkeyNote': 'Press once in-game to unlock and drag the panel like a TFT overlay, press again to lock and save the position',
  'settings.overlay.customPos': 'Manually positioned at',
  'settings.overlay.resetPos': 'Reset to anchor default',
  'settings.overlay.pos.topLeft': 'Top Left',
  'settings.overlay.pos.topRight': 'Top Right',
  'settings.overlay.pos.bottomLeft': 'Bottom Left',
  'settings.overlay.pos.bottomRight': 'Bottom Right',

  'settings.dashboard.title': 'Dashboard Sections',
  'settings.dashboard.identityCard': 'Identity Card',
  'settings.dashboard.versionChanges': 'Patch Changes',
  'settings.dashboard.recentMatches': 'Recent Matches',
  'settings.dashboard.achievements': 'Achievements',

  'settings.account.title': 'Account',
  'settings.account.none': 'No signed-in account detected',
  'settings.account.desc': 'Local history is kept per account. No network access, not tied to your Riot account.',
  'settings.account.refresh': 'Refresh',
  'settings.account.loading': 'Loading local account history…',
  'settings.account.empty': "No account's match history has been saved locally yet.",
  'settings.account.current': 'Current',
  'settings.account.forget': 'Clear local history',
  'settings.account.matches': '{n} matches',
  'settings.account.detailsCached': '{n} details cached',
  'settings.account.lastMatch': 'Last match',

  'settings.notification.title': 'Notifications',
  'settings.notification.inpage': 'In-app toast',
  'settings.notification.system': 'System notification',

  'settings.language.title': 'Language',
  'settings.language.zh': '中文',
  'settings.language.en': 'English',
  'settings.language.note': 'Champion/item/augment names switch immediately; hand-written archetype notes are translated champion-by-champion and will fill in over time.',

  'settings.privacy.title': 'Data & Privacy',
  'settings.privacy.persist': 'Persist match history locally',
  'settings.privacy.persistDesc': 'Builds a dataset for long-term performance tracking and champion strength stats. Stored only on your own machine, never uploaded.',
}

const DICTS: Record<Lang, Dict> = { zh, en }

export function t(lang: Lang, key: string, fallback?: string): string {
  return DICTS[lang][key] ?? DICTS.zh[key] ?? fallback ?? key
}

const LangContext = createContext<Lang>('zh')
export const LangProvider = LangContext.Provider

export function useLang(): Lang {
  return useContext(LangContext)
}

export function useT(): (key: string, fallback?: string) => string {
  const lang = useLang()
  return (key: string, fallback?: string) => t(lang, key, fallback)
}
