// M3：静态流派副官——overlay 里显示 LCU 自动识别到的英雄对应的出装+海克斯分级清单。
// 按 BRAINSTORM.md M3 的范围：只做"瞄一眼清单自己点"的静态展示，不做 CV 自动框住(那是 V2)。
// ⚠️ 设计边界：overlay 窗口默认点击穿透(setIgnoreMouseEvents)，鼠标事件不会落到这个页面上——
// 所以这里不做任何需要点击的交互(比如切换流派)，多套玩法时固定显示第一套，
// 想看其他流派/完整介绍去主 companion 窗口那边点。

import { useEffect, useState } from 'react'
import { isElectron, type OverlayCollapsedState, type OverlayLockState, type Settings, type CustomRoute } from './lcu'
import { loadCore, loadBuild, withCustomRoutes, getAugment, icon, type Core, type Build, type Augment, type Item } from './data'
import { LangProvider, useLang, useT } from './i18n'

const CUSTOM_ROUTES_ENABLED = true

const RARITY: Record<number, { border: string; glow: string }> = {
  0: { border: 'border-[#a7b0be]', glow: 'shadow-[0_0_18px_rgba(167,176,190,0.14)]' },
  1: { border: 'border-gold', glow: 'shadow-[0_0_20px_rgba(200,170,110,0.20)]' },
  2: { border: 'border-hex', glow: 'shadow-[0_0_22px_rgba(41,211,255,0.22)]' },
  4: { border: 'border-[#b98cf0]', glow: 'shadow-[0_0_20px_rgba(185,140,240,0.18)]' },
}

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
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

