# GTA 6 中文全能助手

**Leonida Companion** · 少看攻略，多玩一会儿。

[打开网站](https://tanghaitian04-debug.github.io/gta6-chinese-companion/) · [数据审核](docs/DATA-AUDIT.md) · [作者与许可](docs/LICENSES.md) · [未核验清单](docs/PENDING.md) · [修改记录](CHANGELOG.md)

独立的 GTA VI 中文玩家工具。使用 Leaflet 虚构世界坐标、独立 JSON 数据目录与浏览器本地存档。中文地名和任务名为便于搜索的编辑译名，英文原名可用于对照游戏。来源、坐标精度和核验日期显示在各条目内。

## V2.0

原生瓦片、DPR 缩放上限、设施分类、字段核验和站内全文攻略已纳入主分支。详见[审核报告](docs/DATA-AUDIT.md)、[仍待核验的项目](docs/PENDING.md)与[版本日志](CHANGELOG.md)。

## 运行与检查

需要 Node.js 24 和 Git。构建脚本从固定 Git 提交取出 CC BY 4.0 的 Yanis v18 分级瓦片，保持发布瓦片的原始字节，另制封面和离线总览。首次构建需要 GitHub 访问权限。已有包含对应瓦片路径的本地 GTADB 检出目录时，可设置 `LEONIDA_GTADB_CHECKOUT` 指向该目录，构建会核对固定提交。

```bash
npm ci
npm run prepare:map
npm run dev
npm run typecheck
npm run lint
npm run data
npm run audit:links
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

本地 URL 为 Vite 打印的地址，路径为 `/gta6-chinese-companion/`。Pages 使用仓库子路径和哈希路由，打开分享地址或刷新地图详情均使用同一入口。迁移到另一个路径时可通过 `PAGES_BASE` 设置资源路径，包含首尾斜杠。浏览器自动化默认使用 Playwright Chromium，也支持通过 `PLAYWRIGHT_CHROMIUM_PATH` 使用已安装的 Chromium 或 Chrome。

## 编辑资料

- `src/data/places.json` 和 `src/data/facilities.json` 存放地图地点、设施分店、证据、坐标精度、寻找方法与关联资料。
- `src/data/entries.json` 存放任务、角色、载具、武器、收集品、秘籍、玩法和完成条件。
- `src/data/articles.json` 按稳定 ID 保存站内攻略与百科正文。每篇完整攻略经校验，包含开始、实机阶段、完成条件和奖励来源。
- `src/data/schema.ts` 定义 Zod 规范。ID 一经发布保持稳定，玩家存档用 ID 关联。字段未知时省略或写 `null`，由界面显示为待核实。
- `src/data/map.json` 固定底图尺寸、版本、坐标系和瓦片规格。地图位置需要来源，可按 [审核流程](docs/DATA-AUDIT.md) 复核。
- 导入候选资料前核验许可。对于以目录格式提供的新条目，可运行 `npm run data -- --candidate places /绝对路径/文件.json` 生成校验报告。通过后再逐项合入正式目录。
- 进度、笔记、收藏和独立的 100% 条件勾选均保存在当前浏览器。切换设备时导出 JSON 再恢复。

## Pages

仓库的 Settings → Pages 选择 GitHub Actions。工作流对主分支运行依赖安装、类型、lint、数据、单元测试、构建、Playwright 验证与 Pages 发布。工作流同时保存 V1/V2 截图、DPR 采样及外部链接审计；部署后验证首页、地图总览和 manifest 的 HTTP 响应。

Rockstar Games 与 Take-Two Interactive 拥有 GTA VI 品牌及其官方游戏素材。本工具为独立玩家项目。
