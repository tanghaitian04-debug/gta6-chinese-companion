# GTA 6 中文全能助手

**Leonida Companion** · 少看攻略，多玩一会儿。

[打开网站](https://tanghaitian04-debug.github.io/gta6-chinese-companion/) · [数据审核](docs/DATA-AUDIT.md) · [作者与许可](docs/LICENSES.md) · [未核验清单](docs/PENDING.md) · [修改记录](CHANGELOG.md)

独立的 GTA VI 中文玩家工具。使用 Leaflet 虚构世界坐标、独立 JSON 数据目录与浏览器本地存档。中文地名和任务名为便于搜索的编辑译名，英文原名可用于对照游戏。来源、坐标精度和核验日期显示在各条目内。

## 运行与检查

需要 Node.js 24 和 Git。构建脚本下载已固定版本并校验的 CC BY 4.0 社区地图，再本地生成多级瓦片。首次构建需要访问 GitHub。地图源文件已在本地时，可设置 `LEONIDA_MAP_SOURCE` 指向同一 SHA 对应的原始 WebP。

```bash
npm ci
npm run prepare:map
npm run dev
npm run typecheck
npm run lint
npm run data
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

本地 URL 为 Vite 打印的地址，路径为 `/gta6-chinese-companion/`。Pages 使用仓库子路径和哈希路由，打开分享地址或刷新地图详情均使用同一入口。迁移到另一个路径时可通过 `PAGES_BASE` 设置资源路径，包含首尾斜杠。浏览器自动化默认使用 Playwright Chromium，也支持通过 `PLAYWRIGHT_CHROMIUM_PATH` 使用已安装的 Chromium 或 Chrome。

## 编辑资料

- `src/data/places.json` 存放地图地点、游戏内证据、坐标精度、寻找方法与关联资料。
- `src/data/entries.json` 存放任务、角色、载具、武器、秘籍、玩法和游戏内完成条件。
- `src/data/schema.ts` 定义 Zod 规范。ID 一经发布保持稳定，玩家存档用 ID 关联。字段未知时省略或写 `null`，由界面显示为待核实。
- `src/data/map.json` 固定底图尺寸、版本、坐标系和瓦片规格。地图位置需要来源，可按 [审核流程](docs/DATA-AUDIT.md) 复核。
- 导入候选资料前核验许可。对于以目录格式提供的新条目，可运行 `npm run data -- --candidate places /绝对路径/文件.json` 生成校验报告。通过后再逐项合入正式目录。
- 进度、笔记、收藏和独立的 100% 条件勾选均保存在当前浏览器。切换设备时导出 JSON 再恢复。

## Pages

仓库的 Settings → Pages 选择 GitHub Actions。工作流对主分支运行依赖安装、类型、lint、数据、单元测试、构建、Playwright 验证与 Pages 发布。部署后同时验证首页、地图总览和 manifest 的 HTTP 响应。

Rockstar Games 与 Take-Two Interactive 拥有 GTA VI 品牌及其官方游戏素材。本工具为独立玩家项目。
