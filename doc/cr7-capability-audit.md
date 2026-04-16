# cr7 能力评测：可用 vs 静默死亡

> 调查日期：2026-04-15
> 分析版本：claude-code v2.1.88 / cr7 fork

---

## 核心发现：`bun-bundle` stub

cr7 构建时（`build.ts:39`）用本地 stub 替换了 Bun 原生的 `bun:bundle` 模块：

```ts
"bun:bundle": resolve(STUBS, "bun-bundle.ts"),
```

stub 内容只有一行有效逻辑：

```ts
// src/stubs/bun-bundle.ts
export function feature(_flag: string): boolean {
  return false; // 所有 feature flag 硬编码为 false
}
```

**结论**：所有 `feature('XXX')` 调用在 cr7 构建产物中永远返回 `false`。受此影响的代码路径在运行时静默跳过，不报错、不提示，如同不存在。

另有 4 个 Anthropic 私有包被替换为空 stub：

| 私有包                       | Stub 位置                               |
| ---------------------------- | --------------------------------------- |
| `@ant/computer-use-mcp`      | `src/stubs/@ant/computer-use-mcp/`      |
| `@ant/claude-for-chrome-mcp` | `src/stubs/@ant/claude-for-chrome-mcp/` |
| `@ant/computer-use-swift`    | `src/stubs/@ant/computer-use-swift/`    |
| `@anthropic-ai/mcpb`         | `src/stubs/@anthropic-ai/mcpb/`         |

---

## GrowthBook runtime flag 的地位

GrowthBook（`@growthbook/growthbook`）是 external 依赖，正常加载运行。但它控制的是"第二层"门控（`tengu_*` flag），而 `feature()` 是"第一层"——代码根本没到达 GrowthBook 检查的分支。

环境变量 `CLAUDE_INTERNAL_FC_OVERRIDES` 可以覆盖 GrowthBook flag（JSON 格式），但对被 `feature()` 保护的路径无效。

---

## 能力状态全表

### ✅ 完整可用

| 功能                                    | 具体作用                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| **多 Provider 支持**                    | 接入阿里百炼(Qwen)、智谱(GLM)、DeepSeek、OpenAI、Ollama，cr7 核心改造 |
| **Bash Tool**                           | 执行终端命令                                                          |
| **Read / Write / Edit / Glob / Grep**   | 文件读写与搜索                                                        |
| **Agent Tool（子任务）**                | 启动子 Agent 处理子任务（协调模式被切断，见下）                       |
| **WebFetch / WebSearch**                | 抓取网页、搜索                                                        |
| **MCP Server 接入**                     | 连接外部 MCP server，动态加载工具                                     |
| **Skills 系统**                         | `.claude/skills/` 斜杠命令扩展                                        |
| **Hooks 系统**                          | PreToolUse / PostToolUse 等事件钩子                                   |
| **Session 保存/恢复**                   | 对话历史持久化，`/resume` 恢复历史 session                            |
| **Auto-compact**                        | 对话过长时自动压缩上下文（`/compact`）                                |
| **ReadToolDocsTool**                    | 按需加载工具文档，避免一次传入 40+ 工具 schema（cr7 自研）            |
| **SyntheticOutputTool**                 | 非交互模式下返回结构化 JSON 输出（SDK 场景）                          |
| **EnterPlanMode / ExitPlanMode**        | 进入/退出计划模式，防止 Claude 边想边改                               |
| **TaskCreate / TaskList / TaskGet**     | 当前 session 内的任务追踪系统                                         |
| **AskUserQuestion**                     | 向用户提问并等待输入                                                  |
| **`/model` 命令**                       | 交互式切换 provider 和 API Key                                        |
| **`/compact` `/clear` `/cost` `/help`** | 常规对话管理命令                                                      |
| **LSP 集成（初始化层）**                | LSP 管理器初始化 + 插件推荐弹窗（LSPTool 本身需 env var 激活）        |
| **Vim 模式**                            | 终端输入框 Vim 键位                                                   |
| **`CLAUDE_INTERNAL_FC_OVERRIDES`**      | 覆盖 GrowthBook runtime flag（对未被 `feature()` 保护的路径有效）     |

---

### ⚠️ 条件可用（需手动设置 env var）

| 功能                        | 激活方式                                     | 具体作用                                                     |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| **Bare 模式**               | `--bare` 或 `CLAUDE_CODE_SIMPLE=1`           | 禁用 hooks/MCP扫描/keychain/LSP 等约 30 个子系统，适合 CI/CD |
| **LSP Tool**                | `ENABLE_LSP_TOOL=1`                          | 调用 LSP 服务做跳转定义、查引用、获取诊断（代码智能）        |
| **VerifyPlanExecutionTool** | `CLAUDE_CODE_VERIFY_PLAN=true`               | 计划执行后触发后台验证，确认实现是否符合计划                 |
| **Bash cwd 隔离**           | `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` | 各 session 的 bash 工作目录独立，互不污染                    |

---

### 💀 静默死亡（`feature()` = false，代码存在但永不执行）

