// 主进程：建窗口 + 连 LCU，把选人/换将数据通过 IPC 推给 React 渲染层。
// M1 只在控制台打印；这一步把同一份 LCU 逻辑接上真正的窗口。

import { app, BrowserWindow, ipcMain, Notification, screen } from 'electron'
import { authenticate, createWebSocketConnection, createHttp1Request } from 'league-connect'
import type { Credentials } from 'league-connect'
import uiohook from 'uiohook-napi'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadChampions, championName } from './champions.js'
import { fetchMatchHistory, fetchMatchFullDetail } from './match-history.js'
import {
  forgetPersistedAccount,
  listPersistedAccounts,
  loadPersistedMatchDetail,
  loadPersistedMatchHistory,
  mergePersistedMatchHistory,
  savePersistedMatchDetail,
} from './match-history-store.js'
import { getSettings, setSetting, type Settings, type OverlaySettings } from './settings.js'

const { uIOhook, UiohookKey } = uiohook

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/**
 * 打包后的 index.html / fetch() 全用绝对路径("/assets/..."、"/augments.json")。
 * 这类路径在 file:// 协议下会被解析成文件系统根目录、直接 404——渲染层永远空白，
 * 只剩窗口的 backgroundColor 顶着，看起来就是"黑屏"。
 * 所以起一个本地静态文件服务器，用 http:// 加载，让这些绝对路径按 web 惯例正确解析。
 */
function startRendererServer(root: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
      const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath)
      readFile(filePath)
        .then((data) => {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' })
          res.end(data)
        })
        .catch(() => {
          res.writeHead(404)
          res.end('Not found')
        })
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve(addr.port)
      else reject(new Error('本地渲染服务器端口分配失败'))
    })
  })
}

/** 选人 session 里我们关心的字段（其余忽略）。 */
interface ChampSelectSession {
  benchEnabled?: boolean
  benchChampions?: Array<{ championId: number }>
  localPlayerCellId?: number
  myTeam?: Array<{ cellId: number; championId: number }>
}

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let lastSnapshot = ''
/** connectLcu() 认证成功后填充，供"点进某一局看完整详情"这类按需请求复用，不用每次都重新 authenticate */
let lcuCredentials: Credentials | null = null
let currentPuuid: string | null = null
let buildChampionIds = new Set<number>()
let lastNotifiedChampionId: number | null = null
const OVERLAY_WIDTH = 392
const OVERLAY_HEIGHT = 430
const overlayCollapseHotkey: OverlaySettings['hotkey'] = { ctrl: true, shift: true, alt: false, key: 'C' }

/** 推给"两个"窗口——主 companion 窗口 + M2 overlay 探针都订阅同一批 LCU 事件 */
function send(channel: string, data: unknown): void {
  mainWindow?.webContents.send(channel, data)
  overlayWindow?.webContents.send(channel, data)
}

interface AppNotice {
  id: string
  title: string
  body: string
  tone: 'success' | 'warning' | 'info'
}

async function loadBuildChampionIds(): Promise<void> {
  const raw = await readFile(path.join(__dirname, '..', 'data', 'builds', 'index.json'), 'utf-8')
  const index = JSON.parse(raw) as Record<string, string>
  buildChampionIds = new Set(Object.keys(index).map((id) => Number(id)).filter((id) => Number.isFinite(id)))
}

function notifyUser(notice: AppNotice): void {
  if (getSettings().notificationMode === 'system' && Notification.isSupported()) {
    new Notification({ title: notice.title, body: notice.body }).show()
    return
  }
  mainWindow?.webContents.send('app:notification', notice)
}

