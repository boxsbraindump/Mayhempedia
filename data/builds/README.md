# 流派数据（人工 curate）

每个英雄一个文件 `data/builds/{英雄}.json`。这是 overlay 的"内容"——主页展示它、局内 overlay 复用它。

## 结构

```jsonc
{
  "championId": 145,          // 英雄 id（LCU 识别到的就是这个，用来自动匹配）
  "championName": "卡莎",
  "archetypes": [             // 一个英雄多个流派（AP/AD/…）
    {
      "key": "ap",            // 流派内部 key（英文，稳定）
      "name": "AP卡莎",        // 展示名
      "damageType": "AP",     // AP | AD | 混伤 | 坦克 …（用于标签/图标）
      "note": "",             // 可选：一句话玩法提示
      "augments": {           // 海克斯增强，按"定性分级"（不放胜率，合规）
        "core": [ ... ],      // 核心：三选一里出现就框住/首选
        "good": [ ... ],      // 备选：不错的选择
        "trap": [ ... ]       // 陷阱：这个流派要避开的
      },
      "items": [ ... ],       // 推荐装备，按出装顺序
      "runes": null           // 符文（待补）
    }
  ]
}
```

## 引用格式

**增强**（`augments.core/good/trap` 数组元素）：
```json
{ "id": 29, "apiName": "EtherealWeapon", "name": "虚幻武器" }
```
- `id` / `apiName` = 在 `augments.json` 里的键；`apiName` 也是图标文件名 & 未来 CV 匹配用的稳定标识。
- `name` = 给人看的（图标/介绍运行时按 id 从 `augments.json` 取，不在这里重复）。

**装备**（`items` 数组元素，按出装顺序）：
```json
{ "id": 3115, "name": "纳什之牙" }
```
- `id` = 在 `items.json` 里的键（图标 = `icons/items/{id}.png`）。

## 校验

改完跑一次，确认引用的 id 都存在、名字没写错（会对照主数据）：
```bash
npm run validate
```

## curate 流程

用户给中文名 → 用脚本/查表把名字解析成 `{id, apiName, name}` → 填进对应英雄文件 → `npm run validate` 兜底。
先覆盖自己常玩的英雄，逐步扩。
