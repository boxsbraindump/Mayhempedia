import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  loadCore,
  loadBuild,
  withCustomRoutes,
  icon,
  getAugment,
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
  type DashboardSections,
  type MatchFullDetail,
  type PlayerMatchStats,
  type CustomRoute,
} from './lcu'
import { augmentTagLabel, scoreAugmentPick, type DecisionPick } from './augment-scoring'
import { LangProvider, useT, useLang, t, type Lang } from './i18n'

/* 复用样式片段（字面量常量，Tailwind 扫描可识别） */
const CARD =
  'glass-panel relative overflow-hidden rounded-[8px] border border-line/75 transition-colors hover:border-gold/30'
const SEARCH_INLINE =
  'bg-panel w-full px-4 py-3 border border-line/80 rounded-lg text-cream text-sm outline-none focus:border-gold/70 focus:shadow-[0_0_0_4px_rgba(208,173,104,0.08)] placeholder:text-dim/55 transition'
const TOOLBAR =
  'bg-panel sticky top-4 z-20 mb-5 rounded-[8px] border border-line/75 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.22)]'
const CHIP =
  'px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition border'

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const
const APP_BASE_WIDTH = 1280
const APP_BASE_HEIGHT = 720
const CUSTOM_ROUTES_ENABLED = false

const RARITY_KEY: Record<number, string> = { 0: 'silver', 1: 'gold', 2: 'prismatic', 4: 'special' }
const RARITY: Record<number, { label: string; text: string; border: string; bg: string }> = {
  0: { label: '白银', text: 'text-[#a7b0be]', border: 'border-[#a7b0be]', bg: 'bg-[#a7b0be]' },
  1: { label: '黄金', text: 'text-gold', border: 'border-gold', bg: 'bg-gold' },
  2: { label: '棱彩', text: 'text-hex', border: 'border-hex', bg: 'bg-hex' },
  4: { label: '特殊', text: 'text-[#b98cf0]', border: 'border-[#b98cf0]', bg: 'bg-[#b98cf0]' },
}
const RARITY_ORDER = [2, 1, 0, 4]

const ROLES: { key: string; label: string }[] = [
  { key: 'fighter', label: '战士' },
  { key: 'mage', label: '法师' },
  { key: 'tank', label: '坦克' },
  { key: 'assassin', label: '刺客' },
  { key: 'marksman', label: '射手' },
  { key: 'support', label: '辅助' },
]

type Tab = 'dash' | 'champ' | 'builder' | 'tier' | 'aug' | 'patch' | 'settings'
const NAV: { key: Tab; label: string }[] = [
  { key: 'dash', label: '副官状态' },
  { key: 'champ', label: '英雄图鉴' },
  { key: 'builder', label: '自定义路线' },
  { key: 'aug', label: '增强图鉴' },
  { key: 'patch', label: '战术更新' },
  { key: 'settings', label: '设置' },
].filter((item) => CUSTOM_ROUTES_ENABLED || item.key !== 'builder') as { key: Tab; label: string }[]

function NavIcon({ k }: { k: Tab }) {
  const p = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (k === 'dash')
    return (
      <svg {...p}>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    )
  if (k === 'champ')
    return (
      <svg {...p}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </svg>
    )
  if (k === 'tier')
    return (
      <svg {...p}>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
        <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11" />
        <path d="M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11" />
        <path d="M12 14v3" />
        <path d="M8.5 20h7l-.7-3h-5.6z" />
      </svg>
    )
  if (k === 'patch')
    return (
      <svg {...p}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    )
  if (k === 'settings')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z" />
      </svg>
    )
  return (
    <svg {...p}>
      <path d="M12 2.5l8.5 4.9v9.2L12 21.5 3.5 16.6V7.4z" />
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
    loadCore(settings?.language ?? 'zh').then(setCore).catch((e) => setErr(String(e)))
  }, [settings?.language])

  // 只在真正的 Electron 窗口里生效；浏览器预览下 window.mayhem 不存在，安全跳过。
  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.onLcuStatus(setLcuStatus)
    window.mayhem!.onChampSelect((s) => {
      if (s.myChampionId) setActiveChampionId(s.myChampionId)
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

  const detectedChamp =
    core && activeChampionId ? core.champions.find((c) => c.id === activeChampionId) : null
  const visibleCustomRoutes = CUSTOM_ROUTES_ENABLED ? customRoutes : []
  const detectedHasBuild = !!(
    detectedChamp &&
    (core?.buildIndex[detectedChamp.id] || visibleCustomRoutes.some((route) => route.championId === detectedChamp.id))
  )
  const appLang: Lang = settings?.language ?? 'zh'
  const appZoom = settings?.zoomFactor ?? 1

  useEffect(() => {
    if (!detectedChamp) return
    setMatchDetailId(null)
    setChampId(detectedChamp.id)
  }, [detectedChamp?.id])

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
    <LangProvider value={settings?.language ?? 'zh'}>
    <div className="fixed inset-0 overflow-hidden bg-ink">
    <div
      className="mayhem-scale-stage"
      style={{
        width: APP_BASE_WIDTH,
        height: APP_BASE_HEIGHT,
        transform: `scale(${appZoom})`,
      }}
    >
    <div data-lang={appLang} className="relative h-full w-full overflow-hidden rounded-none bg-ink text-cream shadow-[inset_0_0_38px_rgba(208,173,104,0.1)]">
      <WindowTitleBar />
      <div className="relative flex h-[calc(100%-36px)] min-h-0 min-w-0 overflow-hidden bg-ink">
      <div className="pointer-events-none absolute inset-0 opacity-95">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(208,173,104,0.13),transparent_28%),radial-gradient(circle_at_88%_2%,rgba(94,200,215,0.1),transparent_24%),linear-gradient(135deg,#080d14_0%,#0d1521_48%,#111b29_100%)]" />
        <div className="noise-field absolute inset-0 opacity-55 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        <div className="absolute inset-y-0 left-[250px] w-px bg-gradient-to-b from-transparent via-gold/20 to-transparent" />
      </div>
      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
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
            className="group w-full mb-5 flex items-center gap-3 px-4 py-3 rounded-[8px] bg-[#111a27]/88 border border-gold/35 text-left cursor-pointer hover:border-gold/70 hover:-translate-y-0.5 transition shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
          >
            <img
              src={icon(detectedChamp.iconLocal)}
              alt={detectedChamp.name}
              className="w-10 h-10 rounded-lg border border-gold/40 shadow-[0_0_24px_rgba(200,170,110,0.16)]"
            />
            <span className="text-sm">
              {t(appLang, 'app.detectedPrefix')} <b className="text-gold">{detectedChamp.name}</b>
              {detectedHasBuild ? t(appLang, 'app.hasBuild') : t(appLang, 'app.noBuild')}
            </span>
          </button>
        )}
        {err && <div className="p-16 text-center text-red">{t(appLang, 'app.loadFailed', { err })}</div>}
        {!err && !core && <div className="p-16 text-center text-dim">{t(appLang, 'app.loadingData')}</div>}
        {core && matchDetailId != null && (
          <MatchDetail
            core={core}
            match={matchHistory?.matches.find((m) => m.gameId === matchDetailId) ?? null}
            onBack={() => setMatchDetailId(null)}
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
            matchHistory={matchHistory}
            summoner={summoner}
            onOpenPatchNotes={() => setTab('patch')}
            onGoChamp={() => setTab('champ')}
            onGoTier={() => setTab('champ')}
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
        {CUSTOM_ROUTES_ENABLED && core && matchDetailId == null && champId == null && tab === 'builder' && (
          <CustomRouteBuilder
            core={core}
            routes={customRoutes}
            onChange={saveCustomRoutes}
            onActivate={setArchetypePreference}
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
          <SettingsTab summoner={summoner} />
        )}
      </main>
      </div>
    </div>
    </div>
    </div>
    </LangProvider>
  )
}