async function createWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    title: 'Mayhempedia',
    backgroundColor: '#150b0d', // 跟 Tailwind --color-ink 一致，避免白屏闪一下
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[ARAM Copilot] 渲染层加载失败:', code, desc)
  })
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[ARAM Copilot] ✅ 渲染层已加载')
  })
  mainWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[renderer]', message)
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}/`)
  mainWindow.webContents.setZoomFactor(getSettings().zoomFactor)

  // overlay 窗口只是隐藏(hide)不是关闭，不算进 window-all-closed 的判断——
  // 显式在主窗口关闭时退出整个 app，避免 overlay 变成看不见的僵尸进程。
  mainWindow.on('closed', () => app.quit())
}

/**
 * overlay 窗口在主显示器上的实际坐标。拖动过(customPos 有值)就用那个坐标；
 * 没拖过就按锚点(左上/右上/左下/右下)算默认位置，留 20px 边距。
 */
function overlayPosition(overlay: OverlaySettings, w: number, h: number): { x: number; y: number } {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const MARGIN = 20
  if (overlay.customPos) {
    return {
      x: Math.max(MARGIN, Math.min(overlay.customPos.x, sw - w - MARGIN)),
      y: Math.max(MARGIN, Math.min(overlay.customPos.y, sh - h - MARGIN)),
    }
  }
  const x = overlay.position.includes('right') ? sw - w - MARGIN : MARGIN
  const y = overlay.position.includes('bottom') ? sh - h - MARGIN : MARGIN
  return { x, y }
}

/** 把当前设置里的 overlay 位置/透明度实时应用到窗口——设置变更时和窗口创建时都调这个。 */
function applyOverlaySettings(overlay: OverlaySettings): void {
  if (!overlayWindow) return
  const [w, h] = overlayWindow.getSize()
  const { x, y } = overlayPosition(overlay, w, h)
  overlayWindow.setPosition(x, y)
  overlayWindow.setOpacity(overlay.opacity)
}

/**
 * M2 窗口地基 + M3 静态流派内容：跟主 companion 窗口完全独立的第二个窗口。
 * transparent+frame:false 让非内容区域真正透明（能看到底下的游戏画面，不是纯黑背景假装透明）；
 * alwaysOnTop('screen-saver') 层级够高，盖得住无边框窗口模式的 LoL；
 * setIgnoreMouseEvents 点击穿透——不抢游戏的鼠标输入，只是"看"，不能"点"。
 * 默认隐藏，快捷键呼出/收起（全局快捷键不受点击穿透影响，游戏窗口在前台也能触发）。
 * 尺寸从 M2 探针时期的 300x140 放大到当前 Hextech field unit 尺寸；
 * 空白区域反正透明不占视觉，宁可留够高度不滚动，也别挤。
 */
function createOverlayWindow(port: number): void {
  const overlaySettings = getSettings().overlay
  const { x, y } = overlayPosition(overlaySettings, OVERLAY_WIDTH, OVERLAY_HEIGHT)
  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    opacity: overlaySettings.opacity,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[overlay]', message)
  })
  overlayWindow.loadURL(`http://127.0.0.1:${port}/overlay.html`)
}

let overlayVisible = false
function showOverlay(reason: string): void {
  if (!overlayWindow || overlayVisible) return
  overlayVisible = true
  overlayWindow.showInactive()
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  console.log('[ARAM Copilot] overlay 已自动呼出:', reason)
}

function toggleOverlay(): void {
  if (!overlayWindow) return
  overlayVisible = !overlayVisible
  if (overlayVisible) overlayWindow.showInactive() // showInactive: 显示但不抢焦点，游戏继续吃键鼠输入
  else overlayWindow.hide()
  console.log('[ARAM Copilot] overlay', overlayVisible ? '已呼出' : '已隐藏')
}

/**
 * 手动拖动定位：默认 overlay 是点击穿透的(setIgnoreMouseEvents true)，鼠标事件根本落不到
 * 这个窗口上，没法拖。解锁模式下关掉穿透，渲染层给个 -webkit-app-region:drag 的拖拽区，
 * 就能像 TFT 那类叠加插件一样手动拖窗口；再按一次锁定，把最终坐标存进 customPos。
 */
let overlayLocked = true
function toggleOverlayLock(): void {
  if (!overlayWindow) return
  overlayLocked = !overlayLocked
  overlayWindow.setIgnoreMouseEvents(overlayLocked, { forward: true })

  if (!overlayLocked) {
    // 解锁就是要看着拖，强制呼出并给焦点(拖拽需要真的抢到鼠标输入，showInactive 不够)
    overlayVisible = true
    overlayWindow.show()
  } else {
    const [x, y] = overlayWindow.getPosition()
    const overlay = getSettings().overlay
    setSetting('overlay', { ...overlay, customPos: { x, y } })
    mainWindow?.webContents.send('settings:changed', getSettings())
  }

  send('overlay:lockChanged', { locked: overlayLocked })
  console.log('[ARAM Copilot] overlay', overlayLocked ? '已锁定(点击穿透，位置已保存)' : '已解锁(可拖动调整位置)')
}

