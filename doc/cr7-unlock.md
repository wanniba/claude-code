# cr7 静默死亡功能解锁计划

> 起始日期：2026-04-16
> 配套文档：[cr7-capability-audit.md](cr7-capability-audit.md)

## 取舍原则

cr7 的 `src/stubs/bun-bundle.ts` 把所有 `feature(flag)` 硬编码为 `false`，导致一批用 `feature()` 守卫的能力静默死亡。复活的可行性分三档：

1. **源码完整 + 依赖本地** → 翻 flag 即生效
2. **源码完整 + 依赖 Anthropic 服务端**（claude.ai OAuth、KAIROS 后端、Bridge 撮合）→ flag 翻了也跑不通，cr7 多 provider 场景下没意义
3. **`require()` 路径在 cr7 源里不存在**（SnipTool / CtxInspectTool / MonitorTool 等 11 个）→ 翻 flag 会触发 `Cannot find module`，必须先把官方实现搬回来

本轮只做第 1 档。第 3 档需要从官方 npm 产物反向搬运代码，留作后续；第 2 档放弃。

## 本轮启用范围

| Flag               | 解锁能力                                                     | 复活原因                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENT_TRIGGERS`   | CronCreate / CronList / CronDelete                           | `utils/cronScheduler.ts` `utils/cronJitterConfig.ts` `utils/cronTasks.ts` `tools/ScheduleCronTool/{Create,List,Delete}Tool.ts` `prompt.ts` `UI.tsx` 全在；纯本地 cron，写 `.claude/scheduled_tasks.json` |
| `COORDINATOR_MODE` | 多 Agent 编排（父 Claude 调度子 Agent 并行做研究/实现/验证） | `coordinator/coordinatorMode.ts` 完整；依赖的 TeamCreate / TeamDelete / SendMessage / SyntheticOutput 工具目录都在；运行时还需 `CLAUDE_CODE_COORDINATOR_MODE=1` 环境变量                                 |

## 主动放弃

| Flag                    | 拒绝理由                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AGENT_TRIGGERS_REMOTE` | `RemoteTriggerTool.ts` 调 `getClaudeAIOAuthTokens()` + `getOrganizationUUID()`；cr7 用户多用 Qwen/GLM/DeepSeek API Key，没有 claude.ai OAuth token，开了永远 401         |
| `KAIROS` 系列           | `main.tsx:142-147` 引 `assistant/index.js`、`assistant/gate.js`，但 `src/assistant/` 只有 `AssistantSessionChooser.tsx` + `sessionHistory.ts`，主 runtime 缺失，开了即崩 |
| `BRIDGE_MODE`           | 客户端代码完整（`src/bridge/` 30+ 文件），但需要 claude.ai 配对端点和 JWT 颁发服务，自建无意义                                                                           |
| 其余 11 个第 3 档 flag  | `require("./tools/<Name>/<Name>.js")` 路径在 cr7 源里不存在，需要补实现                                                                                                  |

## 进度

- [x] 2026-04-16 完成依赖核查（cron 模块齐 / coordinator 完整 / RemoteTrigger 强依赖 claude.ai OAuth）
- [x] 2026-04-16 修改 `src/stubs/bun-bundle.ts` 启用 `AGENT_TRIGGERS` + `COORDINATOR_MODE`
- [x] 2026-04-16 `bun run build.ts` 通过
- [x] 2026-04-16 验证产物：cron 三件套和 coordinator 模块在 bundle 里被引用，未被 dead-code 消除
- [x] 2026-04-16 调查官方 npm 产物（v2.1.110）第 3 档工具可搬运性 → 结论见下方

## 第 3 档工具：npm 产物调查（2026-04-16）

对官方 `@anthropic-ai/claude-code@2.1.110` npm 包（`cli.js`，17634 行 minified）做了逐工具排查。Anthropic 自己的 Bun 构建也做 dead-code elimination：`feature('X')` 在 **编译期** 求值，为 false 的分支整体删除——不是所有 flag-gated 工具都存在于 npm 产物中。

### npm 产物里存活的工具

| 工具                     | Flag                       | 证据                                                                                                           | 可搬运性                                                                               |
| ------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **MonitorTool**          | `MONITOR_TOOL`             | 完整实现（schema + handler + UI），searchHint `"stream events from a background script as live notifications"` | ⚠️ 可逆向但 minified，且依赖 task 系统内部接口（`TM6`/`Od8` 等混淆符号），适配成本中等 |
| **PushNotificationTool** | `KAIROS_PUSH_NOTIFICATION` | searchHint `"send a notification to the user via terminal and optionally mobile"`                              | ⚠️ 同上                                                                                |

### npm 产物里被 DCE 消除的工具（不可搬运）

| 工具                    | Flag                 | 结论                                                      |
| ----------------------- | -------------------- | --------------------------------------------------------- |
| **SnipTool**            | `HISTORY_SNIP`       | ❌ 官方 build 也关了此 flag，编译期删除，npm 里无任何痕迹 |
| **CtxInspectTool**      | `CONTEXT_COLLAPSE`   | ❌ 同上                                                   |
| **WorkflowTool**        | `WORKFLOW_SCRIPTS`   | ❌ 仅 `WorkflowTask` 一处残留引用，主实现被删             |
| **WebBrowserTool**      | `WEB_BROWSER_TOOL`   | ❌ 同上                                                   |
| **ListPeersTool**       | `UDS_INBOX`          | ❌ 同上                                                   |
| **TerminalCaptureTool** | `TERMINAL_PANEL`     | ❌ 同上                                                   |
| **OverflowTestTool**    | `OVERFLOW_TEST_TOOL` | ❌ 同上                                                   |

### 结论

- **SnipTool / CtxInspectTool / WorkflowTool** 从 npm 搬运的路径 **不可行**，Anthropic 自己的 public build 也没编译进去
- 若要实现，只能根据 cr7 源中的调用点（`query.ts` / `tools.ts` 里的 import 和调用签名）推断接口契约，**自己重写**
- MonitorTool / PushNotificationTool 理论上可从 minified 代码逆向，但性价比不高（混淆符号多、依赖 task 系统内部接口）

## 验证方法

启用后跑：

```bash
bun run build.ts
# 看日志中是否报 Cannot find module
node dist/cli.js   # 或 cr7 入口
# 在交互模式下让模型调 CronCreate（"every 5 minutes ping me"）
# 检查 .claude/scheduled_tasks.json 是否生成
# 设 CLAUDE_CODE_COORDINATOR_MODE=1 重启，观察是否进入 coordinator 模式
```

## 回滚

恢复 `src/stubs/bun-bundle.ts` 到 `enabled = new Set()`（或全删 set 让 `return false`），重 build。
