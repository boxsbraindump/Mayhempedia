# 海克斯大乱斗 Overlay — ARAM Champ-Select Copilot

英雄联盟「海克斯大乱斗 / ARAM: Mayhem」的桌面 overlay。专攻选人/换将那 12 秒的决策。
设计文档见 [BRAINSTORM.md](./BRAINSTORM.md)。

## 当前进度：Electron 主窗口 + LCU 打通

只用官方/容忍的**只读**接口（LCU API），不读内存、不自动操作。

### 运行

```bash
npm install
npm start        # = tsc 编译主进程 + vite build 渲染层 + electron 启动
```

然后：
1. 会弹出一个 **Mayhempedia** 窗口（首页/英雄/海克斯一览/自动化设置都能点）。
2. 打开英雄联盟**客户端**（程序会等它，侧栏底部会显示"连接客户端中… → 已连接客户端"）。
3. 进入一局**大乱斗**选人阶段，页面顶部应弹出"选人阶段检测到 XX，点击查看流派 →"的提示条。

> ⚠️ 需要本机装有英雄联盟客户端才能实测真实连接效果。日常开发调 UI 建议还是走浏览器预览（`npm run dev`），更快。

## 技术栈

- **Electron + TypeScript**（ESM）
- **[league-connect](https://github.com/supergrecko/league-connect)** — 自动读 lockfile、连 LCU REST + WebSocket
- **Community Dragon** — 英雄静态数据（championId → 名字）

## 路线图

- [x] M1 连 LCU → 打印选人板凳
- [ ] M2 透明置顶 + 点击穿透 overlay 窗口
- [ ] M3 选人阶段渲染板凳 + ARAM 平衡数值徽章
- [ ] 二期：海克斯增强推荐
- [ ] 三期：对局内 HUD
