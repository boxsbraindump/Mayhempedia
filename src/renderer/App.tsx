import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  loadCore,
  loadBuild,
  withCustomRoutes,
  customRouteToArchetype,
  icon,
  getAugment,
  isSelectableRouteItem,
  type Augment,
  type Item,
  type Champion,
  type Archetype,
  type Ref,
  type Build,
  type Core,
  type AramBalance,
} from './data'
import { customRouteKey } from '../custom-routes'
import {
  isElectron,
  type LcuStatus,
  type MatchHistoryResult,
  type ArpResult,
  type MatchSummary,
  type Achievement,
  type AppNotice,
  type SummonerInfo,
  type PersistedAccountSummary,
  type Settings,
  type OverlaySettings,
  type Hotkey,
  type DashboardSections,
  type FeedbackSettings,
  type MatchFullDetail,
  type PlayerMatchStats,
  type CustomRoute,
  type UpdateStatus,
} from './lcu'
import { augmentTagLabel, scoreAugmentPick, type DecisionPick } from './augment-scoring'
import { LangProvider, useT, useLang, t, type Lang } from './i18n'

/* 复用样式片段（字面量常量，Tailwind 扫描可识别） */
const CARD =
  'glass-panel relative overflow-hidden rounded-[8px] border border-line/70 transition-colors hover:border-hex/35'
const SEARCH_INLINE =
  'bg-panel/85 w-full px-3 py-2 border border-line/75 rounded-md text-cream text-[12px] outline-none focus:border-hex/70 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.09)] placeholder:text-dim/55 transition'
const TOOLBAR =
  'bg-panel/88 sticky top-4 z-20 mb-5 rounded-[8px] border border-line/70 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.20)]'
const CHIP =
  'px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition border'
const BTN_PRIMARY =
  'rounded-md border border-hex bg-hex px-3 py-1.5 text-[11px] font-black text-[#041017] transition hover:bg-[#45dff0] active:translate-y-px'
const BTN_SECONDARY =
  'rounded-md border border-line/70 bg-panel2/70 px-3 py-1.5 text-[11px] font-black text-dim transition hover:border-line hover:bg-panel2 hover:text-cream active:translate-y-px'
const BTN_TINY_SECONDARY =
  'rounded-md border border-line/70 bg-panel2/70 px-2.5 py-1 text-[10px] font-black text-dim transition hover:border-line hover:bg-panel2 hover:text-cream active:translate-y-px'
const BTN_DANGER =
  'rounded-md border border-red/50 bg-transparent px-3 py-1.5 text-[11px] font-black text-red transition hover:bg-red/10 active:translate-y-px'
const PAGE_HEADER =
  'glass-panel-strong relative mb-3 overflow-hidden rounded-[8px] border p-3 shadow-[0_14px_34px_rgba(0,0,0,0.16)]'
const SURFACE =
  'rounded-[8px] border border-line/70 bg-panel/78 shadow-[0_12px_30px_rgba(0,0,0,0.14)]'
const PANEL_INSET =
  'rounded-[7px] border border-line/60 bg-[#07101b]/46'
const ICON_ASSET =
  'shrink-0 rounded-[6px] border border-line/70 object-cover'

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const
const APP_BASE_WIDTH = 1280
const APP_BASE_HEIGHT = 720
const CUSTOM_ROUTES_ENABLED = true
const EMPTY_CUSTOM_ROUTES: CustomRoute[] = []
const CUSTOM_ROUTE_DRAFT_STORAGE_KEY = 'mayhempedia.customRouteDraft'
const CUSTOM_ROUTE_SUBPAGE_STORAGE_KEY = 'mayhempedia.customRouteSubpage'
const CUSTOM_ROUTE_LIBRARY_SELECTION_STORAGE_KEY = 'mayhempedia.customRouteLibrarySelection'
type FeedbackMode = 'feedback' | 'problem'

const RARITY_KEY: Record<number, string> = { 0: 'silver', 1: 'gold', 2: 'prismatic', 4: 'special' }
const RARITY: Record<number, { label: string; text: string; border: string; bg: string }> = {
  0: { label: '白银', text: 'text-[#a7b0be]', border: 'border-[#a7b0be]', bg: 'bg-[#a7b0be]' },
  1: { label: '黄金', text: 'text-gold', border: 'border-gold', bg: 'bg-gold' },
  2: { label: '棱彩', text: 'text-hex', border: 'border-hex', bg: 'bg-hex' },
  4: { label: '特殊', text: 'text-[#b98cf0]', border: 'border-[#b98cf0]', bg: 'bg-[#b98cf0]' },
}
const RARITY_ORDER = [2, 1, 0]

const ROLES: { key: string; label: string }[] = [
  { key: 'fighter', label: '战士' },
  { key: 'mage', label: '法师' },
  { key: 'tank', label: '坦克' },
  { key: 'assassin', label: '刺客' },
  { key: 'marksman', label: '射手' },
  { key: 'support', label: '辅助' },
]

type Tab = 'dash' | 'champ' | 'history' | 'builder' | 'tier' | 'aug' | 'patch' | 'settings'
const NAV: { key: Tab; label: string }[] = [
  { key: 'dash', label: '作战总览' },
  { key: 'champ', label: '英雄图鉴' },
  { key: 'history', label: '对局记录' },
  { key: 'builder', label: '自定义路线' },
  { key: 'aug', label: '海克斯图鉴' },
  { key: 'patch', label: '战术更新' },
  { key: 'settings', label: '设置' },
].filter((item) => CUSTOM_ROUTES_ENABLED || item.key !== 'builder') as { key: Tab; label: string }[]

function NavIcon({ k }: { k: Tab }) {
  const p = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  }
  const main = 'var(--nav-icon-main)'
  const soft = 'var(--nav-icon-soft)'
  if (k === 'dash')
    return (
      <svg {...p}>
        <rect x="5" y="5" width="5" height="5" rx="1.2" fill={soft} />
        <rect x="14" y="5" width="5" height="5" rx="1.2" fill={main} />
        <rect x="5" y="14" width="5" height="5" rx="1.2" fill={main} />
        <rect x="14" y="14" width="5" height="5" rx="1.2" fill={main} opacity="0.62" />
      </svg>
    )
  if (k === 'champ')
    return (
      <svg {...p}>
        <path d="M12 4 18.8 7.8v8.4L12 20 5.2 16.2V7.8z" fill="none" stroke={main} strokeWidth="2" strokeLinejoin="round" />
        <path d="M8.8 9.2h6.4v2.7L12 14.5l-3.2-2.6z" fill={main} />
        <circle cx="12" cy="17" r="1.35" fill={soft} />
      </svg>
    )
  if (k === 'history')
    return (
      <svg {...p}>
        <rect x="6" y="5" width="12" height="14" rx="2" fill="none" stroke={main} strokeWidth="2" />
        <rect x="8.5" y="8" width="3.6" height="3.6" rx="0.9" fill={main} />
        <path d="M13.7 9.2h2" stroke={main} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="14.7" cy="15.3" r="1.3" fill={soft} />
      </svg>
    )
  if (k === 'tier')
    return (
      <svg {...p}>
        <path d="M7.4 5.3h9.2v4.8a4.6 4.6 0 0 1-9.2 0z" fill="none" stroke={main} strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 14.8v3.2M9 19h6" stroke={main} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="9" r="1.3" fill={soft} />
      </svg>
    )
  if (k === 'builder')
    return (
      <svg {...p}>
        <path d="M7 8h10M7 16h10M12 8v8" stroke={main} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4.8" y="5.8" width="4.4" height="4.4" rx="1.3" fill={soft} />
        <rect x="14.8" y="5.8" width="4.4" height="4.4" rx="1.3" fill={main} />
        <rect x="4.8" y="13.8" width="4.4" height="4.4" rx="1.3" fill={main} />
        <rect x="14.8" y="13.8" width="4.4" height="4.4" rx="1.3" fill={main} />
      </svg>
    )
  if (k === 'aug')
    return (
      <svg {...p}>
        <path d="M12 4.5 19.5 12 12 19.5 4.5 12z" fill="none" stroke={main} strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 8.4 14.1 12 12 15.6 9.9 12z" fill={main} />
        <circle cx="12" cy="12" r="1.4" fill={soft} />
      </svg>
    )
  if (k === 'patch')
    return (
      <svg {...p}>
        <path d="M7 4.5h6.8L18 8.7v10.8H7z" fill="none" stroke={main} strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 4.8V9h4" fill="none" stroke={soft} strokeWidth="2" strokeLinejoin="round" />
        <path d="M9.6 13.7h5.2" stroke={main} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  if (k === 'settings')
    return (
      <svg {...p}>
        <path d="M5 7h14M5 12h14M5 17h14" stroke={main} strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
        <circle cx="9" cy="7" r="2.05" fill={main} />
        <circle cx="15.2" cy="12" r="2.05" fill={soft} />
        <circle cx="11.2" cy="17" r="2.05" fill={main} />
      </svg>
    )
  return (
    <svg {...p}>
      <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8z" fill={main} />
    </svg>
  )
}

export default function App() {
  const [core, setCore] = useState<Core | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dash')
  const [champId, setChampId] = useState<number | null>(null)
  const [lcuStatus, setLcuStatus] = useState<LcuStatus | null>(null)
  const [activeChampionId, setActiveChampionId] = useState<number | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryResult | null>(null)
  const [summoner, setSummoner] = useState<SummonerInfo | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [matchDetailId, setMatchDetailId] = useState<number | null>(null) // 查看的是"近期对局"里某一局的真实出装/海克斯
  const [settings, setSettings] = useState<Settings | null>(null)
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode | null>(null)
  const [previewLanguage] = useState<Lang>(() => {
    if (typeof window === 'undefined' || isElectron()) return 'zh'
    return window.localStorage.getItem('mayhempedia.previewLanguage') === 'en' ? 'en' : 'zh'
  })
  const [customRoutes, setCustomRoutes] = useState<CustomRoute[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(window.localStorage.getItem('mayhempedia.customRoutes') ?? '[]') as CustomRoute[]
    } catch {
      return []
    }
  })
  // 主页板块显隐开关；未拿到设置(浏览器预览/还没读到)前默认全部显示，不让空指针挡住主页
  const [dashboardSections, setDashboardSections] = useState<DashboardSections | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)
  const mainScrollTimer = useRef<number | null>(null)

  useEffect(() => {
    loadCore(settings?.language ?? previewLanguage).then(setCore).catch((e) => setErr(String(e)))
  }, [previewLanguage, settings?.language])

  // 只在真正的 Electron 窗口里生效；浏览器预览下 window.mayhem 不存在，安全跳过。
  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.onLcuStatus(setLcuStatus)
    window.mayhem!.onChampSelect((s) => {
      if (!s.myChampionId) return
      // Champion detection is the primary job: leave library views and open
      // the current champion's Combat File immediately.
      setActiveChampionId(s.myChampionId)
      setMatchDetailId(null)
      setTab('champ')
      setChampId(s.myChampionId)
    })
    window.mayhem!.onSummoner(setSummoner)
    window.mayhem!.onNotification((n) => {
      setNotice(n)
      window.setTimeout(() => setNotice((current) => (current?.id === n.id ? null : current)), 4200)
    })
    window.mayhem!.onMatchHistory((mh) => {
      console.log(
        '[Mayhempedia] 收到对局记录:',
        mh.matches.length,
        '场 · 段位',
        mh.arp.rankName,
        '· 成就',
        mh.achievements.map((a) => a.name),
      )
      setMatchHistory(mh)
    })
    window.mayhem!.getSettings().then((s) => {
      setSettings(s)
      setCustomRoutes(s.customRoutes ?? [])
      setDashboardSections(s.dashboardSections)
    })
    window.mayhem!.onSettingsChanged((s) => {
      setSettings(s)
      setCustomRoutes(s.customRoutes ?? [])
      setDashboardSections(s.dashboardSections)
    })
  }, [])

  async function setArchetypePreference(championId: number, archetypeKey: string) {
    const baseSettings = settings ?? (isElectron() ? await window.mayhem!.getSettings() : null)
    const next = { ...(baseSettings?.selectedArchetypeByChampionId ?? {}), [String(championId)]: archetypeKey }
    setSettings((current) => (current ? { ...current, selectedArchetypeByChampionId: next } : baseSettings))
    if (!isElectron()) return
    const updated = await window.mayhem!.setSetting('selectedArchetypeByChampionId', next)
    setSettings(updated)
    setDashboardSections(updated.dashboardSections)
  }

  async function saveCustomRoutes(routes: CustomRoute[]) {
    setCustomRoutes(routes)
    if (!isElectron()) {
      window.localStorage.setItem('mayhempedia.customRoutes', JSON.stringify(routes))
      return
    }
    const updated = await window.mayhem!.setSetting('customRoutes', routes)
    setSettings(updated)
  }

  async function saveMatchPlayerRoute(route: CustomRoute) {
    const next = [...customRoutes.filter((existing) => existing.id !== route.id), route]
    window.localStorage.setItem(CUSTOM_ROUTE_SUBPAGE_STORAGE_KEY, 'library')
    window.localStorage.setItem(CUSTOM_ROUTE_LIBRARY_SELECTION_STORAGE_KEY, route.id)
    await saveCustomRoutes(next)
    await setArchetypePreference(route.championId, customRouteKey(route.id))
    setChampId(null)
    setMatchDetailId(null)
    setTab('builder')
  }

  const detectedChamp =
    core && activeChampionId ? core.champions.find((c) => c.id === activeChampionId) : null
  const visibleCustomRoutes = CUSTOM_ROUTES_ENABLED ? customRoutes : EMPTY_CUSTOM_ROUTES
  const detectedHasBuild = !!(
    detectedChamp &&
    (core?.buildIndex[detectedChamp.id] || visibleCustomRoutes.some((route) => route.championId === detectedChamp.id))
  )
  const appLang: Lang = settings?.language ?? previewLanguage
  const appZoom = settings?.zoomFactor ?? 1
  const previewMatchHistory = useMemo(
    () => (core && !isElectron() && !matchHistory ? createPreviewMatchHistory(core) : matchHistory),
    [core, matchHistory],
  )

  useEffect(() => {
    if (!detectedChamp) return
    setMatchDetailId(null)
    setChampId(detectedChamp.id)
  }, [detectedChamp?.id])

  useEffect(() => {
    if (!isElectron() || !settings || feedbackMode || tab !== 'dash' || activeChampionId) return
    const feedback = settings.feedback
    const matchCount = matchHistory?.matches.length ?? 0
    const lastPrompted = feedback.lastPromptedAt ? Date.parse(feedback.lastPromptedAt) : 0
    const canAskAgain = feedback.state === 'unasked' || (feedback.state === 'later' && Date.now() - lastPrompted > 7 * 24 * 60 * 60 * 1000)
    if (!canAskAgain || matchCount < 3) return
    const timer = window.setTimeout(() => setFeedbackMode('feedback'), 1100)
    return () => window.clearTimeout(timer)
  }, [activeChampionId, feedbackMode, matchHistory?.matches.length, settings, tab])

  async function saveFeedback(feedback: FeedbackSettings) {
    if (!isElectron()) return
    const updated = await window.mayhem!.setSetting('feedback', feedback)
    setSettings(updated)
  }

  async function submitFeedback(mode: FeedbackMode, rating: number, comment: string): Promise<boolean> {
    const opened = await window.mayhem!.openFeedback({ kind: mode, rating, comment })
    if (!opened) {
      setNotice({ text: appLang === 'en' ? 'Could not open the feedback form. Please try again.' : '暂时无法打开反馈表单，请稍后重试。', tone: 'warning' })
      return false
    }
    if (mode === 'feedback') {
      await saveFeedback({ state: 'completed', lastPromptedAt: new Date().toISOString(), rating })
    }
    setFeedbackMode(null)
    return true
  }

  useEffect(() => {
    return () => {
      if (mainScrollTimer.current != null) window.clearTimeout(mainScrollTimer.current)
    }
  }, [])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [tab, champId, matchDetailId])

  function handleMainScroll(event: { currentTarget: HTMLElement }) {
    const scroller = event.currentTarget
    scroller.classList.add('is-scrolling')
    if (mainScrollTimer.current != null) window.clearTimeout(mainScrollTimer.current)
    mainScrollTimer.current = window.setTimeout(() => scroller.classList.remove('is-scrolling'), 720)
  }

  return (
    <LangProvider value={settings?.language ?? previewLanguage}>
    <div className="fixed inset-0 overflow-hidden bg-ink">
    <div
      className="mayhem-scale-stage"
      style={{
        width: APP_BASE_WIDTH,
        height: APP_BASE_HEIGHT,
        transform: `scale(${appZoom})`,
      }}
    >
    <div data-lang={appLang} className="density-compact relative h-full w-full overflow-hidden rounded-none bg-ink text-cream shadow-[inset_0_1px_0_rgba(244,241,232,0.05)]">
      <WindowTitleBar />
      <div className="relative flex h-[calc(100%-36px)] min-h-0 min-w-0 overflow-hidden bg-ink">
      <div className="pointer-events-none absolute inset-0 bg-[#0a1018]" />
      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
      {feedbackMode && (
        <FeedbackPrompt
          mode={feedbackMode}
          lang={appLang}
          onLater={() => {
            void saveFeedback({ state: 'later', lastPromptedAt: new Date().toISOString(), rating: settings?.feedback.rating ?? null })
            setFeedbackMode(null)
          }}
          onDisable={() => {
            void saveFeedback({ state: 'disabled', lastPromptedAt: new Date().toISOString(), rating: settings?.feedback.rating ?? null })
            setFeedbackMode(null)
          }}
          onCancel={() => setFeedbackMode(null)}
          onSubmit={submitFeedback}
        />
      )}
      <Sidebar
        tab={tab}
        onTab={(t) => {
          setTab(t)
          setChampId(null)
          setMatchDetailId(null)
        }}
        lcuStatus={lcuStatus}
      />
      <main
        ref={mainRef}
        onScroll={handleMainScroll}
        className="scrollbar-auto-hide relative z-10 h-full flex-1 min-w-0 overflow-y-auto px-7 py-6 pb-16"
      >
        {detectedChamp && champId !== detectedChamp.id && (
          <button
            onClick={() => {
              setMatchDetailId(null)
              setChampId(detectedChamp.id)
            }}
            className="group w-full mb-5 flex items-center gap-3 px-4 py-3 rounded-[8px] bg-[#101a28]/88 border border-hex/30 text-left cursor-pointer hover:border-hex/65 hover:-translate-y-0.5 transition shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
          >
            <img
              src={icon(detectedChamp.iconLocal)}
              alt={detectedChamp.name}
              className="w-10 h-10 rounded-lg border border-hex/35"
            />
            <span className="text-sm">
              {t(appLang, 'app.detectedPrefix')} <b className="text-hex">{detectedChamp.name}</b>
              {detectedHasBuild ? t(appLang, 'app.hasBuild') : t(appLang, 'app.noBuild')}
            </span>
          </button>
        )}
        {err && <div className="p-16 text-center text-red">{t(appLang, 'app.loadFailed', { err })}</div>}
        {!err && !core && <div className="p-16 text-center text-dim">{t(appLang, 'app.loadingData')}</div>}
        {core && matchDetailId != null && (
          <MatchDetail
            core={core}
            match={previewMatchHistory?.matches.find((m) => m.gameId === matchDetailId) ?? null}
            onBack={() => setMatchDetailId(null)}
            onSavePlayerRoute={saveMatchPlayerRoute}
          />
        )}
        {core && matchDetailId == null && champId != null && (
          <Detail
            core={core}
            championId={champId}
            onBack={() => setChampId(null)}
            onPick={setChampId}
            selectedArchetypeKey={settings?.selectedArchetypeByChampionId[String(champId)]}
            onArchetypePreference={setArchetypePreference}
            customRoutes={visibleCustomRoutes}
          />
        )}
        {core && matchDetailId == null && champId == null && tab === 'dash' && (
          <Dashboard
            core={core}
            onPick={setChampId}
            onPickMatch={setMatchDetailId}
            matchHistory={previewMatchHistory}
            summoner={summoner}
            onOpenPatchNotes={() => setTab('patch')}
            onGoChamp={() => setTab('champ')}
            onGoTier={() => setTab('champ')}
            onGoHistory={() => setTab('history')}
            onGoBuilder={() => setTab('builder')}
            onGoAug={() => setTab('aug')}
            sections={dashboardSections}
            lcuStatus={lcuStatus}
            detectedChamp={detectedChamp}
            detectedHasBuild={detectedHasBuild}
            selectedArchetypeByChampionId={settings?.selectedArchetypeByChampionId ?? {}}
            customRoutes={visibleCustomRoutes}
          />
        )}
        {core && matchDetailId == null && champId == null && tab === 'champ' && (
          <ChampionGrid
            core={core}
            onPick={setChampId}
            detectedChamp={detectedChamp}
            detectedHasBuild={detectedHasBuild}
          />
        )}
        {core && matchDetailId == null && champId == null && tab === 'history' && (
          <MatchHistoryTab
            core={core}
            matchHistory={previewMatchHistory}
            onPickMatch={setMatchDetailId}
          />
        )}
        {CUSTOM_ROUTES_ENABLED && core && matchDetailId == null && champId == null && tab === 'builder' && (
          <CustomRouteBuilder
            core={core}
            routes={customRoutes}
            onChange={saveCustomRoutes}
            onActivate={setArchetypePreference}
            onOpenHistory={() => setTab('history')}
            onOpenChampion={(id) => {
              setChampId(id)
              setMatchDetailId(null)
            }}
          />
        )}
        {core && matchDetailId == null && champId == null && tab === 'aug' && <AugmentBrowser core={core} />}
        {core && matchDetailId == null && champId == null && tab === 'patch' && (
          <PatchNotesTab core={core} onPick={setChampId} />
        )}
        {core && matchDetailId == null && champId == null && tab === 'settings' && (
          <SettingsTab summoner={summoner} onOpenFeedback={() => setFeedbackMode('feedback')} onReportProblem={() => setFeedbackMode('problem')} />
        )}
      </main>
      </div>
    </div>
    </div>
    </div>
    </LangProvider>
  )
}

function createPreviewMatchHistory(core: Core): MatchHistoryResult {
  const tierIds = core.heroTier.map((entry) => entry.id)
  const championIds = [...tierIds, ...core.champions.map((champion) => champion.id)]
    .filter((id, index, array) => array.indexOf(id) === index)
    .slice(0, 24)
  const now = Date.now()
  const matches: MatchSummary[] = Array.from({ length: 20 }, (_, index) => {
    const championId = championIds[index % Math.max(1, championIds.length)] ?? core.champions[index % core.champions.length]?.id ?? 1
    const win = index % 3 !== 1
    return {
      gameId: 900000 + index,
      championId,
      win,
      kills: 5 + ((index * 4) % 18),
      deaths: 3 + ((index * 2) % 12),
      assists: 12 + ((index * 5) % 28),
      impactPercentile: Math.min(96, 38 + ((index * 13) % 59)),
      gameCreationDate: new Date(now - index * 46 * 60 * 1000).toISOString(),
    }
  })
  return {
    matches,
    arp: {
      score: 78,
      winRateScore: 74,
      impactScore: 82,
      stateScore: 77,
      wins: matches.filter((match) => match.win).length,
      losses: matches.filter((match) => !match.win).length,
      winRatePct: Math.round((matches.filter((match) => match.win).length / Math.max(1, matches.length)) * 100),
      rankName: 'Demo Scout',
    },
    achievements: [],
  }
}

function createPreviewMatchDetail(core: Core, match: MatchSummary): MatchFullDetail {
  const championPool = [...core.heroTier.map((entry) => entry.id), ...core.champions.map((champion) => champion.id)]
    .filter((id, index, array) => array.indexOf(id) === index)
  const championIndex = Math.max(0, championPool.indexOf(match.championId))
  const itemIds = [...core.itemById.keys()]
  const augmentIds = core.augments.map((augment) => augment.id)
  const pickIds = (ids: number[], start: number, count: number) =>
    Array.from({ length: count }, (_, index) => ids[(start + index * 3) % Math.max(1, ids.length)]).filter((id): id is number => typeof id === 'number')

  const players: PlayerMatchStats[] = Array.from({ length: 10 }, (_, index) => {
    const ally = index < 5
    const base = index + (match.gameId % 11)
    const championId = index === 0 ? match.championId : championPool[(championIndex + index * 3) % Math.max(1, championPool.length)] ?? match.championId
    return {
      participantId: index + 1,
      championId,
      summonerName: ['MayhemPilot', 'RiverWard', 'HexSmith', 'SnowballLab', 'ForgeTheory', 'PoroScout', 'ARAMChef', 'SideQuestor', 'QuietCarry', 'DataMiner'][index] ?? `Player ${index + 1}`,
      isMe: index === 0,
      team: ally ? 'ally' : 'enemy',
      win: ally ? match.win : !match.win,
      kills: index === 0 ? match.kills : 3 + ((base * 5) % 22),
      deaths: index === 0 ? match.deaths : 2 + ((base * 3) % 13),
      assists: index === 0 ? match.assists : 8 + ((base * 7) % 31),
      champLevel: 18,
      goldEarned: 12800 + base * 427,
      totalDamageDealtToChampions: 14500 + base * 1380,
      totalDamageTaken: 18500 + base * 960,
      totalHeal: 1200 + base * 280,
      totalMinionsKilled: 22 + ((base * 4) % 47),
      visionScore: 0,
      items: pickIds(itemIds, base * 5, 6),
      augments: pickIds(augmentIds, base * 7, 4),
    }
  })

  const goldGraph = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8
    const swing = Math.sin(t * Math.PI * 1.4 + (match.win ? 0.4 : 2.2)) * 2400
    const allyLead = (match.win ? 1 : -1) * t * 4600 + swing
    const total = 19000 + index * 7600
    return {
      timestampMs: index * 180000,
      allyGold: Math.round(total / 2 + allyLead / 2),
      enemyGold: Math.round(total / 2 - allyLead / 2),
    }
  })

  return {
    gameId: match.gameId,
    gameDurationSec: 1488,
    win: match.win,
    players,
    goldGraph,
  }
}

const LCU_BADGE: Record<LcuStatus['state'], { labelKey: string; dot: string }> = {
  connecting: { labelKey: 'lcu.connecting', dot: 'bg-hex animate-pulse' },
  reconnecting: { labelKey: 'lcu.reconnecting', dot: 'bg-gold animate-pulse' },
  connected: { labelKey: 'lcu.connected', dot: 'bg-hex' },
  error: { labelKey: 'lcu.error', dot: 'bg-red' },
}

const DEFAULT_LCU_BADGE = LCU_BADGE.connecting

/* ---------------- 左侧栏 ---------------- */
const NOTICE_TONE: Record<AppNotice['tone'], { border: string; dot: string }> = {
  success: { border: 'border-[#63c07a]/70', dot: 'bg-[#63c07a]' },
  warning: { border: 'border-gold/70', dot: 'bg-gold' },
  info: { border: 'border-[#57c3e8]/70', dot: 'bg-[#57c3e8]' },
}

function NoticeToast({ notice, onClose }: { notice: AppNotice; onClose: () => void }) {
  const tone = NOTICE_TONE[notice.tone]
  return (
    <div className="fixed right-5 top-14 z-50 max-w-[360px]">
      <div
        className={
          'bg-panel/95 border rounded-[8px] shadow-[0_18px_52px_rgba(0,0,0,0.42),0_0_36px_rgba(41,211,255,0.08)] backdrop-blur-xl p-4 ' +
          tone.border
        }
      >
        <div className="flex items-start gap-3">
          <span className={'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ' + tone.dot} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-cream">{notice.title}</div>
            <div className="text-xs text-dim mt-1 leading-relaxed">{notice.body}</div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-cream text-sm leading-none cursor-pointer">
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

function FeedbackPrompt({
  mode,
  lang,
  onLater,
  onDisable,
  onCancel,
  onSubmit,
}: {
  mode: FeedbackMode
  lang: Lang
  onLater: () => void
  onDisable: () => void
  onCancel: () => void
  onSubmit: (mode: FeedbackMode, rating: number, comment: string) => Promise<boolean>
}) {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isEn = lang === 'en'
  const isProblem = mode === 'problem'

  async function submit() {
    if (submitting || (!isProblem && !rating) || (isProblem && !comment.trim())) return
    setSubmitting(true)
    const opened = await onSubmit(mode, rating ?? 0, comment)
    if (!opened) setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#03070c]/58 px-5 backdrop-blur-[2px]">
      <section className="w-full max-w-[470px] rounded-[8px] border border-line/80 bg-[#0b1420] p-5 shadow-[0_24px_72px_rgba(0,0,0,0.5)]">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">Mayhempedia Beta</div>
        <h2 className="mt-1 text-[19px] font-black text-cream">
          {isProblem ? (isEn ? 'Report a problem' : '报告问题') : (isEn ? 'Did Mayhempedia help this game?' : 'Mayhempedia 这局有帮到你吗？')}
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-dim">
          {isProblem
            ? (isEn
              ? 'Describe what you saw, what you expected, and where it happened. You review everything here before choosing to open the report form.'
              : '描述你看到的问题、你的预期，以及发生在哪个页面。你会先在这里写完，再决定是否打开外部提交页。')
            : (isEn
            ? 'A quick rating helps us decide what to fix next. Your note is only sent after you choose to continue to the feedback form.'
            : '一个简单评分就能帮助我们决定下一步修什么。只有你点击继续到反馈表单后，评论才会离开应用。')}
        </p>

        {!isProblem && <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label={isEn ? 'Rate Mayhempedia from 1 to 5' : '为 Mayhempedia 评分，1 到 5 分'}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={
                'h-10 rounded-[6px] border text-sm font-black transition ' +
                (rating === value
                  ? 'border-hex bg-hex text-[#041017]'
                  : 'border-line/70 bg-panel2/65 text-dim hover:border-hex/45 hover:text-cream')
              }
              aria-pressed={rating === value}
            >
              {value}
            </button>
          ))}
        </div>}

        <label className="mt-4 block">
          <span className="text-[11px] font-bold text-cream">{isProblem ? (isEn ? 'What happened?' : '发生了什么？') : (isEn ? 'Anything we should fix or keep?' : '有什么该修，或值得保留？')}</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 700))}
            maxLength={700}
            placeholder={isProblem ? (isEn ? 'What you were doing, what went wrong, and what you expected.' : '你当时在做什么、哪里不对、预期应该是什么。') : (isEn ? 'Optional. A sentence is enough.' : '选填，一句话就够。')}
            className="mt-2 min-h-24 w-full resize-none rounded-[6px] border border-line/70 bg-[#07101b]/70 px-3 py-2 text-[12px] leading-5 text-cream outline-none transition placeholder:text-dim/60 focus:border-hex/65"
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          {isProblem ? <button type="button" onClick={onCancel} className="text-[11px] font-bold text-dim transition hover:text-cream">{isEn ? 'Cancel' : '取消'}</button> : <button type="button" onClick={onDisable} className="text-[11px] font-bold text-dim transition hover:text-cream">{isEn ? "Don't ask again" : '不再提示'}</button>}
          <div className="flex items-center gap-2">
            {!isProblem && <button type="button" onClick={onLater} className={BTN_SECONDARY}>{isEn ? 'Later' : '以后再说'}</button>}
            <button type="button" disabled={(!isProblem && !rating) || (isProblem && !comment.trim()) || submitting} onClick={() => void submit()} className={BTN_PRIMARY + ' disabled:cursor-not-allowed disabled:opacity-45'}>
              {submitting ? (isEn ? 'Opening...' : '正在打开...') : (isProblem ? (isEn ? 'Continue to report' : '继续提交问题') : (isEn ? 'Continue to feedback' : '继续到反馈表单'))}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-cream">Mayhem</span><span className="text-hex">pedia</span>
    </span>
  )
}

function WindowTitleBar() {
  return (
    <header className="window-drag-region relative z-50 flex h-9 shrink-0 items-center justify-between border-b border-line/55 bg-[#0a111c] px-3">
      <div className="flex items-center gap-2 text-[12px] font-extrabold tracking-tight text-cream">
        <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-[#0b1320] shadow-[inset_0_1px_0_rgba(244,241,232,0.08)]">
          <img src="/assets/brand/mayhempedia-icon.svg" alt="" className="h-4 w-4 rounded-[3px]" />
        </span>
        <BrandWordmark />
        <span className="h-1.5 w-1.5 rounded-full bg-hex" />
      </div>
      <WindowControls />
    </header>
  )
}

function WindowControls() {
  const run = (action: 'minimize' | 'close') => {
    if (!isElectron()) return
    if (action === 'minimize') void window.mayhem!.minimizeWindow()
    if (action === 'close') void window.mayhem!.closeWindow()
  }

  return (
    <div className="window-controls window-no-drag flex h-full items-stretch -mr-3">
      <WindowButton label="Minimize" onClick={() => run('minimize')}>
        <path d="M7 12h10" />
      </WindowButton>
      <WindowButton label="Close" danger onClick={() => run('close')}>
        <path d="M8 8l8 8" />
        <path d="M16 8l-8 8" />
      </WindowButton>
    </div>
  )
}

function WindowButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        'window-no-drag grid h-full w-11 place-items-center text-dim transition active:translate-y-px ' +
        (danger
          ? 'hover:bg-[#d95b5b] hover:text-white'
          : 'hover:bg-hex/10 hover:text-cream')
      }
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  )
}

