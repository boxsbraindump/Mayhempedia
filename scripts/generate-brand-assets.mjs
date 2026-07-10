import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = process.cwd()
const brandDir = path.join(root, 'data', 'assets', 'brand')
const svgPath = path.join(brandDir, 'mayhempedia-icon.svg')
const svg = await readFile(svgPath)

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngBuffers = []

for (const size of sizes) {
  const buffer = await sharp(svg).resize(size, size).png().toBuffer()
  pngBuffers.push(buffer)
  await writeFile(path.join(brandDir, `mayhempedia-icon-${size}.png`), buffer)
}

await writeFile(path.join(brandDir, 'mayhempedia-icon.png'), pngBuffers[pngBuffers.length - 1])
await writeFile(path.join(brandDir, 'mayhempedia-icon.ico'), await pngToIco(pngBuffers))

console.log(`Generated Mayhempedia brand assets: ${sizes.map((s) => `${s}px`).join(', ')} + ico`)
