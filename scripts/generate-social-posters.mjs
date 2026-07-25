import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputDir = path.join(root, 'site', 'assets', 'social')
const assetsDir = path.join(root, 'site', 'assets')
const W = 1242
const H = 1660
const paper = '#F7F7F4'
const ink = '#0D1723'
const muted = '#64707C'
const cyan = '#0AAFC8'

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]))
}

function svg(body) {
  return Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`)
}

function text({ x, y, lines, size, weight = 600, fill = ink, leading = 1.25, letterSpacing = 0, anchor = 'start' }) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Microsoft YaHei, Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}" text-anchor="${anchor}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * leading}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`
}

function base(page, eyebrow) {
  return svg(`
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="24" fill="none" stroke="#D9DEDF" stroke-width="2"/>
    <rect x="70" y="82" width="48" height="48" rx="15" fill="#07131F"/>
    <path d="M85 95h18v7l-9 9-9-9zM84 105h7l3 3 3-3h7v13h-7v-5l-3 3-3-3v5h-7z" fill="#F7F7F4"/>
    <circle cx="1124" cy="106" r="5" fill="${cyan}"/>
    ${text({ x: 136, y: 112, lines: ['Mayhempedia'], size: 28, weight: 800 })}
    ${text({ x: 1124, y: 114, lines: [`0.1.2  ·  ${page}/3`], size: 17, weight: 700, fill: muted, anchor: 'end' })}
    <line x1="70" y1="160" x2="1172" y2="160" stroke="#D9DEDF" stroke-width="2"/>
    ${text({ x: 70, y: 212, lines: [eyebrow], size: 18, weight: 800, fill: cyan, letterSpacing: 1.6 })}
    <line x1="70" y1="1570" x2="1172" y2="1570" stroke="#D9DEDF" stroke-width="2"/>
    ${text({ x: 70, y: 1613, lines: ['mayhempedia.com'], size: 19, weight: 800 })}
    ${text({ x: 1172, y: 1613, lines: ['Windows beta'], size: 18, weight: 700, fill: muted, anchor: 'end' })}
  `)
}

function roundedMask(width, height, radius = 18) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`)
}

async function screen(source, width) {
  const buffer = await sharp(source).resize({ width, withoutEnlargement: true }).png().toBuffer()
  const { height } = await sharp(buffer).metadata()
  return {
    image: await sharp(buffer).composite([{ input: roundedMask(width, height) , blend: 'dest-in' }]).png().toBuffer(),
    height,
  }
}

function screenFrame(x, y, width, height) {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect x="${x - 2}" y="${y - 2}" width="${width + 4}" height="${height + 4}" rx="20" fill="#fff" stroke="#C7CED0" stroke-width="2"/></svg>`)
}

async function writePoster({ name, background, layers }) {
  await sharp(background).composite(layers).png().toFile(path.join(outputDir, name))
}

await fs.mkdir(outputDir, { recursive: true })

const dashboard = await screen(path.join(assetsDir, 'app-dashboard.png'), 1102)
const combat = await screen(path.join(assetsDir, 'app-combat-file-clean-en.png'), 1102)

const cover = base(1, 'ARAM: MAYHEM 玩法更新')
await writePoster({
  name: 'mayhempedia-012-cover-zh.png',
  background: cover,
  layers: [
    { input: svg(`${text({ x: 70, y: 324, lines: ['0.1.2', '把新玩法直接放到你眼前。'], size: 68, weight: 800, leading: 1.1 })}${text({ x: 70, y: 500, lines: ['11 套新英雄路线 · 26.14 海克斯大乱斗更新', '组合玩法、路线切换与对局浏览同步整理。'], size: 27, weight: 600, fill: muted, leading: 1.45 })}<rect x="70" y="610" width="267" height="50" rx="25" fill="#DDF7FA"/><text x="203.5" y="643" fill="#08798C" font-family="Microsoft YaHei, Segoe UI, Arial, sans-serif" font-size="20" font-weight="800" text-anchor="middle">正式测试版</text>`), top: 0, left: 0 },
    { input: screenFrame(70, 715, 1102, dashboard.height), top: 0, left: 0 },
    { input: dashboard.image, top: 715, left: 70 },
  ],
})

const routes = base(2, 'NEW ROUTES')
await writePoster({
  name: 'mayhempedia-012-new-routes-zh.png',
  background: routes,
  layers: [
    { input: svg(`${text({ x: 70, y: 324, lines: ['新玩法，不用从', '一张空白搜索框开始。'], size: 59, weight: 800, leading: 1.12 })}${text({ x: 70, y: 500, lines: ['主页只精选四套本次新增路线。', '点击卡片，直接打开对应的 Combat File。'], size: 27, weight: 600, fill: muted, leading: 1.42 })}<rect x="70" y="618" width="90" height="42" rx="21" fill="#07131F"/><text x="115" y="646" fill="#F7F7F4" font-family="Microsoft YaHei, Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" text-anchor="middle">NEW</text><rect x="178" y="618" width="258" height="42" rx="21" fill="#E7ECEC"/><text x="307" y="646" fill="#40505A" font-family="Microsoft YaHei, Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" text-anchor="middle">直达对应路线</text>`), top: 0, left: 0 },
    { input: screenFrame(70, 735, 1102, dashboard.height), top: 0, left: 0 },
    { input: dashboard.image, top: 735, left: 70 },
  ],
})

const combatFile = base(3, 'COMBAT FILE')
await writePoster({
  name: 'mayhempedia-012-combat-file-zh.png',
  background: combatFile,
  layers: [
    { input: svg(`${text({ x: 70, y: 324, lines: ['一眼看完', '这套玩法该怎么拿。'], size: 62, weight: 800, leading: 1.12 })}${text({ x: 70, y: 498, lines: ['核心海克斯、备选海克斯、出门装与六神装，', '在一张路线表里读完。'], size: 27, weight: 600, fill: muted, leading: 1.42 })}<line x1="70" y1="630" x2="1172" y2="630" stroke="#D9DEDF" stroke-width="2"/>${text({ x: 70, y: 687, lines: ['26.14'], size: 27, weight: 800, fill: cyan })}${text({ x: 210, y: 687, lines: ['仅同步 ARAM: Mayhem 相关更新'], size: 23, weight: 700, fill: ink })}`), top: 0, left: 0 },
    { input: screenFrame(70, 755, 1102, combat.height), top: 0, left: 0 },
    { input: combat.image, top: 755, left: 70 },
  ],
})

console.log(`Created social posters in ${path.relative(root, outputDir)}`)
