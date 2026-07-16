# 数据说明（海克斯增强 + 装备）

overlay 的数据地基。全部来自 **Community Dragon**（社区维护、比官方 Data Dragon 全）。
**语言 = 中文 `zh_cn`**（在 `scripts/fetch-data.mjs` 顶部 `LANG` 常量切换；图标与语言无关）。

## 重新生成

```bash
npm run data          # 抓取 JSON + 下载图标
npm run data:fetch    # 只重抓 JSON
npm run data:icons    # 只重下图标（读现有 JSON）
```

## 产物

| 文件 | 内容 |
|---|---|
| `augments.json` | **199** 个 arammayhem.com live 海克斯增强 + 隐藏 legacy 兼容项 |
| `items.json` | **706** 件装备 |
| `icons/augments/{apiName}_large.png` / `_small.png` | 增强图标（450 张，git 忽略，可重下） |
| `icons/items/{id}.png` | 装备图标（706 张，git 忽略，可重下） |

## 字段

**增强 augments.json**
```jsonc
{
  "id": 41,
  "apiName": "Goliath",           // 稳定标识（英文，不随语言变）；图标文件名 & CV 匹配都用它
  "name": "歌利亚巨人",             // 中文名
  "rarity": 2,                    // 0银 1金 2棱彩
  "rarityLabel": "棱彩 Prismatic",
  "desc": "体型变大，获得15%生命值和10%自适应之力。",  // 清洗+占位符替换后的可读文本
  "tooltip": "...",               // 同上，更详细
  "descRaw": "...<scaleHealth>@HealthAmp*100@%...",  // 原始富文本（保留以备精确渲染）
  "dataValues": { "AFAmp": [0.1, 0.1, 0.2, ...], ... },  // 各数值的分档表（精确值）
  "iconLargeUrl": "https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons/goliath_large.png",
  "iconSmallUrl": "...",
  "iconLargeLocal": "icons/augments/Goliath_large.png",
  "iconSmallLocal": "icons/augments/Goliath_small.png"
}
```

**装备 items.json**
```jsonc
{
  "id": 3003,
  "name": "Archangel's Staff",
  "price": 450, "priceTotal": 2900,
  "categories": ["SpellDamage", "Mana", "AbilityHaste"],
  "from": [3070, 3802, 3108],   // 合成来源装备 id
  "to": [],                     // 可升级成
  "inStore": true,
  "isEnchantment": false,
  "desc": "10 Attack Damage / 80 Health / ...",  // 清洗后纯文本
  "descRaw": "<mainText><stats>...",             // 原始富文本
  "iconUrl": "https://raw.communitydragon.org/.../assets/items/icons2d/3003_....png",
  "iconLocal": "icons/items/3003.png"
}
```

## 已知注意点 / TODO

- **占位符替换取第 1 档近似值**：`desc`/`tooltip` 里的 `@Key@` 用 `dataValues[Key][0]` 替换，方便展示；**精确逐档数值以 `dataValues` 为准**。个别档位第 1 档为 0 时会显示 0（如"冰寒"），属已知近似。
- **部分增强有残留占位符**：这些用 `@spell.X:Y@` / `{{模板}}` 引用技能计算值，静态 `dataValues` 拿不到 → `desc` 里保留原 token（如"@spell.Augment_ShadowRunner:BuffDuration@秒"）。`descRaw` 始终保留；做 UI/curate 时再处理。
- **可见海克斯池以 arammayhem.com/augments 为准**：`availability: "live"` 的 199 个会进入增强图鉴、选择器和推荐器。
- **隐藏 legacy 兼容项**：`availability: "legacy"` 只用于解析旧官方路线里已经引用的历史 ID，不会展示给玩家选择。
- **图标 CDN 分支不同**：增强图标在 `.../latest/game/`，装备图标在 `.../latest/plugins/rcp-be-lol-game-data/global/default/`（图标与语言无关，始终 `default`）。
- **切语言**：改 `scripts/fetch-data.mjs` 顶部 `LANG`（`default`=英文 / `zh_cn` / `ko_kr` …）重跑 `npm run data:fetch` 即可，图标不用重下。
