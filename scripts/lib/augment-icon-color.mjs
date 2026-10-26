// 判断海克斯图标原图画的是哪种稀有度配色：0 银、1 金、2 棱彩、-1 白/灰（没上色）。
// 用来从官方原图里挑出颜色和稀有度一致的那张，不改动图片本身。
import sharp from 'sharp'

export async function iconColorFamily(file) {
  const { data } = await sharp(file)
    .ensureAlpha()
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let lit = 0
  let warm = 0
  let cool = 0
  let vivid = 0
  let gray = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (l < 0.35) continue // 只看亮部，暗部的描边/底色看不出配色
    lit++
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
    if (s < 0.12) {
      gray++
      continue
    }
    const sector = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
    const hue = (sector * 60 + 360) % 360
    if (hue >= 20 && hue <= 60) warm++
    else if (hue >= 160 && hue <= 215 && s < 0.45) cool++
    else vivid++
  }
  if (!lit) return -1
  if (vivid / lit > 0.15) return 2
  if (warm / lit > 0.3) return 1
  if ((cool + gray) / lit > 0.5 && warm / lit < 0.15) return gray / lit > 0.85 && cool / lit < 0.05 ? -1 : 0
  return -1
}
