# Claude Code — 架构总览

> 非官方 @anthropic-ai/claude-code v2.1.88 源码分析文档。
> 代码由 npm 包内 `cli.js.map` source map 提取而来，版权归 Anthropic 所有。

---

## 项目定位

Claude Code 是 Anthropic 官方的终端 AI 编程助手 CLI。用户在终端中与 Claude 对话，
Claude 可以读写文件、执行 Shell 命令、搜索代码库、管理 Git 工作流等。

---

## 整体数据流

```text
用户输入（终端 / API / 桥接）
         │
         ▼
    main.tsx  ── 初始化：鉴权 / MCP / MDM / 遥测
         │
         ▼
  commands.ts  ── 命令路由（slash commands / REPL 模式）
         │
         ▼
   query.ts / QueryEngine  ── 对话循环 + 工具调度
         │
    ┌────┴─────┐
    ▼          ▼
 tools/     services/   ── 工具执行 + Claude API / MCP
    │
    ▼
components/  ── React + Ink 渲染终端 UI
```

---

## 模块地图

| 路径                                | 职责                           | 详细文档                           |
| ----------------------------------- | ------------------------------ | ---------------------------------- |
| `src/main.tsx`                      | 应用入口、启动初始化、模式路由 | 本文                               |
| `src/QueryEngine.ts`                | 核心对话循环类                 | [query-engine.md](query-engine.md) |
| `src/query.ts`                      | 消息处理、流式响应             | [query-engine.md](query-engine.md) |
| `src/commands.ts` + `src/commands/` | CLI 命令注册与实现             | [commands.md](commands.md)         |
| `src/tools/` + `src/Tool.ts`        | 工具系统（45+ 工具）           | [tools.md](tools.md)               |
| `src/services/`                     | API / MCP / 分析等服务         | [services.md](services.md)         |
| `src/bridge/`                       | 远程桥接协议                   | [bridge.md](bridge.md)             |
| `src/components/` + `src/ink/`      | 终端 UI 组件                   | [ui.md](ui.md)                     |
| `src/Task.ts` + `src/tasks/`        | 任务类型与生命周期             | [tools.md](tools.md)               |

---

## 启动流程（main.tsx）

`main.tsx`（4683 行）是整个应用的引导层：

```text
进程启动
  │
  ├─ 并行预加载（减少感知延迟）
  │    ├─ keychain（鉴权令牌）
  │    ├─ MDM 托管配置
  │    └─ MCP 服务器资源
  │
  ├─ 初始化
  │    ├─ Commander.js 构建命令树
  │    ├─ 遥测（诊断追踪）
  │    ├─ GrowthBook 功能开关
  │    └─ 策略限制（policyLimits）
  │
  └─ 模式路由
       ├─ 标准 REPL          默认交互模式
       ├─ Bridge 模式        远程会话（BRIDGE_MODE）
       ├─ Coordinator 模式   多 Agent Swarm（COORDINATOR_MODE）
       └─ 助手模式           实验性主动助手（KAIROS flag）
```

---

## 运行模式对比

| 模式             | 触发方式                    | 适用场景                   |
| ---------------- | --------------------------- | -------------------------- |
| 标准 REPL        | 默认                        | 本地交互编程               |
| Bridge 模式      | `BRIDGE_MODE` 构建标志      | claude.ai 网页远程控制终端 |
| Coordinator 模式 | `COORDINATOR_MODE` 构建标志 | 多 Agent 并行任务编排      |
| 助手模式         | `KAIROS` 构建标志           | 实验性主动式助手           |

---

## 功能开关体系

**构建时（Bun `feature()` API）：**

- `KAIROS` — 主动式助手模式
- `COORDINATOR_MODE` — 多 Agent 协调
- `BRIDGE_MODE` — 远程桥接
- `PROACTIVE` — 主动功能模块
- `HISTORY_SNIP` — 对话历史片段压缩

**运行时：**

- `USER_TYPE === 'ant'` — Anthropic 内部专属功能
- GrowthBook 实验标志 — A/B 测试与灰度发布
- 环境变量（`isBareMode`、`isEnvTruthy` 等）

---

## 关键技术选型

| 决策     | 方案                          | 原因                                                                                                                 |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 终端 UI  | React + Ink                   | 组件化、状态管理成熟                                                                                                 |
| 打包工具 | Bun bundle                    | 支持 `feature()` 死代码消除                                                                                          |
| 类型系统 | TypeScript + Zod              | 运行时校验 + 编译期安全                                                                                              |
| 工具协议 | MCP（Model Context Protocol） | 标准化第三方扩展                                                                                                     |
| 延迟加载 | `require()` 懒加载            | 减少启动时间（**注意**：Bun bundler 会将 bundle 内模块的 `require()` 编译为 always-throw IIFE，必须改用静态 import） |
| 对话压缩 | autoCompact / snipCompact     | 长会话下控制 token 消耗                                                                                              |
| 权限检查 | `canUseTool` + PermissionMode | 防止未授权操作                                                                                                       |

---

## 踩坑记录

### Bun bundler：内部模块 `require()` 编译为 always-throw

**现象**：`cr7` 在终端无响应，启动后立即退出（exit 0），无任何报错输出。

**根因**：`src/services/api/client.ts` 的 `applyCustomModelProviderFromConfig()` 用 `require("../utils/config.js")` 懒加载 config 模块。Bun 打包时检测到该模块已 bundle 在内，将 `require()` 编译为：

```js
(() => {
  throw new Error("Cannot require module ../utils/config.js");
})();
```

函数内的 `try/catch {}` 静默吞掉了这个错误，导致：

1. `CLAUDE_CODE_USE_OPENAI` 未被设置 → 默认走 Anthropic 客户端
2. `hasCompletedOnboarding`/`theme` 未写入 config → 触发 Anthropic onboarding 流程

**修复**：

- 将 `require()` 改为顶层静态 `import { getGlobalConfig, saveGlobalConfig } from "../../utils/config.js"`
- catch 块中补设默认 env vars（`CLAUDE_CODE_USE_OPENAI=1`、`OPENAI_BASE_URL`、`CLAUDE_CODE_MODEL`）
- 新增 `applyConfigAfterInit()` 在 `init()`（即 `enableConfigs()` 之后）再次执行 theme/provider 修复

**结论**：Bun bundle 内的模块**不能**用 CommonJS `require()` 引用，必须用静态 import。