// 图标很多长得像，点击穿透又让 hover 提示(title)根本没机会触发——名字必须常显，不能指望 hover。
function AugmentRail({
  label,
  tone,
  refs,
  augById,
}: {
  label: string
  tone: 'core' | 'good'
  refs: Augment['id'][]
  augById: Core['augById']
}) {
  const t = useT()
  const augs = refs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  const toneClass = tone === 'core' ? 'text-gold' : 'text-hex'
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-start gap-2 py-2">
      <div className={'pt-1 text-[10px] font-extrabold ' + toneClass}>{label}</div>
      {augs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {augs.map((a) => {
            const r = RARITY[a.rarity] ?? RARITY[0]
            return (
              <div key={a.id} title={`${a.name}\n${plainText(a.desc || a.tooltip)}`} className="flex min-h-8 w-fit max-w-[168px] items-center gap-1.5 rounded-md border border-line/55 bg-panel/35 px-1.5 py-1">
                <img
                  src={icon(a.iconLargeLocal)}
                  alt={a.name}
                  className={'h-6 w-6 shrink-0 rounded border object-cover ' + r.border + ' ' + r.glow}
                />
                <span className="break-words text-[10px] font-extrabold leading-[12px] text-cream">{a.name}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="pt-1 text-[11px] text-dim">{t('common.none')}</div>
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
  const t = useT()
  const coreAugs = coreRefs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  const goodAugs = goodRefs.map((id) => getAugment(augById, id)).filter((a): a is Augment => !!a)
  const merged = [...coreAugs, ...goodAugs.filter((a) => !coreAugs.some((core) => core.id === a.id))]
  const SHOWN = compact ? 4 : 5
  const capped = merged.slice(0, SHOWN)
  // compact 模式下若有溢出，留一格给 "+N" 徽标、只显示前3个。
  const shownPool = compact && merged.length > SHOWN ? capped.slice(0, 3) : capped
  // ⚠️ hiddenCount 必须从真正渲染的 shownPool 算，不能从 capped 算——否则二次截断掉的那个海克斯
  // 会既不显示、又不计入"+N"，凭空消失(违反同文件 AugColumn 里"绝不能悄悄丢掉"的注释保证)。
  const hiddenCount = merged.length - shownPool.length
  const coreIds = new Set(coreAugs.map((a) => a.id))

  if (shownPool.length === 0) return null
  return (
    <div className={compact ? 'mt-2 rounded-[8px] border border-line/55 bg-panel/45 p-2' : 'mt-3'}>
      {!compact && <div className="mb-1 text-[10px] font-extrabold text-gold">{t('overlay.recommended')}</div>}
      <div className={compact ? 'grid grid-cols-4 items-start gap-1.5' : 'grid grid-cols-3 items-start gap-x-2 gap-y-1.5'}>
        {shownPool.map((a) => {
          const r = RARITY[a.rarity] ?? RARITY[0]
          const priority = coreIds.has(a.id)
          return (
            <div
              key={a.id}
              title={`${a.name}\n${plainText(a.desc || a.tooltip)}`}
              className={(compact ? 'w-full flex-col items-center gap-0.5' : 'grid h-[42px] grid-cols-[38px_minmax(0,1fr)] items-center gap-1.5') + ' min-w-0'}
            >
              <span
                className={
                  (compact ? '' : 'grid h-[38px] w-[38px] place-items-center rounded-lg ') +
                  (priority ? 'border-2 border-gold p-0.5 shadow-[0_0_18px_rgba(200,170,110,0.34)]' : '')
                }
              >
                <img
                  src={icon(a.iconLargeLocal)}
                  alt={a.name}
                  className={(compact ? 'h-7 w-7 ' : 'h-8 w-8 ') + 'shrink-0 rounded-md border object-cover ' + r.border + ' ' + r.glow}
                />
              </span>
              <span
                className={
                  (compact
                    ? 'block w-full truncate text-center text-[9px] leading-[11px]'
                    : 'block h-[34px] min-w-0 overflow-hidden pt-1 text-[12px] leading-[13px] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]') +
                  (priority ? ' font-extrabold text-gold' : ' font-bold text-cream')
                }
              >
                {a.name}
              </span>
            </div>
          )
        })}
        {hiddenCount > 0 && (
          <span className={(compact ? 'grid h-[48px] place-items-center rounded-md border border-line/50 bg-panel2/50 text-center text-[9px]' : 'grid h-[42px] place-items-center rounded-lg border border-line/50 bg-panel2/45 text-center text-[11px]') + ' font-bold text-dim opacity-70'}>
            {t('overlay.moreInHome', { n: hiddenCount })}
          </span>
        )}
      </div>
    </div>
  )
}

function ItemRail({ items }: { items: Item[] }) {
  const t = useT()
  if (items.length === 0) return null
  const visibleItems = stackItems(items).slice(0, 6)
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-start gap-2 py-2">
      <div className="pt-1 text-[10px] font-extrabold text-hex">{t('overlay.items')}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleItems.map((it, idx) => (
          <div key={it.id + '-' + idx} className="flex items-center gap-1">
            <span className="relative block">
              <img
                src={icon(it.iconLocal)}
                alt={it.name}
                title={`${it.name}\n${plainText(it.desc)}`}
                className="h-7 w-7 rounded-md border border-line/70 object-cover shadow-[0_0_12px_rgba(0,0,0,0.28)]"
              />
              {it.count > 1 && (
                <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-[#091428] bg-gold px-1 text-[9px] font-extrabold leading-none text-[#091428]">
                  {it.count}
                </span>
              )}
            </span>
            {idx < visibleItems.length - 1 && <span className="text-[11px] text-dim">-&gt;</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function StarterRail({ items }: { items: Item[] }) {
  const t = useT()
  if (items.length === 0) return null
  const visibleItems = stackItems(items)
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-start gap-2 py-2">
      <div className="pt-1 text-[10px] font-extrabold text-gold">{t('overlay.starterItems')}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleItems.map((it, idx) => (
          <span key={it.id + '-' + idx} className="relative block">
            <img
              src={icon(it.iconLocal)}
              alt={it.name}
              title={`${it.name}\n${plainText(it.desc)}`}
              className="h-7 w-7 rounded-md border border-gold/55 object-cover"
            />
            {it.count > 1 && (
              <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-[#091428] bg-gold px-1 text-[9px] font-extrabold leading-none text-[#091428]">
                {it.count}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function CompactItemRail({ items }: { items: Item[] }) {
  if (items.length === 0) return null
  const visibleItems = items.slice(0, 6)
  return (
    <div className="mt-2 rounded-[8px] border border-line/55 bg-panel/35 p-2">
    <div className="grid grid-cols-[repeat(6,1fr)] items-center gap-1">
      {visibleItems.map((it, idx) => (
        <div key={it.id + '-' + idx} className="flex min-w-0 items-center justify-center gap-1">
          <img
            src={icon(it.iconLocal)}
            alt={it.name}
            title={`${it.name}\n${plainText(it.desc)}`}
            className="h-7 w-7 shrink-0 rounded-md border border-line/70 object-cover"
          />
        </div>
      ))}
    </div>
    </div>
  )
}

function BuildPanel({
  core,
  championId,
  selectedArchetypeKey,
  customRoutes,
  collapsed,
  locked,
  onToggleCollapsed,
}: {
  core: Core
  championId: number
  selectedArchetypeKey?: string
  customRoutes: CustomRoute[]
  collapsed: boolean
  locked: boolean
  onToggleCollapsed: () => void
}) {
  const t = useT()
  const lang = useLang()
  const champ = core.champions.find((c) => c.id === championId)
  const [build, setBuild] = useState<Build | null | undefined>(undefined)

  useEffect(() => {
    const file = core.buildIndex[championId]
    if (!file) {
      setBuild(withCustomRoutes(null, championId, customRoutes, core))
      return
    }
    setBuild(undefined)
    loadBuild(file, lang).then((loaded) => setBuild(withCustomRoutes(loaded, championId, customRoutes, core)))
  }, [championId, core, customRoutes, lang])

  if (!champ) return null
  const arch = build?.archetypes.find((a) => a.key === selectedArchetypeKey) ?? build?.archetypes[0]
  const starterItems = arch?.starterItems?.map((ref) => core.itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  const items = arch?.items.map((ref) => core.itemById.get(ref.id)).filter((it): it is Item => !!it) ?? []
  const coreAugs = arch?.augments.core.map((ref) => getAugment(core.augById, ref.id)).filter((a): a is Augment => !!a) ?? []
  const quickAugs =
    arch
      ? [
          ...arch.augments.core,
          ...arch.augments.good.filter((good) => !arch.augments.core.some((core) => core.id === good.id)),
        ]
          // 先解析+过滤掉查不到的，最后再 slice——顺序不能反：若前3个引用里有一个 id 查不到，
          // 先 slice 会让结果不足3个(后面能解析的被截断在外)，跟 AugmentPool 的正确写法保持一致。
          .map((ref) => getAugment(core.augById, ref.id))
          .filter((a): a is Augment => !!a)
          .slice(0, 3)
      : []
  const quickItems = items.slice(0, 6)

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
            title={collapsed ? t('overlay.expandHud') : t('overlay.collapseHud')}
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

      {build === undefined && <div className="mt-2 text-[11px] text-dim">{t('overlay.loadingBuild')}</div>}
      {build === null && (
        <div className="mt-3 rounded-2xl border border-red/30 bg-red/10 p-3 text-[11px] leading-relaxed text-dim">
          {t('overlay.noBuild', { name: champ.name })}
        </div>
      )}
      {arch && (
        <>
          {collapsed ? (
            <div className="mt-2 overflow-hidden rounded-[8px] border border-line/60 bg-panel/45 px-2 py-1.5">
              <div className="grid h-[34px] grid-cols-[24px_92px_1px_28px_1fr] items-center gap-1.5">
                <div className="text-[8px] font-extrabold tracking-[0.12em] text-gold">AUG</div>
                <div className="grid grid-cols-3 gap-1">
                  {quickAugs.map((a) => {
                    const r = RARITY[a.rarity] ?? RARITY[0]
                    return (
                      <img
                        key={a.id}
                        src={icon(a.iconLargeLocal)}
                        alt={a.name}
                        title={`${a.name}\n${plainText(a.desc || a.tooltip)}`}
                        className={'h-7 w-7 shrink-0 rounded-md border object-cover ' + r.border}
                      />
                    )
                  })}
                </div>
                <div className="h-6 w-px bg-line/70" />
                <div className="text-[8px] font-extrabold tracking-[0.12em] text-dim">ITEM</div>
                <div className="grid grid-cols-6 justify-items-center gap-[3px]">
                  {quickItems.map((it, idx) => (
                    <img
                      key={it.id + '-' + idx}
                      src={icon(it.iconLocal)}
                      alt={it.name}
                      title={`${it.name}\n${plainText(it.desc)}`}
                      className="h-6 w-6 shrink-0 rounded-md border border-line/70 object-cover"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
          <div className="mt-3 divide-y divide-line/55">
            <AugmentRail label={t('archetypeCard.core')} tone="core" refs={arch.augments.core.map((r) => r.id)} augById={core.augById} />
            <AugmentRail label={t('archetypeCard.good')} tone="good" refs={arch.augments.good.map((r) => r.id)} augById={core.augById} />
            <StarterRail items={starterItems} />
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
  const [activeChampionId, setActiveChampionId] = useState<number | null>(null)
  const [core, setCore] = useState<Core | null>(null)
  const [locked, setLocked] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    loadCore(settings?.language ?? 'zh').then(setCore)
  }, [settings?.language])

  useEffect(() => {
    if (!isElectron()) return
    window.mayhem!.onChampSelect((s) => {
      if (s.myChampionId) setActiveChampionId(s.myChampionId)
    })
    window.mayhem!.onOverlayLock((s: OverlayLockState) => setLocked(s.locked))
    window.mayhem!.onOverlayCollapsed((s: OverlayCollapsedState) => setCollapsed(s.collapsed))
    window.mayhem!.getSettings().then(setSettings)
    window.mayhem!.onSettingsChanged(setSettings)
  }, [])

  return (
    <LangProvider value={settings?.language ?? 'zh'}>
      <OverlayBody
        activeChampionId={activeChampionId}
        core={core}
        locked={locked}
        collapsed={collapsed}
        settings={settings}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
      />
    </LangProvider>
  )
}

function OverlayBody({
  activeChampionId,
  core,
  locked,
  collapsed,
  settings,
  onToggleCollapsed,
}: {
  activeChampionId: number | null
  core: Core | null
  locked: boolean
  collapsed: boolean
  settings: Settings | null
  onToggleCollapsed: () => void
}) {
  const t = useT()
  return (
    <div className="p-2">
      <div
        className={
          'relative w-full max-w-[432px] overflow-hidden rounded-[10px] border p-3 text-cream bg-[#0a1220e6] backdrop-blur-xl ' +
          (locked ? 'border-line/70' : 'border-hex border-dashed cursor-move')
        }
        style={locked ? undefined : ({ WebkitAppRegion: 'drag' } as React.CSSProperties)}
      >
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        {!locked && (
          <div className="relative mb-1.5 rounded-xl border border-hex/40 bg-hex/10 px-2 py-1 text-[10px] font-semibold text-hex">
            {t('overlay.dragHint')}
          </div>
        )}

        {core && activeChampionId ? (
          <BuildPanel
            core={core}
            championId={activeChampionId}
            selectedArchetypeKey={settings?.selectedArchetypeByChampionId[String(activeChampionId)]}
            customRoutes={CUSTOM_ROUTES_ENABLED ? settings?.customRoutes ?? [] : []}
            collapsed={collapsed}
            locked={locked}
            onToggleCollapsed={onToggleCollapsed}
          />
        ) : (
          <div className="relative mt-3 rounded-[10px] border border-hex/25 bg-hex/8 p-3 text-xs leading-relaxed text-dim">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-hex">Standby</div>
            {t('overlay.standbyDesc')}
          </div>
        )}
      </div>
    </div>
  )
}
