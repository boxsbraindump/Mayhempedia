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
  'settings.language.title': '语言',
  'settings.language.zh': '中文',
  'settings.language.en': 'English',
  'settings.language.note': '切换后英雄/装备/海克斯名字会显示对应语言；人工撰写的流派说明视翻译完成情况逐步补齐。',
}

const en: Dict = {
  'nav.dash': 'Dashboard',
  'nav.champ': 'Champions',
  'nav.tier': 'Tier List',
  'nav.aug': 'Augments',
  'nav.patch': 'Patch Notes',
  'nav.settings': 'Settings',

  'settings.title': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.zh': '中文',
  'settings.language.en': 'English',
  'settings.language.note': 'Champion/item/augment names switch immediately; hand-written archetype notes are translated champion-by-champion and will fill in over time.',
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