const LCU_BADGE: Record<LcuStatus['state'], { label: string; dot: string }> = {
  connecting: { label: '连接客户端中…', dot: 'bg-hex animate-pulse' },
  connected: { label: '已连接客户端', dot: 'bg-hex' },
  error: { label: '连接失败', dot: 'bg-red' },
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

function WindowTitleBar() {
  return (
    <header className="window-drag-region relative z-50 flex h-9 shrink-0 items-center justify-between border-b border-gold/20 bg-[linear-gradient(180deg,rgba(18,26,38,0.95),rgba(8,13,20,0.72))] px-3">
      <div className="flex items-center gap-2 text-[12px] font-extrabold tracking-tight text-cream">
        <img src="/assets/brand/mayhempedia-icon.svg" alt="" className="h-4 w-4 rounded-[4px]" />
        <span>Mayhem<span className="text-gold">pedia</span></span>
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
          ? 'hover:bg-[#e81123] hover:text-white'
          : 'hover:bg-white/18 hover:text-cream')
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
  return (
    <aside className="relative z-10 w-[250px] shrink-0 border-r border-line/70 bg-[#080d14]/82 px-4 py-5 sticky top-0 h-full flex flex-col shadow-[18px_0_44px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-7 px-2">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gold/35 bg-[#151d27] shadow-[inset_0_1px_0_rgba(242,234,216,0.08),0_12px_28px_rgba(0,0,0,0.24)]">
          <img src="/assets/brand/mayhempedia-icon.svg" alt="" className="h-8 w-8 rounded-md" />
        </div>
        <div className="mt-4 text-[22px] font-extrabold tracking-tight">
          Mayhem<span className="text-gold">pedia</span>
        </div>
        <div className="mt-1 text-[11px] text-dim tracking-[0.12em] uppercase">ARAM route desk</div>
      </div>
      <nav className="flex flex-col gap-1.5">
        {NAV.map((n) => {
          const on = tab === n.key
          return (
            <button
              key={n.key}
              onClick={() => onTab(n.key)}
              className={
                'flex items-center gap-2.5 px-3.5 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition border ' +
                (on
                  ? 'border-transparent bg-white/10 text-cream shadow-[0_10px_24px_rgba(0,0,0,0.16)]'
                  : 'border-transparent text-dim hover:bg-white/10 hover:text-cream hover:translate-x-0.5')
              }
            >
              <span className="w-[18px] inline-flex items-center justify-center">
                <NavIcon k={n.key} />
              </span>
              {t(`nav.${n.key}`, n.label)}
            </button>
          )
        })}
      </nav>
      <div className="glass-control mt-auto rounded-[8px] border border-line/70 px-3.5 py-3.5 text-xs text-dim">
        <div className="flex items-center gap-2">
          <span className={'w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_14px_currentColor] ' + lcuBadge.dot} />
          <span className="font-semibold">{t(`lcu.${lcuStatus?.state ?? 'connecting'}`, lcuBadge.label)}</span>
        </div>
        <div className="mt-2 text-[11px] text-dim/70">Overlay: Ctrl+Shift+X</div>
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
  sections: DashboardSections | null
  lcuStatus: LcuStatus | null
  detectedChamp: Champion | null
  detectedHasBuild: boolean
  selectedArchetypeByChampionId: Record<string, string>
  customRoutes: CustomRoute[]
}) {
  const champById = useMemo(() => new Map(core.champions.map((c) => [c.id, c])), [core])
  // 还没读到设置(浏览器预览/尚未连上)时全部显示，不能因为空指针就把主页显示成空的
  const show = (key: keyof DashboardSections) => sections?.[key] ?? true
  return (
    <>
      <DashboardHero
        core={core}
        lcuStatus={lcuStatus}
        detectedChamp={detectedChamp}
        detectedHasBuild={detectedHasBuild}
        matchHistory={matchHistory}
        onPick={onPick}
        onGoChamp={onGoChamp}
        onGoTier={onGoTier}
        onOpenPatchNotes={onOpenPatchNotes}
        selectedArchetypeByChampionId={selectedArchetypeByChampionId}
        customRoutes={customRoutes}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5 items-start max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-4 min-w-0">
          {show('recentMatches') && (
            <RecentMatches matches={matchHistory?.matches ?? null} champById={champById} onPick={onPickMatch} />
          )}
          {show('versionChanges') && (
            <VersionChanges core={core} champById={champById} onPick={onPick} onOpenPatchNotes={onOpenPatchNotes} />
          )}
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          {show('identityCard') && <IdentityCard arp={matchHistory?.arp ?? null} summoner={summoner} />}
          {show('achievements') && <Achievements achievements={matchHistory?.achievements ?? null} />}
          {!matchHistory && <DashboardOnboarding onGoChamp={onGoChamp} onGoTier={onGoTier} />}
        </div>
      </div>
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
        (active ? 'brightness-[0.38] saturate-75 contrast-150' : 'opacity-85 drop-shadow-[0_0_8px_rgba(201,169,92,0.25)] group-hover:opacity-100')
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold/80 via-gold/25 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 bg-[radial-gradient(circle_at_top_right,rgba(94,200,215,0.12),transparent_62%)]" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_340px] gap-6 items-start max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-md border border-gold/35 bg-gold/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
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
              className="rounded-lg bg-gold px-5 py-2.5 text-sm font-extrabold text-[#161006] shadow-[0_12px_28px_rgba(208,173,104,0.2)] transition hover:-translate-y-0.5 hover:bg-[#dec07a] cursor-pointer"
            >
              {primaryLabel}
            </button>
            <button
              onClick={onGoTier}
              className="rounded-lg border border-hex/35 bg-hex/8 px-5 py-2.5 text-sm font-bold text-hex transition hover:-translate-y-0.5 hover:border-hex/70 hover:bg-hex/12 cursor-pointer"
            >
              {t('dash.hero.viewTier')}
            </button>
            <button
              onClick={onOpenPatchNotes}
              className="rounded-lg border border-line/80 bg-panel2/55 px-5 py-2.5 text-sm font-bold text-dim transition hover:-translate-y-0.5 hover:text-cream hover:border-gold/45 cursor-pointer"
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
        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
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
  const [build, setBuild] = useState<Build | null | undefined>(undefined)

  useEffect(() => {
    const file = core.buildIndex[champion.id]
    if (!file) {
      setBuild(withCustomRoutes(null, champion.id, customRoutes, core))
      return
    }
    setBuild(undefined)
    loadBuild(file)
      .then((loaded) => setBuild(withCustomRoutes(loaded, champion.id, customRoutes, core)))
      .catch(() => setBuild(withCustomRoutes(null, champion.id, customRoutes, core)))
  }, [core, champion.id, customRoutes])

  const route = build?.archetypes.find((a) => a.key === selectedArchetypeKey) ?? build?.archetypes[0]
  const previewItems = route?.items
    .map((ref) => core.itemById.get(ref.id))
    .filter((item): item is Item => !!item)
    .slice(0, 3) ?? []
  return (
    <div className="glass-control mt-4 rounded-[8px] border border-gold/30 p-3">
      <div className="flex items-center gap-3">
        <img
          src={icon(champion.iconLocal)}
          alt={champion.name}
          className="h-12 w-12 rounded-lg border border-gold/45 object-cover shadow-[0_0_22px_rgba(200,170,110,0.12)]"
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hex/35 to-transparent" />
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
          className="text-xs px-3 py-1.5 rounded-lg bg-panel2/80 hover:bg-gold/15 hover:text-gold transition cursor-pointer"
        >
          {t('dash.onboarding.goChamp')}
        </button>
        <button
          onClick={onGoTier}
          className="text-xs px-3 py-1.5 rounded-lg bg-panel2/80 hover:bg-gold/15 hover:text-gold transition cursor-pointer"
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
            className="h-full rounded-full bg-gradient-to-r from-gold to-[#f5dea0] shadow-[0_0_18px_rgba(200,170,110,0.42)]"
            style={{ width: `${arp.score}%` }}
          />
        </div>
        <div className="mt-3 text-[13px] italic text-[#d7bfa0]">{t('dash.identity.quote', { score: arp.score })}</div>
        <button className="mt-3.5 px-4 py-2 bg-gold text-[#1d1709] rounded-lg font-extrabold text-[13px] cursor-pointer hover:bg-[#dec07a] transition">
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
          <button onClick={onOpenPatchNotes} className="text-xs text-red hover:underline cursor-pointer shrink-0">
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
      {!matches && <div className="text-xs text-dim py-2">{t('dash.emptyNeedElectron')}</div>}
      {matches && matches.length === 0 && <div className="text-xs text-dim py-2">{t('dash.recentMatches.empty')}</div>}
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
      {!achievements && <div className="text-xs text-dim py-2">{t('dash.emptyNeedElectron')}</div>}
      {achievements && achievements.length === 0 && (
        <div className="text-xs text-dim py-2">{t('dash.achievements.empty')}</div>
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
            <button className="px-3 py-1.5 bg-gold text-[#2b1e07] rounded-lg font-bold text-xs cursor-pointer hover:bg-[#dec07a] transition">
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

type PickerEntry = {
  id: number
  name: string
  desc: string
  iconLocal: string
}

function AssetPicker({
  label,
  hint,
  entries,
  selectedIds,
  max,
  allowDuplicates = false,
  onChange,
}: {
  label: string
  hint: string
  entries: PickerEntry[]
  selectedIds: number[]
  max: number
  allowDuplicates?: boolean
  onChange: (ids: number[]) => void
}) {
  const [query, setQuery] = useState('')
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])
  const selected = selectedIds.flatMap((id, index) => {
    const entry = byId.get(id)
    return entry ? [{ entry, index }] : []
  })
  const normalized = query.trim().toLocaleLowerCase()
  const results = normalized
    ? entries
        .filter((entry) => entry.name.toLocaleLowerCase().includes(normalized))
        .filter((entry) => allowDuplicates || !selectedIds.includes(entry.id))
        .slice(0, 24)
    : []
  const full = selectedIds.length >= max

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-cream">{label}</div>
          <div className="mt-0.5 text-[11px] text-dim">{hint}</div>
        </div>
        <span className={'text-xs font-extrabold ' + (full ? 'text-gold' : 'text-dim')}>
          {selectedIds.length}/{max}
        </span>
      </div>
      <div className="min-h-[72px] rounded-[8px] border border-line/70 bg-[#09121f]/65 p-2.5">
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selected.map(({ entry, index }) => (
              <button
                key={`${entry.id}-${index}`}
                type="button"
                title={`移除 ${entry.name}`}
                onClick={() => onChange(selectedIds.filter((_, itemIndex) => itemIndex !== index))}
                className="group flex w-[92px] flex-col items-center gap-1.5 rounded-lg border border-line/70 bg-panel/75 p-2 text-center transition hover:border-red/60 hover:bg-red/8"
              >
                <img src={icon(entry.iconLocal)} alt="" className="h-9 w-9 rounded-lg border border-line object-cover" />
                <span className="line-clamp-2 min-h-[28px] text-[11px] font-bold leading-[14px] text-cream group-hover:text-red">
                  {entry.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[50px] place-items-center text-xs text-dim">搜索并添加内容</div>
        )}
      </div>
      <div className="relative mt-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={full}
          placeholder={full ? '已达到数量上限' : `搜索${label}`}
          className={SEARCH_INLINE + ' py-2.5 disabled:cursor-not-allowed disabled:opacity-50'}
        />
        {query && !full && (
          <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-[8px] border border-gold/30 bg-[#0b1421]/98 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.48)] backdrop-blur-xl">
            {results.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {results.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onChange([...selectedIds, entry.id])
                      setQuery('')
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-transparent p-2 text-left transition hover:border-gold/35 hover:bg-white/5"
                  >
                    <img src={icon(entry.iconLocal)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                    <span className="truncate text-xs font-bold text-cream">{entry.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-dim">没有找到匹配内容</div>
            )}
          </div>
        )}
      </div>
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

function CustomRouteBuilder({
  core,
  routes,
  onChange,
  onActivate,
  onOpenChampion,
}: {
  core: Core
  routes: CustomRoute[]
  onChange: (routes: CustomRoute[]) => void | Promise<void>
  onActivate: (championId: number, archetypeKey: string) => void | Promise<void>
  onOpenChampion: (championId: number) => void
}) {
  const firstChampionId = core.champions[0]?.id ?? 0
  const [editingId, setEditingId] = useState<string | null>(routes[0]?.id ?? null)
  const [draft, setDraft] = useState<CustomRoute>(() => routes[0] ?? createEmptyCustomRoute(firstChampionId))
  const [message, setMessage] = useState('')
  const champions = useMemo(() => [...core.champions].sort((a, b) => a.name.localeCompare(b.name)), [core.champions])
  const items: PickerEntry[] = useMemo(
    () =>
      [...core.itemById.values()]
        .filter((item) => item.priceTotal > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({ id: item.id, name: item.name, desc: item.desc, iconLocal: item.iconLocal })),
    [core.itemById],
  )
  const augments: PickerEntry[] = useMemo(
    () =>
      [...core.augments]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((augment) => ({
          id: augment.id,
          name: augment.name,
          desc: augment.desc,
          iconLocal: augment.iconLargeLocal,
        })),
    [core.augments],
  )
  const champion = core.champions.find((entry) => entry.id === draft.championId)
  const starterItems = draft.starterItemIds.flatMap((id) => {
    const item = core.itemById.get(id)
    return item ? [item] : []
  })
  const finalItems = draft.itemIds.flatMap((id) => {
    const item = core.itemById.get(id)
    return item ? [item] : []
  })

  const edit = (route: CustomRoute) => {
    setEditingId(route.id)
    setDraft({ ...route })
    setMessage('')
  }
  const startNew = () => {
    setEditingId(null)
    setDraft(createEmptyCustomRoute(firstChampionId))
    setMessage('')
  }
  const patch = <K extends keyof CustomRoute>(key: K, value: CustomRoute[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!draft.championId || !draft.title.trim()) {
      setMessage('请选择英雄并填写路线标题。')
      return
    }
    if (draft.starterItemIds.length === 0 || draft.itemIds.length !== 6) {
      setMessage('请至少添加一件出门装，并补齐六神装。')
      return
    }
    if (draft.coreAugmentIds.length === 0) {
      setMessage('请至少添加一个核心海克斯。')
      return
    }
    const id = draft.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`)
    const saved: CustomRoute = {
      ...draft,
      id,
      title: draft.title.trim(),
      description: draft.description.trim(),
      updatedAt: new Date().toISOString(),
    }
    const next = editingId ? routes.map((route) => (route.id === editingId ? saved : route)) : [...routes, saved]
    await onChange(next)
    await onActivate(saved.championId, customRouteKey(saved.id))
    setEditingId(saved.id)
    setDraft(saved)
    setMessage('已保存，并设为该英雄当前路线。')
  }

  const remove = async () => {
    if (!editingId || !window.confirm('删除这条自定义路线？此操作无法撤销。')) return
    await onChange(routes.filter((route) => route.id !== editingId))
    startNew()
  }

  return (
    <>
      <ViewHead title="自定义路线" meta={`${routes.length} 条本地路线`} />
      <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <aside className="glass-control sticky top-4 rounded-[8px] border border-line/75 p-3">
          <button
            type="button"
            onClick={startNew}
            className="w-full rounded-lg bg-gold px-3 py-2.5 text-sm font-extrabold text-[#171006] transition hover:bg-[#dec07a] active:translate-y-px"
          >
            新建路线
          </button>
          <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">我的路线</div>
          <div className="mt-2 flex max-h-[520px] flex-col gap-1.5 overflow-y-auto">
            {routes.length > 0 ? (
              routes.map((route) => {
                const routeChampion = core.champions.find((entry) => entry.id === route.championId)
                return (
                  <button
                    type="button"
                    key={route.id}
                    onClick={() => edit(route)}
                    className={
                      'flex items-center gap-2 rounded-lg border p-2 text-left transition ' +
                      (editingId === route.id
                        ? 'border-gold/55 bg-gold/10'
                        : 'border-transparent hover:border-line hover:bg-white/5')
                    }
                  >
                    {routeChampion && (
                      <img src={icon(routeChampion.iconLocal)} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-extrabold text-cream">{route.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-dim">{routeChampion?.name}</span>
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs leading-5 text-dim">
                还没有自定义路线
              </div>
            )}
          </div>
        </aside>

        <div className="space-y-4">
          <section className="glass-panel relative overflow-visible rounded-[8px] border border-gold/30 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold">Route editor</div>
                <h2 className="mt-1 text-xl font-extrabold text-cream">{editingId ? '编辑路线' : '创建新路线'}</h2>
                <p className="mt-1 text-xs text-dim">内容只保存在本机，并会同步到你的游戏内 Overlay。</p>
              </div>
              {editingId && (
                <button type="button" onClick={remove} className="rounded-lg border border-red/40 px-3 py-2 text-xs font-bold text-red hover:bg-red/10">
                  删除
                </button>
              )}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-bold text-dim">英雄</span>
                <select
                  value={draft.championId}
                  onChange={(event) => patch('championId', Number(event.target.value))}
                  className={SEARCH_INLINE + ' appearance-none'}
                >
                  {champions.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-dim">伤害类型</span>
                <select
                  value={draft.damageType}
                  onChange={(event) => patch('damageType', event.target.value)}
                  className={SEARCH_INLINE + ' appearance-none'}
                >
                  {['AP', 'AD', 'Tank', 'Support', 'Hybrid'].map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 flex justify-between text-xs font-bold text-dim">
                <span>路线标题</span><span>{draft.title.length}/32</span>
              </span>
              <input
                value={draft.title}
                maxLength={32}
                onChange={(event) => patch('title', event.target.value)}
                placeholder="例如：持续灼烧控制流"
                className={SEARCH_INLINE}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 flex justify-between text-xs font-bold text-dim">
                <span>玩法介绍</span><span>{draft.description.length}/240</span>
              </span>
              <textarea
                value={draft.description}
                maxLength={240}
                rows={3}
                onChange={(event) => patch('description', event.target.value)}
                placeholder="写下核心思路、适用场景和需要避开的陷阱。"
                className={SEARCH_INLINE + ' resize-none leading-6'}
              />
            </label>
          </section>

          <section className="glass-panel relative overflow-visible rounded-[8px] border border-line/75 p-5 focus-within:z-40">
            <div className="grid grid-cols-2 gap-5 max-[920px]:grid-cols-1">
              <AssetPicker
                label="出门装"
                hint="按实际购买顺序添加，允许重复药水"
                entries={items}
                selectedIds={draft.starterItemIds}
                max={6}
                allowDuplicates
                onChange={(ids) => patch('starterItemIds', ids)}
              />
              <AssetPicker
                label="六神装"
                hint="第一件成装放在最前，必须正好六件"
                entries={items}
                selectedIds={draft.itemIds}
                max={6}
                onChange={(ids) => patch('itemIds', ids)}
              />
            </div>
          </section>

          <section className="glass-panel relative overflow-visible rounded-[8px] border border-line/75 p-5 focus-within:z-40">
            <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-1">
              <AssetPicker label="核心海克斯" hint="拿到时优先选择" entries={augments} selectedIds={draft.coreAugmentIds} max={6} onChange={(ids) => patch('coreAugmentIds', ids)} />
              <AssetPicker label="备选海克斯" hint="稳定、泛用的选择" entries={augments} selectedIds={draft.goodAugmentIds} max={6} onChange={(ids) => patch('goodAugmentIds', ids)} />
              <AssetPicker label="避开海克斯" hint="容易误导这套路线" entries={augments} selectedIds={draft.trapAugmentIds} max={4} onChange={(ids) => patch('trapAugmentIds', ids)} />
            </div>
          </section>

          <section className="rounded-[8px] border border-hex/30 bg-[#0a1524]/85 p-5">
            <div className="flex items-start gap-4">
              {champion && <img src={icon(champion.iconLocal)} alt="" className="h-16 w-16 rounded-[8px] border border-gold/45 object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-hex">Overlay preview</div>
                <div className="mt-1 flex items-center gap-2">
                  <h3 className="truncate text-lg font-extrabold text-cream">{draft.title || '未命名路线'}</h3>
                  <span className="rounded-md bg-white/8 px-2 py-0.5 text-[10px] font-bold text-dim">{draft.damageType}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-dim">{draft.description || '路线介绍会显示在这里。'}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold">出门装</div>
                <MiniItemLine items={starterItems} />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-hex">六神装</div>
                <MiniItemLine items={finalItems} />
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 rounded-[8px] border border-gold/30 bg-[#0a111b]/95 p-3 shadow-[0_-12px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className={'text-xs ' + (message.startsWith('已保存') ? 'text-[#63c07a]' : 'text-dim')}>
              {message || '保存后会自动设为该英雄当前使用的路线。'}
            </div>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={() => onOpenChampion(draft.championId)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-dim hover:border-hex/45 hover:text-cream">
                  查看英雄页
                </button>
              )}
              <button type="button" onClick={save} className="rounded-lg bg-gold px-5 py-2.5 text-sm font-extrabold text-[#171006] hover:bg-[#dec07a] active:translate-y-px">
                保存并启用
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SettingsSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={CARD + ' p-5 ' + className}>
      <h3 className="text-sm font-bold text-cream mb-4">{title}</h3>
      {children}
    </section>
  )
}

function SettingsNavItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className={
        'rounded-lg border px-3 py-2 text-xs font-bold ' +
        (active ? 'border-gold/45 bg-gold/12 text-gold' : 'border-transparent text-dim')
      }
    >
      {label}
    </div>
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

function SettingsTab({ summoner }: { summoner: SummonerInfo | null }) {
  const t = useT()
  const lang = useLang()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<PersistedAccountSummary[] | null>(null)

  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.getSettings().then(setSettings)
    window.mayhem!.getStoredAccounts().then(setAccounts)
    window.mayhem!.onSettingsChanged(setSettings)
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

  if (!isElectron()) {
    return (
      <>
        <ViewHead title={t('settings.title', '设置')} />
        <div className="p-11 text-center text-dim text-sm">{t('settings.electronOnly')}</div>
      </>
    )
  }
  if (!settings) {
    return (
      <>
        <ViewHead title={t('settings.title', '设置')} />
        <div className="p-11 text-center text-dim text-sm">{t('settings.loading')}</div>
      </>
    )
  }

  return (
    <>
      <ViewHead title={t('settings.title', '设置')} />

      <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5 items-start max-[980px]:grid-cols-1">
        <aside className="glass-panel sticky top-6 rounded-[8px] border border-line/75 p-4 max-[980px]:static">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">Control stack</div>
          <div className="mt-3 flex flex-col gap-1">
            <SettingsNavItem label={t('settings.startup.title', '启动与窗口')} active />
            <SettingsNavItem label={t('settings.overlay.title', 'Overlay 行为')} />
            <SettingsNavItem label={t('settings.dashboard.title', '主页内容显示')} />
            <SettingsNavItem label={t('settings.account.title', '账号')} />
            <SettingsNavItem label={t('settings.privacy.title', '数据与隐私')} />
          </div>
          <div className="mt-5 rounded-lg border border-line/65 bg-panel2/38 p-3">
            <div className="text-[11px] font-bold text-dim">{t('settings.account.title', '账号')}</div>
            <div className="mt-1 truncate text-sm font-extrabold text-cream">
              {summoner ? `${summoner.gameName}#${summoner.tagLine}` : t('settings.account.none')}
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-dim">{t('settings.account.desc')}</div>
          </div>
        </aside>

        <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
      <SettingsSection title={t('settings.startup.title', '启动与窗口')}>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm">{t('settings.startup.autoLaunch')}</div>
            <div className="text-xs text-dim mt-0.5">{t('settings.startup.autoLaunchDesc')}</div>
          </div>
          <Toggle on={settings.autoLaunch} onClick={() => update('autoLaunch', !settings.autoLaunch)} />
        </div>
        <div className="py-2">
          <div className="flex items-center justify-between">
            <div className="text-sm">{t('settings.startup.zoom')}</div>
            <span className="text-xs text-dim">{Math.round(settings.zoomFactor * 100)}%</span>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5 rounded-lg border border-line/60 bg-ink/30 p-1.5">
            {ZOOM_PRESETS.map((zoom) => (
              <button
                key={zoom}
                onClick={() => update('zoomFactor', zoom)}
                className={
                  'rounded-lg px-2 py-1.5 text-xs font-extrabold transition cursor-pointer ' +
                  (settings.zoomFactor === zoom
                    ? 'bg-gold text-[#1d1709]'
                    : 'bg-panel2/45 text-dim hover:bg-panel2/80 hover:text-cream')
                }
              >
                {Math.round(zoom * 100)}%
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.overlay.title', 'Overlay 行为')}>
        <div className="py-2">
          <div className="text-sm mb-2">{t('settings.overlay.position')}</div>
          <div className="flex gap-2">
            {(Object.keys(POSITION_LABEL) as OverlaySettings['position'][]).map((pos) => (
              <button
                key={pos}
                onClick={() => update('overlay', { ...settings.overlay, position: pos })}
                className={
                  'px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ' +
                  (settings.overlay.position === pos
                    ? 'bg-gold text-[#2b1e07] font-bold'
                    : 'bg-panel2 text-dim hover:text-cream')
                }
              >
                {t(`settings.overlay.pos.${POSITION_KEY[pos]}`, POSITION_LABEL[pos])}
              </button>
            ))}
          </div>
        </div>
        <div className="py-2">
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
            className="w-full mt-2 accent-gold"
          />
        </div>
        <div className="py-2">
          <div className="text-sm">{t('settings.overlay.hotkey')}</div>
          <div className="text-xs text-dim mt-1">
            {settings.overlay.hotkey.ctrl && 'Ctrl+'}
            {settings.overlay.hotkey.shift && 'Shift+'}
            {settings.overlay.hotkey.alt && 'Alt+'}
            {settings.overlay.hotkey.key}
            <span className="ml-2 opacity-70">{t('settings.overlay.hotkeyNote')}</span>
          </div>
        </div>
        <div className="py-2">
          <div className="text-sm">{t('settings.overlay.moveHotkey')}</div>
          <div className="text-xs text-dim mt-1">
            {settings.overlay.moveHotkey.ctrl && 'Ctrl+'}
            {settings.overlay.moveHotkey.shift && 'Shift+'}
            {settings.overlay.moveHotkey.alt && 'Alt+'}
            {settings.overlay.moveHotkey.key}
            <span className="ml-2 opacity-70">{t('settings.overlay.moveHotkeyNote')}</span>
          </div>
        </div>
        {settings.overlay.customPos && (
          <div className="py-2 flex items-center justify-between">
            <div className="text-xs text-dim">
              {t('settings.overlay.customPos')} ({settings.overlay.customPos.x}, {settings.overlay.customPos.y})
            </div>
            <button
              onClick={() => update('overlay', { ...settings.overlay, customPos: null })}
              className="px-2.5 py-1 rounded-lg text-xs cursor-pointer bg-panel2 text-dim hover:text-cream transition"
            >
              {t('settings.overlay.resetPos')}
            </button>
          </div>
        )}
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

      <SettingsSection title={t('settings.account.title', '账号')} className="col-span-2 max-[1180px]:col-span-1">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <div className="text-sm">{summoner ? `${summoner.gameName}#${summoner.tagLine}` : t('settings.account.none')}</div>
            <div className="text-xs text-dim mt-1">{t('settings.account.desc')}</div>
          </div>
          <button
            onClick={() => window.mayhem!.getStoredAccounts().then(setAccounts)}
            className="px-2.5 py-1 rounded-lg text-xs cursor-pointer bg-panel2 text-dim hover:text-cream transition shrink-0"
          >
            {t('settings.account.refresh')}
          </button>
        </div>
        <div className="pt-3">
          {!accounts && <div className="text-xs text-dim py-2">{t('settings.account.loading')}</div>}
          {accounts && accounts.length === 0 && (
            <div className="text-xs text-dim py-2">{t('settings.account.empty')}</div>
          )}
          {accounts && accounts.length > 0 && (
            <div className="flex flex-col">
              {accounts.map((account) => (
                <div key={account.puuid} className="flex items-center justify-between gap-3 py-2 border-b border-line/60 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{accountName(account, lang)}</span>
                      {account.isCurrent && (
                        <span className="text-[10px] px-1.5 py-px rounded bg-gold/15 text-gold shrink-0">{t('settings.account.current')}</span>
                      )}
                    </div>
                    <div className="text-xs text-dim mt-0.5">
                      {t('settings.account.matches', '{n} 场').replace('{n}', String(account.matchCount))} ·{' '}
                      {t('settings.account.detailsCached', '{n} 场详情缓存').replace('{n}', String(account.detailCount))} ·{' '}
                      {t('settings.account.lastMatch', '最近对局')} {fmtAccountDate(account.latestGameCreationDate, lang)}
                    </div>
                  </div>
                  <button
                    onClick={() => forgetAccount(account.puuid)}
                    className="text-xs text-dim hover:text-red transition cursor-pointer shrink-0"
                  >
                    {t('settings.account.forget')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.notification.title', '通知')}>
        <div className="flex gap-2">
          {(['inpage', 'system'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update('notificationMode', mode)}
              className={
                'px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ' +
                (settings.notificationMode === mode
                  ? 'bg-gold text-[#2b1e07] font-bold'
                  : 'bg-panel2 text-dim hover:text-cream')
              }
            >
              {mode === 'inpage' ? t('settings.notification.inpage') : t('settings.notification.system')}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.language.title', '语言')}>
        <div className="flex gap-2">
          {(['zh', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => update('language', lang)}
              className={
                'px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ' +
                (settings.language === lang
                  ? 'bg-gold text-[#2b1e07] font-bold'
                  : 'bg-panel2 text-dim hover:text-cream')
              }
            >
              {t(`settings.language.${lang}`, lang === 'zh' ? '中文' : 'English')}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-dim">{t('settings.language.note')}</div>
      </SettingsSection>

      <SettingsSection title={t('settings.privacy.title', '数据与隐私')}>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm">{t('settings.privacy.persist')}</div>
            <div className="text-xs text-dim mt-0.5 max-w-md">
              {t('settings.privacy.persistDesc')}
            </div>
          </div>
          <Toggle
            on={settings.persistMatchHistory}
            onClick={() => update('persistMatchHistory', !settings.persistMatchHistory)}
          />
        </div>
      </SettingsSection>
        </div>
      </div>
    </>
  )
}

/* ---------------- 视图标题 / 英雄网格 / 海克斯 / Tier ---------------- */
function ViewHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <h2 className="text-[22px] font-bold">{title}</h2>
      {meta && <span className="text-[13px] text-dim">{meta}</span>}
    </div>
  )
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
          (c) =>
            c.name.includes(q.trim()) ||
            c.pinyin.includes(s) ||
            c.initials.includes(s) ||
            c.alias.toLowerCase().includes(s),
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
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-hex/80 via-hex/25 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 bg-[radial-gradient(circle_at_top_right,rgba(208,173,104,0.12),transparent_62%)]" />
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
                    ? 'border-gold/45 bg-gold/10 shadow-[0_0_34px_rgba(200,170,110,0.1)]'
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
              <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-hex/0 blur-2xl transition group-hover:bg-hex/10" />
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
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const s = q.trim()
    const filtered = s ? core.augments.filter((a) => a.name.includes(s) || a.desc.includes(s)) : core.augments
    return RARITY_ORDER.map((r) => ({ rarity: r, meta: RARITY[r], items: filtered.filter((a) => a.rarity === r) })).filter(
      (g) => g.items.length > 0,
    )
  }, [q, core])

  return (
    <>
      <ViewHead title={t('nav.aug')} meta={t('augBrowser.meta', { count: core.augments.length })} />
      <section className={TOOLBAR}>
        <div className="flex items-center gap-3 max-[760px]:flex-col max-[760px]:items-stretch">
          <input
            className={SEARCH_INLINE}
            placeholder={t('augBrowser.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="shrink-0 rounded-lg border border-line/65 bg-panel2/45 px-3 py-2 text-xs text-dim">
            <span className="font-extrabold text-cream">{groups.reduce((sum, g) => sum + g.items.length, 0)}</span> /{' '}
            {core.augments.length}
          </div>
        </div>
      </section>
      {groups.map((g) => (
        <div key={g.rarity} className="mb-6">
          <div className="sticky top-[94px] z-10 mb-3 flex items-center gap-2 rounded-lg border border-line/60 bg-ink/82 px-3 py-2 text-sm font-semibold backdrop-blur-xl">
            <span className={'w-2.5 h-2.5 rounded-full ' + g.meta.bg} />
            <span className={g.meta.text}>{t(`rarity.${RARITY_KEY[g.rarity]}`, g.meta.label)}</span>
            <span className="text-xs text-dim font-normal">{g.items.length}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2.5">
            {g.items.map((a) => (
              <AugmentHoverCard key={a.id} augment={a}>
                <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-panel border border-line transition hover:-translate-y-0.5">
                  <div className={'w-14 h-14 rounded-md overflow-hidden border-2 ' + g.meta.border}>
                    <img src={icon(a.iconLargeLocal)} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs text-center leading-tight">{a.name}</span>
                </div>
              </AugmentHoverCard>
            ))}
          </div>
        </div>
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
      <ViewHead title={t('nav.patch')} meta={t('patch.meta', { patch: pn.patch, date: pn.releaseDate })} />

      <section className={CARD + ' p-5 mb-5'}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-dim mb-1">{t('patch.theme')}</div>
            <div className="text-lg font-bold text-cream">{pn.theme}</div>
            <div className="mt-2 text-xs text-dim">{pn.patch} / {pn.releaseDate}</div>
          </div>
          <PatchMark />
        </div>
        <a
          href={pn.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-red hover:underline mt-1 inline-block"
        >
          {t('patch.sourceLink')}
        </a>
      </section>

      {/* 海克斯大乱斗专属改动放最前面——这是这个 App 的核心受众最关心的部分 */}
      <section className={CARD + ' p-5 mb-5 border-gold/30'}>
        <div className="flex items-center gap-2 mb-3">
          <PatchMark />
          <h3 className="text-base font-bold text-gold">{t('patch.mayhemTitle')}</h3>
        </div>
        <p className="text-[13px] text-dim leading-relaxed mb-4">
          {lang === 'en' && pn.mayhem.summaryEn ? pn.mayhem.summaryEn : pn.mayhem.summaryZh}
        </p>
        {pn.mayhem.augmentChanges.length > 0 && (
          <>
            <div className="text-[13px] font-semibold text-cream mb-2">{t('patch.augmentChanges')}</div>
            <div className="flex flex-col rounded-lg border border-line/60 bg-ink/24 mb-4">
              {pn.mayhem.augmentChanges.map((a, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[44px_180px_minmax(0,1fr)] items-center gap-3 px-3 py-3 max-[760px]:grid-cols-[44px_minmax(0,1fr)]"
                >
                  <AugmentGlyph icon={a.icon} />
                  <div className="truncate text-sm font-semibold text-cream">{a.name}</div>
                  <div className="min-w-0 text-[12px] text-dim leading-snug max-[760px]:col-span-2">
                    {lang === 'en' && a.changeEn ? a.changeEn : a.change}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {pn.mayhem.bugfixes.length > 0 && (
          <>
            <div className="text-[13px] font-semibold text-cream mb-2">{t('patch.bugfixes')}</div>
            <ul className="list-disc list-inside text-[13px] text-dim space-y-1">
              {(lang === 'en' && pn.mayhem.bugfixesEn ? pn.mayhem.bugfixesEn : pn.mayhem.bugfixes).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={CARD + ' p-5 mb-5'}>
        <h3 className="text-base font-bold text-cream mb-3">{t('patch.championChanges')}</h3>
        <div className="flex flex-col divide-y divide-line/55 rounded-lg border border-line/60 bg-ink/24">
          {pn.championChanges.map((c) => {
            const champ = core.champions.find((ch) => ch.id === c.championId)
            const lines = lang === 'en' && c.changesEn ? c.changesEn : c.changes
            return (
              <button
                key={c.championId}
                onClick={() => champ && onPick(champ.id)}
                className="grid grid-cols-[44px_128px_minmax(0,1fr)] items-start gap-3 px-3 py-3 text-left transition hover:bg-panel2/45 cursor-pointer max-[840px]:grid-cols-[44px_minmax(0,1fr)]"
              >
                {champ && (
                  <img src={icon(champ.iconLocal)} alt={champ.name} className="w-10 h-10 rounded-lg shrink-0 border border-line/70" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-cream">{c.championName}</div>
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
        <section className={CARD + ' p-5 mb-5'}>
          <h3 className="text-base font-bold text-cream mb-3">{t('patch.itemChanges')}</h3>
          <div className="flex flex-col divide-y divide-line/55 rounded-lg border border-line/60 bg-ink/24">
            {pn.itemChanges.map((it, i) => {
              const item = it.itemId != null ? core.itemById.get(it.itemId) : undefined
              const name = item?.name ?? (lang === 'en' && it.itemNameEn ? it.itemNameEn : it.itemName)
              const lines = lang === 'en' && it.changesEn ? it.changesEn : it.changes
              return (
                <div key={i} className="grid grid-cols-[44px_140px_minmax(0,1fr)] items-start gap-3 px-3 py-3 max-[760px]:grid-cols-[44px_minmax(0,1fr)]">
                  {item && (
                    <img src={icon(item.iconLocal)} alt={name} className="w-10 h-10 rounded-lg shrink-0 border border-line/70 bg-ink/40" />
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
        <section className={CARD + ' p-5'}>
          <h3 className="text-base font-bold text-cream mb-3">{t('patch.systemChanges')}</h3>
          <div className="flex flex-col gap-2">
            {(lang === 'en' && pn.systemChangesEn ? pn.systemChangesEn : pn.systemChanges).map((s, i) => (
              <div key={i} className="rounded-lg border border-line/55 bg-panel2/32 px-3 py-2 text-[13px] leading-relaxed text-dim">
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
        className="h-10 w-10 shrink-0 rounded-lg border border-gold/40 object-cover"
      />
    )
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/40 bg-gold/10" aria-hidden="true">
      <span className="h-3.5 w-3.5 rotate-45 rounded-[3px] border border-gold/60 bg-gold/15" />
    </span>
  )
}

// 从 S 到 D 做真正的视觉重量递减：横幅底色由暖变暗、图标尺寸由大变小、
// 发光强度由强变无——一眼"感受到"层级差，不是靠读文字/边框色才知道。
function PatchMark() {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/35 bg-gold/10 text-gold">
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
    row: 'border-gold/45 bg-gold/10',
    badge: 'bg-gold text-[#1b1307]',
    bar: 'bg-gold',
    label: 'Priority routes',
  },
  A: {
    row: 'border-hex/35 bg-hex/8',
    badge: 'bg-hex text-[#061117]',
    bar: 'bg-hex',
    label: 'Stable high value',
  },
  B: {
    row: 'border-line/80 bg-panel/70',
    badge: 'bg-panel2 text-cream',
    bar: 'bg-dim',
    label: 'Playable picks',
  },
  C: {
    row: 'border-line/65 bg-panel/50',
    badge: 'bg-[#202936] text-dim',
    bar: 'bg-line',
    label: 'Narrow use cases',
  },
  D: {
    row: 'border-red/20 bg-red/6 opacity-80',
    badge: 'bg-[#251418] text-red',
    bar: 'bg-red',
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
  const champ = core.champions.find((c) => c.id === championId)
  const [build, setBuild] = useState<Build | null | undefined>(undefined)
  const [activeIdx, setActiveIdx] = useState(0)
  const [syncPulse, setSyncPulse] = useState(false)
  const covered = useMemo(
    () =>
      Object.keys(core.buildIndex)
        .map((id) => core.champions.find((c) => c.id === Number(id)))
        .filter((c): c is Champion => !!c && c.id !== championId),
    [core, championId],
  )

  useEffect(() => {
    const file = core.buildIndex[championId]
    if (!file) {
      setBuild(withCustomRoutes(null, championId, customRoutes, core))
      return
    }
    setBuild(undefined)
    loadBuild(file)
      .then((loaded) => setBuild(withCustomRoutes(loaded, championId, customRoutes, core)))
      // 没有 .catch 的话，loadBuild 一旦 reject(网络抖动/build json 损坏/打包路径问题)，build 会永远
      // 卡在 undefined(加载中)，用户看到永久转圈还没报错。退回 null 走"无出装"空态，跟隔壁
      // DetectedRouteCard 的处理保持一致。
      .catch(() => setBuild(withCustomRoutes(null, championId, customRoutes, core)))
  }, [championId, core, customRoutes])

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
        className="mb-3.5 inline-flex items-center gap-2 rounded-lg border border-line/70 bg-panel/55 px-3 py-2 text-sm font-bold text-hex cursor-pointer transition hover:-translate-y-0.5 hover:border-hex/55 hover:bg-hex/8"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span>
        <span>{t('detail.back')}</span>
      </button>
      {champ && build && build.archetypes.length > 1 && (
        <section className="glass-panel mb-5 rounded-[8px] border border-gold/35 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold">Pre-game route lock</div>
              <div className="mt-1 text-lg font-extrabold text-cream">{t('detail.chooseArchetype', { name: champ.name })}</div>
              <div className="mt-1 text-xs leading-relaxed text-dim">
                {t('detail.chooseArchetypeDesc')}
              </div>
            </div>
            {active && (
              <div className="rounded-lg border border-hex/35 bg-hex/10 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-hex">
                  {syncPulse ? 'Synced to overlay' : 'Overlay will show'}
                </div>
                <div className="mt-0.5 text-sm font-extrabold text-cream">{active.name}</div>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {build.archetypes.map((a, i) => (
              <button
                key={a.key}
                onClick={() => chooseArchetype(i)}
                className={
                  'flex min-h-[68px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left cursor-pointer transition hover:-translate-y-0.5 ' +
                  (i === activeIdx
                    ? 'border-gold/80 bg-gold text-[#1d1709] shadow-[0_14px_30px_rgba(208,173,104,0.18)]'
                    : 'border-line/70 bg-panel/78 text-dim hover:border-hex/50 hover:text-cream')
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{a.name}</span>
                  <span className={i === activeIdx ? 'mt-1 block text-[11px] text-[#2b1e07]/75' : 'mt-1 block text-[11px] text-dim'}>
                    {i === activeIdx ? t('detail.archetypeLocked') : t('detail.archetypeSetActive')}
                  </span>
                </span>
                <span
                  className={
                    'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold ' +
                    (i === activeIdx
                      ? 'bg-[#2b1e07]/15 text-[#2b1e07]'
                      : a.damageType === 'AP'
                        ? 'bg-[#9664dc]/18 text-[#c9a3f0]'
                        : 'bg-[#dc8246]/18 text-[#f0a97a]')
                  }
                >
                  {a.damageType}
                </span>
              </button>
            ))}
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
      {active && <AugmentDecisionLab arch={active} core={core} />}
      {active && <ArchetypeCard key={active.key} arch={active} augById={core.augById} itemById={core.itemById} />}
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
  const t = useT()
  const coreAugs = active?.augments.core.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const goodAugs = active?.augments.good.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const trapAugs = active?.augments.trap.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const starterItems = active?.starterItems?.map((ref) => core.itemById.get(ref.id)).filter((i): i is Item => !!i) ?? []
  const firstItems = active?.items.map((ref) => core.itemById.get(ref.id)).filter((i): i is Item => !!i).slice(0, 6) ?? []
  const routeCount = build ? build.archetypes.length : 0

  return (
    <section className="relative overflow-hidden rounded-[8px] border border-gold/30 bg-[linear-gradient(135deg,rgba(17,28,47,0.96),rgba(9,20,40,0.92))] p-6 shadow-[0_22px_68px_rgba(0,0,0,0.3),0_0_62px_rgba(200,170,110,0.08)]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute left-20 bottom-0 h-44 w-56 rounded-full bg-hex/8 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <img
              src={icon(champ.iconLocal)}
              alt={champ.name}
              className="h-24 w-24 rounded-[8px] border border-gold/45 object-cover shadow-[0_0_34px_rgba(200,170,110,0.16)]"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold">Mayhem combat file</div>
              <h1 className="mt-2 text-[38px] leading-none font-extrabold text-cream">{champ.name}</h1>
              <div className="mt-2 text-sm text-dim">{champ.title}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-line/70 bg-panel/70 px-3 py-1 text-xs text-dim">
                  {routeCount ? t('warRoom.routeCount', { n: routeCount }) : t('warRoom.routePending')}
                </span>
                {active && (
                  <span className="rounded-full border border-hex/35 bg-hex/10 px-3 py-1 text-xs font-bold text-hex">
                    {t('warRoom.current', { name: active.name })}
                  </span>
                )}
                {active && (
                  <span
                    className={
                      'rounded-full px-3 py-1 text-xs font-bold ' +
                      (active.damageType === 'AP' ? 'bg-[#9664dc]/18 text-[#c9a3f0]' : 'bg-[#dc8246]/18 text-[#f0a97a]')
                    }
                  >
                    {active.damageType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[8px] border border-hex/25 bg-hex/8 p-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-hex">Decision brief</div>
            <p className="mt-2 text-sm leading-7 text-cream">
              {active?.note || t('warRoom.noNote')}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            <CombatRule
              label={t('warRoom.rule.core')}
              value={coreAugs.length > 0 ? t('warRoom.rule.core.value.has') : t('warRoom.rule.core.value.none')}
              detail={coreAugs[0] ? t('warRoom.rule.core.detail.has', { name: coreAugs[0].name }) : t('warRoom.rule.core.detail.none')}
            />
            <CombatRule
              label={t('warRoom.rule.good')}
              value={goodAugs.length > 0 ? t('warRoom.rule.good.value.has') : t('warRoom.rule.good.value.none')}
              detail={goodAugs[0] ? t('warRoom.rule.good.detail.has', { name: goodAugs[0].name }) : t('warRoom.rule.good.detail.none')}
            />
            <CombatRule
              label={t('warRoom.rule.trap')}
              value={trapAugs.length > 0 ? t('warRoom.rule.trap.value.has') : t('warRoom.rule.trap.value.none')}
              detail={trapAugs[0] ? t('warRoom.rule.trap.detail.has', { name: trapAugs[0].name }) : t('warRoom.rule.trap.detail.none')}
            />
          </div>
        </div>

        <div className="rounded-[8px] border border-line/70 bg-[#0a1428]/75 p-4 shadow-[inset_0_1px_0_rgba(240,230,210,0.06)]">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-dim">At a glance</div>
          <QuickAugLine label={t('warRoom.quick.core')} tone="core" items={coreAugs} />
          <QuickAugLine label={t('warRoom.quick.good')} tone="good" items={goodAugs} />
          <QuickAugLine label={t('warRoom.quick.trap')} tone="trap" items={trapAugs} />
          <div className="mt-4 border-t border-line/60 pt-4">
            <div className="mb-2 text-xs font-bold text-dim">{t('warRoom.itemOrder')}</div>
            {starterItems.length > 0 || firstItems.length > 0 ? (
              <div className="space-y-3">
                {starterItems.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold">{t('warRoom.starterItems')}</div>
                    <MiniItemLine items={starterItems} />
                  </div>
                )}
                {firstItems.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-hex">{t('warRoom.finalItems')}</div>
                    <MiniItemLine items={firstItems} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-dim">{t('warRoom.itemOrderPending')}</div>
            )}
          </div>
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

function MiniItemLine({ items }: { items: Item[] }) {
  const visibleItems = stackItems(items)
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

function CombatRule({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[8px] border border-line/60 bg-panel/58 p-3">
      <div className="text-[11px] font-bold text-dim">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-cream">{value}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-dim">{detail}</div>
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
  const selected = pickedIds.map((id) => (id == null ? null : getAugment(core.augById, id)))
  const ownedAugments = ownedIds.map((id) => getAugment(core.augById, id)).filter((a): a is Augment => !!a)
  const decisions = selected
    .filter((a): a is Augment => !!a)
    .map((augment) => scoreAugmentPick(augment, arch, ownedAugments, lang))
    .sort((a, b) => b.score - a.score)
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
    <section className={CARD + ' mt-5 p-5'}>
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-hex/10 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_320px] gap-5 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-hex">Augment decision lab</div>
          <h3 className="mt-1 text-xl font-extrabold text-cream">{t('lab.title')}</h3>
          <p className="mt-2 text-sm leading-6 text-dim">
            {t('lab.subtitle')}
          </p>
          <OwnedAugmentsPanel
            query={ownedQuery}
            ownedAugments={ownedAugments}
            augments={core.augments}
            onQuery={setOwnedQuery}
            onAdd={addOwned}
            onRemove={removeOwned}
          />
          <div className="mt-4 grid grid-cols-3 gap-3 max-[820px]:grid-cols-1">
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

        <div className="relative rounded-[8px] border border-line/70 bg-[#0a1428]/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-dim">Recommendation</div>
            <button onClick={clear} className="text-[11px] text-dim hover:text-cream cursor-pointer">
              {t('lab.clear')}
            </button>
          </div>
          {winner ? (
            <>
              <DecisionResult pick={winner} rank={1} featured />
              <div className="mt-3 flex flex-col gap-2">
                {decisions.slice(1).map((pick, idx) => (
                  <DecisionResult key={pick.augment.id} pick={pick} rank={idx + 2} />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-line/60 bg-panel/50 p-4 text-sm leading-6 text-dim">
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
  const suggestions = needle
    ? augments
        .filter((a) => a.name.includes(query.trim()) || a.apiName.toLowerCase().includes(needle) || a.desc.includes(query.trim()))
        .slice(0, 5)
    : []
  const picked = pickedId == null ? null : augments.find((a) => a.id === pickedId) ?? null

  return (
    <div className="rounded-[8px] border border-line/70 bg-panel/70 p-3">
      <label className="text-[11px] font-extrabold text-dim">{t('lab.option', { n: idx + 1 })}</label>
      <input
        value={query}
        onChange={(e) => preserveNearestScroll(e.currentTarget, () => onQuery(e.currentTarget.value))}
        placeholder={t('lab.inputPlaceholder')}
        className="mt-2 w-full rounded-lg border border-line/70 bg-[#091428]/75 px-3 py-2 text-sm text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {picked && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/8 p-2">
          <img src={icon(picked.iconLargeLocal)} alt={picked.name} className="h-8 w-8 rounded-lg border border-line object-cover" />
          <span className="min-w-0 truncate text-xs font-bold text-cream">{picked.name}</span>
        </div>
      )}
      {!picked && suggestions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onPick(a))}
              className="flex items-center gap-2 rounded-lg border border-line/50 bg-panel2/45 p-2 text-left transition hover:border-hex/50 cursor-pointer"
            >
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-7 w-7 rounded-lg border border-line object-cover" />
              <span className="min-w-0 truncate text-xs text-cream">{a.name}</span>
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
  const ownedIds = new Set(ownedAugments.map((a) => a.id))
  const suggestions = needle
    ? augments
        .filter(
          (a) =>
            !ownedIds.has(a.id) &&
            (a.name.includes(query.trim()) || a.apiName.toLowerCase().includes(needle) || a.desc.includes(query.trim())),
        )
        .slice(0, 5)
    : []

  return (
    <div className="mt-4 rounded-[8px] border border-hex/25 bg-hex/8 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-hex">{t('lab.owned.title')}</div>
          <div className="mt-1 text-[11px] text-dim">{t('lab.owned.desc')}</div>
        </div>
        {ownedAugments.length > 0 && (
          <span className="rounded-full border border-line/60 bg-panel/55 px-2 py-1 text-[10px] text-dim">
            {t('lab.owned.count', { n: ownedAugments.length })}
          </span>
        )}
      </div>
      <input
        value={query}
        onChange={(e) => preserveNearestScroll(e.currentTarget, () => onQuery(e.currentTarget.value))}
        placeholder={t('lab.owned.addPlaceholder')}
        className="mt-3 w-full rounded-lg border border-line/70 bg-[#091428]/75 px-3 py-2 text-sm text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {suggestions.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 max-[780px]:grid-cols-1">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onAdd(a))}
              className="flex items-center gap-2 rounded-lg border border-line/50 bg-panel2/45 p-2 text-left transition hover:border-hex/50 cursor-pointer"
            >
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-7 w-7 rounded-lg border border-line object-cover" />
              <span className="min-w-0 truncate text-xs text-cream">{a.name}</span>
            </button>
          ))}
        </div>
      )}
      {ownedAugments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ownedAugments.map((a) => (
            <button
              key={a.id}
              onClick={(e) => preserveNearestScroll(e.currentTarget, () => onRemove(a.id))}
              className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/8 px-2 py-1 text-xs text-cream transition hover:border-red/45 hover:text-red cursor-pointer"
              title={t('lab.owned.removeHint')}
            >
              <img src={icon(a.iconSmallLocal)} alt={a.name} className="h-4 w-4 rounded-full" />
              {a.name}
              <span className="text-dim">×</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-line/50 bg-panel/45 p-2 text-[11px] text-dim">
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
      ? 'border-gold/45 bg-gold/10 text-gold'
      : pick.tone === 'good'
        ? 'border-hex/45 bg-hex/10 text-hex'
        : pick.tone === 'avoid'
          ? 'border-red/45 bg-red/10 text-red'
          : 'border-line/60 bg-panel/55 text-dim'
  return (
    <div className={'rounded-[8px] border p-3 ' + tone}>
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#091428]/65 text-xs font-extrabold">
          #{rank}
        </div>
        <img src={icon(pick.augment.iconLargeLocal)} alt={pick.augment.name} className="h-10 w-10 rounded-lg border border-line/70 object-cover" />
        <div className="min-w-0 flex-1">
          <div className={(featured ? 'text-base' : 'text-sm') + ' truncate font-extrabold text-cream'}>{pick.augment.name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-full border border-current/35 bg-[#091428]/45 px-2 py-px text-[10px] font-extrabold">
              {pick.grade}
            </span>
            <span className="text-xs font-bold">{pick.label}</span>
            {pick.verified ? (
              <span className="rounded-full border border-[#3fb950]/40 bg-[#3fb950]/10 px-1.5 py-px text-[9px] font-bold text-[#3fb950]">
                {t('lab.verified')}
              </span>
            ) : (
              <span className="rounded-full border border-line/60 bg-panel/55 px-1.5 py-px text-[9px] font-bold text-dim">
                {t('lab.unverified')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-relaxed text-dim">{pick.reason}</div>
      {pick.comboNotes.length > 0 && (
        <div className="mt-2 rounded-lg border border-hex/20 bg-hex/8 px-2.5 py-2 text-[11px] leading-relaxed text-hex">
          {pick.comboNotes.join(' · ')}
        </div>
      )}
      {pick.tags.length > 0 && (
        <div className="mt-2 text-[10px] text-dim/70">
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
      ? 'text-gold border-gold/25 bg-gold/8'
      : tone === 'good'
        ? 'text-hex border-hex/25 bg-hex/8'
        : 'text-red border-red/25 bg-red/8'
  return (
    <div className="mt-3">
      <div className={'mb-2 inline-flex rounded-md border px-2.5 py-1 text-[11px] font-extrabold ' + toneClass}>
        {label}
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {items.slice(0, 3).map((a) => (
            <div key={a.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-line/55 bg-panel/55 px-2 py-1.5">
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-7 w-7 shrink-0 rounded-lg border border-line/70 object-cover" />
              <span className="min-w-0 truncate text-xs font-bold text-cream">{a.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-line/55 bg-panel/40 px-2.5 py-2 text-xs text-dim">{t('common.none')}</div>
      )}
    </div>
  )
}

function PlayerRow({ p, core, maxDamage }: { p: PlayerMatchStats; core: Core; maxDamage: number }) {
  const t = useT()
  const champ = core.champions.find((c) => c.id === p.championId)
  const items = p.items.map((id) => core.itemById.get(id)).filter((x): x is Item => !!x)
  const augments = p.augments.map((id) => getAugment(core.augById, id)).filter((x): x is Augment => !!x)
  const dmgPct = maxDamage > 0 ? Math.round((p.totalDamageDealtToChampions / maxDamage) * 100) : 0
  return (
    <div
      className={
        'flex flex-wrap items-center gap-3 py-2.5 px-3 rounded-lg border ' +
        (p.isMe ? 'bg-gold/10 border-gold/30' : 'border-transparent')
      }
    >
      {champ && (
        <img src={icon(champ.iconLocal)} alt={champ.name} className="w-9 h-9 rounded-md border border-line shrink-0" />
      )}
      <div className="w-[112px] shrink-0 min-w-0">
        <div className="text-[13px] truncate">{champ?.name ?? t('match.unknownChamp')}</div>
        <div className="text-[11px] text-dim truncate">{p.summonerName}</div>
      </div>
      <div className="w-16 shrink-0 text-xs text-center">
        {p.kills} / {p.deaths} / {p.assists}
      </div>
      <div className="flex-1 min-w-[100px]">
        <div className="flex items-center justify-between text-[11px] text-dim mb-0.5">
          <span>{t('match.damage')}</span>
          <span>{p.totalDamageDealtToChampions.toLocaleString()}</span>
        </div>
        <div className="h-1.5 rounded-full bg-panel2 overflow-hidden">
          <div className="h-full bg-red" style={{ width: dmgPct + '%' }} />
        </div>
      </div>
      <div className="w-16 shrink-0 text-xs text-center text-dim">{p.goldEarned.toLocaleString()}g</div>
      <div className="flex items-center gap-1 shrink-0">
        {items.map((it, i) => (
          <img
            key={it.id + '-' + i}
            src={icon(it.iconLocal)}
            alt={it.name}
            title={it.name}
            className="w-6 h-6 rounded border border-line"
          />
        ))}
        {augments.map((a) => (
          <img
            key={a.id}
            src={icon(a.iconLargeLocal)}
            alt={a.name}
            title={a.name}
            className={'w-6 h-6 rounded border-2 ' + (RARITY[a.rarity] ?? RARITY[0]).border}
          />
        ))}
      </div>
    </div>
  )
}

function MatchOverview({ detail, core }: { detail: MatchFullDetail; core: Core }) {
  const t = useT()
  const maxDamage = Math.max(...detail.players.map((p) => p.totalDamageDealtToChampions), 1)
  const ally = detail.players.filter((p) => p.team === 'ally')
  const enemy = detail.players.filter((p) => p.team === 'enemy')
  return (
    <>
      <section className={CARD + ' p-4'}>
        <div className={'text-xs font-semibold mb-2 ' + (detail.win ? 'text-[#63c07a]' : 'text-red')}>
          {t('match.ally')} · {detail.win ? t('match.win') : t('match.loss')}
        </div>
        <div className="flex flex-col gap-1.5">
          {ally.map((p) => (
            <PlayerRow key={p.participantId} p={p} core={core} maxDamage={maxDamage} />
          ))}
        </div>
      </section>
      <section className={CARD + ' p-4 mt-3'}>
        <div className={'text-xs font-semibold mb-2 ' + (detail.win ? 'text-red' : 'text-[#63c07a]')}>
          {t('match.enemy')} · {detail.win ? t('match.loss') : t('match.win')}
        </div>
        <div className="flex flex-col gap-1.5">
          {enemy.map((p) => (
            <PlayerRow key={p.participantId} p={p} core={core} maxDamage={maxDamage} />
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

const MATCH_TABS: { key: 'overview' | 'stats' | 'graph'; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'stats', label: 'Stats' },
  { key: 'graph', label: 'Graph' },
]

/** 「近期对局」点进去看的：比分/双方阵容/每人伤害经济KDA/每人出装海克斯（事实记录，不是流派推荐）。 */
function MatchDetail({ core, match, onBack }: { core: Core; match: MatchSummary | null; onBack: () => void }) {
  const t = useT()
  const lang = useLang()
  const [detail, setDetail] = useState<MatchFullDetail | null | undefined>(undefined) // undefined=加载中，null=拿不到
  const [matchTab, setMatchTab] = useState<'overview' | 'stats' | 'graph'>('overview')

  useEffect(() => {
    setDetail(undefined)
    setMatchTab('overview')
    if (!match || !isElectron()) {
      setDetail(null)
      return
    }
    window.mayhem!.getMatchDetail(match.gameId).then(setDetail)
  }, [match?.gameId])

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

  return (
    <>
      <button className="text-red text-sm cursor-pointer pb-3.5 hover:underline" onClick={onBack}>
        {t('match.back')}
      </button>
      {champ && (
        <header className="flex items-center gap-3.5 pb-4 mb-1 border-b border-line">
          <img
            src={icon(champ.iconLocal)}
            alt={champ.name}
            className="w-16 h-16 rounded-[10px] object-cover border border-line"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-bold">{champ.name}</h1>
              <span
                className={
                  'text-xs font-bold px-2 py-0.5 rounded ' +
                  (match.win ? 'text-[#63c07a] bg-[#63c07a]/15' : 'text-red bg-red/15')
                }
              >
                {match.win ? t('match.win') : t('match.loss')}
              </span>
              {allyScore != null && enemyScore != null && (
                <span className="text-sm font-bold text-dim">
                  {allyScore} : {enemyScore}
                </span>
              )}
            </div>
            <p className="text-[13px] text-dim mt-1">
              {match.kills} / {match.deaths} / {match.assists} · {t('match.impact', { pct: match.impactPercentile })}
              {' · '}
              {new Date(match.gameCreationDate).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN')}
            </p>
          </div>
        </header>
      )}

      <div className="flex gap-1.5 mt-4 mb-3">
        {MATCH_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setMatchTab(t.key)}
            disabled={!detail}
            className={
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition disabled:cursor-default disabled:opacity-40 ' +
              (matchTab === t.key ? 'bg-gold text-[#2b1e07]' : 'bg-panel2 text-dim hover:text-cream')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {detail === undefined && <div className="p-11 text-center text-dim text-sm">{t('match.loadingDetail')}</div>}
      {detail === null && (
        <div className="p-11 text-center text-dim text-sm">
          {t('match.needElectron')}
        </div>
      )}
      {detail && matchTab === 'overview' && <MatchOverview detail={detail} core={core} />}
      {detail && matchTab === 'stats' && <MatchStats detail={detail} core={core} />}
      {detail && matchTab === 'graph' && <MatchGraph detail={detail} />}
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
  const boots = arch.boots?.map((ref) => itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  const optionalItems = arch.optionalItems?.map((ref) => itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  return (
    <section className={CARD + ' mt-[18px] p-5'}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="relative flex items-center gap-2.5 mb-3.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-dim">Full tactical readout</span>
      </div>
      <div className="relative flex flex-wrap items-center gap-2.5">
        <span className="text-[22px] font-extrabold">{arch.name}</span>
        <span
          className={
            'text-xs font-semibold px-2.5 py-1 rounded-md ' +
            (arch.damageType === 'AP' ? 'text-[#c9a3f0] bg-[#9664dc]/18' : 'text-[#f0a97a] bg-[#dc8246]/18')
          }
        >
          {arch.damageType}
        </span>
      </div>
      {arch.note && <p className="relative mt-2 max-w-3xl text-[13px] text-dim leading-relaxed">{arch.note}</p>}

      <div className="relative text-[13px] font-semibold text-dim mb-2.5 mt-5">{t('archetypeCard.augments')}</div>
      <div className="relative flex flex-col gap-3">
        <AugTier label={t('archetypeCard.core')} tone="core" refs={arch.augments.core} augById={augById} />
        <AugTier label={t('archetypeCard.good')} tone="good" refs={arch.augments.good} augById={augById} />
        {arch.augments.trap.length > 0 && (
          <AugTier label={t('archetypeCard.trap')} tone="trap" refs={arch.augments.trap} augById={augById} />
        )}
      </div>

      <div className="relative text-[13px] font-semibold text-dim mb-2.5 mt-5">{t('archetypeCard.items')}</div>
      <div className="relative space-y-4">
        {starterItems.length > 0 && (
          <ItemSequence label={t('archetypeCard.starterItems')} tone="starter" items={starterItems} />
        )}
        <ItemSequence label={t('archetypeCard.finalItems')} tone="final" items={finalItems} />
        {boots.length > 0 && <ItemSequence label={t('archetypeCard.boots')} tone="boots" items={boots} />}
        {optionalItems.length > 0 && (
          <ItemSequence label={t('archetypeCard.optionalItems')} tone="optional" items={optionalItems} />
        )}
      </div>

      {arch.sources && arch.sources.length > 0 && (
        <div className="relative mt-5 pt-3 border-t border-line/70 text-[11px] text-dim/70">
          {t('archetypeCard.sources', { sources: arch.sources.join(' · ') })}
        </div>
      )}
    </section>
  )
}

function ItemSequence({
  label,
  tone,
  items,
}: {
  label: string
  tone: 'starter' | 'final' | 'boots' | 'optional'
  items: Item[]
}) {
  if (items.length === 0) return null
  const visibleItems = stackItems(items)
  return (
    <div className="rounded-[8px] border border-line/60 bg-panel/34 p-3">
      <div
        className={
          (tone === 'starter' || tone === 'boots' ? 'text-gold' : tone === 'final' ? 'text-hex' : 'text-dim') +
          ' mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em]'
        }
      >
        {label}
      </div>
      <div className="flex flex-wrap items-start justify-start gap-2">
        {visibleItems.map((it, idx) => (
          <div key={it.id + '-' + idx} className="flex h-[104px] items-center gap-1.5">
            <ItemHoverCard item={it}>
              <div className="flex h-[104px] w-[96px] flex-col items-center justify-center rounded-lg border border-line/60 bg-panel2/38 p-2">
                <span className="relative block">
                  <img src={icon(it.iconLocal)} alt={it.name} className="h-11 w-11 shrink-0 rounded-lg border border-line" />
                  {it.count > 1 && (
                    <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-panel bg-gold px-1 text-[9px] font-extrabold leading-none text-[#091428]">
                      {it.count}
                    </span>
                  )}
                </span>
                <span className="mt-1 line-clamp-3 h-[34px] text-center text-[11px] leading-[11px] text-dim">
                  {it.name}
                </span>
              </div>
            </ItemHoverCard>
            {idx < visibleItems.length - 1 && <span className="grid h-[104px] place-items-center text-dim text-[13px]">-&gt;</span>}
          </div>
        ))}
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
  if (refs.length === 0) return null
  return (
    <div className="rounded-[8px] border border-line/60 bg-panel2/35 p-3">
      <div className={'mb-3 text-[13px] font-extrabold ' + TONE_LABEL[tone]}>{label}</div>
      <div className="flex flex-wrap items-start justify-start gap-3">
        {refs.map((ref) => {
          const a = getAugment(augById, ref.id)
          if (!a) return null
          const r = RARITY[a.rarity] ?? RARITY[0]
          return (
            <AugmentHoverCard key={ref.id} augment={a}>
              <div className="flex h-[94px] w-[92px] flex-col items-center">
                <div
                  className={
                    'w-[62px] h-[62px] rounded-lg overflow-hidden border-2 shadow-[0_10px_22px_rgba(0,0,0,0.22)] ' +
                    r.border +
                    (tone === 'core' ? ' ring-2 ring-gold' : '') +
                    (tone === 'trap' ? ' opacity-70' : '')
                  }
                >
                  <img src={icon(a.iconLargeLocal)} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <span className="mt-1.5 line-clamp-2 h-[28px] text-center text-xs leading-[14px]">{a.name}</span>
              </div>
            </AugmentHoverCard>
          )
        })}
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
  return (
    <HoverPortal
      content={
        <div className="relative rounded-[10px] border border-gold/35 bg-[#0a0f17]/98 p-3 shadow-[0_22px_54px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <img src={icon(a.iconSmallLocal)} alt="" className={'h-9 w-9 shrink-0 rounded-md border-2 object-cover ' + r.border} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-cream">{a.name}</div>
              <div className={'text-[10px] font-bold uppercase tracking-wide ' + r.text}>
                {t(`rarity.${RARITY_KEY[a.rarity]}`, r.label)}
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-[12px] leading-relaxed text-dim">{a.desc}</div>
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