let overlayCollapsed = false
function toggleOverlayCollapsed(): void {
  overlayCollapsed = !overlayCollapsed
  overlayWindow?.webContents.send('overlay:collapsedChanged', { collapsed: overlayCollapsed })
  console.log('[ARAM Copilot] overlay', overlayCollapsed ? '已折叠' : '已展开')
}

/** 拉当前登录账号的召唤师名——身份卡显示出来，方便用户一眼确认"这是不是我的账号"
 *（比如登了小号/共用电脑忘切账号这种，光看战绩数字看不出来，看名字秒懂）。 */
async function fetchSummoner(credentials: Credentials): Promise<{ puuid: string; gameName: string; tagLine: string } | null> {
  const res = await createHttp1Request({ method: 'GET', url: '/lol-summoner/v1/current-summoner' }, credentials)
  if (!res.ok) return null
  const j = (await res.json()) as { puuid?: string; gameName?: string; tagLine?: string }
  if (!j.puuid || !j.gameName) return null
  return { puuid: j.puuid, gameName: j.gameName, tagLine: j.tagLine ?? '' }
}

function handleChampSelect(session: ChampSelectSession | null): void {
  if (!session) return

  const myCellId = session.localPlayerCellId
  const me = (session.myTeam ?? []).find((p) => p.cellId === myCellId)
  const myChampionId = me?.championId ?? null
  const benchChampionIds = (session.benchChampions ?? []).map((b) => b.championId)

  // 去重：选人阶段事件会高频触发，没变化就不重复推送
  const snapshot = `${myChampionId}|${benchChampionIds.join(',')}`
  if (snapshot === lastSnapshot) return
  lastSnapshot = snapshot

  console.log(
    '[ARAM Copilot] 选人变化 你的英雄:',
    championName(myChampionId),
    '板凳:',
    benchChampionIds.length ? benchChampionIds.map(championName).join(' / ') : '(空)',
  )
  send('lcu:champSelect', {
    myChampionId,
    benchChampionIds,
    benchEnabled: !!session.benchEnabled,
  })

  if (!myChampionId) lastNotifiedChampionId = null
  if (myChampionId && myChampionId !== lastNotifiedChampionId) {
    lastNotifiedChampionId = myChampionId
    const name = championName(myChampionId)
    const hasBuild = buildChampionIds.has(myChampionId)
    // 只呼出 overlay(showInactive，不抢焦点)——主窗口的英雄详情页照常在后台跟着 champId 同步更新，
    // 但不强制 restore/show/focus 抢占 OS 窗口焦点，用户在忙别的窗口时不会被硬拉走。
    showOverlay(`检测到 ${name}`)
    notifyUser({
      id: `champ-${myChampionId}-${Date.now()}`,
      title: hasBuild ? 'Overlay 已准备好' : '暂无流派数据',
      body: hasBuild
        ? `已识别 ${name}，推荐面板已自动显示；按 ${comboLabel(getSettings().overlay.hotkey)} 可隐藏。`
        : `${name} 还没收录流派数据，可以先看英雄 Tier 或海克斯一览。`,
      tone: hasBuild ? 'success' : 'warning',
    })
  }
}

