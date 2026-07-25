import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputDir = path.join(root, 'site', 'assets', 'social')
const assetsDir = path.join(root, 'site', 'assets')
const generatedBackground = 'C:\\Users\\Cecily\\.codex\\generated_images\\019f9824-67da-7472-aaae-00c0532de90e\\exec-298a8f91-eaa6-46b5-9500-72ec54961c36.png'

const W = 1242
const H = 1660
const paper = '#F7F7F4'
const ink = '#0D1723'
const muted = '#64707C'
const cyan = '#0AAFC8'
const navy = '#07131F'

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]))
}

function svg(body, width = W, height = H) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`)
}

function text({ x, y, lines, size, weight = 600, fill = ink, leading = 1.22, letterSpacing = 0, anchor = 'start', family = 'Microsoft YaHei, Segoe UI, Arial, sans-serif' }) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}" text-anchor="${anchor}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * leading}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`
}

function mark(x, y, inverse = false) {
  const fill = inverse ? paper : navy
  const inkFill = inverse ? navy : paper
  return `<rect x="${x}" y="${y}" width="48" height="48" rx="15" fill="${fill}"/><path d="M${x + 15} ${y + 13}h18v7l-9 9-9-9zM${x + 14} ${y + 23}h7l3 3 3-3h7v13h-7v-5l-3 3-3-3v5h-7z" fill="${inkFill}"/>`
}

function header({ page, eyebrow, dark = false }) {
  const foreground = dark ? paper : ink
  const line = dark ? '#314252' : '#D9DEDF'
  return `${mark(70, 70, dark)}${text({ x: 136, y: 103, lines: ['Mayhempedia'], size: 27, weight: 800, fill: foreground })}<circle cx="1110" cy="93" r="5" fill="${cyan}"/>${text({ x: 1172, y: 101, lines: [`0.1.2  ·  ${page}/4`], size: 17, weight: 700, fill: dark ? '#B9C5CF' : muted, anchor: 'end' })}<line x1="70" y1="150" x2="1172" y2="150" stroke="${line}" stroke-width="2"/>${text({ x: 70, y: 207, lines: [eyebrow], size: 18, weight: 800, fill: cyan, letterSpacing: 1.6 })}`
}

function footer({ dark = false, right = 'Windows beta' }) {
  const foreground = dark ? paper : ink
  const secondary = dark ? '#B9C5CF' : muted
  const line = dark ? '#314252' : '#D9DEDF'
  return `<line x1="70" y1="1570" x2="1172" y2="1570" stroke="${line}" stroke-width="2"/>${text({ x: 70, y: 1613, lines: ['mayhempedia.com'], size: 19, weight: 800, fill: foreground })}${text({ x: 1172, y: 1613, lines: [right], size: 18, weight: 700, fill: secondary, anchor: 'end' })}`
}

function roundedMask(width, height, radius = 20) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`)
}

async function screen(source, width) {
  const buffer = await sharp(source).resize({ width, withoutEnlargement: true }).png().toBuffer()
  const { height } = await sharp(buffer).metadata()
  return {
    image: await sharp(buffer).composite([{ input: roundedMask(width, height), blend: 'dest-in' }]).png().toBuffer(),
    height,
  }
}

function frame(x, y, width, height, stroke = '#B9C5CF') {
  return svg(`<rect x="${x - 3}" y="${y - 3}" width="${width + 6}" height="${height + 6}" rx="24" fill="none" stroke="${stroke}" stroke-width="3"/>`)
}

async function writePoster(name, background, layers) {
  await sharp(background).composite(layers).png().toFile(path.join(outputDir, name))
}

await fs.mkdir(outputDir, { recursive: true })

const dashboard = await screen(path.join(assetsDir, 'app-dashboard.png'), 1102)
const combat = await screen(path.join(assetsDir, 'app-combat-file-clean-en.png'), 1102)

const darkBackground = await sharp(generatedBackground).resize(W, H, { fit: 'cover' }).png().toBuffer()

const cover = svg(`
  ${header({ page: 1, eyebrow: 'ARAM: MAYHEM  /  0.1.2 UPDATE', dark: true })}
  ${text({ x: 70, y: 360, lines: ['这次更新，', '把玩法直接放到', '你眼前。'], size: 74, weight: 850, fill: paper, leading: 1.06 })}
  ${text({ x: 70, y: 665, lines: ['11 套新路线  ·  Combo Plays', '26.14 ARAM: Mayhem 更新'], size: 28, weight: 650, fill: '#D7E2E8', leading: 1.45 })}
  <rect x="70" y="770" width="290" height="52" rx="26" fill="${cyan}"/>
  ${text({ x: 215, y: 803, lines: ['Windows beta  ·  免费试用'], size: 20, weight: 800, fill: navy, anchor: 'middle' })}
  ${footer({ dark: true, right: 'Mayhempedia update' })}