| 功能                                   | 死亡的 feature flag                                 | 具体作用                                                                                                                |
| -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Coordinator Mode（多 Agent 编排）**  | `COORDINATOR_MODE`                                  | 父 Claude 作为调度者，并行派发子 Agent 做研究/实现/验证，结果异步汇报；即使设置 `CLAUDE_CODE_COORDINATOR_MODE=1` 也无效 |
| **KAIROS（助手/守护模式）**            | `KAIROS`                                            | Claude 变成长驻后台的主动助手，可定时触发、接收外部事件、主动向用户发消息                                               |
| **Bridge（Web 远程控制）**             | `BRIDGE_MODE`                                       | claude.ai 网页端通过 WebSocket 远程控制本地终端，权限弹窗显示在网页                                                     |
| **BriefTool（主动摘要）**              | `KAIROS \| KAIROS_BRIEF`                            | KAIROS 模式下 Claude 主动发送进度摘要，替代被动等待                                                                     |
| **SleepTool（主动等待）**              | `PROACTIVE \| KAIROS`                               | Claude 主动暂停等待指定时间后继续执行，用于轮询/定时任务                                                                |
| **Auto-Dream（后台记忆整合）**         | `KAIROS_DREAM`（dream.ts 被 feature-gated require） | 每 24h / 5 个 session 后，后台自动整合对话记忆供未来 session 复用                                                       |
| **CronCreate / CronList / CronDelete** | `AGENT_TRIGGERS`                                    | 给 Claude 设定 cron 定时任务，到时间自动唤醒执行                                                                        |
| **RemoteTriggerTool**                  | `AGENT_TRIGGERS_REMOTE`                             | 从远端（webhook / 外部系统）触发本地 Claude Agent 执行任务                                                              |
| **SubscribePRTool**                    | `KAIROS_GITHUB_WEBHOOKS`                            | 订阅 GitHub PR 事件（review comment、CI 结果），事件到达时 Claude 自动响应                                              |
| **SendUserFileTool**                   | `KAIROS`                                            | KAIROS 模式下 Claude 主动向用户发送文件（产物、报告等）                                                                 |
| **PushNotificationTool**               | `KAIROS_PUSH_NOTIFICATION`                          | Claude 完成任务后推送系统通知，无需盯着终端                                                                             |
| **WebBrowserTool**                     | `WEB_BROWSER_TOOL`                                  | 原生内置浏览器自动化（非 MCP），截图、点击、填表                                                                        |
| **MonitorTool**                        | `MONITOR_TOOL`                                      | 监控进程/文件/接口，异常时触发 Claude 介入                                                                              |
| **WorkflowTool**                       | `WORKFLOW_SCRIPTS`                                  | 执行预定义 workflow 脚本，结构化多步骤自动化                                                                            |
| **SnipTool**                           | `HISTORY_SNIP`                                      | 裁剪对话历史特定片段，精细控制上下文窗口                                                                                |
| **ListPeersTool**                      | `UDS_INBOX`                                         | 列出当前运行的对等 Agent，用于 Agent 间通信                                                                             |
| **CtxInspectTool**                     | `CONTEXT_COLLAPSE`                                  | 检视上下文窗口内容分布，调试上下文管理策略                                                                              |
| **TerminalCaptureTool**                | `TERMINAL_PANEL`                                    | 捕获 IDE 终端面板输出，用于 IDE 深度集成                                                                                |
| **OverflowTestTool**                   | `OVERFLOW_TEST_TOOL`                                | 测试 token budget 溢出场景（Anthropic 内部压测）                                                                        |

---

### 🔧 硬性缺失（私有包 stub 为空，`feature()` 也为 false，双重封死）

| 功能                         | 缺失原因                                                                                           | 具体作用                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Computer Use（屏幕控制）** | `@ant/computer-use-mcp` + `@ant/computer-use-swift` stub 为空，且 `feature('CHICAGO_MCP')` = false | 控制鼠标键盘、截屏、操作桌面 GUI，Pro/Max 订阅功能 |
| **Chrome MCP**               | `@ant/claude-for-chrome-mcp` stub 为空                                                             | 在 Chrome 浏览器内执行操作                         |
| **Sandbox Runtime**          | `@anthropic-ai/sandbox-runtime` stub 为空                                                          | 隔离沙箱执行环境，代码安全运行                     |
| **内部 MCP 总线（MCPB）**    | `@anthropic-ai/mcpb` stub 为空                                                                     | Anthropic 内部 MCP 服务总线                        |

---

## 解锁路径

> **已落地进度**：见 [cr7-unlock.md](cr7-unlock.md)。当前 build 已启用 `AGENT_TRIGGERS`（CronCreate/List/Delete）和 `COORDINATOR_MODE`（多 Agent 编排，需 `CLAUDE_CODE_COORDINATOR_MODE=1`）。

若想在 cr7 中启用静默死亡的功能，唯一可行路径是修改 stub 让特定 flag 返回 `true`，然后重新构建：

```ts
// src/stubs/bun-bundle.ts — 按需开启
export function feature(flag: string): boolean {
  const enabled = new Set([
    "COORDINATOR_MODE",
    // 'KAIROS',
    // 'AGENT_TRIGGERS',
  ]);
  return enabled.has(flag);
}
```

```bash
bun run build.ts
```

注意：开启 `KAIROS` 还需要 `BRIDGE_MODE` 相关依赖，以及 GrowthBook 返回 `tengu_kairos = true`（可用 `CLAUDE_INTERNAL_FC_OVERRIDES` 覆盖）。私有包功能（Computer Use 等）即使开启 feature flag 也无法工作，因为 stub 是空实现。

---

## 总结

cr7 是一个**功能完整的编码助手**（工具调用、MCP、Session、Skills、Hooks 全齐），但 Anthropic 真正差异化的能力——多 Agent 并行编排、主动助手守护、Web 远程控制、定时任务、Computer Use——全部被 `feature()` stub 在编译期静默切断。用户毫无感知，代码就在那里，但永远不会运行。