async function connectLcu(): Promise<void> {
  send('lcu:status', { state: 'connecting' })
  console.log('[ARAM Copilot] 等待英雄联盟客户端…（请先打开客户端）')
  const credentials = await authenticate({ awaitConnection: true })
  console.log(`[ARAM Copilot] ✅ 已连接 LCU (port ${credentials.port})`)
  lcuCredentials = credentials

  await loadChampions()
  console.log('[ARAM Copilot] ✅ 英雄数据就绪')
  await loadBuildChampionIds()
  console.log(`[ARAM Copilot] ✅ 流派索引就绪：${buildChampionIds.size} 个英雄有推荐数据`)

  send('lcu:status', { state: 'connected' })

  const summoner = await fetchSummoner(credentials)
  if (summoner) {
    currentPuuid = summoner.puuid
    console.log(`[ARAM Copilot] 当前登录账号: ${summoner.gameName}#${summoner.tagLine}`)
    send('lcu:summoner', { gameName: summoner.gameName, tagLine: summoner.tagLine })
  }

  const ws = await createWebSocketConnection({
    authenticationOptions: { awaitConnection: true },
  })
  ws.subscribe('/lol-champ-select/v1/session', (data: unknown) => {
    handleChampSelect(data as ChampSelectSession)
  })

  try {
    const res = await createHttp1Request({ method: 'GET', url: '/lol-champ-select/v1/session' }, credentials)
    if (res.ok) handleChampSelect((await res.json()) as ChampSelectSession)
  } catch {
    // 不在选人阶段时这个端点会 404/失败，忽略即可，后续 WebSocket 会接住真正进入选人的事件。
  }

  console.log('[ARAM Copilot] 👀 正在监听选人阶段——进入一局大乱斗选人即可看到板凳。\n')

  console.log('[ARAM Copilot] 读取本机大乱斗对局记录…')
  try {
    const result = await fetchMatchHistory(credentials)
    if (result) {
      const displayResult =
        getSettings().persistMatchHistory && summoner
          ? mergePersistedMatchHistory(summoner.puuid, summoner, result)
          : result
      console.log(
        `[ARAM Copilot] ✅ 对局记录就绪：${displayResult.matches.length} 场嚎哭深渊，段位「${displayResult.arp.rankName}」`,
      )
      send('lcu:matchHistory', displayResult)
    } else {
      const persisted =
        getSettings().persistMatchHistory && summoner ? loadPersistedMatchHistory(summoner.puuid) : null
      if (persisted) {
        console.log(
          `[ARAM Copilot] ✅ 已加载本地累计对局记录：${persisted.matches.length} 场嚎哭深渊，段位「${persisted.arp.rankName}」`,
        )
        send('lcu:matchHistory', persisted)
      } else {
        console.log('[ARAM Copilot] 本机暂无嚎哭深渊对局记录')
      }
    }
  } catch (err) {
    console.error('[ARAM Copilot] 读取对局记录失败:', err)
    const persisted =
      getSettings().persistMatchHistory && summoner ? loadPersistedMatchHistory(summoner.puuid) : null
    if (persisted) {
      console.log(
        `[ARAM Copilot] ✅ LCU 读取失败，已改用本地累计对局记录：${persisted.matches.length} 场嚎哭深渊，段位「${persisted.arp.rankName}」`,
      )
      send('lcu:matchHistory', persisted)
    }
  }
}

/**
 * 全局快捷键改用 uiohook-napi（底层键盘钩子）而不是 Electron 自带的 globalShortcut。
 * 原因：globalShortcut 底层是 Windows 的 RegisterHotKey API，实测在无边框 LoL 窗口下会被
 * 游戏的独占式键盘输入吞掉、根本收不到——这是 DirectX 类游戏常见的已知问题。uiohook-napi
 * 走的是更底层的键盘钩子，是社区公认的 globalShortcut 替代方案，能穿透这类拦截。
 * 默认 Ctrl+Shift+X：Alt 组合键很容易被游戏自己的菜单/切换逻辑保留占用。
 * 组合键读自设置(overlay.hotkey)，不是写死的——虽然设置页目前还没有"按键捕获"UI改不了它，
 * 但运行时是真的按配置值判断，不是摆设，以后加上捕获UI就能直接生效。
 */
function hotkeyMatches(hk: OverlaySettings['hotkey'], e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; keycode: number }): boolean {
  const keycode = (UiohookKey as unknown as Record<string, number>)[hk.key]
  return e.ctrlKey === hk.ctrl && e.shiftKey === hk.shift && e.altKey === hk.alt && keycode != null && e.keycode === keycode
}

function comboLabel(hk: OverlaySettings['hotkey']): string {
  return `${hk.ctrl ? 'Ctrl+' : ''}${hk.shift ? 'Shift+' : ''}${hk.alt ? 'Alt+' : ''}${hk.key}`
}

