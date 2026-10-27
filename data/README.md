# 数据说明（海克斯增强 + 装备）

overlay 的数据地基。装备/英雄来自 **Community Dragon**（社区维护、比官方 Data Dragon 全）；
海克斯池来自 **arammayhem.com**（当前版本目录 + 中英文详情页 + CC BY 4.0 开放数据，署名 "Data: arammayhem.com"），
新海克斯的 id 和官方中文名用 Community Dragon 的客户端数据校对。
**语言 = 中文 `zh_cn`**（在 `scripts/fetch-data.mjs` 顶部 `LANG` 常量切换；图标与语言无关）。

## 重新生成

```bash
npm run data           # 全部重抓 + 下载图标
npm run data:fetch     # 只重抓装备/英雄 JSON
npm run data:augments  # 只重抓海克斯池（arammayhem.com），之后跑 npm run data:augment-aliases
npm run data:icons     # 只重下图标（读现有 JSON）
```

海克斯抓取完会打印新增/移出/稀有度变化/中文名变化。改了中文名后流派文件里的引用名会漂移，
`npm run validate` 会提示，按提示改 `data/builds/` 里的 `name` 即可。
⚠️ 不要整体重跑 `scripts/generate-en-builds.mjs`（`npm run data` 末尾也会跑它）：0.1.2 起有 11 条英文流派是手写的，会被模板覆盖。

## 产物

| 文件 | 内容 |
|---|---|
| `augments.json` | **234** 个 26.21 现役海克斯（`availability: "live"`）+ 隐藏 legacy 兼容项 |
| `arammayhem-augments.snapshot.json` | 抓取快照：每个现役海克斯的 slug、id 来源、上线版本、选取率、arammayhem 实战指南 |
| `augment-runtime-aliases.json` | Riot 运行时海克斯 id → 本地 id（对局记录用） |
| `augment-name-aliases.json` | 识别别名：每个现役海克斯在英文、国服、台服（繁体）、马服客户端卡片上的名字，只给选海克斯 overlay 读卡片名字用，界面始终显示国服译名。`npm run data:augments` 一起生成 |
| `augment-tiers.json` | 海克斯 × 英雄评级（S/A/B/C/D），`npm run data:tiers` 从各评级来源生成；现在的来源是官方流派（核心 = S、备选 = A、陷阱 = D），以后的授权统计数据在 `scripts/build-augment-tiers.mjs` 的 `SOURCES` 里接入。改了流派后要重新生成，`npm run validate` 会检查 |
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
- **可见海克斯池以 arammayhem.com/augments 的当前版本目录为准**：`availability: "live"` 的会进入增强图鉴、选择器和推荐器。
  另有两张手工维护的补充表（见 `scripts/fetch-arammayhem-augments.mjs`）：`EXTRA_LIVE_SLUGS` 是 arammayhem 标成下架、
  但 26.21 实战里仍出现的；`CDRAGON_ONLY_LIVE` 是 arammayhem 完全没收录的（名字/图标取 Community Dragon，部分没有描述）。
  这两张表在 arammayhem 补齐后应删掉对应条目（脚本会提示）。
- **隐藏 legacy 兼容项**：`availability: "legacy"` 只用于解析旧官方路线/旧对局里引用的历史 ID，不展示给玩家选择；
  流派和组合里引用到的 legacy 海克斯在加载时会被过滤掉（`src/renderer/data.ts`）。
- **图标用 Riot 官方上色原图**：游戏文件里 `*_small.png` 是白图，`*_large.png` 是按稀有度上好色的图（海斗 kiwi 目录优先，
  其次竞技场 cherry 目录，技能类用分稀有度的通用图标），存到 `icons/augments/official/`。抓取时按颜色自动挑和海斗稀有度一致的那张
  （`scripts/lib/augment-icon-color.mjs`），不自己调色；官方没有彩图的暂用白色原图，抓取结束会列出来。
- **稀有度以 Riot 客户端数据为准**（`cherry-augments.json` 里 id ≥ 1000 的海斗条目），和 arammayhem 不一致时脚本会打印。
- **新海克斯的 id = Riot 运行时 id**（如 BEES!!! = 3086），对局记录可以直接对上；注意它们和装备 id 处于同一数值区间（如 3036），按名字批量改数据时别混。
- **图标 CDN 分支不同**：增强图标在 `.../latest/game/`，装备图标在 `.../latest/plugins/rcp-be-lol-game-data/global/default/`（图标与语言无关，始终 `default`）。
- **切语言**：改 `scripts/fetch-data.mjs` 顶部 `LANG`（`default`=英文 / `zh_cn` / `ko_kr` …）重跑 `npm run data:fetch` 即可，图标不用重下。
