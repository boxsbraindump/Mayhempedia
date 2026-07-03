import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadCore,
  loadBuild,
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
} from './lcu'
import { augmentTagLabel, scoreAugmentPick, type DecisionPick } from './augment-scoring'
import { LangProvider, useT } from './i18n'

/* 复用样式片段（字面量常量，Tailwind 扫描可识别） */
const CARD =
  'relative overflow-hidden rounded-[28px] border border-line/80 bg-panel/90 shadow-[0_18px_52px_rgba(0,0,0,0.28),0_0_42px_rgba(41,211,255,0.05)] backdrop-blur-xl'
const SEARCH =
  'w-full max-w-lg px-4 py-3 mb-5 bg-panel/90 border border-line/80 rounded-2xl text-cream text-sm outline-none focus:border-hex/80 focus:shadow-[0_0_24px_rgba(41,211,255,0.12)] placeholder:text-dim/55 transition'

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

type Tab = 'dash' | 'champ' | 'tier' | 'aug' | 'patch' | 'settings'
const NAV: { key: Tab; label: string }[] = [
  { key: 'dash', label: '副官状态' },
  { key: 'champ', label: '流派档案' },
  { key: 'tier', label: '强度路线' },
  { key: 'aug', label: '增强图鉴' },
  { key: 'patch', label: '战术更新' },
  { key: 'settings', label: '设置' },
]

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
  // 主页板块显隐开关；未拿到设置(浏览器预览/还没读到)前默认全部显示，不让空指针挡住主页
  const [dashboardSections, setDashboardSections] = useState<DashboardSections | null>(null)

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
      setDashboardSections(s.dashboardSections)
    })
    window.mayhem!.onSettingsChanged((s) => {
      setSettings(s)
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

  const detectedChamp =
    core && activeChampionId ? core.champions.find((c) => c.id === activeChampionId) : null
  const detectedHasBuild = !!(detectedChamp && core?.buildIndex[detectedChamp.id])

  useEffect(() => {
    if (!detectedChamp) return
    setMatchDetailId(null)
    setChampId(detectedChamp.id)
  }, [detectedChamp?.id])

  return (
    <LangProvider value={settings?.language ?? 'zh'}>
    <div className="relative flex min-h-screen overflow-hidden bg-ink text-cream">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(41,211,255,0.16),transparent_28%),radial-gradient(circle_at_82%_6%,rgba(200,170,110,0.18),transparent_24%),linear-gradient(135deg,#091428_0%,#111c2f_56%,#1b263b_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(240,230,210,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(240,230,210,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(circle_at_center,black,transparent_76%)]" />
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
      <main className="relative z-10 flex-1 min-w-0 px-8 py-7 pb-16">
        {detectedChamp && champId !== detectedChamp.id && (
          <button
            onClick={() => {
              setMatchDetailId(null)
              setChampId(detectedChamp.id)
            }}
            className="group w-full mb-5 flex items-center gap-3 px-4 py-3 rounded-[22px] bg-gradient-to-r from-gold/18 via-panel/95 to-hex/10 border border-gold/40 text-left cursor-pointer hover:border-gold/80 hover:-translate-y-0.5 transition shadow-[0_14px_42px_rgba(0,0,0,0.24)]"
          >
            <img
              src={icon(detectedChamp.iconLocal)}
              alt={detectedChamp.name}
              className="w-10 h-10 rounded-xl border border-gold/40 shadow-[0_0_24px_rgba(200,170,110,0.16)]"
            />
            <span className="text-sm">
              选人阶段检测到 <b className="text-gold">{detectedChamp.name}</b>
              {detectedHasBuild ? ' · 点击查看流派 →' : ' · 暂无流派数据'}
            </span>
          </button>
        )}
        {err && <div className="p-16 text-center text-red">加载失败：{err}</div>}
        {!err && !core && <div className="p-16 text-center text-dim">加载数据中…</div>}
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
            onGoTier={() => setTab('tier')}
            sections={dashboardSections}
            lcuStatus={lcuStatus}
            detectedChamp={detectedChamp}
            detectedHasBuild={detectedHasBuild}
            selectedArchetypeByChampionId={settings?.selectedArchetypeByChampionId ?? {}}
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
        {core && matchDetailId == null && champId == null && tab === 'tier' && (
          <TierTab core={core} onPick={setChampId} />
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
    </LangProvider>
  )
}

const LCU_BADGE: Record<LcuStatus['state'], { label: string; dot: string }> = {
  connecting: { label: '连接客户端中…', dot: 'bg-gold animate-pulse' },
  connected: { label: '已连接客户端', dot: 'bg-[#4bd07a]' },
  error: { label: '连接失败', dot: 'bg-red' },
}

/* ---------------- 左侧栏 ---------------- */
const NOTICE_TONE: Record<AppNotice['tone'], { border: string; dot: string }> = {
  success: { border: 'border-[#63c07a]/70', dot: 'bg-[#63c07a]' },
  warning: { border: 'border-gold/70', dot: 'bg-gold' },
  info: { border: 'border-[#57c3e8]/70', dot: 'bg-[#57c3e8]' },
}

function NoticeToast({ notice, onClose }: { notice: AppNotice; onClose: () => void }) {
  const tone = NOTICE_TONE[notice.tone]
  return (
    <div className="fixed right-5 top-5 z-50 max-w-[360px]">
      <div
        className={
          'bg-panel/95 border rounded-[22px] shadow-[0_18px_52px_rgba(0,0,0,0.42),0_0_36px_rgba(41,211,255,0.08)] backdrop-blur-xl p-4 ' +
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
  return (
    <aside className="relative z-10 w-60 shrink-0 border-r border-line/70 bg-[#091428]/88 px-4 py-5 sticky top-0 h-screen flex flex-col shadow-[18px_0_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="mb-7 px-2.5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/40 bg-gold/10 text-gold shadow-[0_0_34px_rgba(200,170,110,0.12)]">
          <NavIcon k="aug" />
        </div>
        <div className="mt-4 text-[22px] font-extrabold tracking-wide">
          Mayhem<span className="text-gold">pedia</span>
        </div>
        <div className="mt-1 text-[11px] text-dim tracking-[0.18em] uppercase">Hextech Control Room</div>
      </div>
      <nav className="flex flex-col gap-1.5">
        {NAV.map((n) => {
          const on = tab === n.key
          return (
            <button
              key={n.key}
              onClick={() => onTab(n.key)}
              className={
                'flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm text-left cursor-pointer transition ' +
                (on
                  ? 'bg-gradient-to-br from-[#f0e6d2] to-gold text-[#1d1709] font-extrabold shadow-[0_12px_32px_rgba(200,170,110,0.18)]'
                  : 'text-dim hover:bg-panel2/70 hover:text-cream hover:translate-x-0.5')
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
      {lcuStatus && (
        <div className="mt-auto rounded-[22px] border border-line/70 bg-panel/70 px-3.5 py-3.5 text-xs text-dim shadow-[inset_0_1px_0_rgba(240,230,210,0.06)]">
          <div className="flex items-center gap-2">
            <span className={'w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_18px_currentColor] ' + LCU_BADGE[lcuStatus.state].dot} />
            <span className="font-semibold">{LCU_BADGE[lcuStatus.state].label}</span>
          </div>
          <div className="mt-2 text-[11px] text-dim/70">Overlay: Ctrl+Shift+X</div>
        </div>
      )}
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
      />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[18px] items-start max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-4 min-w-0">
          {show('identityCard') && <IdentityCard arp={matchHistory?.arp ?? null} summoner={summoner} />}
          {show('versionChanges') && (
            <VersionChanges core={core} champById={champById} onPick={onPick} onOpenPatchNotes={onOpenPatchNotes} />
          )}
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          {show('recentMatches') && (
            <RecentMatches matches={matchHistory?.matches ?? null} champById={champById} onPick={onPickMatch} />
          )}
          {show('achievements') && <Achievements achievements={matchHistory?.achievements ?? null} />}
        </div>
      </div>
      {!matchHistory && <DashboardOnboarding onGoChamp={onGoChamp} onGoTier={onGoTier} />}
    </>
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

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-gold/25 bg-[linear-gradient(135deg,rgba(17,28,47,0.96),rgba(27,38,59,0.92))] p-7 mb-5 shadow-[0_24px_70px_rgba(0,0,0,0.32),0_0_70px_rgba(41,211,255,0.08)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-hex/12 blur-3xl" />
      <div className="pointer-events-none absolute right-10 bottom-0 h-32 w-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_320px] gap-7 items-end max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
            Hextech Mayhem Companion
          </div>
          <h1 className="mt-4 max-w-[720px] text-[42px] leading-[1.04] font-extrabold text-cream">
            {t('dash.hero.title')}
          </h1>
          <p className="mt-3 max-w-[650px] text-sm leading-7 text-dim">
            {t('dash.hero.subtitle')}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => (detectedChamp ? onPick(detectedChamp.id) : onGoChamp())}
              className="rounded-2xl bg-gradient-to-br from-[#f0e6d2] to-gold px-5 py-2.5 text-sm font-extrabold text-[#1c1508] shadow-[0_12px_34px_rgba(200,170,110,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 cursor-pointer"
            >
              {detectedChamp ? t('dash.hero.viewBuild', { name: detectedChamp.name }) : t('dash.hero.openLibrary')}
            </button>
            <button
              onClick={onGoTier}
              className="rounded-2xl border border-hex/35 bg-hex/10 px-5 py-2.5 text-sm font-bold text-hex transition hover:-translate-y-0.5 hover:border-hex/70 cursor-pointer"
            >
              {t('dash.hero.viewTier')}
            </button>
            <button
              onClick={onOpenPatchNotes}
              className="rounded-2xl border border-line/80 bg-panel2/70 px-5 py-2.5 text-sm font-bold text-dim transition hover:-translate-y-0.5 hover:text-cream hover:border-gold/45 cursor-pointer"
            >
              {t('dash.hero.patchNotes')}
            </button>
          </div>
        </div>

        <div className="rounded-[26px] border border-line/80 bg-[#0a1428]/72 p-4 shadow-[inset_0_1px_0_rgba(240,230,210,0.08)] backdrop-blur-xl">
          <div className={'rounded-2xl border px-3.5 py-3 text-sm font-bold ' + statusTone}>{status}</div>
          <div className="mt-4 flex flex-col gap-2">
            <StatusStep
              index="01"
              label={t('dash.hero.step.connect')}
              state={lcuStatus?.state === 'connected' ? 'done' : lcuStatus?.state === 'error' ? 'blocked' : 'active'}
              detail={
                lcuStatus?.state === 'connected'
                  ? t('dash.hero.step.connect.done')
                  : lcuStatus?.state === 'error'
                    ? t('dash.hero.step.connect.error')
                    : t('dash.hero.step.connect.idle')
              }
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
              detail={
                detectedChamp
                  ? detectedHasBuild
                    ? t('dash.hero.step.build.done')
                    : t('dash.hero.step.build.blocked')
                  : t('dash.hero.step.build.idle', { covered, total: core.champions.length })
              }
            />
            <StatusStep
              index="04"
              label={t('dash.hero.step.overlay')}
              state={detectedChamp && detectedHasBuild ? 'active' : 'idle'}
              detail={detectedChamp && detectedHasBuild ? t('dash.hero.step.overlay.active') : t('dash.hero.step.overlay.idle')}
            />
          </div>
          {detectedChamp && (
            <DetectedRouteCard
              core={core}
              champion={detectedChamp}
              hasBuild={detectedHasBuild}
              selectedArchetypeKey={selectedArchetypeByChampionId[String(detectedChamp.id)]}
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
    <div className={'flex items-center gap-3 rounded-2xl border px-3 py-2.5 ' + tone}>
      <div className="w-8 shrink-0 text-[10px] font-extrabold tracking-[0.14em] opacity-80">{index}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-extrabold text-cream">{label}</div>
        <div className="mt-0.5 truncate text-[11px] opacity-80">{detail}</div>
      </div>
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_16px_currentColor]" />
    </div>
  )
}

function DetectedRouteCard({
  core,
  champion,
  hasBuild,
  selectedArchetypeKey,
}: {
  core: Core
  champion: Champion
  hasBuild: boolean
  selectedArchetypeKey?: string
}) {
  const [build, setBuild] = useState<Build | null | undefined>(undefined)

  useEffect(() => {
    const file = core.buildIndex[champion.id]
    if (!file) {
      setBuild(null)
      return
    }
    setBuild(undefined)
    loadBuild(file).then(setBuild).catch(() => setBuild(null))
  }, [core, champion.id])

  const route = build?.archetypes.find((a) => a.key === selectedArchetypeKey) ?? build?.archetypes[0]
  return (
    <div className="mt-4 rounded-[22px] border border-gold/30 bg-gold/8 p-3 shadow-[0_0_32px_rgba(200,170,110,0.08)]">
      <div className="flex items-center gap-3">
        <img
          src={icon(champion.iconLocal)}
          alt={champion.name}
          className="h-12 w-12 rounded-2xl border border-gold/45 object-cover shadow-[0_0_22px_rgba(200,170,110,0.14)]"
        />
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-cream">{champion.name}</div>
          <div className="mt-1 text-xs text-dim">
            {route
              ? selectedArchetypeKey
                ? `${route.name} · 已设为本局路线`
                : route.name
              : hasBuild
                ? '读取推荐路线中'
                : '这个英雄还缺少 Mayhem 流派'}
          </div>
        </div>
      </div>
      {route?.note && <div className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-dim">{route.note}</div>}
    </div>
  )
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-panel/72 p-3">
      <div className="text-[11px] text-dim">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-cream">{value}</div>
    </div>
  )
}

/** 主页没有本机对局数据时（浏览器预览/刚打开还没打过大乱斗）填的引导块——
 *  不是纯装饰性留白填充，是真的告诉用户"数据从哪来"+顺带把他导去有内容的页面逛逛。 */
function DashboardOnboarding({ onGoChamp, onGoTier }: { onGoChamp: () => void; onGoTier: () => void }) {
  const t = useT()
  return (
    <section className={CARD + ' p-6 mt-4'}>
      <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-hex/10 blur-3xl" />
      <div className="relative flex items-center gap-2 mb-4">
        <span className="h-2 w-2 rounded-full bg-hex shadow-[0_0_18px_rgba(41,211,255,0.75)]" />
        <h3 className="text-base font-extrabold text-cream">{t('dash.onboarding.title')}</h3>
      </div>
      <div className="relative grid grid-cols-3 gap-5 mb-5 max-[700px]:grid-cols-1">
        <div className="flex flex-col gap-1.5 rounded-2xl border border-line/50 bg-panel2/45 p-4">
          <div className="text-gold font-bold text-sm">{t('dash.onboarding.step1')}</div>
          <div className="text-xs text-dim leading-relaxed">{t('dash.onboarding.step1Desc')}</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-line/50 bg-panel2/45 p-4">
          <div className="text-gold font-bold text-sm">{t('dash.onboarding.step2')}</div>
          <div className="text-xs text-dim leading-relaxed">{t('dash.onboarding.step2Desc')}</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-line/50 bg-panel2/45 p-4">
          <div className="text-gold font-bold text-sm">{t('dash.onboarding.step3')}</div>
          <div className="text-xs text-dim leading-relaxed">{t('dash.onboarding.step3Desc')}</div>
        </div>
      </div>
      <div className="relative flex items-center gap-3 pt-4 border-t border-line/70 flex-wrap">
        <span className="text-xs text-dim">{t('dash.onboarding.meanwhile')}</span>
        <button
          onClick={onGoChamp}
          className="text-xs px-3 py-1.5 rounded-xl bg-panel2/80 hover:bg-gold/15 hover:text-gold transition cursor-pointer"
        >
          {t('dash.onboarding.goChamp')}
        </button>
        <button
          onClick={onGoTier}
          className="text-xs px-3 py-1.5 rounded-xl bg-panel2/80 hover:bg-gold/15 hover:text-gold transition cursor-pointer"
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
        <div className="pointer-events-none absolute -left-10 -bottom-12 h-40 w-40 rounded-full bg-gold/8 blur-3xl" />
        <div className="relative shrink-0 w-24 h-24 rounded-[28px] grid place-items-center bg-panel2/70 border border-line/80 text-dim">
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
    <section className="relative overflow-hidden rounded-[30px] p-6 flex items-center gap-6 border border-gold/35 bg-gradient-to-br from-[#1b263b] via-[#111c2f] to-[#091428] shadow-[0_20px_58px_rgba(0,0,0,0.28),0_0_56px_rgba(200,170,110,0.09)]">
      <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-gold/10 blur-3xl" />
      <div className="shrink-0 w-24 h-24 rounded-[30px] grid place-items-center bg-[#0a1428]/80 border border-gold/70 text-gold shadow-[0_0_28px_rgba(200,170,110,0.22)]">
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
          <span className="text-[10px] text-dim border border-line/70 bg-panel/60 px-2 py-0.5 rounded-full">
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
        <button className="mt-3.5 px-4 py-2 bg-gradient-to-br from-[#f0e6d2] to-gold text-[#1d1709] rounded-2xl font-extrabold text-[13px] cursor-pointer hover:brightness-105 transition">
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
        <h3 className="text-[15px] font-bold shrink-0">{title}</h3>
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

  return (
    <section className={CARD + ' p-4'}>
      <PanelHead
        title="本版本变动"
        meta="ARAM 平衡数值 · 只显示修正最大的"
        action={
          <button onClick={onOpenPatchNotes} className="text-xs text-red hover:underline cursor-pointer shrink-0">
            完整更新日志 →
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
              title={`造成 ${fmtPct(b.dmgDealt)} · 承受 ${fmtPct(b.dmgTaken)}${
                b.healing != null ? ` · 治疗 ${fmtPct(b.healing)}` : ''
              }${b.shielding != null ? ` · 护盾 ${fmtPct(b.shielding)}` : ''}`}
              className="group flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div className="relative">
                <img src={icon(c.iconLocal)} alt={c.name} className="w-13 h-13 rounded-lg" />
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
  return (
    <section className={CARD + ' p-4'}>
      <PanelHead title="近期对局" />
      {!matches && <div className="text-xs text-dim py-2">暂无数据（需真机 Electron 窗口 + 本机对局记录）</div>}
      {matches && matches.length === 0 && <div className="text-xs text-dim py-2">本机暂无嚎哭深渊对局记录</div>}
      <div className="flex flex-col gap-2">
        {(matches ?? []).slice(0, 8).map((m) => {
          const c = champById.get(m.championId)
          if (!c) return null
          return (
            <button
              key={m.gameId}
              onClick={() => onPick(m.gameId)}
              title={`点击查看该局出装/海克斯 · 队内综合表现百分位 ${m.impactPercentile}%`}
              className={
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-panel2 border-l-[3px] cursor-pointer text-left ' +
                (m.win ? 'border-[#63c07a]' : 'border-red')
              }
            >
              <img src={icon(c.iconLocal)} alt={c.name} className="w-[34px] h-[34px] rounded-md" />
              <span className="text-[13px] flex-1">{c.name}</span>
              <span className="text-xs text-dim">
                {m.kills} / {m.deaths} / {m.assists}
              </span>
              <span className={'text-xs font-bold w-4 text-center ' + (m.win ? 'text-[#63c07a]' : 'text-red')}>
                {m.win ? '胜' : '负'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Achievements({ achievements }: { achievements: Achievement[] | null }) {
  return (
    <section className={CARD + ' p-4'}>
      <PanelHead title="新解锁" />
      {!achievements && <div className="text-xs text-dim py-2">暂无数据（需真机 Electron 窗口 + 本机对局记录）</div>}
      {achievements && achievements.length === 0 && (
        <div className="text-xs text-dim py-2">最近对局还没解锁成就，再打几场？</div>
      )}
      <div className="flex flex-col gap-2.5">
        {(achievements ?? []).map((a) => (
          <div
            key={a.key}
            className="flex items-center gap-3 p-3 rounded-xl border border-gold/25 bg-gradient-to-br from-gold/10 to-panel2"
          >
            <div className="text-2xl">{a.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#f6e9cb]">{a.name}</div>
              <div className="text-[11px] text-dim mt-0.5 leading-snug">{a.desc}</div>
            </div>
            <button className="px-3 py-1.5 bg-gold text-[#2b1e07] rounded-lg font-bold text-xs cursor-pointer hover:brightness-105">
              分享
            </button>
          </div>
        ))}
      </div>
    </section>
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

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD + ' p-5 mb-4'}>
      <h3 className="text-sm font-bold text-cream mb-4">{title}</h3>
      {children}
    </section>
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

function accountName(account: PersistedAccountSummary): string {
  if (!account.gameName) return `未知账号 · ${account.puuid.slice(-6)}`
  return account.tagLine ? `${account.gameName}#${account.tagLine}` : account.gameName
}

function fmtAccountDate(value?: string): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function SettingsTab({ summoner }: { summoner: SummonerInfo | null }) {
  const t = useT()
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
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={settings.zoomFactor}
            onChange={(e) => update('zoomFactor', parseFloat(e.target.value))}
            className="w-full mt-2 accent-gold"
          />
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

      <SettingsSection title={t('settings.account.title', '账号')}>
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
                      <span className="text-sm truncate">{accountName(account)}</span>
                      {account.isCurrent && (
                        <span className="text-[10px] px-1.5 py-px rounded bg-gold/15 text-gold shrink-0">{t('settings.account.current')}</span>
                      )}
                    </div>
                    <div className="text-xs text-dim mt-0.5">
                      {t('settings.account.matches', '{n} 场').replace('{n}', String(account.matchCount))} ·{' '}
                      {t('settings.account.detailsCached', '{n} 场详情缓存').replace('{n}', String(account.detailCount))} ·{' '}
                      {t('settings.account.lastMatch', '最近对局')} {fmtAccountDate(account.latestGameCreationDate)}
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
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string | null>(null)
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
    return [...filtered].sort((a, b) => {
      if (detectedChamp?.id === a.id) return -1
      if (detectedChamp?.id === b.id) return 1
      return (hasBuild(b.id) ? 1 : 0) - (hasBuild(a.id) ? 1 : 0)
    })
  }, [q, role, core, detectedChamp?.id])
  const done = Object.keys(core.buildIndex).length

  return (
    <>
      <ViewHead title="流派档案" meta={`Mayhem 推荐已覆盖 ${done} / ${core.champions.length}`} />
      <section className="relative mb-5 overflow-hidden rounded-[28px] border border-hex/25 bg-[linear-gradient(135deg,rgba(17,28,47,0.94),rgba(9,20,40,0.9))] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.24)]">
        <div className="pointer-events-none absolute -right-12 -top-20 h-44 w-44 rounded-full bg-hex/12 blur-3xl" />
        <div className="relative flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-hex">Champion-first archive</div>
            <h2 className="mt-2 text-2xl font-extrabold text-cream">
              {detectedChamp ? `当前识别：${detectedChamp.name}` : '等待选人，自动点亮当前英雄'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dim">
              这里不是普通英雄列表。优先查看已收录 Mayhem 流派的英雄；进入选人后，当前英雄会置顶并标出推荐是否就绪。
            </p>
          </div>
          {detectedChamp ? (
            <button
              onClick={() => onPick(detectedChamp.id)}
              className={
                'flex min-w-[260px] items-center gap-3 rounded-[22px] border p-3 text-left transition hover:-translate-y-0.5 cursor-pointer ' +
                (detectedHasBuild
                  ? 'border-gold/45 bg-gold/10 shadow-[0_0_34px_rgba(200,170,110,0.1)]'
                  : 'border-red/45 bg-red/10')
              }
            >
              <img
                src={icon(detectedChamp.iconLocal)}
                alt={detectedChamp.name}
                className="h-14 w-14 rounded-2xl border border-gold/40 object-cover"
              />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-cream">{detectedChamp.name}</div>
                <div className="mt-1 text-xs text-dim">
                  {detectedHasBuild ? '流派推荐已就绪，点击进入' : '还缺流派数据，优先补这个'}
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-[22px] border border-line/70 bg-panel/70 p-4 text-sm text-dim">
              打开客户端并进入 ARAM: Mayhem 选人后，副官会自动锁定你的英雄。
            </div>
          )}
        </div>
      </section>
      <input
        className={SEARCH}
        placeholder="搜英雄（支持拼音，试试 kasha 或 ks）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setRole(null)}
          className={
            'px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition ' +
            (role === null
              ? 'bg-gradient-to-br from-[#f0e6d2] to-gold text-[#1d1709] font-extrabold'
              : 'bg-panel/80 border border-line/70 text-dim hover:text-cream')
          }
        >
          全部
        </button>
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole((prev) => (prev === r.key ? null : r.key))}
            className={
              'px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition ' +
              (role === r.key
                ? 'bg-gradient-to-br from-[#f0e6d2] to-gold text-[#1d1709] font-extrabold'
                : 'bg-panel/80 border border-line/70 text-dim hover:text-cream')
            }
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(142px,1fr))] gap-3">
        {list.map((c) => {
          const has = hasBuild(c.id)
          const isDetected = detectedChamp?.id === c.id
          const tier = tierById.get(c.id)
          const primaryRole = ROLES.find((r) => c.roles.includes(r.key))?.label ?? c.roles[0]
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              title={has ? c.name : `${c.name}（暂无数据）`}
              className={
                'group relative overflow-hidden rounded-[22px] border p-3 text-left cursor-pointer transition hover:-translate-y-0.5 ' +
                (isDetected
                  ? 'bg-gold/12 border-gold/70 shadow-[0_0_34px_rgba(200,170,110,0.14)]'
                  : has
                    ? 'bg-panel/90 border-gold/35 hover:border-gold/75'
                    : 'bg-panel/60 border-line/60 hover:border-red/50 opacity-75')
              }
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-hex/0 blur-2xl transition group-hover:bg-hex/10" />
              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={icon(c.iconLocal)}
                    alt={c.name}
                    loading="lazy"
                    className="h-13 w-13 rounded-2xl border border-line/70 object-cover"
                  />
                  {has && (
                    <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-gold border-2 border-panel grid place-items-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2b1e07" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={'truncate text-sm font-extrabold ' + (has ? 'text-cream' : 'text-dim')}>{c.name}</div>
                  <div className="mt-1 truncate text-[11px] text-dim">{primaryRole}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {tier && <span className="rounded-full border border-gold/35 bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold">{tier}</span>}
                    {isDetected && <span className="rounded-full border border-hex/45 bg-hex/10 px-1.5 py-0.5 text-[10px] font-bold text-hex">当前</span>}
                  </div>
                </div>
              </div>
              <div className={'relative mt-3 rounded-xl border px-2 py-1.5 text-[11px] leading-tight ' + (has ? 'border-gold/25 bg-gold/8 text-gold' : 'border-line/60 bg-panel2/40 text-dim')}>
                {has ? 'Mayhem 推荐已就绪' : '待补充流派数据'}
              </div>
            </button>
          )
        })}
        {list.length === 0 && <div className="col-span-full p-11 text-center text-dim">没找到「{q}」</div>}
      </div>
    </>
  )
}

function AugmentBrowser({ core }: { core: Core }) {
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
      <ViewHead title="海克斯一览" meta={`${core.augments.length} 个增强`} />
      <input
        className={SEARCH}
        placeholder="搜海克斯（名称或效果）…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {groups.map((g) => (
        <div key={g.rarity} className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <span className={'w-2.5 h-2.5 rounded-full ' + g.meta.bg} />
            <span className={g.meta.text}>{g.meta.label}</span>
            <span className="text-xs text-dim font-normal">{g.items.length}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2.5">
            {g.items.map((a) => (
              <div
                key={a.id}
                title={a.desc}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-panel border border-line transition hover:-translate-y-0.5"
              >
                <div className={'w-14 h-14 rounded-md overflow-hidden border-2 ' + g.meta.border}>
                  <img src={icon(a.iconLargeLocal)} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-center leading-tight">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="p-11 text-center text-dim">没找到「{q}」</div>}
    </>
  )
}

/** 「更新日志」：官方 patch notes 摘要 + 海克斯大乱斗专属改动分开展示（人工翻译整理，见 data/patch-notes.json）。 */
function PatchNotesTab({ core, onPick }: { core: Core; onPick: (id: number) => void }) {
  const pn = core.patchNotes
  return (
    <>
      <ViewHead title="更新日志" meta={`补丁 ${pn.patch} · ${pn.releaseDate}`} />

      <section className={CARD + ' p-5 mb-5'}>
        <div className="text-xs text-dim mb-1">本次更新主题</div>
        <div className="text-lg font-bold text-cream">{pn.theme}</div>
        <a
          href={pn.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-red hover:underline mt-1 inline-block"
        >
          查看官方原文 ↗
        </a>
      </section>

      {/* 海克斯大乱斗专属改动放最前面——这是这个 App 的核心受众最关心的部分 */}
      <section className={CARD + ' p-5 mb-5 border-gold/30'}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔷</span>
          <h3 className="text-base font-bold text-gold">海克斯大乱斗专属改动</h3>
        </div>
        <p className="text-[13px] text-dim leading-relaxed mb-4">{pn.mayhem.summaryZh}</p>
        {pn.mayhem.augmentChanges.length > 0 && (
          <>
            <div className="text-[13px] font-semibold text-cream mb-2">海克斯增强调整</div>
            <div className="flex flex-col gap-1.5 mb-4">
              {pn.mayhem.augmentChanges.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px]">
                  <span className="text-cream font-medium shrink-0">{a.name}</span>
                  <span className="text-dim">— {a.change}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {pn.mayhem.bugfixes.length > 0 && (
          <>
            <div className="text-[13px] font-semibold text-cream mb-2">修复</div>
            <ul className="list-disc list-inside text-[13px] text-dim space-y-1">
              {pn.mayhem.bugfixes.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={CARD + ' p-5 mb-5'}>
        <h3 className="text-base font-bold text-cream mb-3">英雄改动</h3>
        <div className="grid grid-cols-2 gap-3">
          {pn.championChanges.map((c) => {
            const champ = core.champions.find((ch) => ch.id === c.championId)
            return (
              <button
                key={c.championId}
                onClick={() => champ && onPick(champ.id)}
                className="text-left flex gap-2.5 p-3 rounded-xl bg-panel2 border border-line hover:border-gold/40 transition cursor-pointer"
              >
                {champ && (
                  <img src={icon(champ.iconLocal)} alt={champ.name} className="w-9 h-9 rounded-md shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold mb-1">{c.championName}</div>
                  <ul className="text-[11px] text-dim leading-snug space-y-0.5 list-disc list-inside">
                    {c.changes.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {pn.itemChanges.length > 0 && (
        <section className={CARD + ' p-5 mb-5'}>
          <h3 className="text-base font-bold text-cream mb-3">装备改动</h3>
          <div className="flex flex-col gap-3">
            {pn.itemChanges.map((it, i) => (
              <div key={i}>
                <div className="text-sm font-semibold mb-1">{it.itemName}</div>
                <ul className="text-[12px] text-dim leading-snug space-y-0.5 list-disc list-inside">
                  {it.changes.map((line, j) => (
                    <li key={j}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {pn.systemChanges.length > 0 && (
        <section className={CARD + ' p-5'}>
          <h3 className="text-base font-bold text-cream mb-3">系统/功能更新</h3>
          <ul className="text-[13px] text-dim leading-relaxed space-y-1.5 list-disc list-inside">
            {pn.systemChanges.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// 从 S 到 D 做真正的视觉重量递减：横幅底色由暖变暗、图标尺寸由大变小、
// 发光强度由强变无——一眼"感受到"层级差，不是靠读文字/边框色才知道。
const TIER_META: Record<
  string,
  { banner: string; badgeBg: string; badgeText: string; iconSize: string; glow: string; nameSize: string }
> = {
  S: {
    banner: 'bg-gradient-to-r from-gold/25 via-gold/10 to-transparent border-gold/50',
    badgeBg: 'bg-gradient-to-br from-[#f5dea0] to-gold',
    badgeText: 'text-[#2b1e07]',
    iconSize: 'w-16 h-16',
    glow: 'shadow-[0_0_16px_rgba(226,178,78,0.45)] border-gold',
    nameSize: 'text-[12px] text-cream font-medium',
  },
  A: {
    banner: 'bg-gradient-to-r from-red/20 via-red/8 to-transparent border-red/40',
    badgeBg: 'bg-gradient-to-br from-[#ff8a70] to-red',
    badgeText: 'text-[#2b0f07]',
    iconSize: 'w-14 h-14',
    glow: 'shadow-[0_0_10px_rgba(224,70,63,0.35)] border-red/80',
    nameSize: 'text-[11px] text-cream',
  },
  B: {
    banner: 'bg-gradient-to-r from-[#57c3e8]/14 via-[#57c3e8]/5 to-transparent border-[#57c3e8]/30',
    badgeBg: 'bg-[#3a5a66]',
    badgeText: 'text-[#d8f3ff]',
    iconSize: 'w-12 h-12',
    glow: 'border-[#57c3e8]/60',
    nameSize: 'text-[11px] text-dim',
  },
  C: {
    banner: 'bg-panel border-line',
    badgeBg: 'bg-panel2',
    badgeText: 'text-dim',
    iconSize: 'w-11 h-11',
    glow: 'border-line',
    nameSize: 'text-[10px] text-dim',
  },
  D: {
    banner: 'bg-[#150b0d] border-[#2a1c1e]',
    badgeBg: 'bg-[#1c1214]',
    badgeText: 'text-[#6a5a5c]',
    iconSize: 'w-9 h-9',
    glow: 'border-[#2a1c1e] opacity-70',
    nameSize: 'text-[10px] text-[#6a5a5c]',
  },
}
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D']

function TierTab({ core, onPick }: { core: Core; onPick: (id: number) => void }) {
  const champById = useMemo(() => new Map(core.champions.map((c) => [c.id, c])), [core])
  const groups = TIER_ORDER.map((tier) => ({
    tier,
    meta: TIER_META[tier],
    entries: core.heroTier.filter((h) => h.tier === tier),
  })).filter((g) => g.entries.length > 0)

  return (
    <>
      <ViewHead
        title="英雄 Tier"
        meta={`人工评级 · 已收录 ${core.heroTier.length} / ${core.champions.length}，持续更新中`}
      />
      <div className="mb-5 text-xs text-dim leading-relaxed">
        没有走批量爬取/官方胜率 API（Mayhem 拿不到、第三方站点条款不允许规模化抓取）——这是编辑判断，
        参考公开信息交叉核对，不是某一家站点的数据。
      </div>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.tier} className={'rounded-2xl border p-4 ' + g.meta.banner}>
            <div className="flex items-start gap-4">
              <div
                className={
                  'shrink-0 w-11 h-11 rounded-xl grid place-items-center text-xl font-extrabold ' +
                  g.meta.badgeBg +
                  ' ' +
                  g.meta.badgeText
                }
              >
                {g.tier}
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {g.entries.map((h) => {
                  const c = champById.get(h.id)
                  if (!c) return null
                  return (
                    <button
                      key={h.id}
                      onClick={() => onPick(h.id)}
                      title={c.name}
                      className="flex flex-col items-center gap-1 cursor-pointer group"
                    >
                      <img
                        src={icon(c.iconLocal)}
                        alt={c.name}
                        className={`${g.meta.iconSize} rounded-lg border-2 transition group-hover:-translate-y-0.5 ${g.meta.glow}`}
                      />
                      <span className={g.meta.nameSize}>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
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
}: {
  core: Core
  championId: number
  onBack: () => void
  onPick: (id: number) => void
  selectedArchetypeKey?: string
  onArchetypePreference: (championId: number, archetypeKey: string) => void
}) {
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
      setBuild(null)
      return
    }
    setBuild(undefined)
    loadBuild(file).then(setBuild)
  }, [championId, core])

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
      <button className="text-hex text-sm cursor-pointer pb-3.5 hover:underline" onClick={onBack}>
        ← 返回流派档案
      </button>
      {champ && build && build.archetypes.length > 1 && (
        <section className="mb-5 rounded-[28px] border border-gold/40 bg-[linear-gradient(135deg,rgba(200,170,110,0.16),rgba(41,211,255,0.08),rgba(10,20,40,0.92))] p-4 shadow-[0_18px_54px_rgba(0,0,0,0.26),0_0_44px_rgba(200,170,110,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold">Pre-game route lock</div>
              <div className="mt-1 text-lg font-extrabold text-cream">选择这局 {champ.name} 要玩的流派</div>
              <div className="mt-1 text-xs leading-relaxed text-dim">
                这里选中的路线会立即同步到游戏内 overlay，之后再次拿到这个英雄也会默认使用它。
              </div>
            </div>
            {active && (
              <div className="rounded-2xl border border-hex/35 bg-hex/10 px-3 py-2 text-right">
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
                  'flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left cursor-pointer transition hover:-translate-y-0.5 ' +
                  (i === activeIdx
                    ? 'border-gold/80 bg-gradient-to-br from-[#f0e6d2] to-gold text-[#1d1709] shadow-[0_16px_38px_rgba(200,170,110,0.22)]'
                    : 'border-line/70 bg-panel/78 text-dim hover:border-hex/50 hover:text-cream')
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{a.name}</span>
                  <span className={i === activeIdx ? 'mt-1 block text-[11px] text-[#2b1e07]/75' : 'mt-1 block text-[11px] text-dim'}>
                    {i === activeIdx ? '本局 overlay 已锁定' : '点击设为本局路线'}
                  </span>
                </span>
                <span
                  className={
                    'shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-extrabold ' +
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
      {build === undefined && <div className="p-16 text-center text-dim">加载中…</div>}
      {build === null && (
        <div className="pt-5 pb-4">
          <div className={CARD + ' p-8 text-center'}>
            <div className="text-lg font-extrabold text-cream">「{champ?.name}」还没有 Mayhem 作战档案</div>
            <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-dim">
              这个状态会被视为补数据优先级信号。下一步应该补它的核心海克斯、陷阱增强和第一套推荐出装。
            </div>
            <div className="mt-2 text-xs text-dim/70">
              已收录 {covered.length + 1} / {core.champions.length} 位英雄，持续更新中
            </div>
          </div>
          {covered.length > 0 && (
            <div className="mt-10 max-w-2xl mx-auto">
              <div className="text-xs text-dim mb-3 text-center">已收录出装数据的英雄，先看看这些</div>
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
  const coreAugs = active?.augments.core.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const goodAugs = active?.augments.good.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const trapAugs = active?.augments.trap.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const firstItems = active?.items.map((ref) => core.itemById.get(ref.id)).filter((i): i is Item => !!i).slice(0, 4) ?? []
  const routeCount = build ? build.archetypes.length : 0

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-gold/30 bg-[linear-gradient(135deg,rgba(17,28,47,0.96),rgba(9,20,40,0.92))] p-6 shadow-[0_22px_68px_rgba(0,0,0,0.3),0_0_62px_rgba(200,170,110,0.08)]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute left-20 bottom-0 h-44 w-56 rounded-full bg-hex/8 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_360px] gap-6 max-[1000px]:grid-cols-1">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <img
              src={icon(champ.iconLocal)}
              alt={champ.name}
              className="h-24 w-24 rounded-[28px] border border-gold/45 object-cover shadow-[0_0_34px_rgba(200,170,110,0.16)]"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold">Mayhem combat file</div>
              <h1 className="mt-2 text-[38px] leading-none font-extrabold text-cream">{champ.name}</h1>
              <div className="mt-2 text-sm text-dim">{champ.title}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-line/70 bg-panel/70 px-3 py-1 text-xs text-dim">
                  {routeCount ? `${routeCount} 套路线` : '路线待补'}
                </span>
                {active && (
                  <span className="rounded-full border border-hex/35 bg-hex/10 px-3 py-1 text-xs font-bold text-hex">
                    当前：{active.name}
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

          <div className="mt-6 rounded-[24px] border border-hex/25 bg-hex/8 p-4">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-hex">Decision brief</div>
            <p className="mt-2 text-sm leading-7 text-cream">
              {active?.note || '这位英雄的 Mayhem 玩法还没有完成整理。优先补充它的核心增强、陷阱增强和出装顺序。'}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            <CombatRule
              label="看到核心"
              value={coreAugs.length > 0 ? '直接优先' : '待补数据'}
              detail={coreAugs[0] ? `${coreAugs[0].name} 是这条路线的第一信号` : '还没有核心增强判断'}
            />
            <CombatRule
              label="没有核心"
              value={goodAugs.length > 0 ? '拿备选' : '看装备'}
              detail={goodAugs[0] ? `备选增强优先找 ${goodAugs[0].name}` : '按推荐出装继续推进'}
            />
            <CombatRule
              label="遇到陷阱"
              value={trapAugs.length > 0 ? '谨慎避开' : '暂无陷阱'}
              detail={trapAugs[0] ? `${trapAugs[0].name} 与当前路线不匹配` : '这套路线还没有标记明显陷阱'}
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-line/70 bg-[#0a1428]/75 p-4 shadow-[inset_0_1px_0_rgba(240,230,210,0.06)]">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-dim">At a glance</div>
          <QuickAugLine label="优先拿" tone="core" items={coreAugs} />
          <QuickAugLine label="可备选" tone="good" items={goodAugs} />
          <QuickAugLine label="要避开" tone="trap" items={trapAugs} />
          <div className="mt-4 border-t border-line/60 pt-4">
            <div className="mb-2 text-xs font-bold text-dim">出装节奏</div>
            {firstItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {firstItems.map((it, idx) => (
                  <div key={it.id + '-' + idx} className="flex items-center gap-2">
                    <img src={icon(it.iconLocal)} alt={it.name} title={it.name} className="h-9 w-9 rounded-xl border border-line/80" />
                    {idx < firstItems.length - 1 && <span className="text-dim text-xs">→</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-dim">等待补充装备路线</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CombatRule({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-line/60 bg-panel/58 p-3">
      <div className="text-[11px] font-bold text-dim">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-cream">{value}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-dim">{detail}</div>
    </div>
  )
}

function AugmentDecisionLab({ arch, core }: { arch: Archetype; core: Core }) {
  const [queries, setQueries] = useState(['', '', ''])
  const [pickedIds, setPickedIds] = useState<Array<number | null>>([null, null, null])
  const [ownedQuery, setOwnedQuery] = useState('')
  const [ownedIds, setOwnedIds] = useState<number[]>([])
  const selected = pickedIds.map((id) => (id == null ? null : getAugment(core.augById, id)))
  const ownedAugments = ownedIds.map((id) => getAugment(core.augById, id)).filter((a): a is Augment => !!a)
  const decisions = selected
    .filter((a): a is Augment => !!a)
    .map((augment) => scoreAugmentPick(augment, arch, ownedAugments))
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
          <h3 className="mt-1 text-xl font-extrabold text-cream">三选一增强推荐器</h3>
          <p className="mt-2 text-sm leading-6 text-dim">
            先手动输入本轮出现的 3 个海克斯。人工核心/备选/陷阱会强覆盖，其余增强按标签规则评为 S/A/B/C/D。
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

        <div className="relative rounded-[28px] border border-line/70 bg-[#0a1428]/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-dim">Recommendation</div>
            <button onClick={clear} className="text-[11px] text-dim hover:text-cream cursor-pointer">
              清空
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
            <div className="mt-4 rounded-2xl border border-line/60 bg-panel/50 p-4 text-sm leading-6 text-dim">
              输入或选择三个增强后，这里会给出等级、排序和理由。
            </div>
          )}
        </div>
      </div>
    </section>
  )
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
  const needle = query.trim().toLowerCase()
  const suggestions = needle
    ? augments
        .filter((a) => a.name.includes(query.trim()) || a.apiName.toLowerCase().includes(needle) || a.desc.includes(query.trim()))
        .slice(0, 5)
    : []
  const picked = pickedId == null ? null : augments.find((a) => a.id === pickedId) ?? null

  return (
    <div className="rounded-[22px] border border-line/70 bg-panel/70 p-3">
      <label className="text-[11px] font-extrabold text-dim">选项 {idx + 1}</label>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="输入增强名称"
        className="mt-2 w-full rounded-2xl border border-line/70 bg-[#091428]/75 px-3 py-2 text-sm text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {picked && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-gold/25 bg-gold/8 p-2">
          <img src={icon(picked.iconLargeLocal)} alt={picked.name} className="h-8 w-8 rounded-xl border border-line object-cover" />
          <span className="min-w-0 truncate text-xs font-bold text-cream">{picked.name}</span>
        </div>
      )}
      {!picked && suggestions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={() => onPick(a)}
              className="flex items-center gap-2 rounded-2xl border border-line/50 bg-panel2/45 p-2 text-left transition hover:border-hex/50 cursor-pointer"
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
    <div className="mt-4 rounded-[24px] border border-hex/25 bg-hex/8 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-hex">本局已选增强</div>
          <div className="mt-1 text-[11px] text-dim">用于同标签叠加、核心路线确认和路线偏移判断</div>
        </div>
        {ownedAugments.length > 0 && (
          <span className="rounded-full border border-line/60 bg-panel/55 px-2 py-1 text-[10px] text-dim">
            {ownedAugments.length} 个
          </span>
        )}
      </div>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="添加已选增强"
        className="mt-3 w-full rounded-2xl border border-line/70 bg-[#091428]/75 px-3 py-2 text-sm text-cream outline-none transition placeholder:text-dim/55 focus:border-hex/70"
      />
      {suggestions.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 max-[780px]:grid-cols-1">
          {suggestions.map((a) => (
            <button
              key={a.id}
              onClick={() => onAdd(a)}
              className="flex items-center gap-2 rounded-2xl border border-line/50 bg-panel2/45 p-2 text-left transition hover:border-hex/50 cursor-pointer"
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
              onClick={() => onRemove(a.id)}
              className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/8 px-2 py-1 text-xs text-cream transition hover:border-red/45 hover:text-red cursor-pointer"
              title="点击移除"
            >
              <img src={icon(a.iconSmallLocal)} alt={a.name} className="h-4 w-4 rounded-full" />
              {a.name}
              <span className="text-dim">×</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-line/50 bg-panel/45 p-2 text-[11px] text-dim">
          还没有添加已选增强。添加后，右侧推荐会根据本局路线加权。
        </div>
      )}
    </div>
  )
}

function DecisionResult({ pick, rank, featured = false }: { pick: DecisionPick; rank: number; featured?: boolean }) {
  const tone =
    pick.tone === 'recommend'
      ? 'border-gold/45 bg-gold/10 text-gold'
      : pick.tone === 'good'
        ? 'border-hex/45 bg-hex/10 text-hex'
        : pick.tone === 'avoid'
          ? 'border-red/45 bg-red/10 text-red'
          : 'border-line/60 bg-panel/55 text-dim'
  return (
    <div className={'rounded-[22px] border p-3 ' + tone}>
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-[#091428]/65 text-xs font-extrabold">
          #{rank}
        </div>
        <img src={icon(pick.augment.iconLargeLocal)} alt={pick.augment.name} className="h-10 w-10 rounded-2xl border border-line/70 object-cover" />
        <div className="min-w-0 flex-1">
          <div className={(featured ? 'text-base' : 'text-sm') + ' truncate font-extrabold text-cream'}>{pick.augment.name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-full border border-current/35 bg-[#091428]/45 px-2 py-px text-[10px] font-extrabold">
              {pick.grade}
            </span>
            <span className="text-xs font-bold">{pick.label}</span>
            {pick.verified ? (
              <span className="rounded-full border border-[#3fb950]/40 bg-[#3fb950]/10 px-1.5 py-px text-[9px] font-bold text-[#3fb950]">
                ✓ 人工核实
              </span>
            ) : (
              <span className="rounded-full border border-line/60 bg-panel/55 px-1.5 py-px text-[9px] font-bold text-dim">
                ⚠ 规则猜测·未核实
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-relaxed text-dim">{pick.reason}</div>
      {pick.comboNotes.length > 0 && (
        <div className="mt-2 rounded-2xl border border-hex/20 bg-hex/8 px-2.5 py-2 text-[11px] leading-relaxed text-hex">
          {pick.comboNotes.join(' · ')}
        </div>
      )}
      {pick.tags.length > 0 && (
        <div className="mt-2 text-[10px] text-dim/70">
          标签命中：{pick.tags.slice(0, 4).map(augmentTagLabel).join(' · ')}
        </div>
      )}
    </div>
  )
}

function QuickAugLine({ label, tone, items }: { label: string; tone: 'core' | 'good' | 'trap'; items: Augment[] }) {
  const toneClass =
    tone === 'core'
      ? 'text-gold border-gold/25 bg-gold/8'
      : tone === 'good'
        ? 'text-hex border-hex/25 bg-hex/8'
        : 'text-red border-red/25 bg-red/8'
  return (
    <div className="mt-4">
      <div className={'mb-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ' + toneClass}>
        {label}
      </div>
      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.slice(0, 3).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-2xl border border-line/55 bg-panel/55 px-2.5 py-2">
              <img src={icon(a.iconLargeLocal)} alt={a.name} className="h-8 w-8 shrink-0 rounded-xl border border-line/70 object-cover" />
              <span className="min-w-0 truncate text-xs font-bold text-cream">{a.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line/55 bg-panel/40 px-2.5 py-2 text-xs text-dim">暂无</div>
      )}
    </div>
  )
}

function PlayerRow({ p, core, maxDamage }: { p: PlayerMatchStats; core: Core; maxDamage: number }) {
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
        <div className="text-[13px] truncate">{champ?.name ?? '未知英雄'}</div>
        <div className="text-[11px] text-dim truncate">{p.summonerName}</div>
      </div>
      <div className="w-16 shrink-0 text-xs text-center">
        {p.kills} / {p.deaths} / {p.assists}
      </div>
      <div className="flex-1 min-w-[100px]">
        <div className="flex items-center justify-between text-[11px] text-dim mb-0.5">
          <span>伤害</span>
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
  const maxDamage = Math.max(...detail.players.map((p) => p.totalDamageDealtToChampions), 1)
  const ally = detail.players.filter((p) => p.team === 'ally')
  const enemy = detail.players.filter((p) => p.team === 'enemy')
  return (
    <>
      <section className={CARD + ' p-4'}>
        <div className={'text-xs font-semibold mb-2 ' + (detail.win ? 'text-[#63c07a]' : 'text-red')}>
          己方 · {detail.win ? '胜利' : '失败'}
        </div>
        <div className="flex flex-col gap-1.5">
          {ally.map((p) => (
            <PlayerRow key={p.participantId} p={p} core={core} maxDamage={maxDamage} />
          ))}
        </div>
      </section>
      <section className={CARD + ' p-4 mt-3'}>
        <div className={'text-xs font-semibold mb-2 ' + (detail.win ? 'text-red' : 'text-[#63c07a]')}>
          对面 · {detail.win ? '失败' : '胜利'}
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
  return (
    <section className={CARD + ' p-4 overflow-x-auto'}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="text-dim text-left border-b border-line">
            <th className="py-2 pr-3 font-semibold">玩家</th>
            <th className="py-2 px-2 text-center font-semibold">等级</th>
            <th className="py-2 px-2 text-center font-semibold">KDA</th>
            <th className="py-2 px-2 text-right font-semibold">伤害输出</th>
            <th className="py-2 px-2 text-right font-semibold">承受伤害</th>
            <th className="py-2 px-2 text-right font-semibold">治疗</th>
            <th className="py-2 px-2 text-right font-semibold">补刀</th>
            <th className="py-2 px-2 text-right font-semibold">视野分</th>
            <th className="py-2 pl-2 text-right font-semibold">金币</th>
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
  const points = detail.goldGraph
  if (points.length < 2) {
    return <div className={CARD + ' p-8 text-center text-xs text-dim'}>对局太短，没有足够的经济曲线数据</div>
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
            己方领先
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red inline-block" />
            对面领先
          </span>
        </div>
        <div className={'text-sm font-bold ' + (finalDiff >= 0 ? 'text-[#63c07a]' : 'text-red')}>
          终局经济差 {fmtGold(finalDiff)}
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
          ← 返回主页
        </button>
        <div className="p-16 text-center text-dim">找不到这局的数据</div>
      </>
    )
  }
  const champ = core.champions.find((c) => c.id === match.championId)
  const allyScore = detail ? detail.players.filter((p) => p.team === 'ally').reduce((s, p) => s + p.kills, 0) : null
  const enemyScore = detail ? detail.players.filter((p) => p.team === 'enemy').reduce((s, p) => s + p.kills, 0) : null

  return (
    <>
      <button className="text-red text-sm cursor-pointer pb-3.5 hover:underline" onClick={onBack}>
        ← 返回主页
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
                {match.win ? '胜利' : '失败'}
              </span>
              {allyScore != null && enemyScore != null && (
                <span className="text-sm font-bold text-dim">
                  {allyScore} : {enemyScore}
                </span>
              )}
            </div>
            <p className="text-[13px] text-dim mt-1">
              {match.kills} / {match.deaths} / {match.assists} · 队内综合表现百分位 {match.impactPercentile}%
              {' · '}
              {new Date(match.gameCreationDate).toLocaleString('zh-CN')}
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

      {detail === undefined && <div className="p-11 text-center text-dim text-sm">加载完整对局详情中…</div>}
      {detail === null && (
        <div className="p-11 text-center text-dim text-sm">
          需要在真正的 Mayhempedia 客户端窗口里运行才能拉取完整对局详情(浏览器预览下不可用)。
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
  return (
    <section className={CARD + ' mt-[18px] p-5'}>
      <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-hex/8 blur-3xl" />
      <div className="relative flex items-center gap-2.5 mb-3.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-dim">Full tactical readout</span>
      </div>
      <div className="relative flex flex-wrap items-center gap-2.5">
        <span className="text-[22px] font-extrabold">{arch.name}</span>
        <span
          className={
            'text-xs font-semibold px-2.5 py-1 rounded-full ' +
            (arch.damageType === 'AP' ? 'text-[#c9a3f0] bg-[#9664dc]/18' : 'text-[#f0a97a] bg-[#dc8246]/18')
          }
        >
          {arch.damageType}
        </span>
      </div>
      {arch.note && <p className="relative mt-2 max-w-3xl text-[13px] text-dim leading-relaxed">{arch.note}</p>}

      <div className="relative text-[13px] font-semibold text-dim mb-2.5 mt-5">海克斯选择</div>
      <div className="relative flex flex-col gap-3">
        <AugTier label="核心" tone="core" refs={arch.augments.core} augById={augById} />
        <AugTier label="备选" tone="good" refs={arch.augments.good} augById={augById} />
        {arch.augments.trap.length > 0 && (
          <AugTier label="陷阱" tone="trap" refs={arch.augments.trap} augById={augById} />
        )}
      </div>

      <div className="relative text-[13px] font-semibold text-dim mb-2.5 mt-5">推荐出装</div>
      <div className="relative flex flex-wrap items-center gap-2">
        {arch.items.map((ref, idx) => {
          const it = itemById.get(ref.id)
          if (!it) return null
          return (
            <div key={ref.id} className="flex items-center gap-1.5">
              <div className="w-[78px] rounded-2xl border border-line/60 bg-panel2/40 p-2 flex flex-col items-center" title={it.desc}>
                <img src={icon(it.iconLocal)} alt={it.name} className="w-12 h-12 rounded-xl border border-line" />
                <span className="mt-1.5 text-[11px] text-center leading-tight text-dim">{it.name}</span>
              </div>
              {idx < arch.items.length - 1 && <span className="text-dim text-[13px]">→</span>}
            </div>
          )
        })}
      </div>

      {arch.sources && arch.sources.length > 0 && (
        <div className="relative mt-5 pt-3 border-t border-line/70 text-[11px] text-dim/70">
          数据来源：{arch.sources.join(' · ')} · 人工交叉核对，非实时胜率数据
        </div>
      )}
    </section>
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
    <div className="rounded-[22px] border border-line/60 bg-panel2/35 p-3">
      <div className={'mb-3 text-[13px] font-extrabold ' + TONE_LABEL[tone]}>{label}</div>
      <div className="flex flex-wrap gap-3">
        {refs.map((ref) => {
          const a = getAugment(augById, ref.id)
          if (!a) return null
          const r = RARITY[a.rarity] ?? RARITY[0]
          return (
            <div key={ref.id} title={a.desc} className="w-[92px] flex flex-col items-center">
              <div
                className={
                  'w-[62px] h-[62px] rounded-2xl overflow-hidden border-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)] ' +
                  r.border +
                  (tone === 'core' ? ' ring-2 ring-gold' : '') +
                  (tone === 'trap' ? ' opacity-70' : '')
                }
              >
                <img src={icon(a.iconLargeLocal)} alt={a.name} className="w-full h-full object-cover" />
              </div>
              <span className="mt-1.5 text-xs text-center leading-tight">{a.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