function registerHotkey(): void {
  uIOhook.on('keydown', (e) => {
    const overlay = getSettings().overlay
    if (hotkeyMatches(overlay.hotkey, e)) toggleOverlay()
    else if (hotkeyMatches(overlay.moveHotkey, e)) toggleOverlayLock()
    else if (hotkeyMatches(overlayCollapseHotkey, e)) toggleOverlayCollapsed()
  })
  uIOhook.start()
  const overlay = getSettings().overlay
  console.log(
    `[ARAM Copilot] 全局快捷键 ${comboLabel(overlay.hotkey)}(呼出/隐藏) / ${comboLabel(overlay.moveHotkey)}(解锁拖动) 已注册（底层钩子，穿透游戏独占输入）`,
  )
}

/** 开机自启：Electron 自带 API，写系统的登录项（Windows 注册表/macOS LoginItems），不用自己维护。 */
function applyAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled })
}

/**
 * 设置 IPC：渲染层读写都走这两个 handle，主进程是唯一真源(electron-store 落盘)。
 * settings:set 除了落盘，还要把变更实时应用到运行中的窗口/系统状态——不然用户点了开关但啥也没发生。
 */
function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, key: keyof Settings, value: Settings[keyof Settings]) => {
    const updated = setSetting(key, value)
    if (key === 'autoLaunch') applyAutoLaunch(updated.autoLaunch)
    if (key === 'zoomFactor') mainWindow?.webContents.setZoomFactor(updated.zoomFactor)
    if (key === 'overlay') applyOverlaySettings(updated.overlay)
    // 广播给两个窗口，保持主窗口/overlay 的设置 UI 状态同步
    mainWindow?.webContents.send('settings:changed', updated)
    overlayWindow?.webContents.send('settings:changed', updated)
    return updated
  })

  // 健康检查：主动触发一次读取，确认 electron-store 真的能创建+落盘+读到默认值
  // （IPC handler 本身是惰性的，不主动调用不会验证到任何东西）
  const s = getSettings()
  console.log('[ARAM Copilot] ✅ 设置已加载:', JSON.stringify({ overlay: s.overlay, persistMatchHistory: s.persistMatchHistory }))
}

/** 「对局详情」按需懒加载：渲染层点进某一局才 invoke 一次，不在 connectLcu 里对所有20场预取。 */
function registerMatchDetailIpc(): void {
  ipcMain.handle('lcu:getMatchDetail', async (_e, gameId: number) => {
    const shouldPersist = getSettings().persistMatchHistory
    if (!lcuCredentials) {
      return shouldPersist && currentPuuid ? loadPersistedMatchDetail(currentPuuid, gameId) : null
    }

    const detail = await fetchMatchFullDetail(lcuCredentials, gameId)
    if (detail) {
      if (shouldPersist && currentPuuid) savePersistedMatchDetail(currentPuuid, detail)
      return detail
    }

    return shouldPersist && currentPuuid ? loadPersistedMatchDetail(currentPuuid, gameId) : null
  })
}

function registerAccountHistoryIpc(): void {
  ipcMain.handle('matchHistory:getAccounts', () => listPersistedAccounts(currentPuuid))
  ipcMain.handle('matchHistory:forgetAccount', (_e, puuid: string) => {
    forgetPersistedAccount(puuid)
    return listPersistedAccounts(currentPuuid)
  })
}

app.whenReady().then(async () => {
  registerSettingsIpc()
  registerMatchDetailIpc()
  registerAccountHistoryIpc()
  applyAutoLaunch(getSettings().autoLaunch)

  const rendererRoot = path.join(__dirname, '..', 'dist-renderer')
  const port = await startRendererServer(rendererRoot)
  console.log(`[ARAM Copilot] 渲染层本地服务器已就绪 http://127.0.0.1:${port}`)

  await createWindow(port)
  createOverlayWindow(port)
  registerHotkey()

  connectLcu().catch((err) => {
    console.error('[ARAM Copilot] LCU 连接失败:', err)
    send('lcu:status', { state: 'error', message: String(err) })
  })
})

app.on('will-quit', () => {
  uIOhook.stop()
})

app.on('window-all-closed', () => {
  app.quit()
})
