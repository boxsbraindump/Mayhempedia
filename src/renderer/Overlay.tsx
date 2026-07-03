// M3：静态流派副官——overlay 里显示 LCU 自动识别到的英雄对应的出装+海克斯分级清单。
// 按 BRAINSTORM.md M3 的范围：只做"瞄一眼清单自己点"的静态展示，不做 CV 自动框住(那是 V2)。
// ⚠️ 设计边界：overlay 窗口默认点击穿透(setIgnoreMouseEvents)，鼠标事件不会落到这个页面上——
// 所以这里不做任何需要点击的交互(比如切换流派)，多套玩法时固定显示第一套，
// 想看其他流派/完整介绍去主 companion 窗口那边点。

import { useEffect, useState } from 'react'
import { isElectron, type LcuStatus, type OverlayCollapsedState, type OverlayLockState, type Settings } from './lcu'
import { loadCore, loadBuild, getAugment, icon, type Core, type Build, type Augment, type Item } from './data'

const RARITY: Record<number, { border: string; glow: string }> = {
  0: { border: 'border-[#a7b0be]', glow: 'shadow-[0_0_18px_rgba(167,176,190,0.14)]' },
  1: { border: 'border-gold', glow: 'shadow-[0_0_20px_rgba(200,170,110,0.20)]' },
  2: { border: 'border-hex', glow: 'shadow-[0_0_22px_rgba(41,211,255,0.22)]' },
  4: { border: 'border-[#b98cf0]', glow: 'shadow-[0_0_20px_rgba(185,140,240,0.18)]' },
}

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// 图标很多长得像，点击穿透又让 hover 提示(title)根本没机会触发——名字必须常显，不能指望 hover。
function AugColumn({
  label,
  tone,
  refs,
  augById,
}: {
  label: string
  tone: 'core' | 'good' | 'trap'
  refs: Augment['id'][]
  augById: Core['augById']
}) {
  const augs = refs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  // overlay 窗口固定高度、默认点击穿透不能滚动，不能无限撑高——超过3个只挑前3个展示，
  // 但绝不能悄悄丢掉，剩下的必须留一行"+N"提示，不然等于我们自己的数据被程序砍掉一半。
  const SHOWN = tone === 'trap' ? 2 : 2
  const shown = augs.slice(0, SHOWN)
  const hiddenCount = augs.length - shown.length
  const toneClass = tone === 'core' ? 'text-gold' : tone === 'good' ? 'text-hex' : 'text-red'
  return (
    <div>
      <div className={'mb-1 text-[10px] font-extrabold ' + toneClass}>{label}</div>
      {shown.length > 0 ? (
        <div className={tone === 'trap' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-1'}>
          {shown.map((a) => {
            const r = RARITY[a.rarity] ?? RARITY[0]
            return (
              <div key={a.id} title={`${a.name}\n${plainText(a.desc || a.tooltip)}`} className={tone === 'trap' ? 'flex max-w-[160px] min-w-0 items-center gap-1.5' : 'flex min-w-0 items-center gap-2'}>
                <img
                  src={icon(a.iconLargeLocal)}
                  alt={a.name}
                  className={(tone === 'trap' ? 'h-6 w-6 ' : 'h-8 w-8 ') + 'shrink-0 rounded-md border object-cover ' + r.border + ' ' + r.glow}
                />
                <span className={(tone === 'trap' ? 'text-[11px]' : 'text-[13px]') + ' truncate font-extrabold leading-tight text-cream'}>{a.name}</span>
              </div>
            )
          })}
          {hiddenCount > 0 && <div className="text-[10px] font-bold opacity-70">+{hiddenCount}</div>}
        </div>
      ) : (
        <div className="text-[11px] text-dim">暂无</div>
      )}
    </div>
  )
}

function AugmentPool({
  coreRefs,
  goodRefs,
  augById,
  compact = false,
}: {
  coreRefs: Augment['id'][]
  goodRefs: Augment['id'][]
  augById: Core['augById']
  compact?: boolean
}) {
  const coreAugs = coreRefs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  const goodAugs = goodRefs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  const merged = [...coreAugs, ...goodAugs.filter((a) => !coreAugs.some((core) => core.id === a.id))]
  const SHOWN = 5
  const pool = merged.slice(0, SHOWN)
  const hiddenCount = merged.length - pool.length
  const priorityId = coreAugs[0]?.id

  if (pool.length === 0) return null
  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      {!compact && <div className="mb-1 text-[10px] font-extrabold text-gold">推荐海克斯</div>}
      <div className={compact ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-wrap items-center gap-2'}>
        {pool.map((a) => {
          const r = RARITY[a.rarity] ?? RARITY[0]
          const priority = a.id === priorityId
          return (
            <div
              key={a.id}
              title={`${a.name}\n${plainText(a.desc || a.tooltip)}`}
              className={(compact ? 'w-[66px] flex-col items-center gap-0.5' : 'w-[104px] items-center gap-1.5') + ' flex min-w-0'}
            >
              <span className={priority ? 'rounded-lg border-2 border-gold p-0.5 shadow-[0_0_18px_rgba(200,170,110,0.34)]' : ''}>
                <img
                  src={icon(a.iconLargeLocal)}
                  alt={a.name}
                  className={(compact ? 'h-7 w-7 ' : 'h-8 w-8 ') + 'rounded-md border object-cover ' + r.border + ' ' + r.glow}
                />
              </span>
              <span
                className={
                  (compact ? 'max-w-[64px] text-center text-[9px]' : 'text-[12px]') +
                  (priority ? ' truncate font-extrabold text-gold' : ' truncate font-bold text-cream')
                }
              >
                {a.name}
              </span>
            </div>
          )
        })}
        {hiddenCount > 0 && (
          <span className={(compact ? 'text-[9px]' : 'text-[11px]') + ' font-bold text-dim opacity-70'}>
            +{hiddenCount} 更多 · 主页看完整清单
          </span>
        )}
      </div>
    </div>
  )
}

function ItemRail({ items }: { items: Item[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-extrabold text-dim">出装</span>
        <span className="text-[8px] text-dim/70">顺序</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {items.slice(0, 5).map((it, idx) => (
          <div key={it.id + '-' + idx} className="flex items-center gap-1">
            <img
              src={icon(it.iconLocal)}
              alt={it.name}
              title={`${it.name}\n${plainText(it.desc)}`}
              className="h-8 w-8 rounded-md border border-line/70 object-cover shadow-[0_0_12px_rgba(0,0,0,0.28)]"
            />
            {idx < items.slice(0, 5).length - 1 && <span className="text-[11px] text-dim">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function CompactItemRail({ items }: { items: Item[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {items.slice(0, 5).map((it, idx) => (
        <div key={it.id + '-' + idx} className="flex items-center gap-1">
          <img
            src={icon(it.iconLocal)}
            alt={it.name}
            title={`${it.name}\n${plainText(it.desc)}`}
            className="h-7 w-7 rounded-md border border-line/70 object-cover"
          />
          {idx < items.slice(0, 5).length - 1 && <span className="text-[10px] text-dim">→</span>}
        </div>
      ))}
    </div>
  )
}

function BuildPanel({
  core,
  championId,
  selectedArchetypeKey,
  collapsed,
  locked,
  onToggleCollapsed,
}: {
  core: Core
  championId: number
  selectedArchetypeKey?: string
  collapsed: boolean
  locked: boolean
  onToggleCollapsed: () => void
}) {
  const champ = core.champions.find((c) => c.id === championId)
  const [build, setBuild] = useState<Build | null | undefined>(undefined)

  useEffect(() => {
    const file = core.buildIndex[championId]
    if (!file) {
      setBuild(null)
      return
    }
    setBuild(undefined)
    loadBuild(file).then(setBuild)
  }, [championId, core])

  if (!champ) return null
  const arch = build?.archetypes.find((a) => a.key === selectedArchetypeKey) ?? build?.archetypes[0]
  const items = arch?.items.map((ref) => core.itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  const coreAugs = arch?.augments.core.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <img
            src={icon(champ.iconLocal)}
            alt={champ.name}
            className="h-10 w-10 rounded-[14px] border border-gold/55 object-cover shadow-[0_0_22px_rgba(200,170,110,0.18)]"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#091428] bg-hex shadow-[0_0_14px_rgba(41,211,255,0.7)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-extrabold leading-tight text-cream">{champ.name}</div>
          {arch && <div className="truncate text-[12px] font-extrabold text-hex">{arch.name}</div>}
        </div>
        {!locked && (
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? '展开 HUD' : '折叠 HUD'}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="grid h-7 w-7 place-items-center rounded-full border border-line/70 bg-panel/60 text-dim transition hover:border-gold/60 hover:text-gold"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={collapsed ? 'rotate-180 transition-transform' : 'transition-transform'}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {build === undefined && <div className="mt-2 text-[11px] text-dim">加载流派中…</div>}
      {build === null && (
        <div className="mt-3 rounded-2xl border border-red/30 bg-red/10 p-3 text-[11px] leading-relaxed text-dim">
          暂无「{champ.name}」的 Mayhem 作战档案。先按常规出装，下一轮优先补这个英雄。
        </div>
      )}
      {arch && (
        <>
          {collapsed ? (
            <div>
              <AugmentPool
                coreRefs={arch.augments.core.map((r) => r.id)}
                goodRefs={arch.augments.good.map((r) => r.id)}
                augById={core.augById}
                compact
              />
              <CompactItemRail items={items} />
            </div>
          ) : (
            <>
          <AugmentPool
            coreRefs={arch.augments.core.map((r) => r.id)}
            goodRefs={arch.augments.good.map((r) => r.id)}
            augById={core.augById}
          />
          <div className="mt-1.5">
            <AugColumn label="谨慎避开" tone="trap" refs={arch.augments.trap.map((r) => r.id)} augById={core.augById} />
          </div>
          <div className="mt-1.5">
            <ItemRail items={items} />
          </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function Overlay() {
  const [lcuStatus, setLcuStatus] = useState<LcuStatus | null>(null)
  const [activeChampionId, setActiveChampionId] = useState<number | null>(null)
  const [core, setCore] = useState<Core | null>(null)
  const [locked, setLocked] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    loadCore().then(setCore)
  }, [])

  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.onLcuStatus(setLcuStatus)
    window.mayhem!.onChampSelect((s) => {
      if (s.myChampionId) setActiveChampionId(s.myChampionId)
    })
    window.mayhem!.onOverlayLock((s: OverlayLockState) => setLocked(s.locked))
    window.mayhem!.onOverlayCollapsed((s: OverlayCollapsedState) => setCollapsed(s.collapsed))
    window.mayhem!.getSettings().then(setSettings)
    window.mayhem!.onSettingsChanged(setSettings)
  }, [])

  return (
    <div className="p-2">
      <div
        className={
          'relative w-[368px] overflow-hidden rounded-[22px] border p-3 text-cream shadow-[0_18px_46px_rgba(0,0,0,0.42),0_0_34px_rgba(41,211,255,0.10)] bg-[#091428e6] backdrop-blur-xl ' +
          (locked ? 'border-gold/45' : 'border-hex border-dashed cursor-move')
        }
        style={locked ? undefined : ({ WebkitAppRegion: 'drag' } as React.CSSProperties)}
      >
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="pointer-events-none absolute -right-12 -top-16 h-28 w-28 rounded-full bg-hex/14 blur-3xl" />
        <div className="pointer-events-none absolute -left-14 bottom-0 h-24 w-24 rounded-full bg-gold/12 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(240,230,210,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(240,230,210,0.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        {!locked && (
          <div className="relative mb-1.5 rounded-xl border border-hex/40 bg-hex/10 px-2 py-1 text-[10px] font-semibold text-hex">
            拖动此面板调整位置 · Ctrl+Shift+L 锁定
          </div>
        )}
        <div className="hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xl border border-gold/45 bg-gold/10 text-gold shadow-[0_0_20px_rgba(200,170,110,0.14)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2.5l8.5 4.9v9.2L12 21.5 3.5 16.6V7.4z" />
                <path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z" />
              </svg>
            </span>
            <div>
              <div className="text-xs font-extrabold tracking-wide">
                Mayhem<span className="text-gold">pedia</span>
              </div>
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-dim">Hextech field unit</div>
            </div>
          </div>
          <span className="rounded-full border border-line/60 bg-panel/55 px-2 py-1 text-[9px] font-bold text-dim">
            Ctrl+Shift+X
          </span>
        </div>
        <div className="hidden">
          <div className="flex items-center gap-1.5 text-[10px] text-dim">
            <span
              className={
                'w-2 h-2 rounded-full shrink-0 shadow-[0_0_14px_currentColor] ' +
                (lcuStatus?.state === 'connected'
                  ? 'bg-[#4bd07a]'
                  : lcuStatus?.state === 'error'
                    ? 'bg-red'
                    : 'bg-gold animate-pulse')
              }
            />
            <span className="font-bold">
              {lcuStatus
                ? lcuStatus.state === 'connected'
                  ? '客户端在线'
                  : lcuStatus.state === 'error'
                    ? '连接失败'
                    : '连接中'
                : '等待客户端'}
            </span>
            <span className="ml-auto text-[9px] text-dim/70">
              {activeChampionId ? '推荐就绪' : '等待选人'}
            </span>
          </div>
        </div>

        {core && activeChampionId ? (
          <BuildPanel
            core={core}
            championId={activeChampionId}
            selectedArchetypeKey={settings?.selectedArchetypeByChampionId[String(activeChampionId)]}
            collapsed={collapsed}
            locked={locked}
            onToggleCollapsed={() => setCollapsed((current) => !current)}
          />
        ) : (
          <div className="relative mt-3 rounded-[22px] border border-hex/25 bg-hex/8 p-3 text-xs leading-relaxed text-dim">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-hex">Standby</div>
            进入 ARAM: Mayhem 选人后，我会锁定你的英雄，并显示本局路线、核心增强、陷阱增强和出装节奏。
          </div>
        )}
      </div>
    </div>
  )
}
