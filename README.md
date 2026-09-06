# 粉笔综合工具（油猴脚本）

在粉笔网（fenbi.com / fenbike.cn）页面上提供「获取题目 ID」「获取课程信息」的辅助面板。数据全部来自**接口旁路捕获**——只读监听页面自身的 fetch/XHR 响应，脚本**不主动发起任何网络请求**（零新增请求）。

- 当前版本：v3.17.2
- 适用站点：`*://*.fenbi.com/*`、`*://*.fenbike.cn/*`
- 运行环境：Tampermonkey 等支持 `GM_setClipboard` / `GM_addStyle` / `unsafeWindow` 的脚本管理器

## 功能特性

- **获取题目 ID**：读取页面已触发的题目接口（`/solution`、`/exercise`）响应或扫描页面内存，展示题目 ID、globalId、材料 ID、知识点，并自动还原「材料 ⇄ 题目」关联关系
- **多格式复制**：逗号 / 换行 / 空格 / JS 数组 / globalId / 两列（ID+材料ID）/ ID+知识点
- **生成粉笔 AI 提示词**：一键复制「题目 ID + 材料关联」提示词，用于向 AI 生成乱序练习
- **获取课程信息**：读取课程详情（`/detail_for_sale`）与课时分组接口（`/episode_nodes`），展示课程名、分组结构、课时清单与时长，支持导出 JSON / 文本树 / 单组标题列表
- **可拖拽悬浮面板**：默认收起为右下角圆球，支持拖拽定位、点击展开、分区折叠

## 安装

### 方式一：直接安装构建产物（推荐）

1. 使用 [`dist/fenbi-question-id.user.js`](dist/fenbi-question-id.user.js) 文件
2. Tampermonkey 仪表盘 → 「实用工具」→ 「导入」，选择该文件（或直接拖入浏览器窗口），确认安装

### 方式二：源码构建

```bash
npm install
npm run build      # 产物输出到 dist/fenbi-question-id.user.js
```

将 `dist/fenbi-question-id.user.js` 按方式一安装即可。

## 使用说明

1. 打开任意粉笔网页面，右下角出现可拖拽的悬浮圆球，点击展开面板。
2. **获取题目 ID**：先在练习/刷题页正常操作一次（打开或切换题目、刷新页面）以触发接口请求，再点击「获取题目 ID」。面板会优先读取旁路捕获的响应；无捕获时自动回退到页面内存扫描。
3. **获取课程信息**：在课程页打开目录并逐组点开以触发请求，再点击「获取课程信息」；后续捕获到新的课时响应时，展开的面板会自动刷新。
4. 脚本不会在你点击之外主动请求任何数据，卸载即完全失效。

## 开发者指南

技术栈：Vite + TypeScript + [vite-plugin-monkey](https://www.npmjs.com/package/vite-plugin-monkey)（构建产物仍为可直接安装的单文件 `.user.js`）。

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（热更）
npm run build      # 构建 → dist/fenbi-question-id.user.js
npm run typecheck  # tsc --noEmit 类型检查
```

源码结构（UserScript 元数据集中在 `vite.config.ts`）：

```text
src/
├── index.ts            # 入口：安装旁路捕获 + 创建面板
├── capture/            # fetch / XHR 旁路捕获（唯一接触 unsafeWindow 的代码）
├── store/              # 共享状态与数据类型
├── parse/              # 接口响应 → 展示数据（纯函数）
├── core/               # 日志 / 复制 / 扫描 / 格式化等纯工具
├── ui/                 # 面板骨架、折叠逻辑与样式
└── features/           # 「题目 ID」「课程信息」两个功能链路
```

两点红线请务必遵守：**脚本零新增请求**；**产物始终是单文件**。详细的架构约定与领域事实（接口结构、`id`/`globalId` 类型等）见 [AGENTS.md](AGENTS.md)；`samples/` 目录下按接口存放抓包样例数据（`res.json` + `url.txt`），用于理解接口结构与回归验证。

## 版本记录

- **v3.17.2**：工程化改造（单文件等价拆分为 Vite + TS 多模块），浏览器冒烟测试通过；原单文件归档于 `legacy/fenbi-question-id.user.js.v3.17.2.bak`，功能行为与此前版本一致。
