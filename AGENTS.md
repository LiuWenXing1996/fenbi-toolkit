# AGENTS.md

面向 AI 协作的项目说明。开始改动前先读本文件，保持与既有架构与约定一致。

## 项目是什么

「粉笔综合工具」是一个油猴（Tampermonkey）用户脚本：在 fenbi.com / fenbike.cn 页面上提供「获取题目 ID」「获取课程信息」面板。核心特性是**接口旁路捕获**——只读监听页面自身的 fetch/XHR 响应并展示，脚本不主动发起任何网络请求。

## 硬性红线

- **零新增请求**：不允许主动调用任何接口。数据只能来自旁路捕获缓存或页面内存扫描。改动时不得破坏这条约束。
- **产物始终是单文件**：`npm run build` 产出 `dist/fenbi-question-id.user.js`，用户直接安装该文件。不要在产物之外引入需托管的资源。

## 提交红线（AI 必守）

任何 `git commit` 前必须先按 `COMMITTING.md` 执行敏感信息检查，未通过禁止提交。核心要点：拦截凭据（token / cookie / 私钥等）与个人数据（手机号 / 邮箱 / 身份证 / 学员隐私）；抓包样例中的持久标识（如 `deviceId`）一律打码为占位符再入库；时间戳、`materialIdBinary`、哈希文件名等属已知误报不要拦。提交信息遵循 `COMMITTING.md` 第二部分的规范：中文 + Conventional Commits 前缀（`feat`/`fix`/`refactor`/`docs`/`chore` 等），如 `docs: 补充提交规则`。

## 常用命令

```bash
npm install        # 首次安装依赖
npm run build      # 构建 → dist/fenbi-question-id.user.js
npm run dev        # 开发模式（热更，产物供 Tampermonkey @require 调试）
npm run typecheck  # tsc --noEmit
```

UserScript 元数据（match / grant / run-at / version）在 `vite.config.ts` 集中维护；version 同时存在于 `package.json`。

## 目录导览

```text
src/
├── index.ts            # 入口：安装捕获 hook（document-start）+ DOMContentLoaded 建面板
├── capture/            # 网络旁路捕获层（唯一触碰 unsafeWindow 的副作用代码）
│   ├── urls.ts         #   接口 URL 匹配（/solution /exercise /detail_for_sale /episode_nodes）
│   ├── quiz.ts         #   题目接口捕获 + 最新命中查找
│   ├── course.ts       #   课程接口捕获（URL 解析 courseId / episode_set_id）
│   └── install.ts      #   fetch / XHR hook（只 patch 一次，__fenbiQuizHookInstalled 防重）
├── store/              # 共享状态（收敛原单文件的全局缓存）
│   ├── quiz.ts         #   quizApiCaptures 缓存 + 当前展示数据 quizState + 数据类型
│   └── course.ts       #   courseByCourseId / courseLastId
├── parse/              # 纯函数：接口响应 → 展示数据结构（可单测，勿引入 DOM）
├── core/               # 纯工具：log / utils(escapeHtml) / copy / finder / format
├── ui/
│   ├── panel.ts        #   面板骨架 + 可拖拽折叠圆球（模块顶层 GM_addStyle 注入样式）
│   ├── collapsible.ts  #   折叠区块通用绑定
│   └── style.css       #   面板全部样式（?inline 导入，行为等价于原 GM_addStyle 字符串）
└── features/           # 两大功能链路（自包含，避免 ui ⇄ logic 循环依赖）
    ├── quizPanel.ts    #   获取题目 ID：渲染 / 复制 / 生成提示词 / 内存扫描
    └── coursePanel.ts  #   获取课程信息：视图组装 / 渲染 / 导出 / 捕获后自动刷新
```

依赖方向约束：`index → capture / ui`；`capture/quiz|course → store`；`features → store/parse/core`。`capture/course.ts → features/coursePanel`（单向，用于捕获后触发面板刷新）。不要在 `parse` / `core` 里引入 DOM。

## 领域关键事实（踩坑点）

- 接口里 **`id` 是 number，`globalId` 是 string**（形如 `3_1_buiib`）。关联关系（card 树）用的是 globalId。类型定义见 `src/store/quiz.ts`，修改时以 `samples/solution/`、`samples/exercise/` 等目录下的抓包样例为准。
- 题目接口：`/solution` 响应字段 `solutions`；`/exercise` 响应字段 `questions`。统一由 `parse/quiz.ts` 归一化。
- `card.children` 树中 `nodeType === 2` 的叶子节点是一道题：`key` 为题的 globalId，`materialKeys` 是其关联材料。
- 课程接口：`/detail_for_sale`（课程详情）、`/episode_nodes`（无 `episode_set_id` 参数时为分组列表，带该参数时为某分组课时列表）。URL 形如 `/lectures/{courseId}/...`。
- 内存扫描兜底策略：遍历页面全局变量，关键词优先级排序 + 1.5s 超时 + 深度 5 + 对象数上限 + 循环引用保护（`core/finder.ts`）。
- 排除项（别再去接口响应里找）：题目接口响应体中**不存在** `checkId`、`examcatid` 字段；`examcatid`（如 1000183）仅作为请求 URL 参数出现。

## 编码约定

- **行为等价优先**：本项目刚从单文件等价拆分为模块。改动功能时保持展示与数据行为稳定；大规模重构前先确认可回归。
- 状态收敛于 `store/`；不要在功能模块里另起全局缓存。
- 渲染沿用 `innerHTML` 模板 + `data-*` 属性 + 事件绑定（当前形态；UI 框架化是未来的事，别在局部引入不一致风格）。
- 样式注入时序：`panel.ts` 模块顶层执行 `GM_addStyle(cssText)`（对应原脚本 document-start 注入），不要挪进 `createPanel`。
- 复制走 `core/copy.ts` 的 `copyToClipboard`（GM_setClipboard 优先，降级 navigator.clipboard）。
- `tsconfig.json` 当前为宽松模式（`strict: false`）；类型补全与开启 strict 属于进行中的增强项，不要私自切换。

## 抓包样例目录（勿删除）

`samples/` 下按接口存放抓包样例（`detail_for_sale`、`episode_nodes`、`exercise`、`solution`，各含 `res.json` + `url.txt`），用于理解接口结构与回归验证，不是运行产物。

## 里程碑与演进

- 已完成：v3.17.2 单文件 → Vite + TS 多模块工程化（等价拆分），浏览器冒烟测试通过；原单文件归档在 `legacy/fenbi-question-id.user.js.v3.17.2.bak`。
- 候选增强（未开始）：纯逻辑单测（parse/core）、接口响应类型补全 + 开启 strict、git 版本管理、开发期热更联调。