function Sidebar({
  tab,
  onTab,
  lcuStatus,
}: {
  tab: Tab
  onTab: (t: Tab) => void
  lcuStatus: LcuStatus | null
}) {
  const t = useT()
  const lcuBadge = lcuStatus ? LCU_BADGE[lcuStatus.state] : DEFAULT_LCU_BADGE
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('mayhempedia.sidebarExpanded') === '1'
  })
  const [visualExpanded, setVisualExpanded] = useState(expanded)

  useEffect(() => {
    if (expanded) {
      setVisualExpanded(true)
      return
    }
    const timer = window.setTimeout(() => setVisualExpanded(false), 160)
    return () => window.clearTimeout(timer)
  }, [expanded])

  useEffect(() => {
    window.localStorage.setItem('mayhempedia.sidebarExpanded', expanded ? '1' : '0')
  }, [expanded])

  const open = visualExpanded
  const labelsVisible = expanded && visualExpanded
  const toggleSidebar = () => {
    if (!expanded) setVisualExpanded(true)
    setExpanded((value) => !value)
  }

  const expandLabel = expanded ? t('nav.collapse', '收起菜单') : t('nav.expand', '展开菜单')

  return (
    <aside
      className={
        'relative z-40 shrink-0 border-r border-line/55 bg-panel py-3 sticky top-0 h-full flex flex-col shadow-[10px_0_24px_rgba(0,0,0,0.14)] transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
        (open ? 'w-[208px] px-3' : 'w-[72px] px-2')
      }
    >
      <div className={'mb-4 border-b border-line/35 pb-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ' + (open ? 'flex items-center gap-2' : 'flex flex-col items-center')}>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-[10px]">
          <img src="/assets/brand/mayhempedia-icon.svg" alt="" className="h-10 w-10 rounded-[10px]" />
        </div>
        {open && (
          <div className={'min-w-0 flex-1 transition duration-150 ease-out ' + (labelsVisible ? 'translate-x-0 opacity-100 delay-75' : '-translate-x-1 opacity-0')}>
            <BrandWordmark className="block truncate text-[13px] font-black leading-tight" />
            <div className="mt-0.5 truncate text-[9px] font-black tracking-[0.16em] text-hex">ARAM DESK</div>
          </div>
        )}
      </div>
      <nav className={open ? 'flex flex-col gap-1.5' : 'flex flex-col items-center gap-2'}>
        {NAV.map((n) => {
          const on = tab === n.key
          const label = t(`nav.${n.key}`, n.label)
          return (
            <button
              key={n.key}
              title={label}
              aria-label={label}
              onClick={() => onTab(n.key)}
              className={
                'group relative border border-transparent text-left cursor-pointer transition duration-200 ease-out ' +
                (open
                  ? 'flex h-[38px] w-full items-center gap-2.5 rounded-[8px] px-2.5'
                  : 'grid h-[42px] w-[42px] place-items-center rounded-[8px]') +
                ' ' +
                (on
                  ? 'bg-panel2/82 text-cream [--nav-icon-main:#fff9ec] [--nav-icon-soft:#39e6f2] shadow-[0_8px_18px_rgba(0,0,0,0.12)]'
                  : 'text-cream [--nav-icon-main:#fff9ec] [--nav-icon-soft:#39e6f2] hover:bg-panel2 hover:text-cream')
              }
            >
              {on && (
                <span
                  className={
                    open
                      ? 'absolute bottom-[5px] left-[21px] h-0.5 w-3.5 -translate-x-1/2 rounded-full bg-hex/75'
                      : 'absolute bottom-[5px] left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full bg-hex/75'
                  }
                />
              )}
              <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                <NavIcon k={n.key} />
              </span>
              {open && (
                <span
                  className={
                    'truncate text-[12px] transition duration-150 ease-out ' +
                    (labelsVisible ? 'translate-x-0 opacity-100 delay-75 ' : '-translate-x-1 opacity-0 ') +
                    (on ? 'font-black text-cream' : 'font-semibold text-cream/68')
                  }
                >
                  {label}
                </span>
              )}
              {!open && (
                <span className="pointer-events-none absolute left-[54px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded border border-line/55 bg-[#0d1723] px-2 py-1 text-[10px] font-bold text-cream/95 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:opacity-100">
                  {label}
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <div className={open ? 'mt-auto flex flex-col gap-2' : 'mt-auto flex flex-col items-center gap-2'}>
        <button
          type="button"
          title={expandLabel}
          aria-label={expandLabel}
          aria-expanded={expanded}
          onClick={toggleSidebar}
          className={
            'group relative border border-transparent text-left cursor-pointer transition duration-200 ease-out [--nav-icon-main:#fff9ec] [--nav-icon-soft:#39e6f2] hover:bg-panel2 hover:text-cream ' +
            (open
              ? 'flex h-[38px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-cream'
              : 'grid h-[42px] w-[42px] place-items-center rounded-[8px] text-cream')
          }
        >
          <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--nav-icon-main)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={open ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
              <path d="M5 5v14" stroke="var(--nav-icon-soft)" />
            </svg>
          </span>
          {open && <span className={'truncate text-[12px] font-semibold text-cream/68 transition duration-150 ease-out ' + (labelsVisible ? 'translate-x-0 opacity-100 delay-75' : '-translate-x-1 opacity-0')}>{expandLabel}</span>}
          {!open && (
            <span className="pointer-events-none absolute left-[54px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded border border-line/55 bg-[#0d1723] px-2 py-1 text-[10px] font-bold text-cream/95 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:opacity-100">
              {expandLabel}
            </span>
          )}
        </button>
        <div className="mb-1 h-px w-8 self-center bg-line/40" />
      </div>
      <div
        className={
          'glass-control rounded-[8px] border border-line/55 px-2 py-2 text-xs text-dim ' +
          (open ? 'flex items-center gap-2' : '')
        }
        title={t(lcuBadge.labelKey)}
      >
        <div className="flex shrink-0 items-center justify-center">
          <span className={'h-2.5 w-2.5 rounded-full shrink-0 ' + lcuBadge.dot} />
        </div>
        <div className={(open ? 'mt-0 min-w-0 text-left' : 'mt-1 text-center') + ' text-[9px] font-black text-dim/70'}>
          {open ? (
            <div className={'transition duration-150 ease-out ' + (labelsVisible ? 'translate-x-0 opacity-100 delay-75' : '-translate-x-1 opacity-0')}>
              <div className="text-[9px] leading-tight text-dim/80">LCU</div>
              <div className="truncate text-[10px] leading-tight text-cream/72">{t(lcuBadge.labelKey)}</div>
            </div>
          ) : (
            'LCU'
          )}
        </div>
      </div>
    </aside>
  )
}

/* ================= 主页 Dashboard ================= */
// 版本变动 + 身份卡/近期对局 现在都是真数据了：
//   版本变动 ← Riot 官方 wiki Module:ChampionData/data (scripts/fetch-aram-balance.mjs)
//   身份卡/近期对局 ← 本机 LCU 对局记录 (src/match-history.ts，只在真 Electron 窗口里有，浏览器预览显示"暂无数据")
// 成就仍是占位(任务3，需要更细的对局内数据，赛后数据能算的部分待做)。

function Dashboard({
  core,
  onPick,
  onPickMatch,
  matchHistory,
  summoner,
  onOpenPatchNotes,
  onGoChamp,
  onGoTier,
  onGoHistory,
  onGoBuilder,
  onGoAug,
  sections,
  lcuStatus,
  detectedChamp,
  detectedHasBuild,
  selectedArchetypeByChampionId,
  customRoutes,
}: {
  core: Core
  onPick: (id: number) => void
  onPickMatch: (gameId: number) => void
  matchHistory: MatchHistoryResult | null
  summoner: SummonerInfo | null
  onOpenPatchNotes: () => void
  onGoChamp: () => void
  onGoTier: () => void
  onGoHistory: () => void
  onGoBuilder: () => void
  onGoAug: () => void
  sections: DashboardSections | null
  lcuStatus: LcuStatus | null
  detectedChamp: Champion | null
  detectedHasBuild: boolean
  selectedArchetypeByChampionId: Record<string, string>
  customRoutes: CustomRoute[]
}) {
  void summoner
  void sections
  void selectedArchetypeByChampionId
  const t = useT()
  const champById = useMemo(() => new Map(core.champions.map((c) => [c.id, c])), [core])
  const lcuBadge = lcuStatus ? LCU_BADGE[lcuStatus.state] : DEFAULT_LCU_BADGE
  const recentMatches = matchHistory?.matches ?? null
  const coveredCount = Object.keys(core.buildIndex).length
  const tieredCount = core.heroTier.length
  const rarityCounts = RARITY_ORDER.map((rarity) => ({
    rarity,
    count: core.augments.filter((augment) => augment.rarity === rarity).length,
  }))
  const recentChampionIds = useMemo(() => {
    if (!recentMatches?.length) return []
    const stats = new Map<number, { count: number; firstSeen: number }>()
    recentMatches.forEach((match, index) => {
      const current = stats.get(match.championId) ?? { count: 0, firstSeen: index }
      stats.set(match.championId, { count: current.count + 1, firstSeen: Math.min(current.firstSeen, index) })
    })
    return [...stats.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].firstSeen - b[1].firstSeen)
      .map(([championId]) => championId)
  }, [recentMatches])
  const featuredChampionIds = [
    detectedChamp?.id,
    ...recentChampionIds,
    ...core.heroTier.filter((entry) => ['S', 'A'].includes(entry.tier)).map((entry) => entry.id),
  ].filter((id): id is number => typeof id === 'number')
  const featuredChampions = [...new Set(featuredChampionIds)]
    .map((id) => champById.get(id))
    .filter((champion): champion is Champion => !!champion)
    .slice(0, 12)
  const customPreview = [...customRoutes].slice(-4).reverse()
  const [officialDiscoveries, setOfficialDiscoveries] = useState<OfficialDiscovery[]>([])
  const officialDiscoveryKey = useMemo(
    () =>
      core.heroTier
        .filter((entry) => ['S', 'A', 'B'].includes(entry.tier) && core.buildIndex[entry.id])
        .slice(0, 4)
        .map((entry) => `${entry.id}:${core.buildIndex[entry.id]}`)
        .join('|'),
    [core.buildIndex, core.heroTier],
  )
  const lang = useLang()
  useEffect(() => {
    let cancelled = false
    const targets = core.heroTier
      .filter((entry) => ['S', 'A', 'B'].includes(entry.tier) && core.buildIndex[entry.id])
      .slice(0, 4)
    Promise.all(
      targets.map(async (entry) => {
        const champion = champById.get(entry.id)
        const file = core.buildIndex[entry.id]
        if (!champion || !file) return null
        try {
          const build = await loadBuild(file, lang)
          const archetype = build.archetypes[0]
          if (!archetype) return null
          return { champion, archetype, tier: entry.tier }
        } catch {
          return null
        }
      }),
    ).then((items) => {
      if (!cancelled) setOfficialDiscoveries(items.filter((item): item is OfficialDiscovery => !!item))
    })
    return () => {
      cancelled = true
    }
  }, [champById, core, officialDiscoveryKey, lang])
  const patch = core.patchNotes
  const [championQuery, setChampionQuery] = useState('')
  const [quickTier, setQuickTier] = useState<string>('all')
  const tierById = useMemo(() => new Map(core.heroTier.map((entry) => [entry.id, entry.tier])), [core.heroTier])
  const normalizedChampionQuery = championQuery.trim().toLocaleLowerCase()
  const championResults = useMemo(() => {
    const base = normalizedChampionQuery || quickTier !== 'all'
      ? core.champions.filter((champion) => {
          const alt = core.altChampionById.get(champion.id)
          return normalizedChampionQuery
            ? normalizedSearchText(champion.name, champion.title, champion.alias, champion.pinyin, champion.initials, alt?.name, alt?.title, alt?.alias, alt?.pinyin, alt?.initials).includes(normalizedChampionQuery)
            : true
        })
      : featuredChampions.length > 0
        ? featuredChampions
        : core.champions
    return base
      .filter((champion) => quickTier === 'all' || tierById.get(champion.id) === quickTier)
      .slice(0, normalizedChampionQuery ? 30 : 18)
  }, [core.altChampionById, core.champions, featuredChampions, normalizedChampionQuery, quickTier, tierById])
  const topChanges = core.aramBalance.slice(0, 6).map((entry) => champById.get(entry.id)).filter((champion): champion is Champion => !!champion)
  const title = lang === 'en' ? 'Command Center' : '作战大厅'
  const lcuReady = lcuStatus?.state === 'connected'
  const localMatchCount = recentMatches?.length ?? 0
  const localMatchSummary = `${localMatchCount} / 20`
  const heroHeadline = detectedChamp
    ? (lang === 'en' ? `${detectedChamp.name} Combat File` : `${detectedChamp.name} Combat File`)
    : title
  const heroDetail = detectedChamp
    ? (detectedHasBuild
        ? (lang === 'en' ? 'Route, augment priorities, and item order are ready.' : '路线、海克斯优先级、出装顺序已经准备好。')
        : (lang === 'en' ? 'This champion is detected, but still needs a usable route.' : '已经识别到英雄，但还缺一条可启用路线。'))
    : (lang === 'en'
        ? 'Waiting for League client and ARAM champion select.'
        : '等待客户端连接与大乱斗选人。')
  const primaryAction = detectedChamp ? () => onPick(detectedChamp.id) : onGoChamp
  const primaryActionLabel = detectedChamp
    ? (lang === 'en' ? 'Open Combat File' : '打开 Combat File')
    : (lang === 'en' ? 'Browse champions' : '浏览英雄图鉴')
  return (
    <>
      <section className="glass-panel-strong relative mb-3 overflow-hidden rounded-[8px] border p-3.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hex/45" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_360px] gap-3 max-[920px]:grid-cols-1">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">Mayhempedia</div>
            <h1 className="mt-1 text-[23px] font-black leading-tight text-cream">{heroHeadline}</h1>
            <p className="mt-1 max-w-[760px] text-[11px] leading-4 text-dim">{heroDetail}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={primaryAction} className={BTN_PRIMARY}>
                {primaryActionLabel}
              </button>
              <button type="button" onClick={onGoHistory} className={BTN_SECONDARY}>
                {lang === 'en' ? 'Review matches' : '查看对局记录'}
              </button>
              <button type="button" onClick={onGoBuilder} className="rounded-md px-2.5 py-1.5 text-[11px] font-black text-dim transition hover:bg-white/5 hover:text-cream active:translate-y-px">
                {lang === 'en' ? 'Route workshop' : '路线工作台'}
              </button>
            </div>
          </div>
          <div className="rounded-[7px] border border-line/60 bg-[#07101b]/50 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-line/45 pb-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">{lang === 'en' ? 'Live status' : '实时状态'}</div>
                <div className="mt-0.5 text-[14px] font-black text-cream">{title}</div>
              </div>
              <div className="flex items-center gap-1.5 rounded border border-line/55 bg-[#050a11]/36 px-2 py-1">
                <span className={'h-2 w-2 rounded-full ' + lcuBadge.dot} />
                <span className="text-[10px] font-extrabold text-dim">{t(lcuBadge.labelKey)}</span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <DashboardReadoutRow
                label={lang === 'en' ? 'Champion lock' : '英雄锁定'}
                value={detectedChamp?.name ?? (lang === 'en' ? 'Waiting' : '等待中')}
                tone={detectedChamp ? 'ready' : lcuReady ? 'active' : 'idle'}
              />
              <DashboardReadoutRow
                label={lang === 'en' ? 'Combat File' : '作战档案'}
                value={detectedHasBuild ? (lang === 'en' ? 'Ready' : '已就绪') : (lang === 'en' ? 'Needs route' : '缺路线')}
                tone={detectedHasBuild ? 'ready' : detectedChamp ? 'warning' : 'idle'}
              />
              <DashboardReadoutRow
                label={lang === 'en' ? 'Saved matches' : '已保存对局'}
                value={localMatchCount > 0 ? localMatchSummary : '0 / 20'}
                tone={localMatchCount > 0 ? 'active' : 'idle'}
              />
            </div>
          </div>
        </div>
      </section>

      <OfficialDiscoveryRoutes
        discoveries={officialDiscoveries}
        core={core}
        onPick={onPick}
        onOpenChampions={onGoChamp}
      />

      <div className="grid grid-cols-[minmax(0,1.38fr)_minmax(300px,.72fr)] gap-3 max-[980px]:grid-cols-1">
        <section className="glass-panel relative overflow-hidden rounded-[8px] border p-2.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-hex/35" />
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-line/50 pb-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">{lang === 'en' ? 'Champion library' : '英雄图鉴'}</div>
              <h2 className="mt-0.5 text-[15px] font-black text-cream">{coveredCount}/{core.champions.length} {lang === 'en' ? 'champions covered' : '英雄已有路线'}</h2>
            </div>
            <button type="button" onClick={onGoChamp} className={BTN_TINY_SECONDARY}>{lang === 'en' ? 'All' : '全部'}</button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-2 max-[760px]:grid-cols-1">
            <div className="min-w-0">
              <div className="flex gap-2">
                <input
                  value={championQuery}
                  onChange={(event) => setChampionQuery(event.target.value)}
                  placeholder={lang === 'en' ? 'Search champion, pinyin, initials...' : '搜索英雄、拼音或首字母...'}
                  className={SEARCH_INLINE + ' h-8 py-1.5'}
                />
                <button type="button" onClick={onGoTier} className={BTN_TINY_SECONDARY + ' h-8 shrink-0 py-0'}>{lang === 'en' ? 'Tier' : '强度'}</button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {['all', 'S', 'A', 'B', 'C', 'D'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setQuickTier(tier)}
                    className={
                      'rounded border px-1.5 py-0.5 text-[9px] font-black transition active:translate-y-px ' +
                      (quickTier === tier ? 'border-hex bg-hex text-[#041017]' : 'border-line/60 bg-panel2/45 text-dim hover:border-line hover:bg-panel2/70 hover:text-cream')
                    }
                  >
                    {tier === 'all' ? (lang === 'en' ? 'All' : '全部') : tier}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[6px] border border-line/55 bg-[#07101b]/46 p-1.5">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">{lang === 'en' ? 'Coverage' : '覆盖状态'}</div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <div className="text-[13px] font-black text-cream">{coveredCount}</div>
                <div className="text-[13px] font-black text-cream">{tieredCount}</div>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#050b12]">
                <div className="h-full rounded-full bg-hex" style={{ width: `${Math.min(100, Math.round((coveredCount / Math.max(1, core.champions.length)) * 100))}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">
                {championQuery
                  ? (lang === 'en' ? 'Search results' : '搜索结果')
                  : quickTier !== 'all'
                    ? `${quickTier} ${lang === 'en' ? 'tier champions' : '级英雄'}`
                    : recentChampionIds.length > 0
                      ? (lang === 'en' ? 'Recently played' : '最近常用')
                      : (lang === 'en' ? 'Priority champions' : '优先入口')}
              </div>
              <div className="text-[10px] font-black tabular-nums text-dim">{championResults.length}</div>
            </div>
            <div className="grid grid-cols-12 gap-1 max-[1120px]:grid-cols-8 max-[760px]:grid-cols-6">
              {championResults.slice(0, 12).map((champion) => {
                const tier = tierById.get(champion.id)
                return (
                  <button key={champion.id} type="button" onClick={() => onPick(champion.id)} className="group min-w-0 rounded-[5px] border border-line/50 bg-[#07101b]/48 p-1 text-center transition hover:border-hex/40 hover:bg-white/5 active:translate-y-px">
                    <span className="relative mx-auto block h-7 w-7">
                      <img src={icon(champion.iconLocal)} alt={champion.name} className="h-7 w-7 rounded border border-line/70 object-cover group-hover:border-hex/45" />
                      {tier && <span className="absolute -right-1 -top-1 rounded border border-panel bg-hex px-1 text-[8px] font-black leading-3 text-[#041017]">{tier}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="grid gap-3">
          <section className="glass-panel relative overflow-hidden rounded-[8px] border p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-line/45 pb-2">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">{lang === 'en' ? 'Recent history' : '最近对局'}</div>
                <div className="mt-0.5 text-[15px] font-black text-cream">
                  {localMatchCount > 0
                    ? (lang === 'en' ? `${localMatchSummary} saved games` : `已保存 ${localMatchSummary} 场`)
                    : (lang === 'en' ? 'No games yet' : '还没有对局')}
                </div>
              </div>
              <button type="button" onClick={onGoHistory} className={BTN_TINY_SECONDARY}>
                {lang === 'en' ? 'All' : '全部'}
              </button>
            </div>
            <div className="grid gap-1.5">
              {(recentMatches ?? []).slice(0, 3).map((match) => {
                const champion = champById.get(match.championId)
                return (
                  <button
                    key={match.gameId}
                    type="button"
                    onClick={() => onPickMatch(match.gameId)}
                    className="group grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] border border-line/45 bg-[#07101b]/38 px-2 py-1.5 text-left transition hover:border-hex/35 hover:bg-panel2/45 active:translate-y-px"
                  >
                    {champion ? (
                      <img src={icon(champion.iconLocal)} alt={champion.name} className="h-7 w-7 rounded border border-line/65 object-cover group-hover:border-hex/45" />
                    ) : (
                      <span className="h-7 w-7 rounded border border-line/65 bg-panel/60" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-black text-cream">{champion?.name ?? `#${match.championId}`}</span>
                      <span className="block text-[9px] font-bold tabular-nums text-dim">{match.kills}/{match.deaths}/{match.assists} · P{match.impactPercentile}</span>
                    </span>
                    <span className={'rounded border px-1.5 py-0.5 text-[9px] font-black ' + (match.win ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8fd69d]' : 'border-red/35 bg-red/10 text-red')}>
                      {match.win ? (lang === 'en' ? 'W' : '胜') : (lang === 'en' ? 'L' : '负')}
                    </span>
                  </button>
                )
              })}
              {(!recentMatches || recentMatches.length === 0) && (
                <EmptyState
                  compact
                  title={lang === 'en' ? 'No local match history' : '暂无本地对局'}
                  description={lang === 'en' ? 'Recent ARAM Mayhem games will appear here.' : '最近的海克斯大乱斗对局会显示在这里。'}
                />
              )}
            </div>
          </section>

          <section className="glass-panel relative overflow-hidden rounded-[8px] border p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onGoBuilder} className="rounded-[6px] border border-line/55 bg-[#07101b]/44 p-2 text-left transition hover:border-hex/35">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-dim">{lang === 'en' ? 'Routes' : '自定义路线'}</div>
                <div className="mt-1 text-[15px] font-black text-cream">{customRoutes.length}</div>
              </button>
              <button type="button" onClick={onGoAug} className="rounded-[6px] border border-line/55 bg-[#07101b]/44 p-2 text-left transition hover:border-hex/35">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-dim">{lang === 'en' ? 'Augments' : '海克斯'}</div>
                <div className="mt-1 text-[15px] font-black text-cream">{core.augments.length}</div>
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="glass-panel relative mt-3 overflow-hidden rounded-[8px] border px-3 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-[760px]:grid-cols-1">
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red">{lang === 'en' ? 'Patch intelligence' : '战术更新'}</div>
              <div className="mt-0.5 truncate text-[13px] font-black text-cream">{patch.patch} · {patch.theme}</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 max-[760px]:justify-start">
            {topChanges.slice(0, 5).map((champion) => (
              <button key={champion.id} type="button" onClick={() => onPick(champion.id)} className="rounded border border-line/50 bg-panel/50 p-1 transition hover:border-hex/40">
                <img src={icon(champion.iconLocal)} alt={champion.name} className="h-6 w-6 rounded object-cover" />
              </button>
            ))}
            <button type="button" onClick={onOpenPatchNotes} className={BTN_TINY_SECONDARY}>{lang === 'en' ? 'Open' : '打开'}</button>
          </div>
        </div>
      </section>
    </>
  )
}

function DashboardMiniStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-[5px] border border-line/50 bg-panel/42 p-1.5">
      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-dim">{label}</div>
      <div className="mt-0.5 text-[15px] font-black tabular-nums text-cream">{value}{suffix}</div>
    </div>
  )
}

type OfficialDiscovery = {
  champion: Champion
  archetype: Archetype
  tier?: string
}

function OfficialDiscoveryRoutes({
  discoveries,
  core,
  onPick,
  onOpenChampions,
}: {
  discoveries: OfficialDiscovery[]
  core: Core
  onPick: (id: number) => void
  onOpenChampions: () => void
}) {
  const lang = useLang()
  return (
    <section className="glass-panel relative mt-3 overflow-hidden rounded-[8px] border p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-line/50 pb-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">
            {lang === 'en' ? 'Mayhempedia picks' : '官方新发现玩法'}
          </div>
          <p className="mt-0.5 max-w-[760px] text-[11px] leading-4 text-dim">
            {lang === 'en'
              ? 'A few editorial builds worth trying this patch.'
              : '这版本值得试的几条编辑精选小玩法。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onOpenChampions} className={BTN_TINY_SECONDARY}>
            {lang === 'en' ? 'Champion Codex' : '英雄图鉴'}
          </button>
        </div>
      </div>

      {discoveries.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-1.5">
          {discoveries.map(({ champion, archetype, tier }) => {
            const items = archetype.items.map((ref) => core.itemById.get(ref.id)).filter((item): item is Item => !!item).slice(0, 3)
            const augments = [...archetype.augments.core, ...archetype.augments.good]
              .map((ref) => getAugment(core.augById, ref.id))
              .filter((augment): augment is Augment => !!augment)
              .slice(0, 2)
            return (
              <button
                key={`${champion.id}-${archetype.key}`}
                type="button"
                onClick={() => onPick(champion.id)}
                className="group min-w-0 rounded-[6px] border border-line/58 bg-[#07101b]/42 px-2 py-1.5 text-left transition hover:-translate-y-0.5 hover:border-hex/38 hover:bg-white/[0.03] active:translate-y-px"
              >
                <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-1.5">
                  <img src={icon(champion.iconLocal)} alt={champion.name} className={ICON_ASSET + ' h-7 w-7 group-hover:border-hex/45'} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-black text-cream">{champion.name}</div>
                    <div className="mt-0.5 truncate text-[9px] font-bold text-dim">{archetype.name}</div>
                  </div>
                  <span className="rounded border border-hex/35 bg-hex/10 px-1.5 py-0.5 text-[8px] font-black text-hex">
                    {tier ?? archetype.damageType}
                  </span>
                </div>
                <div className="mt-1 flex min-h-5 items-center gap-1">
                  {items.map((item) => (
                    <img key={item.id} src={icon(item.iconLocal)} alt={item.name} title={item.name} className={ICON_ASSET + ' h-5 w-5'} />
                  ))}
                  <span className="h-4 w-px bg-line/45" />
                  {augments.map((augment) => (
                    <img key={augment.id} src={icon(augment.iconLargeLocal)} alt={augment.name} title={augment.name} className={'h-5 w-5 shrink-0 rounded border object-cover ' + (RARITY[augment.rarity] ?? RARITY[0]).border} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState
          compact
          title={lang === 'en' ? 'Curated picks are loading' : '正在整理新玩法'}
          description={lang === 'en'
            ? 'Once hero files are available, Mayhempedia will surface a few builds worth trying.'
            : '英雄档案加载完成后，这里会展示几条值得试的官方精选玩法。'}
        />
      )}
    </section>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  metrics,
  action,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  metrics?: { label: string; value: ReactNode; tone?: 'accent' | 'muted' }[]
  action?: ReactNode
}) {
  return (
    <section className={PAGE_HEADER}>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-[900px]:grid-cols-1">
        <div className="min-w-0">
          {eyebrow && <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">{eyebrow}</div>}
          <h2 className="mt-0.5 text-[21px] font-black leading-tight text-cream">{title}</h2>
          {description && <div className="mt-1 max-w-[760px] text-[11px] leading-4 text-dim">{description}</div>}
        </div>
        {(metrics?.length || action) && (
          <div className="flex min-w-[260px] flex-wrap items-stretch justify-end gap-1.5 max-[900px]:justify-start">
            {metrics?.map((metric) => (
              <div key={metric.label} className="min-w-[104px] rounded-[6px] border border-line/60 bg-[#07101b]/45 px-2.5 py-2">
                <div className="text-[10px] font-black text-dim">{metric.label}</div>
                <div className={'mt-0.5 text-[15px] font-black tabular-nums ' + (metric.tone === 'accent' ? 'text-hex' : 'text-cream')}>{metric.value}</div>
              </div>
            ))}
            {action}
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={(compact ? 'p-3 text-left' : 'p-6 text-center') + ' rounded-[7px] border border-dashed border-line/60 bg-[#07101b]/34'}>
      <div className="text-[12px] font-black text-cream">{title}</div>
      {description && <div className={(compact ? 'mt-1 text-[10px] leading-4' : 'mx-auto mt-2 max-w-[540px] text-[12px] leading-5') + ' text-dim'}>{description}</div>}
      {action && <div className={compact ? 'mt-2' : 'mt-4'}>{action}</div>}
    </div>
  )
}

function DashboardReadoutRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ready' | 'active' | 'warning' | 'idle'
}) {
  const toneClass =
    tone === 'ready'
      ? 'text-[#8bd99e]'
      : tone === 'active'
        ? 'text-hex'
        : tone === 'warning'
          ? 'text-gold'
          : 'text-dim'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-line/30 pb-1.5 last:border-b-0 last:pb-0">
      <span className="truncate text-[10px] font-bold text-dim">{label}</span>
      <span className={'max-w-[170px] truncate text-[11px] font-black ' + toneClass}>{value}</span>
    </div>
  )
}

function matchJudgementTags(match: MatchSummary, lang: Lang): { label: string; className: string }[] {
  const tags: { label: string; className: string }[] = []
  const kdaWeight = match.deaths === 0 ? match.kills + match.assists : (match.kills + match.assists) / match.deaths
  if (match.impactPercentile >= 75) {
    tags.push({
      label: lang === 'en' ? 'High impact' : '高表现',
      className: 'border-gold/35 bg-gold/10 text-gold',
    })
  }
  if (match.win && (match.impactPercentile >= 60 || kdaWeight >= 3.2)) {
    tags.push({
      label: lang === 'en' ? 'Capture-ready' : '可采集',
      className: 'border-hex/35 bg-hex/10 text-hex',
    })
  }
  if (match.impactPercentile >= 70 && kdaWeight >= 2.4) {
    tags.push({
      label: lang === 'en' ? 'Full build' : '装备完整',
      className: 'border-[#8d6cf0]/35 bg-[#8d6cf0]/10 text-[#c6b0ff]',
    })
  }
  if (!match.win && match.impactPercentile >= 55) {
    tags.push({
      label: lang === 'en' ? 'Review loss' : '失败可复盘',
      className: 'border-red/35 bg-red/10 text-red',
    })
  }
  if (tags.length === 0) {
    tags.push({
      label: lang === 'en' ? 'Archive' : '普通记录',
      className: 'border-line/45 bg-panel/45 text-dim',
    })
  }
  return tags.slice(0, 3)
}

function MatchHistoryTab({
  core,
  matchHistory,
  onPickMatch,
}: {
  core: Core
  matchHistory: MatchHistoryResult | null
  onPickMatch: (gameId: number) => void
}) {
  const lang = useLang()
  const champById = useMemo(() => new Map(core.champions.map((champion) => [champion.id, champion])), [core.champions])
  const matches = (matchHistory?.matches ?? []).slice(0, 20)
  const wins = matches.filter((match) => match.win).length
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0
  const avgImpact =
    matches.length > 0
      ? Math.round(matches.reduce((sum, match) => sum + match.impactPercentile, 0) / matches.length)
      : 0
  const title = lang === 'en' ? 'Match history' : '对局记录'
  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <section className={PAGE_HEADER}>
        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3 max-[880px]:grid-cols-1">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">{lang === 'en' ? 'Match center' : '对局中心'}</div>
            <h2 className="mt-0.5 text-[21px] font-black leading-tight text-cream">{title}</h2>
            <p className="mt-1 max-w-[720px] text-[11px] leading-4 text-dim">
              {lang === 'en'
                ? 'Use this as the route-capture workspace. Open a game, inspect all 10 players, then save only the player build you want.'
                : '这里作为出装采集工作区。打开一局，看 10 个人的装备和海克斯，再只保存你想要的那个玩家路线。'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <DashboardMiniStat label={lang === 'en' ? 'Games' : '对局'} value={matches.length} />
            <DashboardMiniStat label={lang === 'en' ? 'Win rate' : '胜率'} value={winRate} suffix="%" />
            <DashboardMiniStat label={lang === 'en' ? 'Impact' : '表现'} value={avgImpact} />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[8px] border border-line/70 bg-panel/78 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
        <div className="grid grid-cols-[44px_minmax(180px,1fr)_76px_92px_minmax(160px,0.7fr)_116px_58px] gap-2 rounded-[6px] border border-line/45 bg-[#07101b]/50 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-dim max-[900px]:grid-cols-[44px_minmax(0,1fr)_76px_92px_58px]">
          <div />
          <div>{lang === 'en' ? 'Champion' : '英雄'}</div>
          <div className="text-right">{lang === 'en' ? 'Result' : '结果'}</div>
          <div className="text-right">KDA</div>
          <div className="text-right max-[900px]:hidden">{lang === 'en' ? 'Impact' : '表现'}</div>
          <div className="text-right max-[900px]:hidden">{lang === 'en' ? 'Time' : '时间'}</div>
          <div className="text-right" />
        </div>
        <div className="mt-1.5 space-y-1">
          {matches.map((match) => {
            const champion = champById.get(match.championId)
            const tags = matchJudgementTags(match, lang)
            return (
              <button
                key={match.gameId}
                type="button"
                onClick={() => onPickMatch(match.gameId)}
                className={
                  'group relative grid w-full grid-cols-[44px_minmax(180px,1fr)_76px_92px_minmax(160px,0.7fr)_116px_58px] items-center gap-2 rounded-[6px] border px-2 py-2 text-left transition hover:border-hex/35 hover:bg-panel2/45 active:translate-y-px max-[900px]:grid-cols-[44px_minmax(0,1fr)_76px_92px_58px] ' +
                  (match.win ? 'border-line/55 bg-[#07101b]/45' : 'border-line/45 bg-[#07101b]/34')
                }
              >
                <span className={'absolute bottom-2 left-0 top-2 w-0.5 rounded-full ' + (match.win ? 'bg-[#63c07a]' : 'bg-red/85')} />
                {champion ? (
                  <img src={icon(champion.iconLocal)} alt={champion.name} className="h-9 w-9 rounded border border-line/70 object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded border border-line/70 bg-panel/60" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-black text-cream">{champion?.name ?? `#${match.championId}`}</div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                    <span className="truncate text-[10px] text-dim">Game {match.gameId}</span>
                    {tags.map((tag) => (
                      <span key={tag.label} className={'rounded border px-1.5 py-px text-[9px] font-black ' + tag.className}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={
                      'inline-flex min-w-[48px] justify-center rounded border px-2 py-0.5 text-[10px] font-black ' +
                      (match.win
                        ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8fd69d]'
                        : 'border-red/35 bg-red/10 text-red')
                    }
                  >
                    {match.win ? (lang === 'en' ? 'Win' : '胜利') : (lang === 'en' ? 'Loss' : '失败')}
                  </span>
                </div>
                <div className="text-right text-[12px] font-black tabular-nums text-cream">
                  {match.kills}/{match.deaths}/{match.assists}
                </div>
                <div className="max-[900px]:hidden">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#050b12]">
                      <div
                        className={'h-full rounded-full ' + (match.impactPercentile >= 70 ? 'bg-gold' : match.impactPercentile >= 45 ? 'bg-hex' : 'bg-line')}
                        style={{ width: `${Math.max(4, Math.min(100, match.impactPercentile))}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] font-black tabular-nums text-dim">P{match.impactPercentile}</span>
                  </div>
                </div>
                <div className="text-right text-[10px] font-bold tabular-nums text-dim max-[900px]:hidden">
                  {formatDate(match.gameCreationDate)}
                </div>
                <span className="justify-self-end rounded border border-line/55 bg-panel/45 px-2 py-1 text-[10px] font-black text-dim transition group-hover:border-hex/40 group-hover:text-hex">
                  {lang === 'en' ? 'Open' : '查看'}
                </span>
              </button>
            )
          })}
          {!matchHistory && (
            <div className="rounded-[8px] border border-dashed border-line/55 bg-[#07101b]/40 px-3 py-10 text-center text-[12px] leading-5 text-dim">
              {lang === 'en' ? 'Match history is available inside the desktop app after connecting to League Client.' : '连接 League 客户端后，桌面应用内会显示本地对局记录。'}
            </div>
          )}
          {matchHistory && matches.length === 0 && (
            <div className="rounded-[8px] border border-dashed border-line/55 bg-[#07101b]/40 px-3 py-10 text-center text-[12px] leading-5 text-dim">
              {lang === 'en' ? 'No ARAM Mayhem games captured yet.' : '还没有采集到海克斯大乱斗对局。'}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function RoleIcon({ role, active = false }: { role: string | null; active?: boolean }) {
  return (
    <img
      src={role ? `/assets/lol-roles/${role}.png` : '/assets/lol-roles/all.svg'}
      alt=""
      aria-hidden="true"
      className={
        'h-[17px] w-[17px] object-contain transition ' +
        (active ? 'brightness-[0.38] saturate-75 contrast-150' : 'opacity-85 group-hover:opacity-100')
      }
    />
  )
}

function DashboardHero({
  core,
  lcuStatus,
  detectedChamp,
  detectedHasBuild,
  matchHistory,
  onPick,
  onGoChamp,
  onGoTier,
  onOpenPatchNotes,
  onShowOverlay,
  selectedArchetypeByChampionId,
  customRoutes,
}: {
  core: Core
  lcuStatus: LcuStatus | null
  detectedChamp: Champion | null
  detectedHasBuild: boolean
  matchHistory: MatchHistoryResult | null
  onPick: (id: number) => void
  onGoChamp: () => void
  onGoTier: () => void
  onOpenPatchNotes: () => void
  onShowOverlay: () => void | Promise<unknown>
  selectedArchetypeByChampionId: Record<string, string>
  customRoutes: CustomRoute[]
}) {
  const t = useT()
  const covered = Object.keys(core.buildIndex).length
  const status =
    lcuStatus?.state === 'connected'
      ? detectedChamp
        ? detectedHasBuild
          ? t('dash.hero.status.ready')
          : t('dash.hero.status.needBuild')
        : t('dash.hero.status.waitingPick')
      : lcuStatus?.state === 'error'
        ? t('dash.hero.status.error')
        : t('dash.hero.status.searching')
  const statusTone =
    lcuStatus?.state === 'connected' && detectedChamp && detectedHasBuild
      ? 'text-[#3fb950] border-[#3fb950]/40 bg-[#3fb950]/10'
      : lcuStatus?.state === 'error'
        ? 'text-red border-red/40 bg-red/10'
        : 'text-hex border-hex/40 bg-hex/10'
  const heroState =
    lcuStatus?.state === 'error'
      ? 'error'
      : lcuStatus?.state === 'connected'
        ? detectedChamp
          ? detectedHasBuild
            ? 'ready'
            : 'missing'
          : 'waitingPick'
        : 'searching'
  const heroTitle =
    heroState === 'ready' && detectedChamp
      ? t('dash.hero.title.ready', { name: detectedChamp.name })
      : heroState === 'missing' && detectedChamp
        ? t('dash.hero.title.missing', { name: detectedChamp.name })
        : heroState === 'waitingPick'
          ? t('dash.hero.title.waitingPick', 'Waiting for champion select')
          : heroState === 'error'
            ? t('dash.hero.title.error', 'Client connection failed')
            : t('dash.hero.title.searching', 'Waiting for League client')
  const heroSubtitle =
    heroState === 'ready'
      ? t('dash.hero.subtitle.ready', 'Route, augments, and item order are ready for the in-game overlay.')
      : heroState === 'missing'
        ? t('dash.hero.subtitle.missing', 'This champion is detected, but the route data still needs to be added.')
        : heroState === 'waitingPick'
          ? t('dash.hero.subtitle.waitingPick', 'Enter ARAM: Mayhem champion select and Mayhempedia will lock onto your pick.')
          : heroState === 'error'
            ? t('dash.hero.subtitle.error', 'Mayhempedia will keep trying to reconnect in the background.')
            : t('dash.hero.subtitle.searching', 'Open the League client to arm the live companion.')
  const primaryLabel = detectedChamp && detectedHasBuild ? t('dash.hero.openBuild', 'Open build') : t('dash.hero.browseRoutes', 'Browse routes')

  return (
    <section className="glass-panel-strong relative overflow-hidden rounded-[8px] border p-6 mb-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-hex/45" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_340px] gap-6 items-start max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-md border border-hex/35 bg-hex/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-hex">
            {t('dash.hero.live', 'Live companion')}
          </div>
          <h1 className="mt-4 max-w-[720px] text-[34px] leading-[1.04] font-extrabold tracking-tight text-cream">
            {heroTitle}
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-dim">
            {heroSubtitle}
          </p>
          <div className="mt-5 grid grid-cols-4 gap-2 max-[760px]:grid-cols-2">
            <StatusStep
              index="01"
              label={t('dash.hero.step.connect')}
              state={lcuStatus?.state === 'connected' ? 'done' : lcuStatus?.state === 'error' ? 'blocked' : 'active'}
              detail={lcuStatus?.state === 'connected' ? t('dash.hero.step.connect.done') : lcuStatus?.state === 'error' ? t('dash.hero.step.connect.error') : t('dash.hero.step.connect.idle')}
            />
            <StatusStep
              index="02"
              label={t('dash.hero.step.pick')}
              state={detectedChamp ? 'done' : lcuStatus?.state === 'connected' ? 'active' : 'idle'}
              detail={detectedChamp ? t('dash.hero.step.pick.done', { name: detectedChamp.name }) : t('dash.hero.step.pick.idle')}
            />
            <StatusStep
              index="03"
              label={t('dash.hero.step.build')}
              state={detectedChamp ? (detectedHasBuild ? 'done' : 'blocked') : 'idle'}
              detail={detectedChamp ? (detectedHasBuild ? t('dash.hero.step.build.done') : t('dash.hero.step.build.blocked')) : t('dash.hero.step.build.idle', { covered, total: core.champions.length })}
            />
            <StatusStep
              index="04"
              label={t('dash.hero.step.overlay')}
              state={detectedChamp && detectedHasBuild ? 'active' : 'idle'}
              detail={detectedChamp && detectedHasBuild ? t('dash.hero.step.overlay.active') : t('dash.hero.step.overlay.idle')}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => (detectedChamp && detectedHasBuild ? onPick(detectedChamp.id) : onGoChamp())}
              className="rounded-md border border-hex bg-hex px-5 py-2.5 text-sm font-extrabold text-[#041017] shadow-[0_12px_28px_rgba(34,211,238,0.12)] transition hover:-translate-y-0.5 hover:bg-[#45dff0] cursor-pointer"
            >
              {primaryLabel}
            </button>
            <button
              onClick={onGoTier}
              className="rounded-md border border-line/70 bg-panel2/60 px-5 py-2.5 text-sm font-bold text-dim transition hover:-translate-y-0.5 hover:border-hex/45 hover:text-cream cursor-pointer"
            >
              {t('dash.hero.viewTier')}
            </button>
            <button
              onClick={onOpenPatchNotes}
              className="rounded-md border border-line/80 bg-panel2/55 px-5 py-2.5 text-sm font-bold text-dim transition hover:-translate-y-0.5 hover:text-cream hover:border-hex/45 cursor-pointer"
            >
              {t('dash.hero.patchNotes')}
            </button>
          </div>
        </div>

        <div className="glass-control rounded-[8px] border border-line/80 p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">{t('dash.hero.readout', 'Live readout')}</div>
          <div className={'mt-3 rounded-lg border px-3.5 py-3 text-sm font-bold ' + statusTone}>{status}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatusMetric label={t('dash.hero.metric.coverage', 'Routes')} value={`${covered}/${core.champions.length}`} />
            <StatusMetric label={t('dash.hero.metric.matches', 'Local matches')} value={matchHistory ? String(matchHistory.matches.length) : '0'} />
          </div>
          <div className="mt-3 rounded-lg border border-line/65 bg-panel/45 p-3">
            <div className="text-[11px] font-bold text-dim">{t('dash.hero.overlayHotkey', 'Overlay hotkey')}</div>
            <div className="mt-1 text-sm font-extrabold text-cream">Ctrl+Shift+X</div>
            {isElectron() && (
              <button
                type="button"
                onClick={onShowOverlay}
                className="mt-3 w-full rounded-md border border-hex/45 bg-hex/10 px-3 py-2 text-xs font-extrabold text-hex transition hover:bg-hex/15 cursor-pointer"
              >
                {t('dash.hero.showOverlay', 'Show overlay')}
              </button>
            )}
          </div>
          {detectedChamp && (
            <DetectedRouteCard
              core={core}
              champion={detectedChamp}
              hasBuild={detectedHasBuild}
              selectedArchetypeKey={selectedArchetypeByChampionId[String(detectedChamp.id)]}
              customRoutes={customRoutes}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function StatusStep({
  index,
  label,
  detail,
  state,
}: {
  index: string
  label: string
  detail: string
  state: 'done' | 'active' | 'idle' | 'blocked'
}) {
  const tone =
    state === 'done'
      ? 'border-[#3fb950]/35 bg-[#3fb950]/10 text-[#3fb950]'
      : state === 'active'
        ? 'border-hex/45 bg-hex/10 text-hex'
        : state === 'blocked'
          ? 'border-red/45 bg-red/10 text-red'
          : 'border-line/60 bg-panel/72 text-dim'
  return (
    <div className={'min-h-[68px] rounded-lg border px-3 py-2.5 ' + tone}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-extrabold tracking-[0.14em] opacity-80">{index}</div>
        <span className="h-2 w-2 rounded-full bg-current" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mt-1 text-xs font-extrabold text-cream">{label}</div>
        <div className="mt-0.5 line-clamp-1 text-[11px] opacity-80">{detail}</div>
      </div>
    </div>
  )
}

function DetectedRouteCard({
  core,
  champion,
  hasBuild,
  selectedArchetypeKey,
  customRoutes,
}: {
  core: Core
  champion: Champion
  hasBuild: boolean
  selectedArchetypeKey?: string
  customRoutes: CustomRoute[]
}) {
  const t = useT()
  const lang = useLang()
  const [build, setBuild] = useState<Build | null | undefined>(undefined)

  useEffect(() => {
    const file = core.buildIndex[champion.id]
    if (!file) {
      setBuild(withCustomRoutes(null, champion.id, customRoutes, core))
      return
    }
    setBuild(undefined)
    loadBuild(file, lang)
      .then((loaded) => setBuild(withCustomRoutes(loaded, champion.id, customRoutes, core)))
      .catch(() => setBuild(withCustomRoutes(null, champion.id, customRoutes, core)))
  }, [core, champion.id, customRoutes, lang])

  const route = build?.archetypes.find((a) => a.key === selectedArchetypeKey) ?? build?.archetypes[0]
  const previewItems = route?.items
    .map((ref) => core.itemById.get(ref.id))
    .filter((item): item is Item => !!item)
    .slice(0, 3) ?? []
  return (
    <div className="glass-control mt-4 rounded-[8px] border border-line/65 p-3">
      <div className="flex items-center gap-3">
        <img
          src={icon(champion.iconLocal)}
          alt={champion.name}
          className="h-12 w-12 rounded-lg border border-line/70 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-extrabold text-cream">{champion.name}</div>
            {route && (
              <span
                className={
                  'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ' +
                  (route.damageType === 'AP'
                    ? 'bg-[#9664dc]/18 text-[#c9a3f0]'
                    : route.damageType === 'Tank'
                      ? 'bg-hex/12 text-hex'
                      : 'bg-[#dc8246]/18 text-[#f0a97a]')
                }
              >
                {route.damageType}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-dim">
            {route
              ? selectedArchetypeKey
                ? t('routeCard.setActive', { name: route.name })
                : route.name
              : hasBuild
                ? t('routeCard.loading')
                : t('routeCard.noBuild')}
          </div>
        </div>
      </div>
      {previewItems.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          {previewItems.map((item) => (
            <img
              key={item.id}
              src={icon(item.iconLocal)}
              alt={item.name}
              title={item.name}
              className="h-7 w-7 rounded-lg border border-line/70 object-cover"
            />
          ))}
          {route && route.items.length > previewItems.length && (
            <span className="ml-1 text-[11px] font-bold text-dim">+{route.items.length - previewItems.length}</span>
          )}
        </div>
      )}
      {route?.note && <div className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-dim">{route.note}</div>}
    </div>
  )
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/60 bg-panel/72 p-3">
      <div className="text-[11px] text-dim">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-cream">{value}</div>
    </div>
  )
}

/** 主页没有本机对局数据时（浏览器预览/刚打开还没打过大乱斗）填的引导块——
 *  不是纯装饰性留白填充，是真的告诉用户"数据从哪来"+顺带把他导去有内容的页面逛逛。 */
function DashboardOnboarding({ onGoChamp, onGoTier }: { onGoChamp: () => void; onGoTier: () => void }) {
  const t = useT()
  const steps = [
    [t('dash.onboarding.step1'), t('dash.onboarding.step1Desc')],
    [t('dash.onboarding.step2'), t('dash.onboarding.step2Desc')],
    [t('dash.onboarding.step3'), t('dash.onboarding.step3Desc')],
  ]
  return (
    <section className={CARD + ' p-4'}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hex/30" />
      <div className="relative mb-4">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-hex">{t('dash.onboarding.kicker', 'Setup checklist')}</div>
        <h3 className="mt-1 text-base font-extrabold text-cream">{t('dash.onboarding.title')}</h3>
      </div>
      <div className="relative flex flex-col gap-2.5">
        {steps.map(([title, desc], index) => (
          <div key={title} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3 rounded-lg border border-line/55 bg-panel2/34 p-3">
            <div className="grid h-6 w-6 place-items-center rounded-lg border border-hex/35 bg-hex/10 text-[10px] font-extrabold text-hex">
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-cream">{title}</div>
              <div className="mt-1 text-xs leading-relaxed text-dim">{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex items-center gap-3 pt-4 border-t border-line/70 flex-wrap">
        <span className="text-xs text-dim">{t('dash.onboarding.meanwhile')}</span>
        <button
          onClick={onGoChamp}
          className="rounded-md border border-line/65 bg-panel2/70 px-3 py-1.5 text-xs text-dim transition hover:border-hex/45 hover:text-cream cursor-pointer"
        >
          {t('dash.onboarding.goChamp')}
        </button>
        <button
          onClick={onGoTier}
          className="rounded-md border border-line/65 bg-panel2/70 px-3 py-1.5 text-xs text-dim transition hover:border-hex/45 hover:text-cream cursor-pointer"
        >
          {t('dash.onboarding.goTier')}
        </button>
      </div>
    </section>
  )
}

function Snowflake() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="3.3" y1="7" x2="20.7" y2="17" />
      <line x1="20.7" y1="7" x2="3.3" y2="17" />
      <path d="M12 5l-2.2 1.3M12 5l2.2 1.3M12 19l-2.2-1.3M12 19l2.2-1.3" />
      <path d="M4.5 9l.3 2.5M4.5 9l2.4-.7M19.5 15l-.3-2.5M19.5 15l-2.4.7" />
      <path d="M19.5 9l-.3 2.5M19.5 9l-2.4-.7M4.5 15l.3-2.5M4.5 15l2.4.7" />
    </svg>
  )
}

function IdentityCard({ arp, summoner }: { arp: ArpResult | null; summoner: SummonerInfo | null }) {
  const t = useT()
  if (!arp) {
    return (
      <section className={CARD + ' p-6 flex items-center gap-6'}>
        <div className="relative shrink-0 w-24 h-24 rounded-[8px] grid place-items-center bg-panel2/58 border border-line/80 text-dim">
          <Snowflake />
        </div>
        <div className="relative flex-1 min-w-0">
          <div className="text-[18px] font-extrabold text-cream">{t('dash.identity.empty')}</div>
          <div className="mt-1.5 text-[13px] text-dim leading-relaxed">
            {t('dash.identity.emptyDesc')}
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="glass-panel relative overflow-hidden rounded-[8px] p-6 flex items-center gap-6 border border-gold/35">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gold/60" />
      <div className="shrink-0 w-24 h-24 rounded-[8px] grid place-items-center bg-[#0a111a]/82 border border-gold/55 text-gold shadow-[inset_0_1px_0_rgba(242,234,216,0.08)]">
        <Snowflake />
      </div>
      <div className="relative flex-1 min-w-0">
        {summoner && (
          <div className="text-xs text-dim mb-1">
            {summoner.gameName}
            {summoner.tagLine && <span className="opacity-60">#{summoner.tagLine}</span>}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <span className="text-[28px] font-extrabold tracking-wide text-[#f6e9cb]">{arp.rankName}</span>
          <span className="text-[10px] text-dim border border-line/70 bg-panel/60 px-2 py-0.5 rounded-md">
            {t('dash.identity.unofficial')}
          </span>
        </div>
        <div className="mt-1.5 text-[13px] text-dim">
          {t('dash.identity.recent', { n: arp.wins + arp.losses })} · <b className="text-[#63c07a]">{arp.wins}</b>W -{' '}
          <b className="text-red">{arp.losses}</b>L · {t('dash.identity.winRate')} {arp.winRatePct}%
        </div>
        <div className="mt-3 h-2 max-w-[360px] bg-[#0a1428] rounded-full overflow-hidden border border-line/40">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${arp.score}%` }}
          />
        </div>
        <div className="mt-3 text-[13px] italic text-[#d7bfa0]">{t('dash.identity.quote', { score: arp.score })}</div>
        <button className="mt-3.5 rounded-md border border-line/70 bg-panel2/70 px-4 py-2 text-[13px] font-extrabold text-dim transition hover:border-hex/45 hover:text-cream cursor-pointer">
          {t('dash.identity.share')}
        </button>
      </div>
    </section>
  )
}

function PanelHead({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 mb-3.5">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h3 className="text-[15px] font-extrabold tracking-tight shrink-0">{title}</h3>
        {meta && <span className="text-xs text-dim truncate">{meta}</span>}
      </div>
      {action}
    </div>
  )
}

/** dmgDealt>1(伤害更高) 或 dmgTaken<1(承受更低) 都是变强；healing/shielding 同理 */
function balanceScore(b: AramBalance): number {
  return (
    ((b.dmgDealt ?? 1) - 1) -
    ((b.dmgTaken ?? 1) - 1) +
    ((b.healing ?? 1) - 1) * 0.5 +
    ((b.shielding ?? 1) - 1) * 0.5
  )
}

function fmtPct(v: number | undefined): string {
  if (v == null || v === 1) return '0%'
  const pct = Math.round((v - 1) * 100)
  return (pct > 0 ? '+' : '') + pct + '%'
}

function VersionChanges({
  core,
  champById,
  onPick,
  onOpenPatchNotes,
}: {
  core: Core
  champById: Map<number, Champion>
  onPick: (id: number) => void
  onOpenPatchNotes: () => void
}) {
  const top = useMemo(
    () =>
      [...core.aramBalance]
        .map((b) => ({ b, score: balanceScore(b) }))
        .sort((x, y) => Math.abs(y.score) - Math.abs(x.score))
        .slice(0, 8),
    [core],
  )

  const t = useT()
  return (
    <section className={CARD + ' p-4'}>
      <PanelHead
        title={t('dash.versionChanges.title', '本版本变动')}
        meta={t('dash.versionChanges.meta', 'ARAM 平衡数值 · 只显示修正最大的')}
        action={
          <button onClick={onOpenPatchNotes} className="shrink-0 rounded-md border border-line/65 bg-panel2/60 px-2.5 py-1 text-[11px] font-bold text-dim transition hover:border-hex/45 hover:text-cream cursor-pointer">
            {t('dash.versionChanges.full')}
          </button>
        }
      />
      <div className="flex flex-wrap gap-4">
        {top.map(({ b, score }) => {
          const c = champById.get(b.id)
          if (!c) return null
          const dir = score >= 0 ? 'buff' : 'nerf'
          return (
            <button
              key={b.id}
              onClick={() => onPick(b.id)}
              title={`${t('dash.versionChanges.dealt')} ${fmtPct(b.dmgDealt)} · ${t('dash.versionChanges.taken')} ${fmtPct(b.dmgTaken)}${
                b.healing != null ? ` · ${t('dash.versionChanges.healing')} ${fmtPct(b.healing)}` : ''
              }${b.shielding != null ? ` · ${t('dash.versionChanges.shielding')} ${fmtPct(b.shielding)}` : ''}`}
              className="group flex flex-col items-center gap-1.5 cursor-pointer rounded-lg p-1.5 transition hover:bg-panel2/55"
            >
              <div className="relative">
                <img src={icon(c.iconLocal)} alt={c.name} className="w-13 h-13 rounded-lg border border-line/60" />
                <span
                  className={
                    'absolute -right-1.5 -bottom-1.5 w-[19px] h-[19px] rounded-full grid place-items-center text-[9px] border-2 border-panel ' +
                    (dir === 'buff' ? 'bg-[#2f7d4f] text-[#cffbe0]' : 'bg-[#8a2e2a] text-[#ffcfcb]')
                  }
                >
                  {dir === 'buff' ? '▲' : '▼'}
                </span>
              </div>
              <span className="text-[11px] text-dim group-hover:text-cream">{c.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function RecentMatches({
  matches,
  champById,
  onPick,
}: {
  matches: MatchSummary[] | null
  champById: Map<number, Champion>
  onPick: (gameId: number) => void
}) {
  const t = useT()
  return (
    <section className={CARD + ' p-4'}>
      <PanelHead title={t('dash.recentMatches.title', '近期对局')} />
      {!matches && <EmptyState compact title={t('dash.emptyNeedElectron')} description={t('dash.recentMatches.empty')} />}
      {matches && matches.length === 0 && <EmptyState compact title={t('dash.recentMatches.empty')} />}
      <div className="flex flex-col gap-2">
        {(matches ?? []).slice(0, 8).map((m) => {
          const c = champById.get(m.championId)
          if (!c) return null
          return (
            <button
              key={m.gameId}
              onClick={() => onPick(m.gameId)}
              title={t('dash.recentMatches.tooltip', { pct: m.impactPercentile })}
              className={
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-panel2/70 border border-line/50 border-l-[3px] cursor-pointer text-left transition hover:bg-panel2 hover:-translate-y-0.5 ' +
                (m.win ? 'border-[#63c07a]' : 'border-red')
              }
            >
              <img src={icon(c.iconLocal)} alt={c.name} className="w-[34px] h-[34px] rounded-lg border border-line/55" />
              <span className="text-[13px] flex-1">{c.name}</span>
              <span className="text-xs text-dim">
                {m.kills} / {m.deaths} / {m.assists}
              </span>
              <span className={'text-xs font-bold w-4 text-center ' + (m.win ? 'text-[#63c07a]' : 'text-red')}>
                {m.win ? t('dash.recentMatches.win') : t('dash.recentMatches.loss')}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Achievements({ achievements }: { achievements: Achievement[] | null }) {
  const t = useT()
  return (
    <section className={CARD + ' p-4'}>
      <PanelHead title={t('dash.achievements.title', '新解锁')} />
      {!achievements && <EmptyState compact title={t('dash.emptyNeedElectron')} />}
      {achievements && achievements.length === 0 && (
        <EmptyState compact title={t('dash.achievements.empty')} />
      )}
      <div className="flex flex-col gap-2.5">
        {(achievements ?? []).map((a, index) => (
          <div
            key={a.key}
            className="flex items-center gap-3 p-3 rounded-lg border border-gold/25 bg-gold/8"
          >
            <AchievementMark index={index} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#f6e9cb]">{a.name}</div>
              <div className="text-[11px] text-dim mt-0.5 leading-snug">{a.desc}</div>
            </div>
            <button className="rounded-md border border-line/65 bg-panel2/70 px-3 py-1.5 text-xs font-bold text-dim transition hover:border-hex/45 hover:text-cream cursor-pointer">
              {t('dash.achievements.share')}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function AchievementMark({ index }: { index: number }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/35 bg-gold/10 text-gold">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l7 4v7c0 3.8-2.9 6.3-7 7-4.1-.7-7-3.2-7-7V7z" />
        {index % 2 === 0 ? <path d="M8.5 12.2l2.2 2.2 4.8-5" /> : <path d="M12 8v8M8 12h8" />}
      </svg>
    </div>
  )
}

/* ---------------- 设置 ---------------- */
function Toggle({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={
        'relative w-9 h-5 rounded-full shrink-0 transition ' +
        (on ? 'bg-[#3f8759]' : 'bg-[#3a2a2c]') +
        (onClick ? ' cursor-pointer' : ' cursor-default')
      }
    >
      <span
        className={
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ' + (on ? 'left-[19px]' : 'left-0.5')
        }
      />
    </button>
  )
}

function hotkeyLabel(hotkey: Hotkey): string {
  return `${hotkey.ctrl ? 'Ctrl+' : ''}${hotkey.shift ? 'Shift+' : ''}${hotkey.alt ? 'Alt+' : ''}${hotkey.key}`
}

function browserKeyToHotkey(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return key.toUpperCase()
  if (/^[0-9]$/.test(key)) return key
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/i.test(key)) return key.toUpperCase()
  const aliases: Record<string, string> = {
    ' ': 'Space',
    Escape: 'Escape',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
  }
  return aliases[key] ?? null
}

function hotkeySignature(hotkey: Hotkey): string {
  return `${hotkey.ctrl ? '1' : '0'}${hotkey.shift ? '1' : '0'}${hotkey.alt ? '1' : '0'}:${hotkey.key}`
}

function HotkeyRecorder({
  label,
  description,
  value,
  reserved,
  onChange,
  recordingText,
  invalidText,
  conflictText,
}: {
  label: string
  description: string
  value: Hotkey
  reserved: Hotkey[]
  onChange: (hotkey: Hotkey) => void
  recordingText: string
  invalidText: string
  conflictText: string
}) {
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('')

  const capture = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return
    event.preventDefault()
    event.stopPropagation()
    const key = browserKeyToHotkey(event.key)
    if (!key) return
    const next: Hotkey = { ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, key }
    if (!next.ctrl && !next.shift && !next.alt) {
      setMessage(invalidText)
      return
    }
    if (reserved.some((hotkey) => hotkeySignature(hotkey) === hotkeySignature(next))) {
      setMessage(conflictText)
      return
    }
    onChange(next)
    setMessage('')
    setRecording(false)
  }

  return (
    <div className="rounded-[6px] border border-line/60 bg-[#050a11]/30 p-3">
      <div className="text-sm font-bold text-cream">{label}</div>
      <div className="mt-1 min-h-7 text-[11px] leading-relaxed text-dim/80">{description}</div>
      <button
        type="button"
        onClick={() => {
          setRecording(true)
          setMessage('')
        }}
        onKeyDown={capture}
        className={
          'mt-2 flex h-8 w-full items-center justify-center rounded-md border text-[11px] font-black transition focus:outline-none ' +
          (recording ? 'border-hex bg-hex/12 text-hex' : 'border-line/70 bg-panel2/70 text-cream hover:border-hex/50')
        }
      >
        {recording ? recordingText : hotkeyLabel(value)}
      </button>
      {message && <div className="mt-1.5 text-[10px] font-semibold text-red">{message}</div>}
    </div>
  )
}

type PickerEntry = {
  id: number
  name: string
  desc: string
  iconLocal: string
  search?: string
  tags?: string[]
  meta?: string
  priceTotal?: number
}

type SearchableChampion = Champion & { searchExtra?: string }

function normalizedSearchText(...parts: Array<string | number | null | undefined>): string {
  return parts.filter((part) => part != null && String(part).trim().length > 0).join(' ').toLocaleLowerCase()
}

function cleanGameText(value?: string): string {
  if (!value) return ''
  return value
    .replace(/\[br\/?\]/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\[\/?[a-zA-Z]+(?::[^\]]+)?\]/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/%i:[A-Za-z0-9_]+%/g, '')
    .replace(/@[A-Za-z0-9_.:+*%/-]+@/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/@f\d+@/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.，。；;:%）)\]])/g, '$1')
    .replace(/([（([])\s+/g, '$1')
    .replace(/。\./g, '。')
    .replace(/\.\./g, '.')
    .trim()
}

function augmentDisplayText(augment: Augment): string {
  return cleanGameText(augment.desc) || cleanGameText(augment.tooltip)
}

type PickerFilter = {
  key: string
  label: string
  match: (entry: PickerEntry) => boolean
}

const ITEM_FILTERS: PickerFilter[] = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'ap', label: 'AP', match: (entry) => entry.tags?.some((tag) => ['SpellDamage', 'MagicPenetration', 'Mana', 'ManaRegen'].includes(tag)) ?? false },
  { key: 'ad', label: 'AD', match: (entry) => entry.tags?.some((tag) => ['Damage', 'AttackSpeed', 'CriticalStrike', 'ArmorPenetration', 'LifeSteal'].includes(tag)) ?? false },
  { key: 'tank', label: '坦克', match: (entry) => entry.tags?.some((tag) => ['Health', 'Armor', 'SpellBlock', 'HealthRegen'].includes(tag)) ?? false },
  { key: 'support', label: '辅助', match: (entry) => entry.tags?.some((tag) => ['ManaRegen', 'HealAndShieldPower'].includes(tag)) ?? false },
  { key: 'boots', label: '鞋子', match: (entry) => entry.tags?.includes('Boots') ?? false },
]

function isFinalRouteItem(item: Item): boolean {
  const tags = item.categories ?? []
  if (tags.some((tag) => ['Consumable', 'Trinket'].includes(tag))) return false
  if (!isSelectableRouteItem(item)) return false
  if (tags.includes('Boots')) return item.priceTotal >= 900
  if ((item.to?.length ?? 0) > 0) return false
  if (tags.includes('Lane') || tags.includes('Jungle')) return false
  return item.priceTotal >= 1600
}

function AssetPicker({
  label,
  hint,
  entries,
  selectedIds,
  max,
  allowDuplicates = false,
  filters,
  variant = 'sequence',
  onChange,
}: {
  label: string
  hint: string
  entries: PickerEntry[]
  selectedIds: number[]
  max: number
  allowDuplicates?: boolean
  filters?: PickerFilter[]
  variant?: 'sequence' | 'pool'
  onChange: (ids: number[]) => void
}) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(filters?.[0]?.key ?? 'all')
  const [resultsDismissed, setResultsDismissed] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const selected = useMemo(
    () =>
      selectedIds.flatMap((id, index) => {
        const entry = byId.get(id)
        return entry ? [{ entry, index }] : []
      }),
    [byId, selectedIds],
  )
  const normalized = query.trim().toLocaleLowerCase()
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const filter = filters?.find((entry) => entry.key === activeFilter) ?? filters?.[0]
  const results = useMemo(
    () =>
      entries
        .filter((entry) => (filter ? filter.match(entry) : true))
        .filter((entry) => {
          if (!normalized) return true
          return normalizedSearchText(entry.name, entry.search, entry.desc).includes(normalized)
        })
        .filter((entry) => allowDuplicates || !selectedSet.has(entry.id))
        .slice(0, 72),
    [allowDuplicates, entries, filter, normalized, selectedSet],
  )
  const full = selectedIds.length >= max
  const showResults = !resultsDismissed && !full && (normalized.length > 0 || (!!filters?.length && activeFilter !== (filters[0]?.key ?? 'all')))
  const isPool = variant === 'pool'
  const actionLabel = isPool
    ? (lang === 'en' ? 'Add augments' : '添加海克斯')
    : (lang === 'en' ? 'Add items' : '添加装备')
  const filterLabel = (entry: PickerFilter) => {
    if (lang !== 'en') return entry.label
    if (entry.key === 'all') return 'All'
    if (entry.key === 'tank') return 'Tank'
    if (entry.key === 'support') return 'Support'
    if (entry.key === 'boots') return 'Boots'
    return entry.label
  }
  const removeAt = (index: number) => onChange(selectedIds.filter((_, itemIndex) => itemIndex !== index))
  const clearDragState = () => {
    setDragIndex(null)
    setDropIndex(null)
  }
  const updateDropIndex = (index: number, event: DragEvent<HTMLElement>) => {
    if (dragIndex == null) return
    const rect = event.currentTarget.getBoundingClientRect()
    const next = event.clientX < rect.left + rect.width / 2 ? index : index + 1
    setDropIndex(next)
  }
  const reorderByDrop = () => {
    if (dragIndex == null || dropIndex == null) {
      clearDragState()
      return
    }
    const next = [...selectedIds]
    const [moved] = next.splice(dragIndex, 1)
    let target = dropIndex
    if (target > dragIndex) target -= 1
    target = Math.max(0, Math.min(next.length, target))
    if (target === dragIndex) {
      clearDragState()
      return
    }
    next.splice(target, 0, moved)
    onChange(next)
    clearDragState()
  }

  return (
    <div className="asset-picker flex min-w-0 flex-col">
      <div className="order-1 mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold text-cream">{label}</div>
          {hint && <div className="mt-0.5 max-w-[560px] text-[9px] leading-3 text-dim/75">{hint}</div>}
        </div>
        <span className={'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ' + (full ? 'border-hex/45 bg-hex/10 text-hex' : 'border-line/60 bg-[#07101b]/55 text-dim')}>
          {selectedIds.length}/{max}
        </span>
      </div>
      <div className="relative order-2 mb-2 rounded-[6px] border border-line/55 bg-[#08131f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_8px_20px_rgba(0,0,0,0.14)]">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-hex">
            <span className="grid h-4 w-4 place-items-center rounded border border-hex/45 bg-hex/10">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 2v8" />
                <path d="M2 6h8" />
              </svg>
            </span>
            {actionLabel}
          </div>
          <div className="text-[9px] font-bold text-dim">{full ? (lang === 'en' ? 'Full' : '已满') : (lang === 'en' ? 'Search, then click a result to add it' : '搜索后点击结果加入')}</div>
        </div>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setResultsDismissed(false)
          }}
          disabled={full}
          placeholder={full ? (lang === 'en' ? 'Limit reached' : '已达到数量上限') : (lang === 'en' ? `Search ${label}, then click to add` : `搜索${label}名称，然后点击添加`)}
          className={SEARCH_INLINE + ' border-line/65 bg-[#050a11]/72 py-2 text-[12px] placeholder:text-dim/45 disabled:cursor-not-allowed disabled:opacity-50'}
        />
        {filters && filters.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  setActiveFilter(entry.key)
                  setResultsDismissed(false)
                }}
                className={
                  'rounded-md border px-2 py-1 text-[10px] font-extrabold transition ' +
                  (activeFilter === entry.key
                    ? 'border-hex/55 bg-hex text-[#041017]'
                    : 'border-line/70 bg-panel/55 text-dim hover:border-hex/35 hover:text-cream')
                }
              >
                {filterLabel(entry)}
              </button>
            ))}
          </div>
        )}
        {showResults && (
          <div className="mt-1.5 max-h-[156px] overflow-y-auto rounded-[6px] border border-line/70 bg-[#07101b]/72 p-1.5">
            {results.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-1">
                {results.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onChange([...selectedIds, entry.id])
                      setQuery('')
                      setResultsDismissed(true)
                    }}
                    className="group flex min-w-0 flex-col items-center rounded-md border border-line/60 bg-panel/58 p-1 text-center transition hover:-translate-y-0.5 hover:border-hex/45 hover:bg-hex/8 active:translate-y-px"
                  >
                    <img src={icon(entry.iconLocal)} alt={entry.name} className="h-7 w-7 shrink-0 rounded border border-line object-cover group-hover:border-hex/40" />
                    <span className="mt-0.5 line-clamp-2 min-h-[22px] text-[9px] font-extrabold leading-[11px] text-cream">{entry.name}</span>
                    {entry.meta && <span className="mt-1 text-[10px] font-bold text-dim">{entry.meta}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-dim">{lang === 'en' ? 'No matching content found' : '没有找到匹配内容'}</div>
            )}
          </div>
        )}
      </div>
      <div className="order-3 min-h-[50px] rounded-[5px] border border-line/55 bg-[#08111d]/42 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.026)]">
        <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">{lang === 'en' ? 'Selected order' : '已选顺序'}</div>
          <div className="text-[9px] text-dim/70">{lang === 'en' ? 'Drag to adjust' : '可拖拽调整'}</div>
        </div>
        {selected.length > 0 ? (
          <div
              className={isPool ? 'grid grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-1.5' : 'grid grid-cols-6 gap-1.5'}
            onDragOver={(event) => {
              if (dragIndex == null) return
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              reorderByDrop()
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null)
            }}
          >
            {selected.map(({ entry, index }) => (
              <div
                key={`${entry.id}-${index}`}
                draggable
                onDragStart={(event) => {
                  setDragIndex(index)
                  setDropIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', `${index}`)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  updateDropIndex(index, event)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  reorderByDrop()
                }}
                onDragEnd={clearDragState}
                className={
                  'group relative flex min-w-0 cursor-grab items-center gap-1.5 overflow-hidden rounded-[5px] border bg-[#0b1624]/78 px-1.5 py-1 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:cursor-grabbing ' +
                  (isPool ? 'h-[50px] ' : 'h-[64px] ') +
                  (dragIndex === index
                    ? 'scale-[0.98] border-hex/70 opacity-45'
                    : dropIndex === index || dropIndex === index + 1
                      ? 'border-hex/65 shadow-[inset_3px_0_0_rgba(34,211,238,0.55)]'
                      : 'border-line/62 hover:-translate-y-0.5 hover:border-hex/42 hover:bg-[#101d2e]/86')
                }
              >
                {!isPool && (
                  <span className="absolute left-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded border border-line/60 bg-[#050a11]/70 px-0.5 text-[8px] font-extrabold text-dim">
                    {index + 1}
                  </span>
                )}
                <span className="absolute right-1 top-1 text-[9px] font-extrabold leading-none text-dim/70 opacity-35 transition group-hover:opacity-100">
                  ⋮⋮
                </span>
                <button
                  type="button"
                  draggable={false}
                  title={lang === 'en' ? `Remove ${entry.name}` : `移除 ${entry.name}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => removeAt(index)}
                  className="absolute right-1 bottom-1 translate-y-1 rounded border border-line/70 bg-[#050a11]/94 px-1 py-0.5 text-[7px] font-extrabold text-dim opacity-0 shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition group-hover:translate-y-0 group-hover:opacity-100 hover:border-red/42 hover:text-red"
                >
                  {lang === 'en' ? 'Remove' : '移除'}
                </button>
                <img draggable={false} src={icon(entry.iconLocal)} alt={entry.name} className={(isPool ? 'h-9 w-9' : 'h-11 w-11') + ' shrink-0 rounded border border-line object-cover shadow-[0_8px_18px_rgba(0,0,0,0.24)] group-hover:border-hex/40'} />
                <span className={(isPool ? 'text-[9px] leading-[11px]' : 'text-[10px] leading-[12px]') + ' line-clamp-2 pr-1 font-extrabold text-cream'}>
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[56px] place-items-center rounded-[6px] border border-dashed border-line/35 bg-transparent px-3 text-center text-[10px] leading-4 text-dim">
            {lang === 'en'
              ? 'Search to add content. For best results, capture one player route from match history first, then fine-tune it here.'
              : '先搜索添加内容。更推荐从对局记录采集一名玩家路线，再回来微调。'}
          </div>
        )}
      </div>
      <div className="relative order-4 hidden">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setResultsDismissed(false)
          }}
          disabled={full}
          placeholder={full ? (lang === 'en' ? 'Limit reached' : '已达到数量上限') : (lang === 'en' ? `Search ${label}` : `搜索${label}`)}
          className={SEARCH_INLINE + ' py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-50'}
        />
        {filters && filters.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  setActiveFilter(entry.key)
                  setResultsDismissed(false)
                }}
                className={
                  'rounded-md border px-2 py-1 text-[10px] font-extrabold transition ' +
                  (activeFilter === entry.key
                    ? 'border-hex/55 bg-hex text-[#041017]'
                    : 'border-line/70 bg-panel/55 text-dim hover:border-hex/35 hover:text-cream')
                }
              >
                {filterLabel(entry)}
              </button>
            ))}
          </div>
        )}
        {showResults && (
          <div className="mt-1.5 max-h-[156px] overflow-y-auto rounded-[6px] border border-line/70 bg-[#07101b]/72 p-1.5">
            {results.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(62px,1fr))] gap-1">
                {results.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onChange([...selectedIds, entry.id])
                      setQuery('')
                      setResultsDismissed(true)
                    }}
                    className="group flex min-w-0 flex-col items-center rounded-md border border-line/60 bg-panel/58 p-1 text-center transition hover:-translate-y-0.5 hover:border-hex/45 hover:bg-hex/8 active:translate-y-px"
                  >
                    <img src={icon(entry.iconLocal)} alt={entry.name} className="h-7 w-7 shrink-0 rounded border border-line object-cover group-hover:border-hex/40" />
                    <span className="mt-0.5 line-clamp-2 min-h-[22px] text-[9px] font-extrabold leading-[11px] text-cream">{entry.name}</span>
                    {entry.meta && <span className="mt-1 text-[10px] font-bold text-dim">{entry.meta}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-dim">{lang === 'en' ? 'No matching content found' : '没有找到匹配内容'}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChampionInlinePicker({
  champions,
  selectedId,
  onChange,
}: {
  champions: SearchableChampion[]
  selectedId: number
  onChange: (id: number) => void
}) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = champions.find((entry) => entry.id === selectedId) ?? champions[0]
  const normalized = query.trim().toLocaleLowerCase()
  const results = useMemo(
    () =>
      champions
        .filter((entry) => {
          if (!normalized) return true
          return normalizedSearchText(entry.name, entry.title, entry.alias, entry.pinyin, entry.initials, entry.searchExtra).includes(normalized)
        })
        .slice(0, 48),
    [champions, normalized],
  )

  return (
    <div
      className="relative"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-[58px] w-full min-w-0 items-center gap-2 rounded-[6px] border border-line/65 bg-[#050a11]/45 px-2 text-left transition hover:border-hex/42 hover:bg-[#0b1624]/68 active:translate-y-px"
      >
        {selected && <img src={icon(selected.iconLocal)} alt={selected.name} className={ICON_ASSET + ' h-10 w-10'} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-hex">Champion</span>
          <span className="mt-0.5 block truncate text-[15px] font-black text-cream">{selected?.name ?? (lang === 'en' ? 'Choose champion' : '选择英雄')}</span>
          <span className="block truncate text-[10px] font-bold text-dim">{selected?.title ?? (lang === 'en' ? 'Search and choose a champion' : '搜索英雄并选择')}</span>
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[330px] max-w-[calc(100vw-40px)] rounded-[6px] border border-line/70 bg-[#07101b]/98 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <input
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lang === 'en' ? 'Search champion: English / Chinese / pinyin' : '搜索英雄：中文 / English / 拼音'}
            className={SEARCH_INLINE + ' mb-1.5'}
          />
          <div className="max-h-[238px] overflow-y-auto pr-0.5">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
              {results.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(entry.id)
                    setQuery('')
                    setOpen(false)
                  }}
                  className={
                    'group flex min-w-0 flex-col items-center rounded-md border p-1.5 text-center transition hover:-translate-y-0.5 active:translate-y-px ' +
                    (entry.id === selectedId
                      ? 'border-hex/70 bg-hex/10'
                      : 'border-line/55 bg-[#08111d]/70 hover:border-hex/40 hover:bg-hex/8')
                  }
                >
                  <img src={icon(entry.iconLocal)} alt={entry.name} className="h-8 w-8 rounded-md border border-line object-cover group-hover:border-hex/40" />
                  <span className="mt-1 w-full truncate text-[10px] font-extrabold text-cream">{entry.name}</span>
                  <span className="mt-0.5 w-full truncate text-[9px] text-dim">{entry.alias}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DamageTypeDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const options = ['AP', 'AD', 'Tank', 'Support', 'Hybrid']
  const toneByType: Record<string, string> = {
    AP: 'bg-[#9664dc]',
    AD: 'bg-[#dc8246]',
    Tank: 'bg-[#63c07a]',
    Support: 'bg-hex',
    Hybrid: 'bg-gold',
  }

  return (
    <div
      className="relative min-w-0"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          'flex h-[58px] w-full min-w-0 flex-col justify-between rounded-[6px] border px-2 py-1.5 text-left transition active:translate-y-px ' +
          (open
            ? 'border-hex/55 bg-[#0b1624]/82'
            : 'border-line/55 bg-[#050a11]/38 hover:border-hex/38 hover:bg-[#0b1624]/64')
        }
      >
        <span className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">Type</span>
          <span className={'h-1.5 w-1.5 rounded-full ' + (toneByType[value] ?? 'bg-dim')} />
        </span>
        <span className="flex items-end justify-between gap-1">
          <span className="truncate text-[13px] font-black text-cream">{value}</span>
          <span className={'mb-0.5 text-[10px] font-black text-dim transition-transform ' + (open ? 'rotate-180' : '')}>⌄</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[154px] rounded-[6px] border border-line/70 bg-[#07101b]/98 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <div className="grid gap-1">
            {options.map((type) => (
              <button
                key={type}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(type)
                  setOpen(false)
                }}
                className={
                  'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] font-black transition active:translate-y-px ' +
                  (type === value
                    ? 'border-hex/62 bg-hex/10 text-cream'
                    : 'border-line/55 bg-[#08111d]/70 text-dim hover:border-hex/40 hover:bg-hex/8 hover:text-cream')
                }
              >
                <span className="flex items-center gap-2">
                  <span className={'h-1.5 w-1.5 rounded-full ' + (toneByType[type] ?? 'bg-dim')} />
                  {type}
                </span>
                {type === value && <span className="text-[10px] text-hex">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChampionImagePicker({
  champions,
  selectedId,
  onChange,
}: {
  champions: SearchableChampion[]
  selectedId: number
  onChange: (id: number) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = champions.find((entry) => entry.id === selectedId) ?? champions[0]
  const normalized = query.trim().toLocaleLowerCase()
  const results = useMemo(
    () =>
      champions
        .filter((entry) => {
          if (!normalized) return true
          return normalizedSearchText(entry.name, entry.title, entry.alias, entry.pinyin, entry.initials, entry.searchExtra).includes(normalized)
        })
        .slice(0, 48),
    [champions, normalized],
  )

  return (
    <div
      className="relative rounded-[6px] border border-line/75 bg-[#07101b]/72 p-2"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <div className="flex items-center gap-2 max-[900px]:flex-wrap">
        {selected && <img src={icon(selected.iconLocal)} alt={selected.name} className={ICON_ASSET + ' h-10 w-10'} />}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold tracking-[0.08em] text-hex">英雄</div>
          <div className="mt-0.5 truncate text-[14px] font-extrabold text-cream">{selected?.name ?? '选择英雄'}</div>
          <div className="truncate text-[10px] text-dim">{selected?.title ?? '搜索英雄并点头像选择'}</div>
        </div>
      </div>
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        placeholder="搜索英雄：中文 / English / 拼音 / 首字母"
        className={SEARCH_INLINE + ' mt-2'}
      />
      {open && <div className="absolute inset-x-2 top-[calc(100%+6px)] z-50 max-h-[250px] overflow-y-auto rounded-[6px] border border-line/70 bg-[#07101b]/98 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
          {results.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(entry.id)
                setQuery('')
                setOpen(false)
              }}
              className={
                'group flex min-w-0 flex-col items-center rounded-md border p-1.5 text-center transition hover:-translate-y-0.5 active:translate-y-px ' +
                (entry.id === selectedId
                  ? 'border-hex/70 bg-hex/10'
                  : 'border-line/55 bg-[#08111d]/70 hover:border-hex/40 hover:bg-hex/8')
              }
            >
              <img src={icon(entry.iconLocal)} alt={entry.name} className="h-8 w-8 rounded-md border border-line object-cover group-hover:border-hex/40" />
              <span className="mt-1 w-full truncate text-[10px] font-extrabold text-cream">{entry.name}</span>
              <span className="mt-0.5 w-full truncate text-[9px] text-dim">{entry.alias}</span>
            </button>
          ))}
        </div>
      </div>}
    </div>
  )
}

function createEmptyCustomRoute(championId: number): CustomRoute {
  return {
    id: '',
    championId,
    title: '',
    description: '',
    damageType: 'AP',
    starterItemIds: [],
    itemIds: [],
    coreAugmentIds: [],
    goodAugmentIds: [],
    trapAugmentIds: [],
    updatedAt: '',
  }
}

function readCustomRouteDraft(fallbackChampionId: number): CustomRoute | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CUSTOM_ROUTE_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as CustomRoute
    return { ...createEmptyCustomRoute(fallbackChampionId), ...draft, championId: draft.championId || fallbackChampionId }
  } catch {
    return null
  }
}

function RouteRailStep({
  index,
  title,
  done,
  active = false,
}: {
  index: number
  title: string
  done: boolean
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          'grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border text-[9px] font-black transition ' +
          (done
            ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8bd99e]'
            : active
              ? 'border-hex/45 bg-hex/10 text-hex'
              : 'border-line/50 bg-[#050a11]/32 text-dim')
        }
      >
        {done ? '✓' : index}
      </span>
      <span className={'whitespace-nowrap text-[11px] font-extrabold transition ' + (active ? 'text-cream' : done ? 'text-[#cfd8ce]' : 'text-dim')}>
        {title}
      </span>
    </div>
  )
}

function RouteQualityRow({ label, detail, done }: { label: string; detail: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2 border-b border-line/35 py-1.5 last:border-b-0">
      <span
        className={
          'mt-1 h-1.5 w-1.5 shrink-0 rounded-full ' +
          (done ? 'bg-[#8bd99e]' : 'bg-line')
        }
      />
      <span className="min-w-0">
        <span className={'block text-[11px] font-black ' + (done ? 'text-cream' : 'text-dim')}>{label}</span>
        <span className="mt-0.5 block text-[9px] font-bold leading-3 text-dim">{detail}</span>
      </span>
    </div>
  )
}

function RouteCompletionMeter({ value }: { value: number }) {
  const lang = useLang()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-black text-dim">
        <span>{lang === 'en' ? 'Completion' : '完成度'}</span>
        <span className="tabular-nums text-cream">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#050a11]">
        <div
          className={'h-full rounded-full ' + (value >= 100 ? 'bg-[#63c07a]' : value >= 60 ? 'bg-hex' : value > 0 ? 'bg-gold/80' : 'bg-line')}
          style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

function CustomRouteBuilder({
  core,
  routes,
  onChange,
  onActivate,
  onOpenHistory,
  onOpenChampion,
}: {
  core: Core
  routes: CustomRoute[]
  onChange: (routes: CustomRoute[]) => void | Promise<void>
  onActivate: (championId: number, archetypeKey: string) => void | Promise<void>
  onOpenHistory: () => void
  onOpenChampion: (championId: number) => void
}) {
  const lang = useLang()
  const isEn = lang === 'en'
  const savedMessagePrefix = isEn ? 'Saved' : '已保存'
  const firstChampionId = core.champions[0]?.id ?? 0
  const [subpage, setSubpage] = useState<'editor' | 'library'>(() =>
    window.localStorage.getItem(CUSTOM_ROUTE_SUBPAGE_STORAGE_KEY) === 'library' ? 'library' : 'editor',
  )
  const [draft, setDraft] = useState<CustomRoute>(() => readCustomRouteDraft(firstChampionId) ?? createEmptyCustomRoute(firstChampionId))
  const [editingId, setEditingId] = useState<string | null>(() => {
    const savedDraft = readCustomRouteDraft(firstChampionId)
    return savedDraft?.id || null
  })
  const [libraryRouteId, setLibraryRouteId] = useState<string | null>(
    () => window.localStorage.getItem(CUSTOM_ROUTE_LIBRARY_SELECTION_STORAGE_KEY) ?? routes[0]?.id ?? null,
  )
  const [message, setMessage] = useState('')
  const champions = useMemo<SearchableChampion[]>(
    () =>
      [...core.champions]
        .map((champion) => {
          const alt = core.altChampionById.get(champion.id)
          return {
            ...champion,
            searchExtra: normalizedSearchText(alt?.name, alt?.title, alt?.alias, alt?.pinyin, alt?.initials),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [core.altChampionById, core.champions],
  )
  const items: PickerEntry[] = useMemo(
    () => {
      const uniqueByName = new Map<string, Item>()
      for (const item of core.itemById.values()) {
        if (!isFinalRouteItem(item)) continue
        if (!uniqueByName.has(item.name)) uniqueByName.set(item.name, item)
      }
      return [...uniqueByName.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          id: item.id,
          name: item.name,
          desc: item.desc,
          iconLocal: item.iconLocal,
          search: normalizedSearchText(
            item.name,
            item.desc,
            item.categories?.join(' '),
            core.altItemById.get(item.id)?.name,
            core.altItemById.get(item.id)?.desc,
            core.altItemById.get(item.id)?.categories?.join(' '),
          ),
          tags: item.categories ?? [],
          priceTotal: item.priceTotal,
        }))
    },
    [core.altItemById, core.itemById],
  )
  const augments: PickerEntry[] = useMemo(
    () =>
      [...core.augments]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((augment) => {
          const alt = core.altAugById.get(augment.id)
          return {
            id: augment.id,
            name: augment.name,
            desc: augment.desc,
            iconLocal: augment.iconLargeLocal,
            search: normalizedSearchText(augment.name, augment.desc, augment.tooltip, alt?.name, alt?.desc, alt?.tooltip),
          }
        }),
    [core.altAugById, core.augments],
  )
  useEffect(() => {
    window.localStorage.setItem(CUSTOM_ROUTE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [draft])
  useEffect(() => {
    window.localStorage.setItem(CUSTOM_ROUTE_SUBPAGE_STORAGE_KEY, subpage)
  }, [subpage])
  useEffect(() => {
    if (libraryRouteId) window.localStorage.setItem(CUSTOM_ROUTE_LIBRARY_SELECTION_STORAGE_KEY, libraryRouteId)
  }, [libraryRouteId])
  useEffect(() => {
    if (routes.length === 0) {
      setLibraryRouteId(null)
      return
    }
    if (!libraryRouteId || !routes.some((route) => route.id === libraryRouteId)) {
      setLibraryRouteId(routes[0].id)
    }
  }, [libraryRouteId, routes])

  const edit = (route: CustomRoute) => {
    setEditingId(route.id)
    setDraft({ ...route })
    setMessage('')
    setSubpage('editor')
  }
  const startNew = () => {
    setEditingId(null)
    setDraft(createEmptyCustomRoute(firstChampionId))
    setMessage('')
    setSubpage('editor')
  }
  const patch = <K extends keyof CustomRoute>(key: K, value: CustomRoute[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const seedFromOfficialRoute = async () => {
    const file = core.buildIndex[draft.championId]
    if (!file) {
      setMessage(isEn ? 'This champion has no built-in route yet. Capture one from match history or add it manually.' : '当前英雄还没有内置路线，可以从对局记录采集或手动添加。')
      return
    }
    try {
      const build = await loadBuild(file, lang)
      const route = build.archetypes[0]
      if (!route) {
        setMessage(isEn ? 'No usable built-in route was found.' : '没有找到可用的内置路线。')
        return
      }
      setDraft((current) => ({
        ...current,
        title: current.title.trim() || route.name,
        description: current.description.trim() || route.note || current.description,
        damageType: route.damageType,
        itemIds: route.items.map((ref) => ref.id).slice(0, 6),
        coreAugmentIds: route.augments.core.map((ref) => ref.id).slice(0, 6),
        goodAugmentIds: route.augments.good.map((ref) => ref.id).slice(0, 6),
      }))
      setMessage(isEn ? 'Filled the draft from the built-in route. You can keep fine-tuning it.' : '已用内置路线填充草稿，可以继续微调。')
    } catch {
      setMessage(isEn ? 'Failed to load the built-in route. Capture one from match history or add it manually.' : '内置路线读取失败，可以从对局记录采集或手动添加。')
    }
  }

  const save = async () => {
    if (!draft.championId) {
      setMessage(isEn ? 'Choose a champion first.' : '请先选择英雄。')
      return
    }
    const champion = core.champions.find((entry) => entry.id === draft.championId)
    const id = draft.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)
    const saved: CustomRoute = {
      ...draft,
      id,
      title: draft.title.trim() || `${champion?.name ?? (isEn ? 'Unnamed' : '未命名')} ${isEn ? 'draft route' : '草稿路线'}`,
      description: draft.description.trim(),
      trapAugmentIds: [],
      updatedAt: new Date().toISOString(),
    }
    const isExistingRoute = editingId && routes.some((route) => route.id === editingId)
    const next = isExistingRoute ? routes.map((route) => (route.id === editingId ? saved : route)) : [...routes, saved]
    await onChange(next)
    if (readyToSave) await onActivate(saved.championId, customRouteKey(saved.id))
    setEditingId(saved.id)
    setDraft(saved)
    setMessage(readyToSave ? (isEn ? 'Saved and set as this champion\'s active route.' : '已保存，并设为该英雄当前路线。') : (isEn ? 'Saved as a draft. Add a full build and augments before enabling it.' : '已保存为草稿。补齐六神装和增强后再启用。'))
  }

  const removeRoute = async (route: CustomRoute) => {
    if (!window.confirm(isEn ? `Delete "${route.title || 'Unnamed route'}"? This cannot be undone.` : `删除「${route.title || '未命名路线'}」？此操作无法撤销。`)) return
    const next = routes.filter((entry) => entry.id !== route.id)
    await onChange(next)
    if (libraryRouteId === route.id) {
      setLibraryRouteId(next[0]?.id ?? null)
    }
    if (editingId === route.id) {
      startNew()
    }
    setMessage(isEn ? 'Route deleted.' : '已删除路线。')
  }

  const remove = async () => {
    const route = editingId ? routes.find((entry) => entry.id === editingId) : null
    if (!route) return
    await removeRoute(route)
  }

  const identityDone = !!draft.championId && !!draft.title.trim()
  const itemsDone = draft.itemIds.length === 6
  const coreAugmentsDone = draft.coreAugmentIds.length > 0
  const goodAugmentsDone = draft.goodAugmentIds.length > 0
  const notesDone = draft.description.trim().length >= 18
  const readyToSave = identityDone && itemsDone && coreAugmentsDone && goodAugmentsDone
  const completionItems = [
    {
      label: isEn ? 'Route identity' : '路线身份',
      detail: identityDone ? (isEn ? 'Champion and title are set' : '英雄和标题已完成') : (isEn ? 'Choose a champion and give the route a clear title' : '选择英雄，并给路线一个可识别标题'),
      done: identityDone,
    },
    {
      label: isEn ? 'Core build' : '核心出装',
      detail: itemsDone ? (isEn ? '6 items ordered' : '6 件装备已排好顺序') : (isEn ? `${Math.max(0, 6 - draft.itemIds.length)} items still needed` : `还需要 ${Math.max(0, 6 - draft.itemIds.length)} 件装备`),
      done: itemsDone,
    },
    {
      label: isEn ? 'Core augments' : '核心海克斯',
      detail: coreAugmentsDone ? (isEn ? `${draft.coreAugmentIds.length} core picks` : `${draft.coreAugmentIds.length} 个核心选择`) : (isEn ? 'Add at least 1 must-take augment' : '至少添加 1 个最想拿的海克斯'),
      done: coreAugmentsDone,
    },
    {
      label: isEn ? 'Backup augments' : '备选海克斯',
      detail: goodAugmentsDone ? (isEn ? `${draft.goodAugmentIds.length} backup picks` : `${draft.goodAugmentIds.length} 个备选选择`) : (isEn ? 'Add at least 1 backup if the core is not offered' : '至少添加 1 个核心没来时的备选'),
      done: goodAugmentsDone,
    },
    {
      label: isEn ? 'Playstyle notes' : '玩法说明',
      detail: notesDone ? (isEn ? 'Readable notes added' : '已有可读说明') : (isEn ? 'Write one line about when or how to play it' : '写一句适用场景或关键玩法'),
      done: notesDone,
    },
  ]
  const requiredDoneCount = completionItems.filter((entry) => entry.done).length
  const completionPct = Math.round((requiredDoneCount / completionItems.length) * 100)
  const qualityLabel = readyToSave ? (isEn ? 'Ready' : '可启用') : completionPct >= 60 ? (isEn ? 'Needs polish' : '需要打磨') : (isEn ? 'Draft' : '草稿')
  const qualityTone = readyToSave ? 'text-[#8bd99e]' : completionPct >= 60 ? 'text-gold' : 'text-dim'
  const missingHints = [
    !identityDone ? (isEn ? 'missing title' : '缺标题') : null,
    !itemsDone ? (isEn ? `missing ${Math.max(0, 6 - draft.itemIds.length)} items` : `缺 ${Math.max(0, 6 - draft.itemIds.length)} 件装备`) : null,
    !coreAugmentsDone ? (isEn ? 'missing core augments' : '缺核心海克斯') : null,
    !goodAugmentsDone ? (isEn ? 'missing backup augments' : '缺备选海克斯') : null,
  ].filter((entry): entry is string => !!entry)
  const routeStatus = readyToSave ? 'Ready' : 'Draft'
  const routeStatusDetail = readyToSave ? (isEn ? 'Complete and ready to enable' : '完整，可启用') : missingHints.join(' · ')
  const stepFrame = (_step: number, tone: 'side' | 'primary' | 'support' = 'support') => {
    const base = 'relative overflow-visible rounded-[6px] border p-2.5 transition-colors '
    if (tone === 'primary') return base + 'border-hex/32 bg-[#0b1624]/62'
    return base + 'border-line/60 bg-[#07101b]/48'
  }
  const selectedLibraryRoute = routes.find((route) => route.id === libraryRouteId) ?? routes[0] ?? null
  const selectedLibraryArchetype = selectedLibraryRoute ? customRouteToArchetype(selectedLibraryRoute, core) : null
  const draftChampion = champions.find((entry) => entry.id === draft.championId)

  return (
    <>
      <section className={PAGE_HEADER}>
        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3 max-[900px]:grid-cols-1">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">Route workshop</div>
            <h2 className="mt-0.5 text-[21px] font-black leading-tight text-cream">{isEn ? 'Custom Routes' : '自定义路线'}</h2>
            <p className="mt-1 max-w-[760px] text-[11px] leading-4 text-dim">
              {isEn
                ? 'Turn high-performing player loadouts into routes you can enable during champion select. Start from match history, then add notes and backup augments.'
                : '把高表现对局里的玩家出装，整理成英雄选择时可直接启用的路线。优先从对局记录采集，再补充说明和备选海克斯。'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <DashboardMiniStat label={isEn ? 'Local routes' : '本地路线'} value={routes.length} />
            <DashboardMiniStat label={isEn ? 'Completion' : '完成度'} value={completionPct} suffix="%" />
          </div>
        </div>
      </section>
      <div className="glass-control mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-line/75 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
        <div className="inline-flex rounded-[6px] border border-line/70 bg-[#07101b]/58 p-0.5">
          {[
            ['editor', isEn ? 'Custom route' : '自定义路线'],
            ['library', isEn ? 'Route library' : '路线库'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubpage(key as 'editor' | 'library')}
              className={
                'rounded-md border px-3 py-1.5 text-[12px] font-extrabold transition ' +
                (subpage === key
                  ? 'border-hex/55 bg-hex text-[#041017]'
                  : 'border-transparent bg-transparent text-dim hover:bg-white/5 hover:text-cream')
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className="rounded-md border border-hex/45 bg-hex/10 px-3 py-1.5 text-[12px] font-extrabold text-hex transition hover:bg-hex/15 active:translate-y-px"
          >
            {isEn ? 'Capture from match history' : '从对局记录采集'}
          </button>
          <button
            type="button"
            onClick={startNew}
            className="rounded-md border border-line/70 bg-panel2/60 px-3 py-1.5 text-[12px] font-extrabold text-dim transition hover:border-hex/35 hover:bg-panel2 hover:text-cream active:translate-y-px"
          >
            {isEn ? 'New blank route' : '新建空白路线'}
          </button>
        </div>
      </div>
      {subpage === 'editor' && (
        <section className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-y border-line/50 bg-[#07101b]/32 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <RouteRailStep index={1} title={isEn ? 'Route identity' : '路线身份'} done={identityDone} active={!identityDone} />
            <span className="h-px w-8 bg-line/45 max-[640px]:hidden" />
            <RouteRailStep index={2} title={isEn ? 'Build content' : '构建内容'} done={itemsDone && coreAugmentsDone && goodAugmentsDone} active={identityDone && !(itemsDone && coreAugmentsDone && goodAugmentsDone)} />
            <span className="h-px w-8 bg-line/45 max-[640px]:hidden" />
            <RouteRailStep index={3} title={isEn ? 'Publish check' : '发布检查'} done={readyToSave} active={identityDone && itemsDone && coreAugmentsDone && goodAugmentsDone && !readyToSave} />
          </div>
          <div className={'text-[10px] font-black tabular-nums ' + qualityTone}>{qualityLabel} · {completionPct}%</div>
        </section>
      )}
      {subpage === 'editor' && (
        <section className="mb-2.5 rounded-[6px] border border-line/70 bg-[#07101b]/58 p-2">
          <div className="grid grid-cols-[260px_minmax(0,1fr)_230px] items-center gap-2 max-[1040px]:grid-cols-[240px_minmax(0,1fr)] max-[760px]:grid-cols-1">
            <ChampionInlinePicker champions={champions} selectedId={draft.championId} onChange={(id) => patch('championId', id)} />

            <label className="min-w-0 rounded-[6px] border border-line/55 bg-[#050a11]/38 px-2 py-1.5 transition-colors focus-within:border-hex/45 focus-within:bg-panel/26">
              <span className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-dim">
                <span>Route title</span>
                <span className={draft.title.trim() ? 'text-dim' : 'text-red/80'}>{draft.title.length}/32</span>
              </span>
              <input
                value={draft.title}
                maxLength={32}
                onChange={(event) => patch('title', event.target.value)}
                placeholder={draftChampion ? `${draftChampion.name} ${isEn ? 'new route' : '新玩法'}` : (isEn ? 'Example: Infinite Mushroom Teemo' : '例如：无限蘑菇提莫')}
                className="h-7 w-full bg-transparent text-[18px] font-black leading-none text-cream outline-none placeholder:text-dim/50"
              />
            </label>

            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 max-[1040px]:col-span-2 max-[760px]:col-span-1">
              <DamageTypeDropdown value={draft.damageType} onChange={(type) => patch('damageType', type)} />
              <div className={'min-w-0 rounded-[6px] border px-2 py-1.5 ' + (readyToSave ? 'border-[#63c07a]/30 bg-[#63c07a]/8' : 'border-line/60 bg-[#050a11]/45')}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">Status</span>
                  <span className={'text-[12px] font-black ' + (readyToSave ? 'text-[#8bd99e]' : 'text-dim')}>
                    {routeStatus}
                  </span>
                </div>
                <div className="truncate text-[10px] font-bold text-dim" title={routeStatusDetail}>{routeStatusDetail}</div>
              </div>
            </div>
          </div>
        </section>
      )}
      {subpage === 'editor' ? (
        <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-2.5 max-[1120px]:grid-cols-1">
          <aside className="order-2 space-y-2.5 max-[1120px]:contents">
            <section className="sticky top-3 rounded-[7px] border border-line/55 bg-[#07101b]/46 p-2.5 max-[1120px]:static max-[1120px]:order-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-hex">Route score</div>
                  <div className="mt-0.5 text-[14px] font-black text-cream">{isEn ? 'Route score' : '路线评分'}</div>
                </div>
                <div className={'border-b px-0.5 pb-0.5 text-[10px] font-extrabold ' + (readyToSave ? 'border-[#63c07a]/45' : completionPct >= 60 ? 'border-gold/45' : 'border-line/60') + ' ' + qualityTone}>
                  {qualityLabel}
                </div>
              </div>
              <RouteCompletionMeter value={completionPct} />
              <div className="mt-2 grid grid-cols-3 gap-2 border-y border-line/35 py-2">
                <div>
                  <div className="text-[9px] font-black text-dim">{isEn ? 'Content' : '内容'}</div>
                  <div className="mt-0.5 text-[13px] font-black text-cream">{draft.itemIds.length + draft.coreAugmentIds.length + draft.goodAugmentIds.length}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-dim">{isEn ? 'Items' : '出装'}</div>
                  <div className="mt-0.5 text-[13px] font-black text-cream">{draft.itemIds.length}/6</div>
                </div>
                <div>
                  <div className="text-[9px] font-black text-dim">{isEn ? 'Augments' : '海克斯'}</div>
                  <div className="mt-0.5 text-[13px] font-black text-cream">{draft.coreAugmentIds.length + draft.goodAugmentIds.length}</div>
                </div>
              </div>
              <div className="mt-2">
                {completionItems.map((entry) => (
                  <RouteQualityRow key={entry.label} label={entry.label} detail={entry.detail} done={entry.done} />
                ))}
              </div>
              <div className={'mt-2 border-t border-line/35 pt-2 text-[10px] leading-4 ' + (message.startsWith(savedMessagePrefix) ? 'text-[#8bd99e]' : 'text-dim')}>
                {message || (readyToSave ? (isEn ? 'Route complete. Saving will set it as this champion\'s active route.' : '路线完整，保存后会设为该英雄当前路线。') : (isEn ? 'Complete the required items before this route can be enabled on the champion page.' : '补齐必需项后，路线才能在英雄页启用。'))}
              </div>
              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  onClick={save}
                  className={BTN_PRIMARY + ' py-2'}
                >
                  {readyToSave ? (isEn ? 'Save and enable' : '保存并启用') : (isEn ? 'Save draft' : '保存草稿')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {editingId ? (
                    <button type="button" onClick={() => onOpenChampion(draft.championId)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-hex/45 hover:text-cream">
                      {isEn ? 'View champion page' : '查看英雄页'}
                    </button>
                  ) : (
                    <button type="button" onClick={startNew} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-hex/35 hover:text-cream">
                      {isEn ? 'Clear draft' : '清空草稿'}
                    </button>
                  )}
                  <button type="button" onClick={editingId ? remove : startNew} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-red/42 hover:text-red">
                    {editingId ? (isEn ? 'Delete route' : '删除路线') : (isEn ? 'Start over' : '重新开始')}
                  </button>
                </div>
              </div>
            </section>
            <section className={stepFrame(1, 'side') + ' max-[1120px]:order-2'}>
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">Creator notes</div>
                  <h2 className="mt-0.5 text-[14px] font-extrabold text-cream">{isEn ? 'Playstyle notes' : '玩法备注'}</h2>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 flex justify-between text-[10px] font-bold text-dim">
                    <span>{isEn ? 'Playstyle intro' : '玩法介绍'}</span><span>{draft.description.length}/240</span>
                  </span>
                  <textarea
                    value={draft.description}
                    maxLength={240}
                    rows={4}
                    onChange={(event) => patch('description', event.target.value)}
                    placeholder={isEn ? 'Write the core idea, when to use it, and common traps.' : '写核心思路、适用场景、容易踩的坑。'}
                    className={SEARCH_INLINE + ' resize-none leading-5'}
                  />
                </label>
              </div>
            </section>

            <section className="hidden">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[12px] font-extrabold text-cream">{isEn ? 'Save' : '保存'}</div>
                <div className={'rounded border px-2 py-0.5 text-[10px] font-extrabold ' + (readyToSave ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8bd99e]' : 'border-line/60 bg-[#050a11]/55 text-dim')}>
                  {readyToSave ? 'Ready' : 'Draft'}
                </div>
              </div>
              <div className={'rounded-[5px] border px-2 py-1.5 text-[10px] leading-4 ' + (message.startsWith(savedMessagePrefix) ? 'border-[#63c07a]/30 bg-[#63c07a]/10 text-[#8bd99e]' : 'border-line/50 bg-[#050a11]/38 text-dim')}>
                {message || routeStatusDetail}
              </div>

              <div className="mt-2 grid gap-2">
                <button
                  type="button"
                  onClick={save}
                  className={BTN_PRIMARY + ' py-2'}
                >
                  {readyToSave ? (isEn ? 'Save and enable' : '保存并启用') : (isEn ? 'Save draft' : '保存草稿')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {editingId ? (
                    <button type="button" onClick={() => onOpenChampion(draft.championId)} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-hex/45 hover:text-cream">
                      {isEn ? 'View champion page' : '查看英雄页'}
                    </button>
                  ) : (
                    <button type="button" onClick={startNew} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-hex/35 hover:text-cream">
                      {isEn ? 'Clear draft' : '清空草稿'}
                    </button>
                  )}
                  <button type="button" onClick={editingId ? remove : startNew} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-dim transition hover:border-red/42 hover:text-red">
                    {editingId ? (isEn ? 'Delete route' : '删除路线') : (isEn ? 'Start over' : '重新开始')}
                  </button>
                </div>
              </div>
            </section>
          </aside>

          <div className="order-1 grid grid-cols-2 gap-2.5 max-[900px]:grid-cols-1 max-[1120px]:order-2">
            <section className={stepFrame(2, 'primary') + ' col-span-2 focus-within:z-40 max-[900px]:col-span-1'}>
              <div className="mb-2 flex items-start justify-between gap-2 border-b border-line/45 pb-2">
                <div className="flex items-start gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-hex">Build board</div>
                    <h3 className="mt-0.5 text-[16px] font-extrabold text-cream">{isEn ? 'Full build order' : '六神装顺序'}</h3>
                  </div>
                </div>
              </div>
              {draft.itemIds.length === 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[6px] border border-line/45 bg-[#07101b]/36 px-2 py-1.5">
                  <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-dim">Start</span>
                  <button
                    type="button"
                    onClick={onOpenHistory}
                    className="rounded-md border border-hex/45 bg-hex/10 px-2.5 py-1.5 text-[11px] font-black text-hex transition hover:bg-hex/15 active:translate-y-px"
                  >
                    {isEn ? 'Import from match' : '从对局导入'}
                  </button>
                  <button
                    type="button"
                    onClick={seedFromOfficialRoute}
                    className="rounded-md px-2 py-1.5 text-[11px] font-bold text-dim transition hover:bg-white/5 hover:text-cream active:translate-y-px"
                  >
                    {isEn ? 'Use built-in route' : '使用内置路线'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessage(isEn ? 'Search item names below, then click a result to add it to the route.' : '从下方搜索装备名称，点击结果即可加入路线。')}
                    className="rounded-md px-2 py-1.5 text-[11px] font-bold text-dim transition hover:bg-white/5 hover:text-cream active:translate-y-px"
                  >
                    {isEn ? 'Add manually' : '手动添加'}
                  </button>
                  <span className="ml-auto text-[9px] font-bold text-dim/75 max-[720px]:ml-0">{isEn ? 'Recommended: capture a real route first' : '建议先采集真实路线'}</span>
                </div>
              )}
              <AssetPicker
                label={isEn ? 'Items' : '装备'}
                hint={isEn ? 'Drag to reorder.' : '拖拽调整顺序。'}
                entries={items}
                selectedIds={draft.itemIds}
                max={6}
                filters={ITEM_FILTERS}
                onChange={(ids) => patch('itemIds', ids)}
              />
            </section>

            <section className={stepFrame(3, 'support') + ' focus-within:z-40'}>
              <div className="mb-2 flex items-start justify-between gap-2 border-b border-line/45 pb-2">
                <div className="flex items-start gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gold/85">Hextech pool</div>
                    <h3 className="mt-0.5 text-[14px] font-extrabold text-cream">{isEn ? 'Core augments' : '核心海克斯'}</h3>
                  </div>
                </div>
              </div>
              <AssetPicker label={isEn ? 'Core augments' : '核心海克斯'} hint={isEn ? 'Prioritize these.' : '优先拿。'} entries={augments} selectedIds={draft.coreAugmentIds} max={6} variant="pool" onChange={(ids) => patch('coreAugmentIds', ids)} />
            </section>

            <section className={stepFrame(4, 'support') + ' focus-within:z-40'}>
              <div className="mb-2 flex items-start justify-between gap-2 border-b border-line/45 pb-2">
                <div className="flex items-start gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">Fallback pool</div>
                    <h3 className="mt-0.5 text-[14px] font-extrabold text-cream">{isEn ? 'Backup augments' : '备选海克斯'}</h3>
                  </div>
                </div>
              </div>
              <AssetPicker label={isEn ? 'Backup augments' : '备选海克斯'} hint={isEn ? 'Pick these when the core is not offered.' : '核心没来时选。'} entries={augments} selectedIds={draft.goodAugmentIds} max={6} variant="pool" onChange={(ids) => patch('goodAugmentIds', ids)} />
            </section>
          </div>
        </div>
      ) : (
        <section className="relative overflow-hidden rounded-[6px] border border-line/75 bg-[#0b1421] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line/70" />
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-line/55 pb-2.5">
            <div>
              <div className="text-[11px] font-extrabold tracking-[0.08em] text-hex">{isEn ? 'Route library' : '路线库'}</div>
              <h3 className="mt-0.5 text-[16px] font-extrabold text-cream">{isEn ? 'All custom routes' : '所有自定义路线'}</h3>
              <p className="mt-0.5 text-[10px] text-dim">
                {isEn
                  ? 'Open any route to preview items and augments below. Edit only when you need changes.'
                  : '点开任意路线会在下方预览装备和增强，需要修改时再进入编辑。'}
              </p>
            </div>
            <div className="rounded-lg border border-line/70 bg-[#07101b]/62 px-3 py-2 text-xs font-extrabold text-cream">{routes.length} {isEn ? 'routes' : '条'}</div>
          </div>
          {routes.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
              {routes.map((route) => {
                const routeChampion = core.champions.find((entry) => entry.id === route.championId)
                const routeDoneCount =
                  (route.title.trim() ? 1 : 0) +
                  (route.itemIds.length === 6 ? 1 : 0) +
                  (route.coreAugmentIds.length > 0 ? 1 : 0) +
                  (route.goodAugmentIds.length > 0 ? 1 : 0) +
                  (route.description.trim().length >= 18 ? 1 : 0)
                const routePct = Math.round((routeDoneCount / 5) * 100)
                const updatedLabel = route.updatedAt ? new Date(route.updatedAt).toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit' }) : (isEn ? 'Unsaved' : '未保存')
                return (
                  <button
                    type="button"
                    key={route.id}
                    onClick={() => setLibraryRouteId(route.id)}
                    className={
                      'group flex min-w-0 items-center gap-2 rounded-[7px] border p-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:-translate-y-0.5 ' +
                      (selectedLibraryRoute?.id === route.id
                        ? 'border-hex/45 bg-hex/8'
                        : 'border-line/55 bg-[#09121f]/58 hover:border-hex/35 hover:bg-white/5')
                    }
                  >
                    {routeChampion && (
                      <img src={icon(routeChampion.iconLocal)} alt={routeChampion.name} className="h-10 w-10 shrink-0 rounded-md border border-line/70 object-cover group-hover:border-hex/40" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-extrabold text-cream">{route.title || (isEn ? 'Unnamed route' : '未命名路线')}</span>
                        <span className={'shrink-0 rounded border px-1.5 py-px text-[9px] font-black ' + (routePct >= 80 ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8bd99e]' : 'border-line/55 bg-[#07101b]/70 text-dim')}>
                          {routePct}%
                        </span>
                      </span>
                      <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                        <span className="inline-flex rounded-md border border-line/60 bg-[#07101b]/70 px-2 py-0.5 text-[10px] font-extrabold text-dim">{routeChampion?.name} · {route.damageType}</span>
                        <span className="text-[9px] font-bold text-dim">{isEn ? 'Edited' : '编辑'} {updatedLabel}</span>
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-dim">{route.description || (isEn ? 'No notes yet' : '无介绍')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-line/70 bg-[#07101b]/42 p-8 text-center">
              <div className="text-sm font-extrabold text-cream">{isEn ? 'No custom routes yet' : '还没有自定义路线'}</div>
              <div className="mx-auto mt-2 max-w-[520px] text-xs leading-5 text-dim">
                {isEn
                  ? 'The fastest path is to capture one player route from match history, then come back to add a title, notes, and backup augments.'
                  : '最快的方式是从对局记录采集一名玩家路线，再回来补标题、说明和备选海克斯。'}
              </div>
              <div className="mx-auto mt-4 max-w-[360px] rounded-[8px] border border-line/55 bg-[#09121f]/70 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2">
                  {draftChampion ? (
                    <img src={icon(draftChampion.iconLocal)} alt={draftChampion.name} className="h-10 w-10 rounded-[6px] border border-line/70 object-cover opacity-75" />
                  ) : (
                    <div className="h-10 w-10 rounded-[6px] border border-dashed border-line/55 bg-panel/45" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-black text-cream">{draftChampion?.name ?? (isEn ? 'Champion' : '英雄')} {isEn ? 'live route' : '实战路线'}</div>
                    <div className="mt-1 inline-flex rounded border border-line/55 bg-[#07101b]/70 px-2 py-px text-[9px] font-black text-dim">AP · {isEn ? 'example preview' : '示例预览'}</div>
                  </div>
                  <div className="rounded border border-[#63c07a]/35 bg-[#63c07a]/10 px-2 py-1 text-[9px] font-black text-[#8bd99e]">{isEn ? 'Preview' : '预览'}</div>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-7 w-7 rounded border border-line/45 bg-panel/55" />
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="rounded-md border border-hex/45 bg-hex/10 px-3 py-2 text-[12px] font-extrabold text-hex transition hover:bg-hex/15 active:translate-y-px"
                >
                  {isEn ? 'Capture from match history' : '从对局记录采集'}
                </button>
                <button
                  type="button"
                  onClick={startNew}
                  className="rounded-md border border-line/70 bg-panel2/60 px-3 py-2 text-[12px] font-extrabold text-dim transition hover:border-hex/35 hover:bg-panel2 hover:text-cream active:translate-y-px"
                >
                  {isEn ? 'New blank route' : '新建空白路线'}
                </button>
                <button
                  type="button"
                  onClick={() => setSubpage('editor')}
                  className="rounded-md border border-line/65 bg-panel/45 px-3 py-2 text-[12px] font-extrabold text-dim transition hover:border-line hover:text-cream active:translate-y-px"
                >
                  {isEn ? 'Open editor' : '查看编辑器'}
                </button>
              </div>
            </div>
          )}
          {selectedLibraryRoute && selectedLibraryArchetype && (
            <div className="mt-5 border-t border-line/60 pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-extrabold tracking-[0.08em] text-hex">{isEn ? 'Route preview' : '路线预览'}</div>
                  <div className="mt-1 text-sm text-dim">
                    {isEn ? 'Preview items and augments here without interrupting the current draft.' : '这里直接查看出装和增强，不会打断当前草稿。'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onActivate(selectedLibraryRoute.championId, customRouteKey(selectedLibraryRoute.id))}
                    className={BTN_PRIMARY}
                  >
                    {isEn ? 'Enable this route' : '启用这条路线'}
                  </button>
                  <button
                    type="button"
                    onClick={() => edit(selectedLibraryRoute)}
                    className="rounded-lg border border-line/70 bg-[#07101b]/65 px-3 py-2 text-xs font-extrabold text-dim transition hover:border-hex/45 hover:text-cream active:translate-y-px"
                  >
                    {isEn ? 'Edit this route' : '编辑这条路线'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRoute(selectedLibraryRoute)}
                    className="rounded-lg border border-red/45 bg-red/8 px-3 py-2 text-xs font-extrabold text-red transition hover:bg-red/12 active:translate-y-px"
                  >
                    {isEn ? 'Delete route' : '删除路线'}
                  </button>
                </div>
              </div>
              <ArchetypeCard arch={selectedLibraryArchetype} augById={core.augById} itemById={core.itemById} />
            </div>
          )}
        </section>
      )}
    </>
  )
}

function SettingsSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={SURFACE + ' p-3.5 ' + className}>
      <h3 className="mb-3 text-[13px] font-black text-cream">{title}</h3>
      {children}
    </section>
  )
}

type SettingsPage = 'overlay' | 'app' | 'account' | 'updates'

function SettingsNavItem({
  label,
  desc,
  active = false,
  onClick,
}: {
  label: string
  desc?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full rounded-[6px] border px-3 py-2 text-left transition active:translate-y-px ' +
        (active
          ? 'border-hex/45 bg-hex/10 text-hex shadow-[inset_0_-2px_0_rgba(34,211,238,0.75)]'
          : 'border-transparent text-dim hover:border-line/55 hover:bg-white/[0.035] hover:text-cream')
      }
    >
      <span className="block text-[12px] font-black">{label}</span>
      {desc && <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-dim/80">{desc}</span>}
    </button>
  )
}

const POSITION_LABEL: Record<OverlaySettings['position'], string> = {
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
}
const POSITION_KEY: Record<OverlaySettings['position'], string> = {
  'top-left': 'topLeft',
  'top-right': 'topRight',
  'bottom-left': 'bottomLeft',
  'bottom-right': 'bottomRight',
}

function accountName(account: PersistedAccountSummary, lang: Lang): string {
  if (!account.gameName) return t(lang, 'settings.account.unknown', { suffix: account.puuid.slice(-6) })
  return account.tagLine ? `${account.gameName}#${account.tagLine}` : account.gameName
}

function fmtAccountDate(value: string | undefined, lang: Lang): string {
  if (!value) return t(lang, 'common.none')
  return new Date(value).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit' })
}

function updateStatusText(status: UpdateStatus | null): string {
  if (!status) return '尚未检查更新'
  if (status.state === 'checking') return '正在检查更新...'
  if (status.state === 'available') return `发现新版本 ${status.version ?? ''}，正在下载`
  if (status.state === 'downloading') return `正在下载 ${status.percent ?? 0}%`
  if (status.state === 'downloaded') return `新版本 ${status.version ?? ''} 已下载，重启后安装`
  if (status.state === 'not-available') return status.message ?? `当前已是最新版本 ${status.version ?? ''}`
  if (status.state === 'error') return status.message ?? '检查更新失败'
  return `当前版本 ${status.version ?? ''}`
}

function SettingsTab({ summoner, onOpenFeedback, onReportProblem }: { summoner: SummonerInfo | null; onOpenFeedback: () => void; onReportProblem: () => void }) {
  const t = useT()
  const lang = useLang()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<PersistedAccountSummary[] | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('overlay')

  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.getSettings().then(setSettings)
    window.mayhem!.getStoredAccounts().then(setAccounts)
    window.mayhem!.getUpdateStatus().then(setUpdateStatus)
    window.mayhem!.onSettingsChanged(setSettings)
    window.mayhem!.onUpdateStatus(setUpdateStatus)
  }, [])

  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.getStoredAccounts().then(setAccounts)
  }, [summoner?.gameName, summoner?.tagLine])

  async function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!isElectron()) return
    const updated = await window.mayhem!.setSetting(key, value)
    setSettings(updated)
  }

  async function forgetAccount(puuid: string) {
    if (!isElectron()) return
    const updated = await window.mayhem!.forgetStoredAccount(puuid)
    setAccounts(updated)
  }

  async function checkUpdates() {
    if (!isElectron()) return
    const status = await window.mayhem!.checkForUpdates()
    setUpdateStatus(status)
  }

  async function installUpdate() {
    if (!isElectron()) return
    await window.mayhem!.installUpdate()
  }

  if (!isElectron()) {
    return (
      <>
        <PageHeader
          eyebrow={lang === 'en' ? 'Desktop settings' : '桌面端设置'}
          title={t('settings.title', '设置')}
          description={
            lang === 'en'
              ? 'Settings are available in the real Mayhempedia desktop window. Browser preview shows the access requirements and setting groups.'
              : '设置需要在真正的 Mayhempedia 客户端窗口里读取。浏览器预览会展示设置入口和权限说明。'
          }
          metrics={[
            { label: lang === 'en' ? 'Runtime' : '运行环境', value: lang === 'en' ? 'Browser' : '浏览器' },
            { label: lang === 'en' ? 'Client API' : '客户端接口', value: lang === 'en' ? 'Missing' : '未连接' },
          ]}
        />
        <section className={SURFACE + ' p-5'}>
          <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-4 max-[900px]:grid-cols-1">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">
                {lang === 'en' ? 'Preview mode' : '预览模式'}
              </div>
              <h3 className="mt-1 text-[18px] font-black text-cream">
                {lang === 'en' ? 'Open the desktop app to edit settings.' : '打开桌面客户端后即可编辑设置。'}
              </h3>
              <p className="mt-2 max-w-[680px] text-[12px] leading-5 text-dim">{t('settings.electronOnly')}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 max-[760px]:grid-cols-1">
                {[
                  [lang === 'en' ? 'Overlay behavior' : 'Overlay 行为', lang === 'en' ? 'Position, opacity, move hotkey' : '位置、透明度、移动快捷键'],
                  [lang === 'en' ? 'App preferences' : '应用偏好', lang === 'en' ? 'Startup, zoom, language' : '启动、缩放、语言'],
                  [lang === 'en' ? 'Account and data' : '账号与数据', lang === 'en' ? 'Stored accounts and local match history' : '已保存账号与本地对局记录'],
                  [lang === 'en' ? 'Updates' : '应用更新', lang === 'en' ? 'Version check and installer state' : '版本检查与安装状态'],
                ].map(([label, desc]) => (
                  <div key={label} className="rounded-[7px] border border-line/60 bg-[#07101b]/46 p-3">
                    <div className="text-[12px] font-black text-cream">{label}</div>
                    <div className="mt-1 text-[11px] leading-4 text-dim">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[8px] border border-line/65 bg-[#07101b]/58 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-dim">
                {lang === 'en' ? 'Why locked' : '为什么不可编辑'}
              </div>
              <div className="mt-3 space-y-3 text-[12px] leading-5 text-dim">
                <p>{lang === 'en' ? 'Browser preview does not expose window.mayhem, so it cannot read or save local client settings.' : '浏览器预览没有 window.mayhem，因此无法读取或保存本地客户端设置。'}</p>
                <p>{lang === 'en' ? 'In the packaged app, this page becomes the control room for overlay behavior, local data, account memory, and updates.' : '在打包后的客户端里，这里会成为 Overlay、本地数据、账号记忆和更新的控制室。'}</p>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }
  if (!settings) {
    return (
      <>
        <PageHeader eyebrow={lang === 'en' ? 'Desktop settings' : '桌面端设置'} title={t('settings.title', '设置')} />
        <EmptyState title={t('settings.loading')} description={lang === 'en' ? 'Loading local preferences and client state.' : '正在读取本地偏好和客户端状态。'} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={lang === 'en' ? 'Desktop settings' : '桌面端设置'}
        title={t('settings.title', '设置')}
        description={lang === 'en' ? 'Control overlay behavior, local data, account memory, and update flow from one place.' : '集中管理 Overlay 行为、本地数据、账号记忆和应用更新。'}
        metrics={[
          { label: lang === 'en' ? 'Account' : '账号', value: summoner ? summoner.gameName : t('settings.account.none') },
          { label: lang === 'en' ? 'Stored' : '已保存', value: accounts?.length ?? 0, tone: 'accent' },
        ]}
      />

      <div className="grid grid-cols-[210px_minmax(0,1fr)] gap-3 items-start max-[900px]:grid-cols-1">
        <aside className={SURFACE + ' sticky top-6 p-3 max-[900px]:static'}>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">Settings</div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingsNavItem
              label={t('settings.overlay.title', 'Overlay 行为')}
              desc={lang === 'en' ? 'Position, opacity, hotkeys' : '位置、透明度、快捷键'}
              active={settingsPage === 'overlay'}
              onClick={() => setSettingsPage('overlay')}
            />
            <SettingsNavItem
              label={lang === 'en' ? 'App' : '应用'}
              desc={lang === 'en' ? 'Startup, zoom, language' : '启动、缩放、语言'}
              active={settingsPage === 'app'}
              onClick={() => setSettingsPage('app')}
            />
            <SettingsNavItem
              label={lang === 'en' ? 'Account & Data' : '账号与数据'}
              desc={lang === 'en' ? 'Local history and privacy' : '本地记录与隐私'}
              active={settingsPage === 'account'}
              onClick={() => setSettingsPage('account')}
            />
            <SettingsNavItem
              label={lang === 'en' ? 'Updates' : '应用更新'}
              desc={lang === 'en' ? 'Version and installer' : '版本检查与安装'}
              active={settingsPage === 'updates'}
              onClick={() => setSettingsPage('updates')}
            />
          </div>
          <div className="mt-4 rounded-[6px] border border-line/65 bg-panel2/30 p-3">
            <div className="text-[11px] font-bold text-dim">{t('settings.account.title', '账号')}</div>
            <div className="mt-1 truncate text-sm font-extrabold text-cream">
              {summoner ? `${summoner.gameName}#${summoner.tagLine}` : t('settings.account.none')}
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-dim">{t('settings.account.desc')}</div>
          </div>
        </aside>

        <div className="min-w-0">
          {settingsPage === 'overlay' && (
            <div className="grid gap-3">
              <SettingsSection title={t('settings.overlay.title', 'Overlay 行为')}>
                <div className="grid gap-3">
                  <div>
                    <div className="mb-2 text-sm">{t('settings.overlay.position')}</div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(POSITION_LABEL) as OverlaySettings['position'][]).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => update('overlay', { ...settings.overlay, position: pos })}
                        className={
                          'px-3 py-1.5 rounded-[6px] text-xs cursor-pointer transition ' +
                          (settings.overlay.position === pos
                              ? 'bg-hex text-[#041017] font-bold'
                              : 'border border-line/60 bg-panel2/55 text-dim hover:border-hex/35 hover:text-cream')
                        }
                        >
                          {t(`settings.overlay.pos.${POSITION_KEY[pos]}`, POSITION_LABEL[pos])}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">{t('settings.overlay.opacity')}</div>
                      <span className="text-xs text-dim">{Math.round(settings.overlay.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={1}
                      step={0.05}
                      value={settings.overlay.opacity}
                      onChange={(e) => update('overlay', { ...settings.overlay, opacity: parseFloat(e.target.value) })}
                      className="mt-2 w-full accent-hex"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-[980px]:grid-cols-1">
                    <HotkeyRecorder
                      label={t('settings.overlay.hotkey')}
                      description={t('settings.overlay.hotkeyNote')}
                      value={settings.overlay.hotkey}
                      reserved={[settings.overlay.moveHotkey, settings.mainWindowHotkey, { ctrl: true, shift: true, alt: false, key: 'C' }]}
                      onChange={(hotkey) => update('overlay', { ...settings.overlay, hotkey })}
                      recordingText={t('settings.hotkey.recording')}
                      invalidText={t('settings.hotkey.requiresModifier')}
                      conflictText={t('settings.hotkey.conflict')}
                    />
                    <HotkeyRecorder
                      label={t('settings.mainWindow.hotkey')}
                      description={t('settings.mainWindow.hotkeyNote')}
                      value={settings.mainWindowHotkey}
                      reserved={[settings.overlay.hotkey, settings.overlay.moveHotkey, { ctrl: true, shift: true, alt: false, key: 'C' }]}
                      onChange={(hotkey) => update('mainWindowHotkey', hotkey)}
                      recordingText={t('settings.hotkey.recording')}
                      invalidText={t('settings.hotkey.requiresModifier')}
                      conflictText={t('settings.hotkey.conflict')}
                    />
                    <HotkeyRecorder
                      label={t('settings.overlay.moveHotkey')}
                      description={t('settings.overlay.moveHotkeyNote')}
                      value={settings.overlay.moveHotkey}
                      reserved={[settings.overlay.hotkey, settings.mainWindowHotkey, { ctrl: true, shift: true, alt: false, key: 'C' }]}
                      onChange={(hotkey) => update('overlay', { ...settings.overlay, moveHotkey: hotkey })}
                      recordingText={t('settings.hotkey.recording')}
                      invalidText={t('settings.hotkey.requiresModifier')}
                      conflictText={t('settings.hotkey.conflict')}
                    />
                  </div>
                  {settings.overlay.customPos && (
                    <div className="flex items-center justify-between rounded-[6px] border border-line/60 bg-[#050a11]/30 p-3">
                      <div className="text-xs text-dim">
                        {t('settings.overlay.customPos')} ({settings.overlay.customPos.x}, {settings.overlay.customPos.y})
                      </div>
                      <button
                        onClick={() => update('overlay', { ...settings.overlay, customPos: null })}
                        className="rounded-[6px] bg-panel2 px-2.5 py-1 text-xs text-dim transition hover:text-cream"
                      >
                        {t('settings.overlay.resetPos')}
                      </button>
                    </div>
                  )}
                </div>
              </SettingsSection>
            </div>
          )}

          {settingsPage === 'app' && (
            <div className="grid grid-cols-2 gap-3 max-[1180px]:grid-cols-1">
              <SettingsSection title={t('settings.startup.title', '启动与窗口')}>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm">{t('settings.startup.autoLaunch')}</div>
                    <div className="mt-0.5 text-xs text-dim">{t('settings.startup.autoLaunchDesc')}</div>
                  </div>
                  <Toggle on={settings.autoLaunch} onClick={() => update('autoLaunch', !settings.autoLaunch)} />
                </div>
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{t('settings.startup.zoom')}</div>
                    <span className="text-xs text-dim">{Math.round(settings.zoomFactor * 100)}%</span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5 rounded-[6px] border border-line/60 bg-ink/30 p-1.5">
                    {ZOOM_PRESETS.map((zoom) => (
                      <button
                        key={zoom}
                        onClick={() => update('zoomFactor', zoom)}
                        className={
                          'rounded-[5px] px-2 py-1.5 text-xs font-extrabold transition cursor-pointer ' +
                          (settings.zoomFactor === zoom
                            ? 'bg-hex text-[#041017]'
                            : 'border border-line/55 bg-panel2/45 text-dim hover:border-hex/35 hover:bg-panel2/80 hover:text-cream')
                        }
                      >
                        {Math.round(zoom * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title={t('settings.language.title', '语言')}>
                <div className="flex gap-2">
                  {(['zh', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => update('language', lang)}
                        className={
                          'px-3 py-1.5 rounded-[6px] text-xs cursor-pointer transition ' +
                          (settings.language === lang
                          ? 'bg-hex text-[#041017] font-bold'
                          : 'border border-line/60 bg-panel2/55 text-dim hover:border-hex/35 hover:text-cream')
                      }
                    >
                      {t(`settings.language.${lang}`, lang === 'zh' ? '中文' : 'English')}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-dim">{t('settings.language.note')}</div>
              </SettingsSection>

              <SettingsSection title={t('settings.notification.title', '通知')}>
                <div className="flex gap-2">
                  {(['inpage', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => update('notificationMode', mode)}
                        className={
                          'px-3 py-1.5 rounded-[6px] text-xs cursor-pointer transition ' +
                          (settings.notificationMode === mode
                          ? 'bg-hex text-[#041017] font-bold'
                          : 'border border-line/60 bg-panel2/55 text-dim hover:border-hex/35 hover:text-cream')
                      }
                    >
                      {mode === 'inpage' ? t('settings.notification.inpage') : t('settings.notification.system')}
                    </button>
                  ))}
                </div>
              </SettingsSection>

              <SettingsSection title={t('settings.dashboard.title', '主页内容显示')}>
                {(
                  [
                    ['identityCard', 'settings.dashboard.identityCard', '身份卡'],
                    ['versionChanges', 'settings.dashboard.versionChanges', '本版本变动'],
                    ['recentMatches', 'settings.dashboard.recentMatches', '近期对局'],
                    ['achievements', 'settings.dashboard.achievements', '新解锁'],
                  ] as [keyof DashboardSections, string, string][]
                ).map(([key, tkey, fallback]) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div className="text-sm">{t(tkey, fallback)}</div>
                    <Toggle
                      on={settings.dashboardSections[key]}
                      onClick={() =>
                        update('dashboardSections', { ...settings.dashboardSections, [key]: !settings.dashboardSections[key] })
                      }
                    />
                  </div>
                ))}
              </SettingsSection>
            </div>
          )}

          {settingsPage === 'account' && (
            <div className="grid gap-3">
              <SettingsSection title={t('settings.account.title', '账号')}>
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                  <div>
                    <div className="text-sm">{summoner ? `${summoner.gameName}#${summoner.tagLine}` : t('settings.account.none')}</div>
                    <div className="mt-1 text-xs text-dim">{t('settings.account.desc')}</div>
                  </div>
                  <button
                    onClick={() => window.mayhem!.getStoredAccounts().then(setAccounts)}
                    className="shrink-0 rounded-[6px] bg-panel2 px-2.5 py-1 text-xs text-dim transition hover:text-cream"
                  >
                    {t('settings.account.refresh')}
                  </button>
                </div>
                <div className="pt-3">
                  {!accounts && <div className="py-2 text-xs text-dim">{t('settings.account.loading')}</div>}
                  {accounts && accounts.length === 0 && (
                    <EmptyState
                      compact
                      title={t('settings.account.empty')}
                      description={lang === 'en' ? 'Connect the client once to let Mayhempedia remember account history locally.' : '连接一次客户端后，Mayhempedia 会在本地记住账号和对局记录。'}
                    />
                  )}
                  {accounts && accounts.length > 0 && (
                    <div className="flex flex-col">
                      {accounts.map((account) => (
                        <div key={account.puuid} className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-b-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm">{accountName(account, lang)}</span>
                              {account.isCurrent && (
                                <span className="shrink-0 rounded bg-hex/10 px-1.5 py-px text-[10px] text-hex">{t('settings.account.current')}</span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-dim">
                              {t('settings.account.matches', '{n} 场').replace('{n}', String(account.matchCount))} ·{' '}
                              {t('settings.account.detailsCached', '{n} 场详情缓存').replace('{n}', String(account.detailCount))} ·{' '}
                              {t('settings.account.lastMatch', '最近对局')} {fmtAccountDate(account.latestGameCreationDate, lang)}
                            </div>
                          </div>
                          <button onClick={() => forgetAccount(account.puuid)} className="shrink-0 text-xs text-dim transition hover:text-red">
                            {t('settings.account.forget')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SettingsSection>

              <SettingsSection title={t('settings.privacy.title', '数据与隐私')}>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm">{t('settings.privacy.persist')}</div>
                    <div className="mt-0.5 max-w-xl text-xs text-dim">{t('settings.privacy.persistDesc')}</div>
                  </div>
                  <Toggle
                    on={settings.persistMatchHistory}
                    onClick={() => update('persistMatchHistory', !settings.persistMatchHistory)}
                  />
                </div>
                <div className="mt-2 rounded-[6px] border border-line/60 bg-[#07101b]/46 p-3 text-xs leading-5 text-dim">
                  <div className="font-bold text-cream">{lang === 'en' ? 'Read-only client access' : '只读客户端连接'}</div>
                  <p className="mt-1">
                    {lang === 'en'
                      ? 'Mayhempedia reads local League Client state to show your champion, match history, items, and augments. It does not read game memory, automate gameplay, collect Riot credentials, or upload your local history.'
                      : 'Mayhempedia 只读取本机 League Client 状态，用于显示英雄、对局记录、装备和海克斯；不会读取游戏内存、自动操作游戏、收集 Riot 登录凭证，也不会上传本地对局记录。'}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
                  <div>
                    <div className="text-sm">{lang === 'en' ? 'Beta feedback' : 'Beta 反馈'}</div>
                    <div className="mt-0.5 max-w-xl text-xs text-dim">
                      {lang === 'en' ? 'Open the feedback form only when you choose to send a rating or comment.' : '只会在你主动选择评分或评论后，才打开外部反馈表单。'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={onOpenFeedback} className={BTN_SECONDARY}>
                      {lang === 'en' ? 'Share feedback' : '留下反馈'}
                    </button>
                    <button type="button" onClick={onReportProblem} className={BTN_DANGER}>
                      {lang === 'en' ? 'Report a problem' : '报告问题'}
                    </button>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {settingsPage === 'updates' && (
            <div className="grid gap-3">
              <SettingsSection title={lang === 'en' ? 'Application updates' : '应用更新'}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm">{lang === 'en' ? 'Update status' : '更新状态'}</div>
                    <div className="mt-0.5 truncate text-xs text-dim">{updateStatusText(updateStatus)}</div>
                  </div>
                  {updateStatus?.state === 'downloaded' ? (
                    <button
                      type="button"
                      onClick={installUpdate}
                      className={BTN_PRIMARY + ' py-2'}
                    >
                      {lang === 'en' ? 'Restart to install' : '重启安装'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={checkUpdates}
                      disabled={updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'}
                      className="shrink-0 rounded-[6px] border border-line px-3 py-2 text-xs font-extrabold text-dim transition hover:border-hex/45 hover:text-cream disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {lang === 'en' ? 'Check for updates' : '检查更新'}
                    </button>
                  )}
                </div>
              </SettingsSection>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ---------------- 视图标题 / 英雄网格 / 海克斯 / Tier ---------------- */
function ViewHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <PageHeader eyebrow="Mayhempedia" title={title} description={meta} />
  )
}

interface ChampionRouteSummary {
  count: number
  names: string[]
  damageTypes: string[]
}

function ChampionGrid({
  core,
  onPick,
  detectedChamp,
  detectedHasBuild,
}: {
  core: Core
  onPick: (id: number) => void
  detectedChamp: Champion | null
  detectedHasBuild: boolean
}) {
  const t = useT()
  const lang = useLang()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<string | null>(null)
  const [view, setView] = useState<'tier' | 'grid'>('tier')
  const [routeSummaries, setRouteSummaries] = useState<Record<number, ChampionRouteSummary>>({})
  const hasBuild = (id: number) => !!core.buildIndex[id]
  const done = Object.keys(core.buildIndex).length
  const tiered = core.heroTier.length
  const readyPct = Math.round((done / Math.max(core.champions.length, 1)) * 100)
  const totalRouteCount = useMemo(
    () => Object.values(routeSummaries).reduce((sum, summary) => sum + summary.count, 0),
    [routeSummaries],
  )
  const routeSummaryKey = useMemo(
    () =>
      Object.entries(core.buildIndex)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, file]) => `${id}:${file}`)
        .join('|'),
    [core.buildIndex],
  )
  useEffect(() => {
    let cancelled = false
    const entries = Object.entries(core.buildIndex)
    setRouteSummaries({})
    Promise.all(
      entries.map(async ([id, file]) => {
        try {
          const build = await loadBuild(file, lang)
          const archetypes = build.archetypes ?? []
          return [
            Number(id),
            {
              count: archetypes.length,
              names: archetypes.map((route) => route.name).filter(Boolean).slice(0, 3),
              damageTypes: [...new Set(archetypes.map((route) => route.damageType).filter(Boolean))].slice(0, 3),
            },
          ] as const
        } catch {
          return [Number(id), { count: 0, names: [], damageTypes: [] }] as const
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setRouteSummaries(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [lang, routeSummaryKey])
  const tierById = useMemo(() => new Map(core.heroTier.map((h) => [h.id, h.tier])), [core.heroTier])
  const roleCounts = useMemo(
    () =>
      ROLES.map((entry) => ({
        ...entry,
        count: core.champions.filter((champion) => champion.roles.includes(entry.key)).length,
      })),
    [core.champions],
  )
  const tierCounts = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        count: core.heroTier.filter((entry) => entry.tier === tier).length,
      })),
    [core.heroTier],
  )
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let filtered = s
      ? core.champions.filter((c) => {
          const alt = core.altChampionById.get(c.id)
          return normalizedSearchText(
            c.name,
            c.title,
            c.alias,
            c.pinyin,
            c.initials,
            alt?.name,
            alt?.title,
            alt?.alias,
            alt?.pinyin,
            alt?.initials,
          ).includes(s)
        })
      : core.champions
    if (role) filtered = filtered.filter((c) => c.roles.includes(role))
    if (tierFilter) filtered = filtered.filter((c) => tierById.get(c.id) === tierFilter)
    return [...filtered].sort((a, b) => {
      if (detectedChamp?.id === a.id) return -1
      if (detectedChamp?.id === b.id) return 1
      const tierA = tierById.get(a.id)
      const tierB = tierById.get(b.id)
      const tierDelta = (tierA ? TIER_ORDER.indexOf(tierA) : 99) - (tierB ? TIER_ORDER.indexOf(tierB) : 99)
      if (tierDelta !== 0) return tierDelta
      return (hasBuild(b.id) ? 1 : 0) - (hasBuild(a.id) ? 1 : 0)
    })
  }, [q, role, tierFilter, tierById, core.champions, core.altChampionById, detectedChamp?.id])
  const tierGroups = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        meta: TIER_META[tier],
        entries: list.filter((c) => tierById.get(c.id) === tier),
      })).filter((g) => g.entries.length > 0),
    [list, tierById],
  )
  const title = lang === 'en' ? 'Champion index' : '英雄图鉴'
  const subtitle =
    lang === 'en'
      ? 'Find the champion first, then jump straight into Combat File. Built for champ select speed, not browsing slowly.'
      : '先找到英雄，再直接进入 Combat File。这里按选人阶段的速度设计，不做慢慢逛的大首页。'

  return (
    <>
      <section className={PAGE_HEADER}>
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(236px,330px)] gap-3 max-[880px]:grid-cols-1">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">Champion index</div>
            <h2 className="mt-0.5 text-[20px] font-black leading-tight text-cream">{title}</h2>
            <p className="mt-1.5 max-w-[650px] text-[11px] leading-4 text-dim">{subtitle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-hex/35 bg-hex/8 px-2 py-0.5 text-[10px] font-black text-hex">
                {done}/{core.champions.length} {lang === 'en' ? 'routes' : '路线'}
              </span>
              <span className="rounded border border-line/60 bg-panel/45 px-2 py-0.5 text-[10px] font-black text-dim">
                {tiered} {lang === 'en' ? 'tiered' : '已评级'}
              </span>
              <span className="rounded border border-line/60 bg-panel/45 px-2 py-0.5 text-[10px] font-black text-dim">
                {readyPct}% {lang === 'en' ? 'ready' : '就绪'}
              </span>
              <span className="rounded border border-line/60 bg-panel/45 px-2 py-0.5 text-[10px] font-black text-dim">
                {totalRouteCount || '...'} {lang === 'en' ? 'playstyles' : '套玩法'}
              </span>
            </div>
          </div>
          <div className="rounded-[8px] border border-line/65 bg-[#0a1421]/72 p-2">
            {detectedChamp ? (
              <button
                onClick={() => onPick(detectedChamp.id)}
                className={
                  'grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] border px-2 py-1.5 text-left transition hover:bg-panel2/45 active:translate-y-px ' +
                  (detectedHasBuild ? 'border-hex/45 bg-hex/8' : 'border-red/45 bg-red/10')
                }
              >
                <img src={icon(detectedChamp.iconLocal)} alt={detectedChamp.name} className="h-9 w-9 rounded border border-hex/35 object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-black text-cream">{detectedChamp.name}</span>
                  <span className="block truncate text-[10px] text-dim">
                    {detectedHasBuild ? t('champGrid.buildReady') : t('champGrid.buildMissing')}
                  </span>
                </span>
                <span
                  className={
                    'rounded border px-1.5 py-0.5 text-[10px] font-black ' +
                    (detectedHasBuild ? 'border-hex/35 bg-hex/8 text-hex' : 'border-red/35 bg-red/10 text-red')
                  }
                >
                  {detectedHasBuild ? t('routeLibrary.status.ready', 'Ready') : t('routeLibrary.status.missing', 'Missing')}
                </span>
              </button>
            ) : (
              <div className="rounded-[6px] border border-line/65 bg-panel/45 px-2 py-2 text-[11px] leading-4 text-dim">
                {t('champGrid.hint')}
              </div>
            )}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel2">
              <div className="h-full rounded-full bg-hex/85" style={{ width: `${readyPct}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-4 z-20 mb-3 rounded-[8px] border border-line/75 bg-panel/95 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.20)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 max-[760px]:grid-cols-1">
          <input
            className={SEARCH_INLINE + ' h-9 rounded-[6px]'}
            placeholder={t('champGrid.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="shrink-0 rounded-[6px] border border-line/65 bg-[#0a1421]/65 px-3 py-2 text-[11px] text-dim">
            <span className="font-extrabold text-cream">{list.length}</span> / {core.champions.length}
          </div>
          <div className="flex rounded-[6px] border border-line/65 bg-[#0a1421]/65 p-0.5">
            <button
              onClick={() => setView('tier')}
              className={'rounded px-2.5 py-1 text-[10px] font-black transition ' + (view === 'tier' ? 'bg-hex text-[#041017]' : 'text-dim hover:text-cream')}
            >
              {t('routeLibrary.tierView', 'Tier')}
            </button>
            <button
              onClick={() => setView('grid')}
              className={'rounded px-2.5 py-1 text-[10px] font-black transition ' + (view === 'grid' ? 'bg-hex text-[#041017]' : 'text-dim hover:text-cream')}
            >
              {t('routeLibrary.archiveView', 'Archive')}
            </button>
          </div>
        </div>
        <div className="mt-2 grid gap-1.5">
          <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2 rounded-[6px] border border-line/55 bg-[#07101b]/35 px-2 py-1.5 max-[620px]:grid-cols-1">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-dim">{lang === 'en' ? 'Tier' : '强度'}</div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {tierCounts.map(({ tier, count }) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter((current) => (current === tier ? null : tier))}
                  className={
                    'rounded border px-2 py-1 text-[10px] font-black transition ' +
                    (tierFilter === tier ? 'border-hex/45 bg-hex text-[#041017]' : 'border-line/70 bg-panel/80 text-dim hover:border-hex/35 hover:text-cream')
                  }
                >
                  {tier} <span className="font-bold opacity-65">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] border border-line/55 bg-[#07101b]/35 px-2 py-1.5 max-[760px]:grid-cols-[52px_minmax(0,1fr)] max-[620px]:grid-cols-1">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-dim">{lang === 'en' ? 'Role' : '位置'}</div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <button
                onClick={() => setRole(null)}
                className={
                  'group inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-black transition ' +
                  (role === null ? 'border-hex/45 bg-hex text-[#041017]' : 'border-line/70 bg-panel/80 text-dim hover:border-hex/35 hover:text-cream')
                }
              >
                <RoleIcon role={null} active={role === null} />
                <span>{t('champGrid.all')}</span>
              </button>
              {roleCounts.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole((prev) => (prev === r.key ? null : r.key))}
                  className={
                    'group inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-black transition ' +
                    (role === r.key ? 'border-hex/45 bg-hex text-[#041017]' : 'border-line/70 bg-panel/80 text-dim hover:border-hex/35 hover:text-cream')
                  }
                >
                  <RoleIcon role={r.key} active={role === r.key} />
                  <span>{t(`role.${r.key}`, r.label)}</span>
                  <span className="font-bold opacity-60">{r.count}</span>
                </button>
              ))}
            </div>
            {(role || tierFilter || q.trim()) && (
              <button
                onClick={() => {
                  setQ('')
                  setRole(null)
                  setTierFilter(null)
                }}
                className="justify-self-end rounded border border-line/70 bg-panel/65 px-2 py-1 text-[10px] font-black text-dim transition hover:border-hex/45 hover:text-cream max-[760px]:col-start-2 max-[620px]:col-start-auto max-[620px]:justify-self-start"
              >
                {t('routeLibrary.clearFilters', 'Clear filters')}
              </button>
            )}
          </div>
        </div>
      </section>

      {view === 'tier' ? (
        <div className="flex flex-col gap-2">
          {tierGroups.map((g) => (
            <section key={g.tier} className={'relative overflow-hidden rounded-[8px] border p-2 ' + g.meta.row}>
              <div className={'absolute inset-y-0 left-0 w-px opacity-70 ' + g.meta.bar} />
              <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className={'grid h-8 w-8 place-items-center rounded-[6px] text-[16px] font-black ' + g.meta.badge}>{g.tier}</div>
                  <div className="text-center text-[10px] font-black uppercase tracking-[0.08em] text-dim">{g.entries.length}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-dim">{g.meta.label}</div>
                    <div className="text-[10px] text-dim">{g.entries.length} {lang === 'en' ? 'champions' : '英雄'}</div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-1.5">
                    {g.entries.map((c) => (
                      <ChampionIndexRow
                        key={c.id}
                        champion={c}
                        hasBuild={hasBuild(c.id)}
                        routeSummary={routeSummaries[c.id]}
                        isDetected={detectedChamp?.id === c.id}
                        tier={tierById.get(c.id)}
                        primaryRole={roleLabel(c, t)}
                        onPick={onPick}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
          {tierGroups.length === 0 && <div className="p-11 text-center text-dim">{t('champGrid.notFound', { q })}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
          {list.map((c) => (
            <ChampionIndexCard
              key={c.id}
              champion={c}
              hasBuild={hasBuild(c.id)}
              routeSummary={routeSummaries[c.id]}
              isDetected={detectedChamp?.id === c.id}
              tier={tierById.get(c.id)}
              primaryRole={roleLabel(c, t)}
              onPick={onPick}
              t={t}
            />
          ))}
          {list.length === 0 && <div className="col-span-full p-11 text-center text-dim">{t('champGrid.notFound', { q })}</div>}
        </div>
      )}
    </>
  )
}

function roleLabel(champion: Champion, translate: ReturnType<typeof useT>) {
  const primaryRoleKey = ROLES.find((r) => champion.roles.includes(r.key))
  return primaryRoleKey ? translate(`role.${primaryRoleKey.key}`, primaryRoleKey.label) : champion.roles[0]
}

function ChampionIndexRow({
  champion,
  hasBuild,
  routeSummary,
  isDetected,
  tier,
  primaryRole,
  onPick,
  t,
}: {
  champion: Champion
  hasBuild: boolean
  routeSummary?: ChampionRouteSummary
  isDetected: boolean
  tier?: string
  primaryRole: string
  onPick: (id: number) => void
  t: ReturnType<typeof useT>
}) {
  const lang = useLang()
  const routeCount = routeSummary?.count ?? 0
  const routeNames = routeSummary?.names ?? []
  const routeCountText = lang === 'en'
    ? `${routeCount} ${routeCount === 1 ? 'route' : 'routes'}`
    : `${routeCount} 套玩法`
  return (
    <button
      type="button"
      onClick={() => onPick(champion.id)}
      title={hasBuild ? champion.name : t('champGrid.noData', { name: champion.name })}
      className={
        'group grid h-11 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] border px-1.5 py-1 text-left transition hover:border-hex/45 hover:bg-panel2/55 active:translate-y-px ' +
        (isDetected ? 'border-hex/60 bg-hex/8' : hasBuild ? 'border-line/65 bg-ink/28' : 'border-line/45 bg-ink/20 opacity-65')
      }
    >
      <img src={icon(champion.iconLocal)} alt={champion.name} loading="lazy" className="h-8 w-8 rounded border border-line/80 object-cover transition group-hover:border-hex/45" />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-black text-cream">{champion.name}</span>
        <span className="mt-0.5 block truncate text-[9px] font-bold text-dim">
          {routeCount > 0 ? `${routeCountText} · ${routeNames.join(' / ')}` : primaryRole}
        </span>
      </span>
      <span className="flex items-center gap-1 justify-self-end">
        {tier && <span className="rounded border border-line/55 bg-panel2/55 px-1 py-0.5 text-[9px] font-black text-dim">{tier}</span>}
        {!hasBuild && <span className="h-1.5 w-1.5 rounded-full bg-red" title={t('champGrid.cardMissing')} />}
        {isDetected && <span className="h-1.5 w-1.5 rounded-full bg-hex" title={t('champGrid.current')} />}
      </span>
    </button>
  )
}

function ChampionIndexCard({
  champion,
  hasBuild,
  routeSummary,
  isDetected,
  tier,
  primaryRole,
  onPick,
  t,
}: {
  champion: Champion
  hasBuild: boolean
  routeSummary?: ChampionRouteSummary
  isDetected: boolean
  tier?: string
  primaryRole: string
  onPick: (id: number) => void
  t: ReturnType<typeof useT>
}) {
  const lang = useLang()
  const routeCount = routeSummary?.count ?? 0
  const routeNames = routeSummary?.names ?? []
  const damageTypes = routeSummary?.damageTypes ?? []
  return (
    <button
      type="button"
      onClick={() => onPick(champion.id)}
      title={hasBuild ? champion.name : t('champGrid.noData', { name: champion.name })}
      className={
        'group relative overflow-hidden rounded-[8px] border p-2 text-left transition hover:border-hex/45 hover:bg-panel2/50 active:translate-y-px ' +
        (isDetected ? 'bg-hex/8 border-hex/65' : hasBuild ? 'bg-panel/74 border-line/65' : 'bg-panel/45 border-line/45 opacity-65')
      }
    >
      <div className="relative flex items-center gap-2">
        <div className="relative shrink-0">
          <img src={icon(champion.iconLocal)} alt={champion.name} loading="lazy" className="h-9 w-9 rounded border border-line/70 object-cover transition group-hover:border-hex/45" />
          {hasBuild && (
            <span className="absolute -right-1 -bottom-1 grid h-3.5 w-3.5 place-items-center rounded bg-hex ring-2 ring-panel">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#061117" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={'truncate text-[11px] font-black ' + (hasBuild ? 'text-cream' : 'text-dim')}>{champion.name}</div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold text-dim">
            {tier && <span className="text-dim">{tier}</span>}
            <span className="truncate">{primaryRole}</span>
          </div>
        </div>
      </div>
      {routeCount > 0 ? (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between gap-2 rounded border border-hex/25 bg-hex/7 px-1.5 py-1">
            <span className="text-[9px] font-black uppercase tracking-[0.08em] text-hex">{lang === 'en' ? 'Playstyles' : '玩法'}</span>
            <span className="text-[11px] font-black text-cream">{routeCount}</span>
          </div>
          <div className="flex min-h-[18px] flex-wrap gap-1">
            {damageTypes.map((type) => (
              <span key={type} className="rounded border border-line/45 bg-[#050a11]/42 px-1.5 py-0.5 text-[8px] font-black text-dim">
                {type}
              </span>
            ))}
          </div>
          <div className="line-clamp-2 min-h-[22px] text-[9px] font-bold leading-[11px] text-dim">
            {routeNames.join(' / ')}
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded border border-line/45 bg-[#050a11]/30 px-1.5 py-1 text-[9px] font-bold text-dim">
          {t('champGrid.cardMissing')}
        </div>
      )}
    </button>
  )
}

function LegacyChampionGrid({
  core,
  onPick,
  detectedChamp,
  detectedHasBuild,
}: {
  core: Core
  onPick: (id: number) => void
  detectedChamp: Champion | null
  detectedHasBuild: boolean
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<string | null>(null)
  const [view, setView] = useState<'tier' | 'archive'>('tier')
  const hasBuild = (id: number) => !!core.buildIndex[id]
  const tierById = useMemo(() => new Map(core.heroTier.map((h) => [h.id, h.tier])), [core.heroTier])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let filtered = s
      ? core.champions.filter(
          (c) => {
            const alt = core.altChampionById.get(c.id)
            return normalizedSearchText(c.name, c.title, c.alias, c.pinyin, c.initials, alt?.name, alt?.title, alt?.alias, alt?.pinyin, alt?.initials).includes(s)
          },
        )
      : core.champions
    if (role) filtered = filtered.filter((c) => c.roles.includes(role))
    if (tierFilter) filtered = filtered.filter((c) => tierById.get(c.id) === tierFilter)
    return [...filtered].sort((a, b) => {
      if (detectedChamp?.id === a.id) return -1
      if (detectedChamp?.id === b.id) return 1
      const tierA = tierById.get(a.id)
      const tierB = tierById.get(b.id)
      const tierDelta = (tierA ? TIER_ORDER.indexOf(tierA) : 99) - (tierB ? TIER_ORDER.indexOf(tierB) : 99)
      if (tierDelta !== 0) return tierDelta
      return (hasBuild(b.id) ? 1 : 0) - (hasBuild(a.id) ? 1 : 0)
    })
  }, [q, role, tierFilter, tierById, core, detectedChamp?.id])
  const tierGroups = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        meta: TIER_META[tier],
        entries: list.filter((c) => tierById.get(c.id) === tier),
      })).filter((g) => g.entries.length > 0),
    [list, tierById],
  )
  const done = Object.keys(core.buildIndex).length
  const tiered = core.heroTier.length
  const missing = core.champions.length - done
  const routeTitle = detectedChamp
    ? detectedHasBuild
      ? t('routeLibrary.title.ready', { name: detectedChamp.name })
      : t('routeLibrary.title.missing', { name: detectedChamp.name })
    : t('routeLibrary.title.idle', 'Route library ready')
  const routeSubtitle = detectedChamp
    ? detectedHasBuild
      ? t('routeLibrary.subtitle.ready', 'Current pick is pinned. Open the route or compare it against the tier table.')
      : t('routeLibrary.subtitle.missing', 'Current pick is detected, but this champion still needs Mayhem route data.')
    : t('routeLibrary.subtitle.idle', 'Search a champion, filter by role or tier, then open the route you want in champion select.')

  return (
    <>
      <ViewHead title={t('nav.champ')} meta={t('champGrid.coverage', { done, total: core.champions.length })} />
      <section className="glass-panel-strong relative mb-5 overflow-hidden rounded-[8px] border p-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-hex/45" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_340px] gap-5 items-start max-[980px]:grid-cols-1">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-md border border-hex/35 bg-hex/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-hex">
              {t('routeLibrary.kicker', 'Route control')}
            </div>
            <h2 className="mt-4 max-w-[720px] text-[32px] leading-[1.05] font-extrabold tracking-tight text-cream">
              {routeTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-dim">
              {routeSubtitle}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 max-[760px]:grid-cols-1">
              <StatusMetric label={t('routeLibrary.metric.coverage', 'Routes')} value={`${done}/${core.champions.length}`} />
              <StatusMetric label={t('routeLibrary.metric.tiered', 'Tiered')} value={`${tiered}`} />
              <StatusMetric label={t('routeLibrary.metric.missing', 'Missing')} value={`${missing}`} />
            </div>
          </div>
          <div className="glass-control rounded-[8px] border border-line/80 p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">
              {t('routeLibrary.readout', 'Current pick')}
            </div>
            {detectedChamp ? (
              <button
                onClick={() => onPick(detectedChamp.id)}
                className={
                  'mt-3 flex w-full items-center gap-3 rounded-[8px] border p-3 text-left transition hover:-translate-y-0.5 cursor-pointer ' +
                  (detectedHasBuild
                    ? 'border-gold/45 bg-gold/10'
                    : 'border-red/45 bg-red/10')
                }
              >
                <img
                  src={icon(detectedChamp.iconLocal)}
                  alt={detectedChamp.name}
                  className="h-14 w-14 rounded-lg border border-gold/40 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold text-cream">{detectedChamp.name}</div>
                  <div className="mt-1 text-xs text-dim">
                    {detectedHasBuild ? t('champGrid.buildReady') : t('champGrid.buildMissing')}
                  </div>
                </div>
                <span
                  className={
                    'rounded-md border px-1.5 py-0.5 text-[10px] font-bold ' +
                    (detectedHasBuild ? 'border-hex/35 bg-hex/8 text-hex' : 'border-red/35 bg-red/10 text-red')
                  }
                >
                  {detectedHasBuild ? t('routeLibrary.status.ready', 'Ready') : t('routeLibrary.status.missing', 'Missing')}
                </span>
              </button>
            ) : (
              <div className="mt-3 rounded-[8px] border border-line/70 bg-panel/55 p-4 text-sm leading-6 text-dim">
                {t('champGrid.hint')}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatusMetric label={t('routeLibrary.metric.results', 'Results')} value={`${list.length}`} />
              <StatusMetric label={t('routeLibrary.metric.view', 'View')} value={view === 'tier' ? t('routeLibrary.tierView', 'Tier') : t('routeLibrary.archiveView', 'Archive')} />
            </div>
          </div>
        </div>
      </section>
      <section className={TOOLBAR}>
        <div className="flex items-center gap-3 max-[900px]:flex-col max-[900px]:items-stretch">
          <input
            className={SEARCH_INLINE}
            placeholder={t('champGrid.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="shrink-0 rounded-lg border border-line/65 bg-panel2/45 px-3 py-2 text-xs text-dim">
            <span className="font-extrabold text-cream">{list.length}</span> / {core.champions.length}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setView('tier')}
            className={
              CHIP +
              ' ' +
              (view === 'tier'
                ? 'border-gold/45 bg-gold text-[#1d1709] font-extrabold'
                : 'border-line/70 bg-panel/80 text-dim hover:text-cream')
            }
          >
            {t('routeLibrary.tierView', 'Tier')}
          </button>
          <button
            onClick={() => setView('archive')}
            className={
              CHIP +
              ' ' +
              (view === 'archive'
                ? 'border-gold/45 bg-gold text-[#1d1709] font-extrabold'
                : 'border-line/70 bg-panel/80 text-dim hover:text-cream')
            }
          >
            {t('routeLibrary.archiveView', '档案')}
          </button>
          {TIER_ORDER.map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter((current) => (current === tier ? null : tier))}
              className={
                CHIP +
                ' ' +
                (tierFilter === tier
                  ? 'border-gold/45 bg-gold text-[#1d1709] font-extrabold'
                  : 'border-line/70 bg-panel/80 text-dim hover:text-cream')
              }
            >
              {tier}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setRole(null)}
            className={
              CHIP +
              ' group inline-flex items-center gap-2 ' +
              (role === null
                ? 'border-gold/45 bg-gold text-[#1d1709] font-extrabold'
                : 'border-line/70 bg-panel/80 text-dim hover:text-cream')
            }
          >
            <RoleIcon role={null} active={role === null} />
            <span>{t('champGrid.all')}</span>
          </button>
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole((prev) => (prev === r.key ? null : r.key))}
              className={
                CHIP +
                ' group inline-flex items-center gap-2 ' +
                (role === r.key
                  ? 'border-gold/45 bg-gold text-[#1d1709] font-extrabold'
                  : 'border-line/70 bg-panel/80 text-dim hover:text-cream')
              }
            >
              <RoleIcon role={r.key} active={role === r.key} />
              <span>{t(`role.${r.key}`, r.label)}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">
            {view === 'tier' ? t('routeLibrary.results.tier', 'Tier table') : t('routeLibrary.results.archive', 'Archive grid')}
          </div>
          <div className="mt-1 text-sm text-dim">
            {t('routeLibrary.results.meta', { count: list.length, total: core.champions.length })}
          </div>
        </div>
        {(role || tierFilter || q.trim()) && (
          <button
            onClick={() => {
              setQ('')
              setRole(null)
              setTierFilter(null)
            }}
            className="rounded-lg border border-line/70 bg-panel/65 px-3 py-1.5 text-xs font-bold text-dim transition hover:border-gold/45 hover:text-cream cursor-pointer"
          >
            {t('routeLibrary.clearFilters', 'Clear filters')}
          </button>
        )}
      </div>
      {view === 'tier' ? (
        <div className="flex flex-col gap-3">
          {tierGroups.map((g) => (
            <section key={g.tier} className={'relative overflow-hidden rounded-[8px] border p-3.5 ' + g.meta.row}>
              <div className={'absolute inset-y-0 left-0 w-1 ' + g.meta.bar} />
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className={'grid h-12 w-12 place-items-center rounded-lg text-2xl font-extrabold ' + g.meta.badge}>
                    {g.tier}
                  </div>
                  <div className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-dim">{g.entries.length}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-dim">{g.meta.label}</div>
                    <div className="text-[11px] text-dim">{g.entries.length} champions</div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                    {g.entries.map((c) => {
                      const has = hasBuild(c.id)
                      const isDetected = detectedChamp?.id === c.id
                      const primaryRoleKey = ROLES.find((r) => c.roles.includes(r.key))
                      const primaryRole = primaryRoleKey ? t(`role.${primaryRoleKey.key}`, primaryRoleKey.label) : c.roles[0]
                      return (
                        <button
                          key={c.id}
                          onClick={() => onPick(c.id)}
                          title={has ? c.name : t('champGrid.noData', { name: c.name })}
                          className={
                            'group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border p-2 text-left transition hover:-translate-y-0.5 hover:border-gold/45 hover:bg-panel2/55 cursor-pointer ' +
                            (isDetected ? 'border-gold/60 bg-gold/10' : 'border-line/65 bg-ink/28')
                          }
                        >
                          <img
                            src={icon(c.iconLocal)}
                            alt={c.name}
                            loading="lazy"
                            className="h-10 w-10 rounded-lg border border-line/80 object-cover transition group-hover:border-gold/45"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-extrabold text-cream">{c.name}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-dim">{primaryRole}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {!has && (
                              <span className="rounded-md border border-line/60 bg-panel2/40 px-1.5 py-0.5 text-[10px] font-bold text-dim">
                                {t('champGrid.cardMissing')}
                              </span>
                            )}
                            {isDetected && (
                              <span className="rounded-md border border-hex/45 bg-hex/10 px-1.5 py-0.5 text-[10px] font-bold text-hex">
                                {t('champGrid.current')}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}
          {tierGroups.length === 0 && <div className="p-11 text-center text-dim">{t('champGrid.notFound', { q })}</div>}
        </div>
      ) : (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(142px,1fr))] gap-3">
        {list.map((c) => {
          const has = hasBuild(c.id)
          const isDetected = detectedChamp?.id === c.id
          const tier = tierById.get(c.id)
          const primaryRoleKey = ROLES.find((r) => c.roles.includes(r.key))
          const primaryRole = primaryRoleKey ? t(`role.${primaryRoleKey.key}`, primaryRoleKey.label) : c.roles[0]
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              title={has ? c.name : t('champGrid.noData', { name: c.name })}
              className={
                'group relative overflow-hidden rounded-[8px] border p-3 text-left cursor-pointer transition hover:-translate-y-0.5 ' +
                (isDetected
                  ? 'bg-gold/12 border-gold/70 shadow-[0_14px_34px_rgba(0,0,0,0.2)]'
                  : has
                    ? 'bg-panel/82 border-gold/30 hover:border-gold/70 hover:bg-panel2/70'
                    : 'bg-panel/55 border-line/60 hover:border-red/50 opacity-75')
              }
            >
              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={icon(c.iconLocal)}
                    alt={c.name}
                    loading="lazy"
                    className="h-13 w-13 rounded-lg border border-line/70 object-cover"
                  />
                  {has && (
                    <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-md bg-hex border-2 border-panel grid place-items-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#061117" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={'truncate text-sm font-extrabold ' + (has ? 'text-cream' : 'text-dim')}>{c.name}</div>
                  <div className="mt-1 truncate text-[11px] text-dim">{primaryRole}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {tier && <span className="rounded-md border border-gold/35 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold">{tier}</span>}
                    {isDetected && <span className="rounded-md border border-hex/45 bg-hex/10 px-1.5 py-0.5 text-[10px] font-bold text-hex">{t('champGrid.current')}</span>}
                  </div>
                </div>
              </div>
              {!has && (
                <div className="relative mt-3 rounded-lg border border-line/60 bg-panel2/40 px-2 py-1.5 text-[11px] leading-tight text-dim">
                  {t('champGrid.cardMissing')}
                </div>
              )}
            </button>
          )
        })}
        {list.length === 0 && <div className="col-span-full p-11 text-center text-dim">{t('champGrid.notFound', { q })}</div>}
      </div>
      )}
    </>
  )
}

function AugmentBrowser({ core }: { core: Core }) {
  const t = useT()
  const lang = useLang()
  const [q, setQ] = useState('')
  const [rarityFilter, setRarityFilter] = useState<number | 'all'>('all')
  const groups = useMemo(() => {
    const s = q.trim().toLocaleLowerCase()
    let filtered = s
      ? core.augments.filter((a) => {
          const alt = core.altAugById.get(a.id)
          return normalizedSearchText(a.name, a.desc, a.tooltip, alt?.name, alt?.desc, alt?.tooltip).includes(s)
        })
      : core.augments
    if (rarityFilter !== 'all') filtered = filtered.filter((a) => a.rarity === rarityFilter)
    return RARITY_ORDER.map((r) => ({ rarity: r, meta: RARITY[r], items: filtered.filter((a) => a.rarity === r) })).filter(
      (g) => g.items.length > 0,
    )
  }, [q, rarityFilter, core])
  const shownCount = groups.reduce((sum, g) => sum + g.items.length, 0)
  const raritySummary = RARITY_ORDER.map((rarity) => ({
    rarity,
    meta: RARITY[rarity],
    count: core.augments.filter((a) => a.rarity === rarity).length,
  }))

  return (
    <>
      <PageHeader
        eyebrow={lang === 'en' ? 'Augment atlas' : '海克斯图鉴'}
        title={t('nav.aug')}
        description={lang === 'en'
          ? 'Search the augment pool by name or effect. Rarity groups stay visible so the page reads like a decision library, not a raw asset grid.'
          : '按名称或效果搜索海克斯。保留棱彩、黄金、白银分组，让这里更像决策图鉴，而不是单纯素材列表。'}
        metrics={[
          { label: lang === 'en' ? 'Shown' : '当前显示', value: `${shownCount}/${core.augments.length}`, tone: 'accent' },
          ...raritySummary.map((entry) => ({
            label: t(`rarity.${RARITY_KEY[entry.rarity]}`, entry.meta.label),
            value: entry.count,
            tone: entry.rarity === 2 ? 'accent' as const : 'muted' as const,
          })),
        ]}
      />
      <section className="glass-control sticky top-0 z-20 mb-2.5 rounded-[6px] border border-line/70 p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.20)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-[760px]:grid-cols-1">
          <input className={SEARCH_INLINE} placeholder={t('augBrowser.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex items-center gap-1.5 max-[760px]:flex-wrap">
            <div className="rounded-[5px] border border-line/55 bg-[#050a11]/40 px-2 py-1.5 text-[11px] font-bold text-dim">
              <span className="font-black text-cream">{shownCount}</span> / {core.augments.length}
            </div>
            {raritySummary.map((entry) => (
              <div key={entry.rarity} className="flex items-center gap-1.5 rounded-[5px] border border-line/45 bg-[#050a11]/28 px-2 py-1.5 text-[10px] font-black text-dim">
                <span className={'h-2 w-2 rounded-full ' + entry.meta.bg} />
                <span className={entry.meta.text}>{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line/45 pt-2">
          <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em] text-dim">
            {lang === 'en' ? 'Rarity' : '稀有度'}
          </span>
          <button
            type="button"
            onClick={() => setRarityFilter('all')}
            className={
              'rounded border px-2 py-1 text-[10px] font-black transition active:translate-y-px ' +
              (rarityFilter === 'all'
                ? 'border-hex/45 bg-hex text-[#041017]'
                : 'border-line/60 bg-[#07101b]/52 text-dim hover:border-hex/35 hover:text-cream')
            }
          >
            {lang === 'en' ? 'All' : '全部'}
          </button>
          {raritySummary.map((entry) => (
            <button
              key={entry.rarity}
              type="button"
              onClick={() => setRarityFilter((current) => (current === entry.rarity ? 'all' : entry.rarity))}
              className={
                'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-black transition active:translate-y-px ' +
                (rarityFilter === entry.rarity
                  ? entry.meta.border + ' bg-panel2 text-cream'
                  : 'border-line/60 bg-[#07101b]/52 text-dim hover:border-line hover:text-cream')
              }
            >
              <span className={'h-1.5 w-1.5 rounded-full ' + entry.meta.bg} />
              <span>{t(`rarity.${RARITY_KEY[entry.rarity]}`, entry.meta.label)}</span>
              <span className="opacity-55">{entry.count}</span>
            </button>
          ))}
        </div>
      </section>
      {groups.map((g) => (
        <section key={g.rarity} className="mb-3 overflow-hidden rounded-[6px] border border-line/65 bg-panel/35">
          <div className="flex items-center justify-between gap-3 border-b border-line/55 bg-[#0a111b]/78 px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className={'h-2.5 w-2.5 rounded-full ' + g.meta.bg} />
              <span className={'text-[11px] font-black uppercase tracking-[0.14em] ' + g.meta.text}>
                {t(`rarity.${RARITY_KEY[g.rarity]}`, g.meta.label)}
              </span>
              <span className="text-[10px] font-bold text-dim">{lang === 'en' ? 'Decision pool' : '决策池'}</span>
            </div>
            <span className="rounded border border-line/45 bg-[#050a11]/40 px-1.5 py-0.5 text-[10px] font-bold text-dim">{g.items.length}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(82px,1fr))] gap-1.5 bg-[#07101b]/55 p-1.5">
            {g.items.map((a) => (
              <AugmentHoverCard key={a.id} augment={a}>
                <div className="group flex h-[88px] min-w-0 flex-col items-center justify-start gap-1 rounded-[6px] border border-line/45 bg-[#0b121d]/78 px-1.5 py-2 text-center transition hover:-translate-y-0.5 hover:border-gold/40 hover:bg-panel2/62">
                  <div className={'h-10 w-10 shrink-0 overflow-hidden rounded-[6px] border-2 shadow-[0_8px_18px_rgba(0,0,0,0.20)] transition group-hover:scale-[1.03] ' + g.meta.border}>
                    <img src={icon(a.iconLargeLocal)} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <div className="line-clamp-3 min-h-[30px] w-full break-words text-[9px] font-bold leading-[10px] text-cream">{a.name}</div>
                </div>
              </AugmentHoverCard>
            ))}
          </div>
        </section>
      ))}
      {groups.length === 0 && <div className="p-11 text-center text-dim">{t('champGrid.notFound', { q })}</div>}
    </>
  )
}

/** 「更新日志」：官方 patch notes 摘要 + 海克斯大乱斗专属改动分开展示（人工翻译整理，见 data/patch-notes.json）。 */
function PatchNotesTab({ core, onPick }: { core: Core; onPick: (id: number) => void }) {
  const t = useT()
  const lang = useLang()
  const pn = core.patchNotes
  return (
    <>
      <PageHeader
        eyebrow={lang === 'en' ? 'Patch intelligence' : '战术更新'}
        title={t('nav.patch')}
        description={lang === 'en'
          ? 'Mayhem-specific changes are surfaced first, with official patch context kept nearby for route review.'
          : '优先展示海克斯大乱斗相关改动，再把官方补丁上下文放在旁边，方便回看路线是否需要调整。'}
        metrics={[
          { label: lang === 'en' ? 'Patch' : '补丁', value: pn.patch, tone: 'accent' },
          { label: lang === 'en' ? 'Date' : '日期', value: pn.releaseDate },
          { label: lang === 'en' ? 'Mayhem changes' : '专属改动', value: pn.mayhem.augmentChanges.length + pn.mayhem.bugfixes.length },
        ]}
      />

      <section className={SURFACE + ' mb-3 p-3.5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-dim">{t('patch.theme')}</div>
            <div className="text-[16px] font-black text-cream">{pn.theme}</div>
            <div className="mt-2 text-xs text-dim">{pn.patch} / {pn.releaseDate}</div>
          </div>
          <PatchMark />
        </div>
        <a
          href={pn.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-md border border-line/65 bg-panel2/60 px-3 py-1.5 text-[11px] font-black text-dim transition hover:border-hex/45 hover:text-cream"
        >
          {t('patch.sourceLink')}
        </a>
      </section>

      {/* 海克斯大乱斗专属改动放最前面——这是这个 App 的核心受众最关心的部分 */}
      <section className={SURFACE + ' mb-3 p-3.5'}>
        <div className="mb-3 flex items-center gap-2 border-b border-line/45 pb-2">
          <PatchMark />
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-hex">Mayhem focus</div>
            <h3 className="mt-0.5 text-[15px] font-black text-cream">{t('patch.mayhemTitle')}</h3>
          </div>
        </div>
        <p className="mb-4 text-[12px] leading-5 text-dim">
          {lang === 'en' && pn.mayhem.summaryEn ? pn.mayhem.summaryEn : pn.mayhem.summaryZh}
        </p>
        {pn.mayhem.augmentChanges.length > 0 && (
          <>
            <div className="mb-2 text-[12px] font-black text-cream">{t('patch.augmentChanges')}</div>
            <div className="mb-4 flex flex-col overflow-hidden rounded-[7px] border border-line/60 bg-[#07101b]/42">
              {pn.mayhem.augmentChanges.map((a, i) => {
                const name = lang === 'en' && a.nameEn ? a.nameEn : a.name
                const change = lang === 'en' && a.changeEn ? a.changeEn : a.change
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[44px_180px_minmax(0,1fr)] items-center gap-3 px-3 py-3 max-[760px]:grid-cols-[44px_minmax(0,1fr)]"
                  >
                    <AugmentGlyph icon={a.icon} />
                    <div className="truncate text-sm font-semibold text-cream">{name}</div>
                    <div className="min-w-0 text-[12px] text-dim leading-snug max-[760px]:col-span-2">
                      {change}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {pn.mayhem.bugfixes.length > 0 && (
          <>
            <div className="mb-2 text-[12px] font-black text-cream">{t('patch.bugfixes')}</div>
            <ul className="space-y-1 text-[12px] leading-5 text-dim">
              {(lang === 'en' && pn.mayhem.bugfixesEn ? pn.mayhem.bugfixesEn : pn.mayhem.bugfixes).map((b, i) => (
                <li key={i} className="rounded-[6px] border border-line/45 bg-[#07101b]/36 px-2.5 py-1.5">{b}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={SURFACE + ' mb-3 p-3.5'}>
        <h3 className="mb-3 text-[14px] font-black text-cream">{t('patch.championChanges')}</h3>
        <div className="flex flex-col divide-y divide-line/55 overflow-hidden rounded-[7px] border border-line/60 bg-[#07101b]/42">
          {pn.championChanges.map((c) => {
            const champ = core.champions.find((ch) => ch.id === c.championId)
            const name = lang === 'en' ? (c.championNameEn ?? champ?.name ?? c.championName) : c.championName
            const lines = lang === 'en' && c.changesEn ? c.changesEn : c.changes
            return (
              <button
                key={c.championId}
                onClick={() => champ && onPick(champ.id)}
                className="grid grid-cols-[44px_128px_minmax(0,1fr)] items-start gap-3 px-3 py-3 text-left transition hover:bg-panel2/45 cursor-pointer max-[840px]:grid-cols-[44px_minmax(0,1fr)]"
              >
                {champ && (
                  <img src={icon(champ.iconLocal)} alt={name} className={ICON_ASSET + ' h-10 w-10'} />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-cream">{name}</div>
                  <div className="mt-1 text-[11px] text-dim">{t('patch.championChanges')}</div>
                </div>
                <ul className="min-w-0 text-[12px] text-dim leading-snug space-y-1 max-[840px]:col-span-2">
                  {lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </section>

      {pn.itemChanges.length > 0 && (
        <section className={SURFACE + ' mb-3 p-3.5'}>
          <h3 className="mb-3 text-[14px] font-black text-cream">{t('patch.itemChanges')}</h3>
          <div className="flex flex-col divide-y divide-line/55 overflow-hidden rounded-[7px] border border-line/60 bg-[#07101b]/42">
            {pn.itemChanges.map((it, i) => {
              const item = it.itemId != null ? core.itemById.get(it.itemId) : undefined
              const name = item?.name ?? (lang === 'en' && it.itemNameEn ? it.itemNameEn : it.itemName)
              const lines = lang === 'en' && it.changesEn ? it.changesEn : it.changes
              return (
                <div key={i} className="grid grid-cols-[44px_140px_minmax(0,1fr)] items-start gap-3 px-3 py-3 max-[760px]:grid-cols-[44px_minmax(0,1fr)]">
                  {item && (
                    <img src={icon(item.iconLocal)} alt={name} className={ICON_ASSET + ' h-10 w-10 bg-ink/40'} />
                  )}
                  <div className="text-sm font-semibold text-cream">{name}</div>
                  <ul className="min-w-0 text-[12px] text-dim leading-snug space-y-1 max-[760px]:col-span-2">
                    {lines.map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {pn.systemChanges.length > 0 && (
        <section className={SURFACE + ' p-3.5'}>
          <h3 className="mb-3 text-[14px] font-black text-cream">{t('patch.systemChanges')}</h3>
          <div className="flex flex-col gap-2">
            {(lang === 'en' && pn.systemChangesEn ? pn.systemChangesEn : pn.systemChanges).map((s, i) => (
              <div key={i} className="rounded-[6px] border border-line/55 bg-[#07101b]/42 px-3 py-2 text-[12px] leading-5 text-dim">
                {s}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/**
 * 官方 patch notes 里"海克斯大乱斗专属改动"列出的这批增强(大魔导师/玻璃大炮等)是海克斯大乱斗
 * 独有、不在竞技场增强池里的海克斯——CommunityDragon 的 cdragon/arena 接口不收录，这也是本App
 * data/augments.json(抓取自那个接口)漏掉这批海克斯的原因。图标从 arammayhem.com 下载到本地
 * (data/assets/mayhem-augments/)，查不到图标的条目才退回占位菱形。
 */
function AugmentGlyph({ icon: slug }: { icon?: string }) {
  if (slug)
    return (
      <img
        src={`/assets/mayhem-augments/${slug}.webp`}
        alt=""
        aria-hidden="true"
        className={ICON_ASSET + ' h-10 w-10'}
      />
    )
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-line/70 bg-[#07101b]/52" aria-hidden="true">
      <span className="h-3.5 w-3.5 rotate-45 rounded-[3px] border border-hex/55 bg-hex/10" />
    </span>
  )
}

// 从 S 到 D 做真正的视觉重量递减：横幅底色由暖变暗、图标尺寸由大变小、
// 发光强度由强变无——一眼"感受到"层级差，不是靠读文字/边框色才知道。
function PatchMark() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-hex/35 bg-hex/10 text-hex">
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l7 4v7c0 3.8-2.9 6.3-7 7-4.1-.7-7-3.2-7-7V7z" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    </div>
  )
}

const TIER_META: Record<string, { row: string; badge: string; bar: string; label: string }> = {
  S: {
    row: 'border-line/80 bg-panel/72',
    badge: 'border border-gold/45 bg-[#16140f] text-gold',
    bar: 'bg-gold/75',
    label: 'Priority routes',
  },
  A: {
    row: 'border-line/75 bg-panel/64',
    badge: 'border border-hex/45 bg-[#0b1822] text-hex',
    bar: 'bg-hex/70',
    label: 'Stable high value',
  },
  B: {
    row: 'border-line/70 bg-panel/56',
    badge: 'border border-line/60 bg-panel2 text-cream',
    bar: 'bg-dim/70',
    label: 'Playable picks',
  },
  C: {
    row: 'border-line/60 bg-panel/44',
    badge: 'border border-line/55 bg-[#202936] text-dim',
    bar: 'bg-line/80',
    label: 'Narrow use cases',
  },
  D: {
    row: 'border-red/18 bg-panel/36 opacity-85',
    badge: 'border border-red/35 bg-[#251418] text-red',
    bar: 'bg-red/65',
    label: 'Low confidence routes',
  },
}
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D']

function TierTab({ core, onPick }: { core: Core; onPick: (id: number) => void }) {
  const t = useT()
  const champById = useMemo(() => new Map(core.champions.map((c) => [c.id, c])), [core])
  const groups = TIER_ORDER.map((tier) => ({
    tier,
    meta: TIER_META[tier],
    entries: core.heroTier.filter((h) => h.tier === tier),
  })).filter((g) => g.entries.length > 0)

  return (
    <>
      <ViewHead
        title={t('nav.tier')}
        meta={t('tierTab.meta', { covered: core.heroTier.length, total: core.champions.length })}
      />
      <section className="glass-control mb-5 rounded-[8px] border border-line/75 p-4">
        <div className="grid grid-cols-[1fr_auto] gap-4 max-[780px]:grid-cols-1">
          <div className="text-xs text-dim leading-relaxed">{t('tierTab.disclaimer')}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-line/60 bg-panel2/45 px-3 py-2">
              <div className="text-dim">{t('tierTab.coveredLabel', '收录')}</div>
              <div className="mt-1 font-extrabold text-cream">{core.heroTier.length}</div>
            </div>
            <div className="rounded-lg border border-line/60 bg-panel2/45 px-3 py-2">
              <div className="text-dim">{t('tierTab.totalLabel', '英雄')}</div>
              <div className="mt-1 font-extrabold text-cream">{core.champions.length}</div>
            </div>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <section key={g.tier} className={'relative overflow-hidden rounded-[8px] border p-3.5 ' + g.meta.row}>
            <div className={'absolute inset-y-0 left-0 w-1 ' + g.meta.bar} />
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className={'grid h-12 w-12 place-items-center rounded-lg text-2xl font-extrabold ' + g.meta.badge}>
                  {g.tier}
                </div>
                <div className="text-center text-[10px] font-bold uppercase tracking-[0.1em] text-dim">{g.entries.length}</div>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-dim">{g.meta.label}</div>
                  <div className="text-[11px] text-dim">{g.entries.length} champions</div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
                {g.entries.map((h) => {
                  const c = champById.get(h.id)
                  if (!c) return null
                  const primaryRoleKey = ROLES.find((r) => c.roles.includes(r.key))
                  const primaryRole = primaryRoleKey ? t(`role.${primaryRoleKey.key}`, primaryRoleKey.label) : c.roles[0]
                  const hasBuild = !!core.buildIndex[h.id]
                  return (
                    <button
                      key={h.id}
                      onClick={() => onPick(h.id)}
                      title={c.name}
                      className="group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-line/65 bg-ink/28 p-2 text-left transition hover:-translate-y-0.5 hover:border-gold/45 hover:bg-panel2/55 cursor-pointer"
                    >
                      <img
                        src={icon(c.iconLocal)}
                        alt={c.name}
                        className="h-10 w-10 rounded-lg border border-line/80 object-cover transition group-hover:border-gold/45"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-cream">{c.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-dim">{primaryRole}</span>
                      </span>
                      {!hasBuild && (
                        <span className="rounded-md border border-line/60 bg-panel2/40 px-1.5 py-0.5 text-[10px] font-bold text-dim">
                          {t('champGrid.cardMissing')}
                        </span>
                      )}
                    </button>
                  )
                })}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

/* ---------------- 详情页 ---------------- */
function Detail({
  core,
  championId,
  onBack,
  onPick,
  selectedArchetypeKey,
  onArchetypePreference,
  customRoutes,
}: {
  core: Core
  championId: number
  onBack: () => void
  onPick: (id: number) => void
  selectedArchetypeKey?: string
  onArchetypePreference: (championId: number, archetypeKey: string) => void
  customRoutes: CustomRoute[]
}) {
  const t = useT()
  const lang = useLang()
  const champ = core.champions.find((c) => c.id === championId)
  const [build, setBuild] = useState<Build | null | undefined>(undefined)
  const [activeIdx, setActiveIdx] = useState(0)
  const [syncPulse, setSyncPulse] = useState(false)
  const lastLoadedChampionId = useRef<number | null>(null)
  const covered = useMemo(
    () =>
      Object.keys(core.buildIndex)
        .map((id) => core.champions.find((c) => c.id === Number(id)))
        .filter((c): c is Champion => !!c && c.id !== championId),
    [core, championId],
  )

  useEffect(() => {
    const file = core.buildIndex[championId]
    const championChanged = lastLoadedChampionId.current !== championId
    lastLoadedChampionId.current = championId
    if (!file) {
      setBuild(withCustomRoutes(null, championId, customRoutes, core))
      return
    }
    if (championChanged) setBuild(undefined)
    loadBuild(file, lang)
      .then((loaded) => setBuild(withCustomRoutes(loaded, championId, customRoutes, core)))
      // 没有 .catch 的话，loadBuild 一旦 reject(网络抖动/build json 损坏/打包路径问题)，build 会永远
      // 卡在 undefined(加载中)，用户看到永久转圈还没报错。退回 null 走"无出装"空态，跟隔壁
      // DetectedRouteCard 的处理保持一致。
      .catch(() => setBuild(withCustomRoutes(null, championId, customRoutes, core)))
  }, [championId, core, customRoutes, lang])

  useEffect(() => {
    if (!build) return
    const preferredIdx = selectedArchetypeKey
      ? build.archetypes.findIndex((a) => a.key === selectedArchetypeKey)
      : -1
    setActiveIdx(preferredIdx >= 0 ? preferredIdx : 0)
  }, [build, selectedArchetypeKey])

  const active = build?.archetypes[activeIdx]

  const chooseArchetype = (idx: number) => {
    const archetype = build?.archetypes[idx]
    if (!archetype) return
    setActiveIdx(idx)
    setSyncPulse(true)
    window.setTimeout(() => setSyncPulse(false), 1800)
    onArchetypePreference(championId, archetype.key)
  }

  return (
    <>
      <button
        className="group mb-2.5 inline-flex h-8 items-center gap-1.5 rounded-md border border-line/45 bg-transparent px-2 text-[12px] font-bold text-dim cursor-pointer transition hover:border-hex/35 hover:bg-white/[0.04] hover:text-cream active:scale-[0.98]"
        onClick={onBack}
      >
        <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded border border-line/40 bg-[#050a11]/45 text-[13px] leading-none text-hex/85 transition group-hover:border-hex/45 group-hover:text-hex">←</span>
        <span>{t('detail.back')}</span>
      </button>
      {champ && build && build.archetypes.length > 1 && (
        <section className="glass-panel mb-3 rounded-[8px] border border-line/70 p-2.5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hex/35" />
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-hex">Route switcher</div>
              <div className="mt-0.5 truncate text-[12px] font-bold text-dim">{champ.name} · {active?.name ?? t('detail.chooseArchetype', { name: champ.name })}</div>
            </div>
            <div className="rounded border border-hex/30 bg-hex/8 px-2 py-1 text-[10px] font-black text-hex">
              {syncPulse ? 'Synced' : 'Current route'}
            </div>
          </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
            {build.archetypes.map((a, i) => {
              const coreAugments = a.augments.core
                .map((ref) => getAugment(core.augById, ref.id)?.name ?? ref.name)
                .filter(Boolean)
                .slice(0, 2)
              return (
                <button
                  key={a.key}
                  onClick={() => chooseArchetype(i)}
                  className={
                    'flex min-h-[58px] cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition hover:-translate-y-0.5 ' +
                    (i === activeIdx
                      ? 'border-hex/70 bg-hex text-[#041017] shadow-[0_10px_22px_rgba(34,211,238,0.14)]'
                      : 'border-line/70 bg-panel/78 text-dim hover:border-hex/50 hover:text-cream')
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-extrabold">{a.name}</span>
                    <span className={i === activeIdx ? 'mt-0.5 block truncate text-[10px] font-bold text-[#041017]/75' : 'mt-0.5 block truncate text-[10px] font-bold text-hex/85'}>
                      {coreAugments.length > 0
                        ? `${lang === 'en' ? 'Core' : '核心'}: ${coreAugments.join(' / ')}`
                        : i === activeIdx ? t('detail.archetypeLocked') : t('detail.archetypeSetActive')}
                    </span>
                    <span className={i === activeIdx ? 'mt-0.5 block text-[9px] text-[#041017]/65' : 'mt-0.5 block text-[9px] text-dim'}>
                      {i === activeIdx ? t('detail.archetypeLocked') : t('detail.archetypeSetActive')}
                    </span>
                  </span>
                  <span
                    className={
                      'shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold ' +
                      (i === activeIdx
                        ? 'bg-[#041017]/15 text-[#041017]'
                        : a.damageType === 'AP'
                          ? 'bg-[#9664dc]/18 text-[#c9a3f0]'
                          : 'bg-[#dc8246]/18 text-[#f0a97a]')
                    }
                  >
                    {a.damageType}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {champ && <ChampionWarRoom champ={champ} build={build} active={active} core={core} />}
      {build === undefined && <div className="p-16 text-center text-dim">{t('detail.loading')}</div>}
      {build === null && (
        <div className="pt-5 pb-4">
          <div className={CARD + ' p-8 text-center'}>
            <div className="text-lg font-extrabold text-cream">{t('detail.noBuild', { name: champ?.name ?? '' })}</div>
            <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-dim">
              {t('detail.noBuildDesc')}
            </div>
            <div className="mt-2 text-xs text-dim/70">
              {t('detail.coverage', { covered: covered.length + 1, total: core.champions.length })}
            </div>
          </div>
          {covered.length > 0 && (
            <div className="mt-10 max-w-2xl mx-auto">
              <div className="text-xs text-dim mb-3 text-center">{t('detail.checkOutOthers')}</div>
              <div className="flex flex-wrap justify-center gap-2.5">
                {covered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    title={c.name}
                    className="flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <img
                      src={icon(c.iconLocal)}
                      alt={c.name}
                      className="w-11 h-11 rounded-lg border border-line group-hover:border-gold transition"
                    />
                    <span className="text-[10px] text-dim group-hover:text-cream">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {active && <ArchetypeCard key={active.key} arch={active} augById={core.augById} itemById={core.itemById} />}
      {active && <AugmentDecisionLab arch={active} core={core} />}
    </>
  )
}

function ChampionWarRoom({
  champ,
  build,
  active,
  core,
}: {
  champ: Champion
  build: Build | null | undefined
  active: Archetype | undefined
  core: Core
}) {
  const routeCount = build?.archetypes.length ?? 0
  const coveredCount = Object.keys(core.buildIndex).length
  const typeTone =
    !active
      ? 'border-line/55 bg-[#050a11]/48 text-dim'
      : active.damageType === 'AP'
      ? 'border-[#9664dc]/35 bg-[#9664dc]/14 text-[#c9a3f0]'
      : active.damageType === 'Tank'
        ? 'border-[#63c07a]/35 bg-[#63c07a]/12 text-[#8bd99e]'
        : 'border-[#dc8246]/35 bg-[#dc8246]/14 text-[#f0a97a]'

  return (
    <section className="relative mb-3 overflow-hidden rounded-[8px] border border-hex/24 bg-[#0b1421] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hex/45" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={icon(champ.iconLocal)}
            alt={champ.name}
            className="h-12 w-12 shrink-0 rounded-[6px] border border-hex/45 object-cover"
          />
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-hex">Mayhem combat file</div>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-[21px] font-black leading-none text-cream">{champ.name}</h1>
              <span className="truncate text-[11px] font-bold text-dim">{champ.title}</span>
            </div>
            <div className="mt-1 truncate text-[12px] font-black text-hex">{active?.name ?? 'Route pending'}</div>
          </div>
        </div>
        <div className={'grid h-9 min-w-9 place-items-center rounded-md border px-2 text-[11px] font-black ' + typeTone}>
          {active?.damageType ?? '-'}
        </div>
      </div>
      <div className="relative mt-2 grid grid-cols-3 gap-1.5 max-[620px]:grid-cols-1">
        <div className="rounded-[5px] border border-line/45 bg-[#050a11]/34 px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">Routes</div>
          <div className="mt-0.5 text-[14px] font-black text-cream">{routeCount || '-'}</div>
        </div>
        <div className="rounded-[5px] border border-line/45 bg-[#050a11]/34 px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">Library</div>
          <div className="mt-0.5 text-[14px] font-black text-cream">{coveredCount}</div>
        </div>
        <div className="rounded-[5px] border border-line/45 bg-[#050a11]/34 px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-dim">Status</div>
          <div className="mt-0.5 text-[14px] font-black text-hex">{active ? 'Ready' : 'Pending'}</div>
        </div>
      </div>
    </section>
  )
}

type CountedItem = Item & { count: number }

function stackItems(items: Item[]): CountedItem[] {
  const stacked: CountedItem[] = []
  for (const item of items) {
    const existing = stacked.find((entry) => entry.id === item.id)
    if (existing) existing.count += 1
    else stacked.push({ ...item, count: 1 })
  }
  return stacked
}

function MiniItemLine({ items, showNames = false }: { items: Item[]; showNames?: boolean }) {
  const visibleItems = stackItems(items)
  if (showNames) {
    return (
      <div className="grid grid-cols-6 gap-2 max-[980px]:grid-cols-3">
        {visibleItems.map((it, idx) => (
          <div key={it.id + '-' + idx} className="min-w-0 rounded-lg border border-line/70 bg-panel/65 p-2 text-center">
            <span className="relative mx-auto block w-fit">
              <img src={icon(it.iconLocal)} alt={it.name} title={it.name} className="h-10 w-10 rounded-lg border border-line/80" />
              {it.count > 1 && (
                <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-panel bg-gold px-1 text-[9px] font-extrabold leading-none text-[#091428]">
                  {it.count}
                </span>
              )}
            </span>
            <div className="mt-1.5 line-clamp-2 min-h-[28px] text-[11px] font-bold leading-[14px] text-cream">{it.name}</div>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - visibleItems.length) }).map((_, idx) => (
          <div key={`empty-${idx}`} className="grid min-h-[80px] place-items-center rounded-lg border border-dashed border-line/55 bg-panel/35 text-[11px] font-bold text-dim">
            空
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleItems.map((it, idx) => (
        <div key={it.id + '-' + idx} className="flex items-center gap-2">
          <span className="relative block">
            <img src={icon(it.iconLocal)} alt={it.name} title={it.name} className="h-9 w-9 rounded-lg border border-line/80" />
            {it.count > 1 && (
              <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-panel bg-gold px-1 text-[9px] font-extrabold leading-none text-[#091428]">
                {it.count}
              </span>
            )}
          </span>
          {idx < visibleItems.length - 1 && <span className="text-dim text-xs">-&gt;</span>}
        </div>
      ))}
    </div>
  )
}

function AugmentDecisionLab({ arch, core }: { arch: Archetype; core: Core }) {
  const t = useT()
  const lang = useLang()
  const [queries, setQueries] = useState(['', '', ''])
  const [pickedIds, setPickedIds] = useState<Array<number | null>>([null, null, null])
  const [ownedQuery, setOwnedQuery] = useState('')
  const [ownedIds, setOwnedIds] = useState<number[]>([])
  const selected = useMemo(
    () => pickedIds.map((id) => (id == null ? null : getAugment(core.augById, id))),
    [core.augById, pickedIds],
  )
  const ownedAugments = useMemo(
    () => ownedIds.map((id) => getAugment(core.augById, id)).filter((a): a is Augment => !!a),
    [core.augById, ownedIds],
  )
  const decisions = useMemo(
    () =>
      selected
        .filter((a): a is Augment => !!a)
        .map((augment) => scoreAugmentPick(augment, arch, ownedAugments, lang))
        .sort((a, b) => b.score - a.score),
    [arch, lang, ownedAugments, selected],
  )
  const winner = decisions[0]

  const updateQuery = (idx: number, value: string) => {
    setQueries((current) => current.map((q, i) => (i === idx ? value : q)))
    setPickedIds((current) => current.map((id, i) => (i === idx ? null : id)))
  }
  const pickAugment = (idx: number, augment: Augment) => {
    setQueries((current) => current.map((q, i) => (i === idx ? augment.name : q)))
    setPickedIds((current) => current.map((id, i) => (i === idx ? augment.id : id)))
  }
  const clear = () => {
    setQueries(['', '', ''])
    setPickedIds([null, null, null])
  }
  const addOwned = (augment: Augment) => {
    setOwnedIds((current) => (current.includes(augment.id) ? current : [...current, augment.id]))
    setOwnedQuery('')
  }
  const removeOwned = (id: number) => setOwnedIds((current) => current.filter((ownedId) => ownedId !== id))

  return (
    <section className={CARD + ' mt-3 p-3'}>
      <div className="relative grid grid-cols-[minmax(0,1fr)_300px] gap-3 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="mb-2 flex items-end justify-between gap-3 border-b border-line/50 pb-2">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">Augment decision lab</div>
              <h3 className="mt-0.5 truncate text-[16px] font-black text-cream">{t('lab.title')}</h3>
            </div>
            <div className="shrink-0 rounded border border-line/55 bg-[#050a11]/48 px-2 py-1 text-[10px] font-black text-dim">
              3 choices
            </div>
          </div>
          <OwnedAugmentsPanel
            query={ownedQuery}
            ownedAugments={ownedAugments}
            augments={core.augments}
            onQuery={setOwnedQuery}
            onAdd={addOwned}
            onRemove={removeOwned}
          />
          <div className="mt-2 grid grid-cols-3 gap-2 max-[820px]:grid-cols-1">
            {[0, 1, 2].map((idx) => (
              <AugmentChoiceInput
                key={idx}
                idx={idx}
                query={queries[idx]}
                pickedId={pickedIds[idx]}
                augments={core.augments}
                onQuery={(value) => updateQuery(idx, value)}
                onPick={(augment) => pickAugment(idx, augment)}
              />
            ))}
          </div>
        </div>

        <div className="relative rounded-[6px] border border-line/65 bg-[#07101b]/64 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-dim">Recommendation</div>
            <button onClick={clear} className="cursor-pointer rounded border border-line/55 bg-[#050a11]/42 px-2 py-1 text-[10px] font-bold text-dim transition hover:border-hex/35 hover:text-cream">
              {t('lab.clear')}
            </button>
          </div>
          {winner ? (
            <>
              <DecisionResult pick={winner} rank={1} featured />
              <div className="mt-2 flex flex-col gap-1.5">
                {decisions.slice(1).map((pick, idx) => (
                  <DecisionResult key={pick.augment.id} pick={pick} rank={idx + 2} />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-2 rounded-[5px] border border-line/55 bg-[#050a11]/38 p-3 text-[11px] leading-4 text-dim">
              {t('lab.emptyRecommendation')}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function preserveNearestScroll(target: HTMLElement, update: () => void) {
  const scroller = target.closest('main')
  if (!scroller) {
    update()
    return
  }
  const top = scroller.scrollTop
  const left = scroller.scrollLeft
  const restore = () => {
    scroller.scrollTop = top
    scroller.scrollLeft = left
  }
  update()
  window.requestAnimationFrame(() => {
    restore()
    window.requestAnimationFrame(restore)
    window.setTimeout(restore, 0)
  })
}

function AugmentChoiceInput({
  idx,
  query,
  pickedId,
  augments,
  onQuery,
  onPick,
}: {
  idx: number
  query: string
  pickedId: number | null
  augments: Augment[]
  onQuery: (value: string) => void
  onPick: (augment: Augment) => void
}) {
  const t = useT()
  const needle = query.trim().toLowerCase()
  const trimmedQuery = query.trim()
  const suggestions = useMemo(
    () =>
      needle
        ? augments
            .filter((a) => a.name.includes(trimmedQuery) || a.apiName.toLowerCase().includes(needle) || a.desc.includes(trimmedQuery))
            .slice(0, 5)
        : [],
    [augments, needle, trimmedQuery],
  )
  const picked = useMemo(
    () => (pickedId == null ? null : augments.find((a) => a.id === pickedId) ?? null),
    [augments, pickedId],
  )

  return (
    <div className="rounded-[6px] border border-line/62 bg-[#07101b]/55 p-2">
      <label className="text-[10px] font-black uppercase tracking-[0.12em] text-dim">{t('lab.option', { n: idx + 1 })}</label>
      <input
        value={query}
        onChange={(e) => preserveNearestScroll(e.currentTarget, () => onQuery(e.currentTarget.value))}
        placeholder={t('lab.inputPlaceholder')}
        className="mt-1.5 w-full rounded-md border border-line/65 bg-[#050a11]/48 px-2 py-1.5 text-[12px] text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {picked && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-hex/25 bg-hex/8 p-1.5">
          <img src={icon(picked.iconLargeLocal)} alt={picked.name} className="h-7 w-7 rounded border border-line object-cover" />
          <span className="min-w-0 truncate text-[11px] font-bold text-cream">{picked.name}</span>
        </div>
      )}
      {!picked && suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onPick(a))}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line/50 bg-panel2/45 p-1.5 text-left transition hover:border-hex/50"
            >
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-6 w-6 rounded border border-line object-cover" />
              <span className="min-w-0 break-words text-[10px] leading-[12px] text-cream">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OwnedAugmentsPanel({
  query,
  ownedAugments,
  augments,
  onQuery,
  onAdd,
  onRemove,
}: {
  query: string
  ownedAugments: Augment[]
  augments: Augment[]
  onQuery: (value: string) => void
  onAdd: (augment: Augment) => void
  onRemove: (id: number) => void
}) {
  const t = useT()
  const needle = query.trim().toLowerCase()
  const trimmedQuery = query.trim()
  const ownedIdSet = useMemo(() => new Set(ownedAugments.map((a) => a.id)), [ownedAugments])
  const suggestions = useMemo(
    () =>
      needle
        ? augments
            .filter(
              (a) =>
                !ownedIdSet.has(a.id) &&
                (a.name.includes(trimmedQuery) || a.apiName.toLowerCase().includes(needle) || a.desc.includes(trimmedQuery)),
            )
            .slice(0, 5)
        : [],
    [augments, needle, ownedIdSet, trimmedQuery],
  )

  return (
    <div className="rounded-[6px] border border-hex/22 bg-hex/7 p-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black text-hex">{t('lab.owned.title')}</div>
          <div className="mt-0.5 text-[10px] text-dim">{t('lab.owned.desc')}</div>
        </div>
        {ownedAugments.length > 0 && (
          <span className="rounded border border-line/60 bg-panel/55 px-2 py-0.5 text-[10px] text-dim">
            {t('lab.owned.count', { n: ownedAugments.length })}
          </span>
        )}
      </div>
      <input
        value={query}
        onChange={(e) => preserveNearestScroll(e.currentTarget, () => onQuery(e.currentTarget.value))}
        placeholder={t('lab.owned.addPlaceholder')}
        className="mt-2 w-full rounded-md border border-line/65 bg-[#050a11]/48 px-2 py-1.5 text-[12px] text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {suggestions.length > 0 && (
        <div className="mt-1.5 grid grid-cols-2 gap-1 max-[780px]:grid-cols-1">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onAdd(a))}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line/50 bg-panel2/45 p-1.5 text-left transition hover:border-hex/50"
            >
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-6 w-6 rounded border border-line object-cover" />
              <span className="min-w-0 break-words text-[10px] leading-[12px] text-cream">{a.name}</span>
            </button>
          ))}
        </div>
      )}
      {ownedAugments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ownedAugments.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onRemove(a.id))}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line/45 bg-[#050a11]/38 px-1.5 py-1 text-[11px] text-cream transition hover:border-red/45 hover:text-red"
              title={t('lab.owned.removeHint')}
            >
              <img src={icon(a.iconSmallLocal)} alt={a.name} className="h-4 w-4 rounded-full" />
              {a.name}
              <span className="text-dim">×</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-md border border-line/50 bg-panel/45 p-1.5 text-[10px] text-dim">
          {t('lab.owned.empty')}
        </div>
      )}
    </div>
  )
}

function DecisionResult({ pick, rank, featured = false }: { pick: DecisionPick; rank: number; featured?: boolean }) {
  const t = useT()
  const lang = useLang()
  const tone =
    pick.tone === 'recommend'
      ? 'border-hex/45 bg-hex/10 text-hex'
      : pick.tone === 'good'
        ? 'border-cream/30 bg-cream/8 text-cream'
        : pick.tone === 'avoid'
          ? 'border-red/45 bg-red/10 text-red'
          : 'border-line/60 bg-panel/55 text-dim'
  return (
    <div className={'rounded-[6px] border p-2 ' + tone}>
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#091428]/65 text-[11px] font-extrabold">
          #{rank}
        </div>
        <img src={icon(pick.augment.iconLargeLocal)} alt={pick.augment.name} className={(featured ? 'h-9 w-9' : 'h-8 w-8') + ' rounded-md border border-line/70 object-cover'} />
        <div className="min-w-0 flex-1">
          <div className={(featured ? 'text-[13px]' : 'text-[12px]') + ' truncate font-extrabold text-cream'}>{pick.augment.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-current/35 bg-[#091428]/45 px-1.5 py-px text-[9px] font-extrabold">
              {pick.grade}
            </span>
            <span className="text-[10px] font-bold">{pick.label}</span>
            {pick.verified ? (
              <span className="rounded border border-[#3fb950]/40 bg-[#3fb950]/10 px-1 py-px text-[8px] font-bold text-[#3fb950]">
                {t('lab.verified')}
              </span>
            ) : (
              <span className="rounded border border-line/60 bg-panel/55 px-1 py-px text-[8px] font-bold text-dim">
                {t('lab.unverified')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-dim">{pick.reason}</div>
      {pick.comboNotes.length > 0 && (
        <div className="mt-1.5 line-clamp-2 rounded-md border border-hex/20 bg-hex/8 px-2 py-1.5 text-[10px] leading-4 text-hex">
          {pick.comboNotes.join(' · ')}
        </div>
      )}
      {pick.tags.length > 0 && (
        <div className="mt-1.5 truncate text-[9px] text-dim/70">
          {t('lab.tagsHit')}{pick.tags.slice(0, 4).map((tag) => augmentTagLabel(tag, lang)).join(' · ')}
        </div>
      )}
    </div>
  )
}

function QuickAugLine({ label, tone, items }: { label: string; tone: 'core' | 'good' | 'trap'; items: Augment[] }) {
  const t = useT()
  const toneClass =
    tone === 'core'
      ? 'text-gold border-gold/28 bg-gold/8'
      : tone === 'good'
        ? 'text-hex border-hex/28 bg-hex/8'
        : 'text-red border-red/28 bg-red/8'
  return (
    <div className={'min-w-0 rounded-[6px] border p-2 ' + toneClass}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.12em]">{label}</div>
        <div className="text-[10px] font-black opacity-70">{items.length}</div>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-1.5">
          {items.slice(0, 3).map((a) => (
            <div key={a.id} className="flex min-h-[36px] min-w-0 items-center gap-1.5 rounded-[5px] border border-line/50 bg-[#050a11]/45 px-1.5 py-1">
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-7 w-7 shrink-0 rounded border border-line/70 object-cover" />
              <span className="min-w-0 break-words text-[9px] font-extrabold leading-[10px] text-cream">{a.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[5px] border border-line/45 bg-[#050a11]/35 px-2 py-2 text-[11px] text-dim">{t('common.none')}</div>
      )}
    </div>
  )
}

function AugmentMiniIcon({ id, core, size = 'h-8 w-8' }: { id: number; core: Core; size?: string }) {
  const augment = getAugment(core.augById, id)
  if (!augment) {
    return (
      <div
        title={`Unknown augment #${id}`}
        className={size + ' grid shrink-0 place-items-center rounded-lg border border-line/70 bg-[#050a11]/75 text-[10px] font-extrabold text-dim'}
      >
        ?
      </div>
    )
  }
  return (
    <img
      src={icon(augment.iconLargeLocal)}
      alt={augment.name}
      title={augment.name}
      className={size + ' shrink-0 rounded-lg border-2 object-cover ' + (RARITY[augment.rarity] ?? RARITY[0]).border}
    />
  )
}

function inferDamageTypeFromItems(items: Item[]): string {
  let apScore = 0
  let adScore = 0
  let tankScore = 0
  for (const item of items) {
    const categories = item.categories ?? []
    if (categories.some((category) => ['SpellDamage', 'MagicPenetration'].includes(category))) apScore += 2
    if (categories.some((category) => ['Damage', 'CriticalStrike', 'ArmorPenetration'].includes(category))) adScore += 2
    if (categories.some((category) => ['Health', 'Armor', 'SpellBlock'].includes(category))) tankScore += 1
  }
  if (tankScore > apScore && tankScore > adScore) return 'Tank'
  return apScore >= adScore ? 'AP' : 'AD'
}

function buildCustomRouteFromPlayer(p: PlayerMatchStats, core: Core, lang: Lang): CustomRoute {
  const champion = core.champions.find((c) => c.id === p.championId)
  const items = p.items.map((id) => core.itemById.get(id)).filter((item): item is Item => !!item).slice(0, 6)
  const augmentIds = p.augments
    .map((id) => getAugment(core.augById, id)?.id)
    .filter((id): id is number => typeof id === 'number')
  const championName = champion?.name ?? (lang === 'en' ? 'Unknown champion' : '未知英雄')
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
    championId: p.championId,
    title: lang === 'en' ? `${championName} copied route` : `${championName} 复制路线`,
    description:
      lang === 'en'
        ? `Captured from ${p.summonerName}'s ARAM: Mayhem match. KDA ${p.kills}/${p.deaths}/${p.assists}, damage ${p.totalDamageDealtToChampions.toLocaleString()}.`
        : `从 ${p.summonerName} 的海克斯大乱斗对局复制。KDA ${p.kills}/${p.deaths}/${p.assists}，伤害 ${p.totalDamageDealtToChampions.toLocaleString()}。`,
    damageType: inferDamageTypeFromItems(items),
    starterItemIds: [],
    itemIds: items.map((item) => item.id),
    coreAugmentIds: augmentIds.slice(0, 2),
    goodAugmentIds: augmentIds.slice(2),
    trapAugmentIds: [],
    updatedAt: new Date().toISOString(),
  }
}

function PlayerLoadoutPanel({
  p,
  core,
  onSaveRoute,
}: {
  p: PlayerMatchStats
  core: Core
  onSaveRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const lang = useLang()
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const items = p.items.map((id) => core.itemById.get(id)).filter((x): x is Item => !!x)
  const copyPlayer = async () => {
    await copyText(buildPlayerCopyText(p, core, lang))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }
  const savePlayer = async () => {
    await onSaveRoute(buildCustomRouteFromPlayer(p, core, lang))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }
  return (
    <div className="border-x border-b border-line/55 bg-[#07101b]/45 px-3 pb-3 pt-1">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-dim">
          {lang === 'en' ? 'Capture this player as a route draft.' : '把这个玩家的出装和增强复制成路线草稿。'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyPlayer}
            className="rounded-md border border-line/65 bg-panel/55 px-3 py-1.5 text-[11px] font-extrabold text-cream transition hover:border-hex/45 hover:bg-hex/8 active:translate-y-px"
          >
            {copied ? (lang === 'en' ? 'Text copied' : '\u6587\u672c\u5df2\u590d\u5236') : (lang === 'en' ? 'Copy text' : '\u590d\u5236\u6587\u672c')}
          </button>
          <button
            type="button"
            onClick={savePlayer}
            className={BTN_PRIMARY}
          >
            {saved ? (lang === 'en' ? 'Saved' : '\u5df2\u4fdd\u5b58') : (lang === 'en' ? 'Save to library' : '\u4fdd\u5b58\u5230\u8def\u7ebf\u5e93')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[920px]:grid-cols-1">
        <div className="rounded-[8px] border border-line/60 bg-panel/45 p-3">
          <div className="mb-2 text-[11px] font-extrabold tracking-[0.08em] text-dim">FINAL ITEMS</div>
          <div className="grid grid-cols-6 gap-2 max-[760px]:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => {
              const item = items[index]
              return item ? (
                <div key={`${item.id}-${index}`} className="min-w-0 text-center">
                  <img src={icon(item.iconLocal)} alt={item.name} title={item.name} className="mx-auto h-10 w-10 rounded-lg border border-line object-cover" />
                  <div className="mt-1 line-clamp-2 min-h-[26px] text-[10px] font-bold leading-[13px] text-cream">{item.name}</div>
                </div>
              ) : (
                <div key={`empty-item-${index}`} className="grid min-h-[72px] place-items-center rounded-lg border border-dashed border-line/45 text-[10px] font-bold text-dim">
                  Empty
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-[8px] border border-line/60 bg-panel/45 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-extrabold tracking-[0.08em] text-dim">AUGMENTS</div>
            <div className="rounded-md border border-line/60 bg-[#050a11]/60 px-2 py-0.5 text-[10px] font-extrabold text-gold">
              {p.augments.length}/4
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 max-[760px]:grid-cols-2">
            {Array.from({ length: Math.max(4, p.augments.length) }).map((_, index) => {
              const augmentId = p.augments[index]
              const augment = augmentId ? getAugment(core.augById, augmentId) : null
              return augmentId ? (
                <div key={`${augmentId}-${index}`} className="min-w-0 text-center">
                  <AugmentMiniIcon id={augmentId} core={core} size="mx-auto h-10 w-10" />
                  <div className="mt-1 line-clamp-2 min-h-[26px] text-[10px] font-bold leading-[13px] text-cream">
                    {augment?.name ?? `Unknown #${augmentId}`}
                  </div>
                </div>
              ) : (
                <div key={`empty-augment-${index}`} className="grid min-h-[72px] place-items-center rounded-lg border border-dashed border-line/45 text-[10px] font-bold text-dim">
                  Empty
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayerRow({
  p,
  core,
  maxDamage,
  expanded,
  onToggle,
  onSaveRoute,
}: {
  p: PlayerMatchStats
  core: Core
  maxDamage: number
  expanded: boolean
  onToggle: () => void
  onSaveRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const t = useT()
  const champ = core.champions.find((c) => c.id === p.championId)
  const items = p.items.map((id) => core.itemById.get(id)).filter((x): x is Item => !!x)
  const dmgPct = maxDamage > 0 ? Math.round((p.totalDamageDealtToChampions / maxDamage) * 100) : 0
  return (
    <div className="overflow-hidden rounded-[8px]">
      <button
        type="button"
        onClick={onToggle}
        className={
          'grid w-full grid-cols-[44px_minmax(120px,1fr)_84px_minmax(160px,1.1fr)_190px_72px] items-center gap-3 border px-3 py-2.5 text-left transition hover:border-gold/35 hover:bg-white/[0.03] max-[1100px]:grid-cols-[44px_minmax(120px,1fr)_84px_minmax(150px,1fr)_72px] max-[820px]:grid-cols-[44px_minmax(0,1fr)_72px] ' +
          (expanded
            ? 'border-gold/45 bg-gold/10'
            : p.isMe
              ? 'border-gold/30 bg-gold/8'
              : 'border-line/45 bg-panel/35')
        }
      >
        {champ ? (
          <img src={icon(champ.iconLocal)} alt={champ.name} className="h-10 w-10 rounded-lg border border-line shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg border border-dashed border-line/55 bg-panel/45" />
        )}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-extrabold text-cream">{champ?.name ?? t('match.unknownChamp')}</div>
          <div className="truncate text-[11px] text-dim">{p.summonerName}</div>
        </div>
        <div className="text-center text-xs font-extrabold text-cream">
          {p.kills} / {p.deaths} / {p.assists}
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center justify-between text-[11px] text-dim">
            <span>{t('match.damage')}</span>
            <span>{p.totalDamageDealtToChampions.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
            <div className="h-full bg-red" style={{ width: dmgPct + '%' }} />
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1 max-[1100px]:hidden">
          {Array.from({ length: 6 }).map((_, index) => {
            const item = items[index]
            return item ? (
              <img key={`${item.id}-${index}`} src={icon(item.iconLocal)} alt={item.name} title={item.name} className="h-7 w-7 rounded border border-line object-cover" />
            ) : (
              <span key={`empty-${index}`} className="h-7 w-7 rounded border border-dashed border-line/45" />
            )
          })}
        </div>
        <div className="justify-self-end rounded-md border border-line/60 bg-[#050a11]/60 px-2 py-1 text-[11px] font-extrabold text-gold">
          {p.augments.length}/4
        </div>
      </button>
      {expanded && <PlayerLoadoutPanel p={p} core={core} onSaveRoute={onSaveRoute} />}
    </div>
  )
}

function matchCopyLine(p: PlayerMatchStats, core: Core): string {
  const champ = core.champions.find((c) => c.id === p.championId)
  const items = p.items.map((id) => core.itemById.get(id)?.name).filter((name): name is string => !!name)
  const augments = p.augments.map((id) => getAugment(core.augById, id)?.name ?? `Unknown #${id}`)
  return [
    `${champ?.name ?? 'Unknown'} (${p.summonerName})`,
    `KDA ${p.kills}/${p.deaths}/${p.assists}`,
    `Items: ${items.length > 0 ? items.join(' > ') : 'None'}`,
    `Augments: ${augments.length > 0 ? augments.join(' / ') : 'None'}`,
  ].join(' | ')
}

function buildPlayerCopyText(p: PlayerMatchStats, core: Core, lang: Lang): string {
  const champ = core.champions.find((c) => c.id === p.championId)
  const championName = champ?.name ?? (lang === 'en' ? 'Unknown champion' : '未知英雄')
  const items = p.items.map((id) => core.itemById.get(id)?.name ?? `Unknown item #${id}`)
  const augments = p.augments.map((id) => getAugment(core.augById, id)?.name ?? `Unknown augment #${id}`)

  if (lang === 'en') {
    return [
      'Mayhempedia single-player route capture',
      `Champion: ${championName}`,
      `Player: ${p.summonerName}`,
      `KDA: ${p.kills}/${p.deaths}/${p.assists}`,
      `Damage: ${p.totalDamageDealtToChampions.toLocaleString()}`,
      `Route title: ${championName} match-tested route`,
      `Playstyle notes: Captured from a real ARAM: Mayhem match. Review and polish before publishing.`,
      `Final items: ${items.length > 0 ? items.join(' > ') : 'None'}`,
      `Augments: ${augments.length > 0 ? augments.join(' / ') : 'None'}`,
    ].join('\n')
  }

  return [
    'Mayhempedia 单人路线采集',
    `英雄：${championName}`,
    `玩家：${p.summonerName}`,
    `KDA：${p.kills}/${p.deaths}/${p.assists}`,
    `伤害：${p.totalDamageDealtToChampions.toLocaleString()}`,
    `路线标题：${championName} 实战路线`,
    '玩法介绍：来自一局真实海克斯大乱斗对局，发布前需要再确认强度和适配英雄。',
    `六神装：${items.length > 0 ? items.join(' > ') : '暂无'}`,
    `增强：${augments.length > 0 ? augments.join(' / ') : '暂无'}`,
  ].join('\n')
}

function buildMatchCopyText(detail: MatchFullDetail, core: Core, lang: Lang): string {
  const ally = detail.players.filter((p) => p.team === 'ally')
  const enemy = detail.players.filter((p) => p.team === 'enemy')
  const title = lang === 'en' ? 'Mayhempedia match capture' : 'Mayhempedia 对局采集'
  const allyTitle = lang === 'en' ? 'Ally team' : '己方'
  const enemyTitle = lang === 'en' ? 'Enemy team' : '敌方'
  return [
    `${title} #${detail.gameId}`,
    '',
    `[${allyTitle}]`,
    ...ally.map((p) => matchCopyLine(p, core)),
    '',
    `[${enemyTitle}]`,
    ...enemy.map((p) => matchCopyLine(p, core)),
  ].join('\n')
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const node = document.createElement('textarea')
    node.value = text
    node.setAttribute('readonly', 'true')
    node.style.position = 'fixed'
    node.style.left = '-9999px'
    document.body.appendChild(node)
    node.select()
    document.execCommand('copy')
    document.body.removeChild(node)
  }
}

function TeamIconSlot({
  children,
  title,
  tone = 'neutral',
}: {
  children?: ReactNode
  title?: string
  tone?: 'neutral' | 'augment' | 'empty'
}) {
  const toneClass =
    tone === 'augment'
      ? 'border-[#8d6cf0]/45 bg-[#100f1a]'
      : tone === 'empty'
        ? 'border-line/35 bg-[#10151b]/55'
        : 'border-line/55 bg-[#07101b]/70'
  return (
    <div
      title={title}
      className={'grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[5px] border ' + toneClass}
    >
      {children}
    </div>
  )
}

function captureScore(player: PlayerMatchStats, maxDamage: number): number {
  const damageScore = maxDamage > 0 ? (player.totalDamageDealtToChampions / maxDamage) * 42 : 0
  const itemScore = Math.min(6, player.items.length) * 4.5
  const augmentScore = Math.min(4, player.augments.length) * 5
  const kdaScore = Math.min(18, ((player.kills + player.assists) / Math.max(1, player.deaths)) * 4)
  return damageScore + itemScore + augmentScore + kdaScore + (player.win ? 4 : 0)
}

function getCaptureCandidate(detail: MatchFullDetail): PlayerMatchStats | null {
  const maxDamage = Math.max(...detail.players.map((player) => player.totalDamageDealtToChampions), 1)
  return [...detail.players].sort((a, b) => captureScore(b, maxDamage) - captureScore(a, maxDamage))[0] ?? null
}

function TeamLoadoutRow({
  p,
  core,
  lang,
  suggested = false,
  onSaveRoute,
}: {
  p: PlayerMatchStats
  core: Core
  lang: Lang
  suggested?: boolean
  onSaveRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const champion = core.champions.find((c) => c.id === p.championId)
  const items = p.items.map((id) => core.itemById.get(id)).filter((item): item is Item => !!item)
  const augments = p.augments.map((id) => getAugment(core.augById, id))
  return (
    <div
      className={
        'group grid w-full grid-cols-[58px_minmax(150px,0.9fr)_180px_230px_86px_104px_62px] items-center gap-2 rounded-[7px] border px-2 py-2 transition hover:border-hex/25 hover:bg-panel2/32 ' +
        (suggested
          ? 'border-hex/45 bg-hex/10 shadow-[inset_2px_0_0_rgba(34,211,238,0.72)]'
          : p.isMe
            ? 'border-hex/30 bg-hex/7'
            : 'border-line/35 bg-[#07101b]/34')
      }
    >
      <div className="flex items-center justify-end gap-2">
        <span className="text-[15px] font-black tabular-nums text-cream">{p.champLevel || 18}</span>
        {champion ? (
          <img
            src={icon(champion.iconLocal)}
            alt={champion.name}
            className={'h-8 w-8 rounded-[6px] border object-cover ' + (p.isMe ? 'border-hex/70' : 'border-line/70')}
          />
        ) : (
          <div className="h-8 w-8 rounded-[6px] border border-line bg-panel" />
        )}
      </div>
      <div className="min-w-0">
        <div className={'truncate text-[12px] font-black ' + (p.isMe ? 'text-hex' : 'text-cream/85')}>
          {p.summonerName}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <span className="truncate text-[9px] font-bold text-dim">{champion?.name ?? 'Unknown'}</span>
          {suggested && (
            <span className="shrink-0 rounded border border-hex/35 bg-hex/10 px-1.5 py-px text-[8px] font-black text-hex">
              {lang === 'en' ? 'Pick' : '推荐'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const augment = augments[index]
          return augment ? (
            <TeamIconSlot key={`${augment.id}-${index}`} title={augment.name} tone="augment">
              <img src={icon(augment.iconLargeLocal)} alt={augment.name} className="h-full w-full object-cover" />
            </TeamIconSlot>
          ) : (
            <TeamIconSlot key={`empty-augment-${index}`} tone="empty" />
          )
        })}
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: 6 }).map((_, index) => {
          const item = items[index]
          return item ? (
            <TeamIconSlot key={`${item.id}-${index}`} title={item.name}>
              <img src={icon(item.iconLocal)} alt={item.name} className="h-full w-full object-cover" />
            </TeamIconSlot>
          ) : (
            <TeamIconSlot key={`empty-item-${index}`} tone="empty" />
          )
        })}
      </div>
      <div className="text-right text-[14px] font-black tabular-nums text-cream">
        {p.kills} <span className="text-dim">/</span> {p.deaths} <span className="text-dim">/</span> {p.assists}
      </div>
      <div className="text-right text-[14px] font-black tabular-nums text-cream">
        {p.totalDamageDealtToChampions.toLocaleString()}
      </div>
      <button
        type="button"
        title={lang === 'en' ? 'Save this player route' : '保存这个玩家路线'}
        onClick={() => onSaveRoute(buildCustomRouteFromPlayer(p, core, lang))}
        className="inline-flex h-8 items-center justify-center gap-1 justify-self-end rounded-[5px] border border-line/55 bg-panel/50 px-2 text-[10px] font-black text-dim opacity-78 transition hover:border-hex/45 hover:bg-hex/10 hover:text-hex hover:opacity-100 active:translate-y-px"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="6" cy="6" r="2.4" />
          <circle cx="18" cy="18" r="2.4" />
          <path d="M8 6h3.5A3.5 3.5 0 0 1 15 9.5v5" />
          <path d="m12.5 12 2.5 2.5 2.5-2.5" />
        </svg>
        {lang === 'en' ? 'Save' : '采集'}
      </button>
    </div>
  )
}

function TeamLoadoutBoard({
  label,
  players,
  core,
  lang,
  tone,
  suggestedParticipantId,
  onSaveRoute,
}: {
  label: string
  players: PlayerMatchStats[]
  core: Core
  lang: Lang
  tone: 'ally' | 'enemy'
  suggestedParticipantId?: number | null
  onSaveRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const kills = players.reduce((sum, player) => sum + player.kills, 0)
  const deaths = players.reduce((sum, player) => sum + player.deaths, 0)
  const assists = players.reduce((sum, player) => sum + player.assists, 0)
  const damage = players.reduce((sum, player) => sum + player.totalDamageDealtToChampions, 0)
  const color = tone === 'ally' ? 'text-hex' : 'text-red'
  const labelText =
    label === 'TEAM 1'
      ? lang === 'en'
        ? 'Team 1'
        : '队伍 1'
      : lang === 'en'
        ? 'Team 2'
        : '队伍 2'
  const orderedPlayers = suggestedParticipantId
    ? [...players].sort((a, b) => {
        if (a.participantId === suggestedParticipantId) return -1
        if (b.participantId === suggestedParticipantId) return 1
        return 0
      })
    : players
  return (
    <section className="w-full rounded-[8px] border border-line/45 bg-[#07101b]/38 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
        <div>
          <div className={'text-[12px] font-black uppercase tracking-[0.14em] ' + color}>{labelText}</div>
          <div className="mt-0.5 text-[10px] font-bold text-dim">{lang === 'en' ? 'Loadout strips' : '阵容出装条'}</div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div className={'text-[14px] font-black tabular-nums tracking-[0.08em] ' + color}>
            {kills} <span className="text-dim">/</span> {deaths} <span className="text-dim">/</span> {assists}
          </div>
          <div className="text-[13px] font-black tabular-nums text-cream/75">{damage.toLocaleString()}</div>
        </div>
      </div>
      <div className="space-y-1">
        {orderedPlayers.map((player) => (
          <TeamLoadoutRow
            key={player.participantId}
            p={player}
            core={core}
            lang={lang}
            suggested={player.participantId === suggestedParticipantId}
            onSaveRoute={onSaveRoute}
          />
        ))}
      </div>
    </section>
  )
}

function CompactMatchOverview({
  detail,
  core,
  onSavePlayerRoute,
}: {
  detail: MatchFullDetail
  core: Core
  onSavePlayerRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const lang = useLang()
  const ally = detail.players.filter((p) => p.team === 'ally')
  const enemy = detail.players.filter((p) => p.team === 'enemy')
  const captureCandidate = getCaptureCandidate(detail)
  const candidateChampion = captureCandidate ? core.champions.find((champion) => champion.id === captureCandidate.championId) : null
  const damageRank = captureCandidate
    ? [...detail.players].sort((a, b) => b.totalDamageDealtToChampions - a.totalDamageDealtToChampions).findIndex((player) => player.participantId === captureCandidate.participantId) + 1
    : 0
  return (
    <section className="overview-board rounded-[8px] border border-line/70 bg-panel/78 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_28px_rgba(0,0,0,0.18)]">
      <div className="w-full">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">{lang === 'en' ? 'Loadout board' : '出装面板'}</div>
            <div className="mt-0.5 text-[15px] font-black text-cream">{lang === 'en' ? '10-player route capture' : '10 人路线采集'}</div>
          </div>
          <div className="text-[10px] font-bold text-dim">{lang === 'en' ? 'Use Capture to save one player route' : '点击采集按钮，只保存单个玩家路线'}</div>
        </div>
        {captureCandidate && (
          <div className="mb-2 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] border border-hex/35 bg-hex/8 px-2.5 py-2">
            {candidateChampion ? (
              <img src={icon(candidateChampion.iconLocal)} alt={candidateChampion.name} className="h-10 w-10 rounded-[6px] border border-hex/45 object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-[6px] border border-hex/35 bg-panel/55" />
            )}
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">{lang === 'en' ? 'Recommended capture' : '推荐采集'}</div>
              <div className="mt-0.5 truncate text-[13px] font-black text-cream">
                {captureCandidate.summonerName} · {candidateChampion?.name ?? 'Unknown'}
              </div>
            </div>
            <div className="text-right text-[10px] font-bold text-dim">
              {lang === 'en'
                ? `Damage rank #${damageRank} · ${captureCandidate.items.length}/6 items · ${captureCandidate.augments.length}/4 augments`
                : `伤害第 ${damageRank} · ${captureCandidate.items.length}/6 装备 · ${captureCandidate.augments.length}/4 增强`}
            </div>
          </div>
        )}
        <TeamLoadoutBoard
          label="TEAM 1"
          players={ally}
          core={core}
          lang={lang}
          tone="ally"
          suggestedParticipantId={captureCandidate?.participantId}
          onSaveRoute={onSavePlayerRoute}
        />
        <div className="my-2 h-px bg-line/55" />
        <TeamLoadoutBoard
          label="TEAM 2"
          players={enemy}
          core={core}
          lang={lang}
          tone="enemy"
          suggestedParticipantId={captureCandidate?.participantId}
          onSaveRoute={onSavePlayerRoute}
        />
      </div>
    </section>
  )
}

function MatchOverview({
  detail,
  core,
  onSavePlayerRoute,
}: {
  detail: MatchFullDetail
  core: Core
  onSavePlayerRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const t = useT()
  const lang = useLang()
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(
    detail.players.find((p) => p.isMe)?.participantId ?? null,
  )
  const maxDamage = Math.max(...detail.players.map((p) => p.totalDamageDealtToChampions), 1)
  const ally = detail.players.filter((p) => p.team === 'ally')
  const enemy = detail.players.filter((p) => p.team === 'enemy')
  return (
    <>
      <section className={CARD + ' mb-3 p-4'}>
        <div>
          <div className="text-sm font-extrabold text-cream">{lang === 'en' ? 'Single-player route capture' : '单人路线采集'}</div>
          <div className="mt-1 text-xs leading-5 text-dim">
            {lang === 'en'
              ? 'Open a player, then copy only that player’s items and augments into your route library draft.'
              : '点开你觉得厉害的玩家，只复制这个人的出装和增强，再贴到路线库草稿里。'}
          </div>
        </div>
      </section>
      <section className={CARD + ' p-4'}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className={'text-xs font-semibold ' + (detail.win ? 'text-[#63c07a]' : 'text-red')}>
            {t('match.ally')} · {detail.win ? t('match.win') : t('match.loss')}
          </div>
          <div className="text-[11px] font-semibold text-dim">
            {lang === 'en' ? 'Click a player for full items and augments' : '点击玩家查看完整出装和增强'}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {ally.map((p) => (
            <PlayerRow
              key={p.participantId}
              p={p}
              core={core}
            maxDamage={maxDamage}
            expanded={expandedPlayerId === p.participantId}
            onToggle={() => setExpandedPlayerId((current) => (current === p.participantId ? null : p.participantId))}
            onSaveRoute={onSavePlayerRoute}
          />
          ))}
        </div>
      </section>
      <section className={CARD + ' p-4 mt-3'}>
        <div className={'text-xs font-semibold mb-2 ' + (detail.win ? 'text-red' : 'text-[#63c07a]')}>
          {t('match.enemy')} · {detail.win ? t('match.loss') : t('match.win')}
        </div>
        <div className="flex flex-col gap-1.5">
          {enemy.map((p) => (
            <PlayerRow
              key={p.participantId}
              p={p}
              core={core}
            maxDamage={maxDamage}
            expanded={expandedPlayerId === p.participantId}
            onToggle={() => setExpandedPlayerId((current) => (current === p.participantId ? null : p.participantId))}
            onSaveRoute={onSavePlayerRoute}
          />
          ))}
        </div>
      </section>
    </>
  )
}

function MatchStats({ detail, core }: { detail: MatchFullDetail; core: Core }) {
  const t = useT()
  return (
    <section className={CARD + ' p-4 overflow-x-auto'}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="text-dim text-left border-b border-line">
            <th className="py-2 pr-3 font-semibold">{t('match.col.player')}</th>
            <th className="py-2 px-2 text-center font-semibold">{t('match.col.level')}</th>
            <th className="py-2 px-2 text-center font-semibold">{t('match.col.kda')}</th>
            <th className="py-2 px-2 text-right font-semibold">{t('match.col.damageDealt')}</th>
            <th className="py-2 px-2 text-right font-semibold">{t('match.col.damageTaken')}</th>
            <th className="py-2 px-2 text-right font-semibold">{t('match.col.heal')}</th>
            <th className="py-2 px-2 text-right font-semibold">{t('match.col.cs')}</th>
            <th className="py-2 px-2 text-right font-semibold">{t('match.col.vision')}</th>
            <th className="py-2 pl-2 text-right font-semibold">{t('match.col.gold')}</th>
          </tr>
        </thead>
        <tbody>
          {detail.players.map((p) => {
            const champ = core.champions.find((c) => c.id === p.championId)
            return (
              <tr key={p.participantId} className={'border-b border-line/50 ' + (p.isMe ? 'bg-gold/10' : '')}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    {champ && <img src={icon(champ.iconLocal)} alt={champ.name} className="w-6 h-6 rounded shrink-0" />}
                    <span className={p.team === 'ally' ? 'text-[#63c07a]' : 'text-red'}>{champ?.name ?? '?'}</span>
                  </div>
                </td>
                <td className="text-center">{p.champLevel}</td>
                <td className="text-center">
                  {p.kills}/{p.deaths}/{p.assists}
                </td>
                <td className="text-right">{p.totalDamageDealtToChampions.toLocaleString()}</td>
                <td className="text-right">{p.totalDamageTaken.toLocaleString()}</td>
                <td className="text-right">{p.totalHeal.toLocaleString()}</td>
                <td className="text-right">{p.totalMinionsKilled}</td>
                <td className="text-right">{p.visionScore}</td>
                <td className="text-right">{p.goldEarned.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

/**
 * 经济曲线：画"经济差"(己方-对面)而不是两条各自按自己量级归一化的绝对值折线。
 * ⚠️ 踩过的坑：最初画两条独立折线，各自用当局最大值归一化到同一张图高度——几乎每局"整体缓慢上扬、
 * 两队差距不大"的形状看起来都差不多，用户反馈"graph都是一样的"。经济差是零基准的对称图，
 * 每局涨跌不同、一眼能看出"这局被拉开了没"，是LoL客户端赛后战绩页同款做法。
 */
function MatchGraph({ detail }: { detail: MatchFullDetail }) {
  const t = useT()
  const points = detail.goldGraph
  if (points.length < 2) {
    return <div className={CARD + ' p-8 text-center text-xs text-dim'}>{t('match.tooShort')}</div>
  }
  const W = 640
  const H = 220
  const PAD = 32
  const diffs = points.map((p) => p.allyGold - p.enemyGold)
  const maxAbsDiff = Math.max(...diffs.map((d) => Math.abs(d)), 1)
  const maxT = points[points.length - 1].timestampMs || 1
  const x = (t: number) => PAD + (t / maxT) * (W - PAD * 2)
  const midY = PAD + (H - PAD * 2) / 2
  const y = (d: number) => midY - (d / maxAbsDiff) * ((H - PAD * 2) / 2)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.timestampMs)} ${y(p.allyGold - p.enemyGold)}`).join(' ')
  const areaPath =
    `M ${x(points[0].timestampMs)} ${midY} ` +
    points.map((p) => `L ${x(p.timestampMs)} ${y(p.allyGold - p.enemyGold)}`).join(' ') +
    ` L ${x(points[points.length - 1].timestampMs)} ${midY} Z`

  const finalDiff = diffs[diffs.length - 1]
  const fmtTime = (ms: number) => {
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  const fmtGold = (g: number) => (g >= 0 ? '+' : '') + Math.round(g).toLocaleString()

  return (
    <section className={CARD + ' p-4'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#63c07a] inline-block" />
            {t('match.allyLead')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red inline-block" />
            {t('match.enemyLead')}
          </span>
        </div>
        <div className={'text-sm font-bold ' + (finalDiff >= 0 ? 'text-[#63c07a]' : 'text-red')}>
          {t('match.finalDiff', { diff: fmtGold(finalDiff) })}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <clipPath id="graph-upper">
            <rect x="0" y="0" width={W} height={midY} />
          </clipPath>
          <clipPath id="graph-lower">
            <rect x="0" y={midY} width={W} height={H - midY} />
          </clipPath>
        </defs>
        <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#3d2529" strokeWidth="1" />
        <path d={areaPath} fill="#63c07a" fillOpacity="0.25" clipPath="url(#graph-upper)" />
        <path d={areaPath} fill="#e0463f" fillOpacity="0.25" clipPath="url(#graph-lower)" />
        <path d={linePath} fill="none" stroke="#f2e8d6" strokeWidth="1.5" />
        <text x={PAD} y={H - 8} fill="#a48d92" fontSize="11">
          0:00
        </text>
        <text x={W - PAD} y={H - 8} fill="#a48d92" fontSize="11" textAnchor="end">
          {fmtTime(maxT)}
        </text>
      </svg>
    </section>
  )
}

/** 「近期对局」点进去看的：比分/双方阵容/每人伤害经济KDA/每人出装海克斯（事实记录，不是流派推荐）。 */
function MatchDetail({
  core,
  match,
  onBack,
  onSavePlayerRoute,
}: {
  core: Core
  match: MatchSummary | null
  onBack: () => void
  onSavePlayerRoute: (route: CustomRoute) => void | Promise<void>
}) {
  const t = useT()
  const lang = useLang()
  const [detail, setDetail] = useState<MatchFullDetail | null | undefined>(undefined) // undefined=加载中，null=拿不到

  useEffect(() => {
    setDetail(undefined)
    if (!match) {
      setDetail(null)
      return
    }
    if (!isElectron()) {
      setDetail(createPreviewMatchDetail(core, match))
      return
    }
    window.mayhem!.getMatchDetail(match.gameId).then(setDetail)
  }, [core, match?.gameId])

  if (!match) {
    return (
      <>
        <button className="text-red text-sm cursor-pointer pb-3.5 hover:underline" onClick={onBack}>
          {t('match.back')}
        </button>
        <div className="p-16 text-center text-dim">{t('match.notFound')}</div>
      </>
    )
  }
  const champ = core.champions.find((c) => c.id === match.championId)
  const allyScore = detail ? detail.players.filter((p) => p.team === 'ally').reduce((s, p) => s + p.kills, 0) : null
  const enemyScore = detail ? detail.players.filter((p) => p.team === 'enemy').reduce((s, p) => s + p.kills, 0) : null
  const matchDate = new Date(match.gameCreationDate).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const durationText = detail
    ? `${Math.floor(detail.gameDurationSec / 60)}:${String(detail.gameDurationSec % 60).padStart(2, '0')}`
    : '--'
  const scoreValue = allyScore != null && enemyScore != null ? allyScore : 0
  const scoreSuffix = allyScore != null && enemyScore != null ? `:${enemyScore}` : ''
  const durationParts = durationText.split(':')

  return (
    <>
      <button
        className="mb-2 inline-flex items-center gap-1.5 rounded-[6px] border border-line/55 bg-panel/45 px-2.5 py-1.5 text-[11px] font-black text-dim transition hover:border-hex/35 hover:text-hex active:translate-y-px"
        onClick={onBack}
      >
        {t('match.back')}
      </button>
      {champ && (
        <header className="mb-3 grid grid-cols-[64px_minmax(0,1fr)_360px] items-center gap-3 rounded-[8px] border border-line/70 bg-panel/78 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.15)] max-[980px]:grid-cols-[64px_minmax(0,1fr)]">
          <img
            src={icon(champ.iconLocal)}
            alt={champ.name}
            className="h-16 w-16 rounded-[8px] border border-line/70 object-cover"
          />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-hex">{lang === 'en' ? 'Match detail' : '对局详情'}</div>
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[23px] font-black leading-tight text-cream">{champ.name}</h1>
              <span
                className={
                  'rounded border px-2 py-0.5 text-[10px] font-black ' +
                  (match.win ? 'border-[#63c07a]/35 bg-[#63c07a]/10 text-[#8fd69d]' : 'border-red/35 bg-red/10 text-red')
                }
              >
                {match.win ? t('match.win') : t('match.loss')}
              </span>
              {allyScore != null && enemyScore != null && (
                <span className="hidden text-sm font-bold text-dim">
                  {allyScore} : {enemyScore}
                </span>
              )}
            </div>
            <p className="text-[13px] text-dim mt-1">
              {match.kills} / {match.deaths} / {match.assists} · {t('match.impact', { pct: match.impactPercentile })}
              {' · '}
              {matchDate}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1.5 max-[980px]:col-span-2">
            <DashboardMiniStat label={lang === 'en' ? 'Score' : '比分'} value={scoreValue} suffix={scoreSuffix} />
            <DashboardMiniStat label="KDA" value={match.kills} suffix={`/${match.deaths}/${match.assists}`} />
            <DashboardMiniStat label={lang === 'en' ? 'Impact' : '表现'} value={match.impactPercentile} />
            <DashboardMiniStat label={lang === 'en' ? 'Time' : '时间'} value={Number(durationParts[0]) || 0} suffix={durationParts.length > 1 ? `:${durationParts[1]}` : ''} />
          </div>
        </header>
      )}

      {detail === undefined && <div className="p-11 text-center text-dim text-sm">{t('match.loadingDetail')}</div>}
      {detail === null && (
        <div className="p-11 text-center text-dim text-sm">
          {t('match.needElectron')}
        </div>
      )}
      {detail && <CompactMatchOverview detail={detail} core={core} onSavePlayerRoute={onSavePlayerRoute} />}
    </>
  )
}

function ArchetypeCard({
  arch,
  augById,
  itemById,
}: {
  arch: Archetype
  augById: Map<number, Augment>
  itemById: Map<number, Item>
}) {
  const t = useT()
  const starterItems = arch.starterItems?.map((ref) => itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  const finalItems = arch.items.map((ref) => itemById.get(ref.id)).filter((it): it is Item => !!it)
  return (
    <section className={CARD + ' mt-3 p-3'}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hex/35" />
      <div className="relative mb-1.5 flex flex-wrap items-center justify-between gap-2 pb-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-hex">Route sheet</div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-[18px] font-black text-cream">{arch.name}</span>
            <span
              className={
                'rounded px-2 py-0.5 text-[10px] font-black ' +
                (arch.damageType === 'AP' ? 'text-[#c9a3f0] bg-[#9664dc]/18' : 'text-[#f0a97a] bg-[#dc8246]/18')
              }
            >
              {arch.damageType}
            </span>
          </div>
        </div>
        <span
          className="rounded border border-line/55 bg-[#050a11]/45 px-2 py-1 text-[10px] font-bold text-dim"
        >
          {finalItems.length}/6 items
        </span>
      </div>
      {arch.note && <p className="relative max-w-5xl line-clamp-2 border-t border-line/45 pt-2 text-[11px] leading-4 text-dim">{arch.note}</p>}

      <div className="relative mt-2 divide-y divide-line/42 rounded-[6px] border border-line/45 bg-[#050a11]/22 px-2">
        <AugTier label={t('archetypeCard.core')} tone="core" refs={arch.augments.core} augById={augById} />
        <AugTier label={t('archetypeCard.good')} tone="good" refs={arch.augments.good} augById={augById} />
        <ItemSequence label={t('archetypeCard.starterItems')} tone="starter" items={starterItems} />
        <ItemSequence label={t('archetypeCard.finalItems')} tone="final" items={finalItems} slots={6} numbered />
      </div>

    </section>
  )
}

function ItemSequence({
  label,
  tone,
  items,
  slots = 0,
  numbered = false,
}: {
  label: string
  tone: 'starter' | 'final' | 'boots' | 'optional'
  items: Item[]
  slots?: number
  numbered?: boolean
}) {
  const visibleItems = stackItems(items)
  const emptySlots = Math.max(0, slots - visibleItems.length)
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 py-2 max-[760px]:grid-cols-1">
      <div
        className={
          (tone === 'starter' || tone === 'boots' ? 'text-gold' : tone === 'final' ? 'text-hex' : 'text-dim') +
          ' text-[10px] font-black uppercase tracking-[0.14em]'
        }
      >
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {visibleItems.map((it, idx) => (
          <div key={it.id + '-' + idx} className="flex h-[48px] items-center gap-1">
            <ItemHoverCard item={it}>
                <div className="relative flex h-[46px] w-[92px] items-center gap-1.5 rounded-[5px] border border-line/38 bg-[#050a11]/28 px-1.5 py-1 transition hover:border-hex/38 hover:bg-panel2/38">
                {numbered && (
                  <span className="absolute left-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded border border-line/45 bg-[#050a11]/78 px-0.5 text-[8px] font-black text-hex">
                    {idx + 1}
                  </span>
                )}
                <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-[5px] border border-line/70">
                  <img src={icon(it.iconLocal)} alt={it.name} className="h-full w-full object-cover" />
                  {it.count > 1 && (
                    <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-panel bg-hex px-1 text-[9px] font-extrabold leading-none text-[#041017]">
                      {it.count}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 min-w-0 text-[9px] font-bold leading-[11px] text-dim">
                  {it.name}
                </span>
              </div>
            </ItemHoverCard>
            {idx < visibleItems.length - 1 && <span className="grid h-[48px] place-items-center text-dim/55 text-[10px]">-&gt;</span>}
          </div>
        ))}
        {emptySlots > 0 && Array.from({ length: emptySlots }).map((_, idx) => (
          <div key={`empty-${idx}`} className="grid h-[46px] w-[92px] place-items-center rounded-[5px] border border-dashed border-line/35 bg-[#050a11]/20 text-[9px] font-bold text-dim/60">
            {numbered ? visibleItems.length + idx + 1 : '—'}
          </div>
        ))}
        {visibleItems.length === 0 && emptySlots === 0 && (
          <div className="rounded-[5px] border border-dashed border-line/35 bg-[#050a11]/20 px-3 py-2 text-[11px] text-dim">
            暂无
          </div>
        )}
      </div>
    </div>
  )
}

const TONE_LABEL: Record<string, string> = {
  core: 'text-gold',
  good: 'text-[#57c3e8]',
  trap: 'text-red',
}

function AugTier({
  label,
  tone,
  refs,
  augById,
}: {
  label: string
  tone: 'core' | 'good' | 'trap'
  refs: Ref[]
  augById: Map<number, Augment>
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 py-2 max-[760px]:grid-cols-1">
      <div className={'text-[10px] font-black uppercase tracking-[0.14em] ' + TONE_LABEL[tone]}>{label}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {refs.length > 0 ? refs.map((ref) => {
          const a = getAugment(augById, ref.id)
          if (!a) return null
          const r = RARITY[a.rarity] ?? RARITY[0]
          return (
            <AugmentHoverCard key={ref.id} augment={a}>
              <div className="flex min-h-[42px] min-w-[96px] max-w-[176px] items-center gap-1.5 rounded-[5px] border border-line/35 bg-[#050a11]/24 px-1.5 py-1 transition hover:border-hex/36 hover:bg-panel2/34">
                <div
                  className={
                    'h-8 w-8 shrink-0 overflow-hidden rounded-[5px] border-2 shadow-[0_8px_18px_rgba(0,0,0,0.18)] ' +
                    r.border +
                    (tone === 'core' ? ' ring-2 ring-gold' : '') +
                    (tone === 'trap' ? ' opacity-70' : '')
                  }
                >
                  <img src={icon(a.iconLargeLocal)} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <span className="min-w-0 break-words text-[9px] font-bold leading-[10px] text-cream">{a.name}</span>
              </div>
            </AugmentHoverCard>
          )
        }) : (
          <div className="rounded-[5px] border border-dashed border-line/35 bg-[#050a11]/20 px-3 py-2 text-[11px] text-dim">
            暂无
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 悬浮卡片的通用底座：用 createPortal 把卡片挂到 document.body 上，脱离触发元素所在的
 * 任何容器——之前直接用 CSS absolute+group-hover 挂在触发元素内部，只要祖先链上有一个
 * overflow-hidden(这个App到处都是圆角卡片，几乎全带overflow-hidden)，卡片就会被咔掉一截。
 * 位置用 getBoundingClientRect 实测算，不用CSS定位，天然不受任何祖先overflow影响。
 */
function HoverPortal({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  return (
    <div
      ref={triggerRef}
      className={className}
      onMouseEnter={() => {
        const r = triggerRef.current?.getBoundingClientRect()
        if (r) {
          const CARD_HALF_WIDTH = 130
          const left = Math.min(Math.max(r.left + r.width / 2, CARD_HALF_WIDTH + 8), window.innerWidth - CARD_HALF_WIDTH - 8)
          setPos({ top: r.top, left })
        }
        setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {createPortal(
        <div
          className={
            'pointer-events-none fixed z-[9999] w-64 -translate-x-1/2 -translate-y-full transition-opacity duration-150 ' +
            (hovered ? 'opacity-100' : 'opacity-0')
          }
          style={{ top: pos.top - 10, left: pos.left }}
        >
          {content}
        </div>,
        document.body,
      )}
    </div>
  )
}

/** 自绘海克斯悬浮卡片，取代原生 title 属性的系统默认小黄条提示框。 */
function AugmentHoverCard({ augment: a, children }: { augment: Augment; children: ReactNode }) {
  const t = useT()
  const r = RARITY[a.rarity] ?? RARITY[0]
  const displayText = augmentDisplayText(a)
  return (
    <HoverPortal
      content={
        <div className="relative rounded-[10px] border border-gold/35 bg-[#0a0f17]/98 p-3 shadow-[0_22px_54px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <img src={icon(a.iconSmallLocal)} alt="" className={'h-9 w-9 shrink-0 rounded-md border-2 object-cover ' + r.border} />
            <div className="min-w-0">
              <div className="break-words text-sm font-bold leading-tight text-cream">{a.name}</div>
              <div className={'text-[10px] font-bold uppercase tracking-wide ' + r.text}>
                {t(`rarity.${RARITY_KEY[a.rarity]}`, r.label)}
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-[12px] leading-relaxed text-dim">{displayText || t('common.none')}</div>
          <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1.5 rotate-45 border-b border-r border-gold/35 bg-[#0a0f17]" />
        </div>
      }
    >
      {children}
    </HoverPortal>
  )
}

/** 装备版悬浮卡片，跟海克斯那个是同一套底座，样式对称(图标+名字+完整描述)。 */
function ItemHoverCard({ item: it, children }: { item: Item; children: ReactNode }) {
  return (
    <HoverPortal
      content={
        <div className="relative rounded-[10px] border border-line/70 bg-[#0a0f17]/98 p-3 shadow-[0_22px_54px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <img src={icon(it.iconLocal)} alt="" className="h-9 w-9 shrink-0 rounded-md border-2 border-line/70 object-cover" />
            <div className="min-w-0 truncate text-sm font-bold text-cream">{it.name}</div>
          </div>
          <div className="mt-2.5 whitespace-pre-line text-[12px] leading-relaxed text-dim">{it.desc}</div>
          <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1.5 rotate-45 border-b border-r border-line/70 bg-[#0a0f17]" />
        </div>
      }
    >
      {children}
    </HoverPortal>
  )
}