`)
await writePoster('mayhempedia-012-xhs-01-cover.png', darkBackground, [
  { input: cover, top: 0, left: 0 },
  { input: frame(70, 900, 1102, dashboard.height, '#3D5A6B'), top: 0, left: 0 },
  { input: dashboard.image, top: 900, left: 70 },
])

const routes = svg(`
  <rect width="${W}" height="${H}" fill="${paper}"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="24" fill="none" stroke="#D9DEDF" stroke-width="2"/>
  ${header({ page: 2, eyebrow: '01  /  NEW ROUTES' })}
  ${text({ x: 70, y: 340, lines: ['首页不再只是入口，', '它现在会告诉你先玩什么。'], size: 57, weight: 850, leading: 1.1 })}
  ${text({ x: 70, y: 530, lines: ['精选 4 套本次新增路线，点击卡片直接打开', '对应的 Combat File。'], size: 27, weight: 600, fill: muted, leading: 1.42 })}
  <rect x="70" y="660" width="98" height="44" rx="22" fill="${navy}"/>
  ${text({ x: 119, y: 689, lines: ['NEW'], size: 18, weight: 800, fill: paper, anchor: 'middle' })}
  <rect x="185" y="660" width="252" height="44" rx="22" fill="#E1F7FA"/>
  ${text({ x: 311, y: 689, lines: ['点卡片，直达路线'], size: 18, weight: 800, fill: '#08798C', anchor: 'middle' })}
  ${text({ x: 70, y: 780, lines: ['Akshan  ·  Briar  ·  Gwen  ·  Hwei  ·  Ivern  ·  Jarvan IV'], size: 18, weight: 750, fill: muted })}
  ${text({ x: 70, y: 812, lines: ['Morgana  ·  Neeko  ·  Rell  ·  Soraka  ·  Volibear'], size: 18, weight: 750, fill: muted })}
  ${footer({ right: '11 new routes' })}
`)
await writePoster('mayhempedia-012-xhs-02-routes.png', svg(`<rect width="${W}" height="${H}" fill="${paper}"/>`), [
  { input: routes, top: 0, left: 0 },
  { input: frame(70, 900, 1102, dashboard.height), top: 0, left: 0 },
  { input: dashboard.image, top: 900, left: 70 },
])

const combatPoster = svg(`
  <rect width="${W}" height="${H}" fill="${paper}"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="24" fill="none" stroke="#D9DEDF" stroke-width="2"/>
  ${header({ page: 3, eyebrow: '02  /  COMBAT FILE' })}
  ${text({ x: 70, y: 340, lines: ['一张路线上，', '把“怎么拿”讲清楚。'], size: 64, weight: 850, leading: 1.08 })}
  ${text({ x: 70, y: 535, lines: ['核心海克斯、备选海克斯、出门装与六神装，', '现在可以在一张路线表里读完。'], size: 26, weight: 600, fill: muted, leading: 1.45 })}
  <line x1="70" y1="660" x2="1172" y2="660" stroke="#D9DEDF" stroke-width="2"/>
  ${text({ x: 70, y: 715, lines: ['CORE'], size: 19, weight: 850, fill: cyan, letterSpacing: 1.4 })}
  ${text({ x: 242, y: 715, lines: ['ALTERNATES'], size: 19, weight: 850, fill: muted, letterSpacing: 1.4 })}
  ${text({ x: 520, y: 715, lines: ['STARTER'], size: 19, weight: 850, fill: muted, letterSpacing: 1.4 })}
  ${text({ x: 745, y: 715, lines: ['6/6 ITEMS'], size: 19, weight: 850, fill: muted, letterSpacing: 1.4 })}
  ${text({ x: 70, y: 780, lines: ['26.14'], size: 28, weight: 850, fill: cyan })}
  ${text({ x: 190, y: 780, lines: ['仅同步 ARAM: Mayhem 相关更新'], size: 22, weight: 750 })}
  ${footer({ right: 'Combat File' })}
`)
await writePoster('mayhempedia-012-xhs-03-combat-file.png', svg(`<rect width="${W}" height="${H}" fill="${paper}"/>`), [
  { input: combatPoster, top: 0, left: 0 },
  { input: frame(70, 850, 1102, combat.height), top: 0, left: 0 },
  { input: combat.image, top: 850, left: 70 },
])

const combo = svg(`
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="24" fill="none" stroke="#314252" stroke-width="2"/>
  ${header({ page: 4, eyebrow: '03  /  COMBO PLAYS', dark: true })}
  ${text({ x: 70, y: 360, lines: ['不只是推荐，', '还告诉你为什么这样搭。'], size: 62, weight: 850, fill: paper, leading: 1.08 })}
  ${text({ x: 70, y: 555, lines: ['把海克斯与装备互动整理成可读的组合玩法，', '让“拿到之后怎么玩”也有答案。'], size: 26, weight: 600, fill: '#D7E2E8', leading: 1.45 })}
  <rect x="70" y="710" width="1102" height="166" rx="22" fill="#0E2030" stroke="#3D5A6B" stroke-width="2"/>
  ${text({ x: 110, y: 765, lines: ['海克斯互动'], size: 23, weight: 800, fill: cyan })}
  ${text({ x: 110, y: 815, lines: ['核心玩法  →  触发方式  →  出装方向'], size: 27, weight: 750, fill: paper })}
  <rect x="70" y="910" width="348" height="150" rx="22" fill="#0E2030" stroke="#3D5A6B" stroke-width="2"/>
  <rect x="438" y="910" width="348" height="150" rx="22" fill="#0E2030" stroke="#3D5A6B" stroke-width="2"/>
  <rect x="806" y="910" width="366" height="150" rx="22" fill="#0E2030" stroke="#3D5A6B" stroke-width="2"/>
  ${text({ x: 110, y: 970, lines: ['看懂组合'], size: 25, weight: 800, fill: paper })}
  ${text({ x: 110, y: 1015, lines: ['不靠猜'], size: 21, weight: 650, fill: '#B9C5CF' })}
  ${text({ x: 478, y: 970, lines: ['更快做决定'], size: 25, weight: 800, fill: paper })}
  ${text({ x: 478, y: 1015, lines: ['少一点试错'], size: 21, weight: 650, fill: '#B9C5CF' })}
  ${text({ x: 846, y: 970, lines: ['下一局就能用'], size: 25, weight: 800, fill: paper })}
  ${text({ x: 846, y: 1015, lines: ['从路线开始'], size: 21, weight: 650, fill: '#B9C5CF' })}
  <rect x="70" y="1200" width="290" height="56" rx="28" fill="${cyan}"/>
  ${text({ x: 215, y: 1236, lines: ['0.1.2  ·  现在开始'], size: 21, weight: 850, fill: navy, anchor: 'middle' })}
  ${text({ x: 70, y: 1350, lines: ['Mayhempedia 是一款 ARAM: Mayhem 桌面伴侣。'], size: 22, weight: 650, fill: '#D7E2E8' })}
  ${footer({ dark: true, right: 'Combo Plays' })}
`)
await writePoster('mayhempedia-012-xhs-04-combo-plays.png', darkBackground, [
  { input: combo, top: 0, left: 0 },
])

console.log(`Created 4 Xiaohongshu posters in ${path.relative(root, outputDir)}`)
